import { HttpException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { mergeCarts } from "../domain/cart";
import type { BrandId, CartLine } from "../domain/types";
import { PrismaService } from "../prisma.service";
import { validateAddress, type AddressInput } from "./address";
import { AuthService } from "./auth.service";
import { CatalogService } from "./catalog.service";
import { decryptField, encryptField } from "./field-crypto";

@Injectable()
export class AccountApi {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
  ) {}

  async merge(authorization: string | undefined, body: { brand?: BrandId; account?: CartLine[]; guest?: CartLine[]; perLineCap?: number }) {
    await this.auth.customerId(authorization);
    const brand: BrandId = body.brand === "halimun" ? "halimun" : "sambung";
    return mergeCarts(this.catalog.snapshot(brand), asLines(body.account), asLines(body.guest), 99);
  }

  async listWishlist(authorization: string | undefined) {
    const customerId = await this.auth.customerId(authorization);
    return this.prisma.wishlistItem.findMany({ where: { customerId } });
  }

  async addWishlist(authorization: string | undefined, productId: string) {
    const customerId = await this.auth.customerId(authorization);
    const known = (["sambung", "halimun"] as const).some((brand) =>
      this.catalog.snapshot(brand).products.some((product) => product.id === productId),
    );
    if (!known) throw new HttpException({ code: "NOT_FOUND", message: "Produk tidak ditemukan." }, 404);
    return this.prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId, productId } },
      update: {},
      create: { customerId, productId },
    });
  }

  async addAddress(authorization: string | undefined, input: Partial<AddressInput>) {
    const customerId = await this.auth.customerId(authorization);
    const parsed = validateAddress(input);
    if (!parsed.ok) throw new HttpException({ code: "VALIDATION", message: parsed.message }, 422);
    const secret = process.env.ADDRESS_ENCRYPTION_KEY?.trim();
    if (!secret) throw new HttpException({ code: "INTERNAL", message: "Penyimpanan alamat belum dikonfigurasi." }, 500);
    const saved = await this.prisma.addressRecord.create({
      data: {
        customerId,
        ...parsed.value,
        phone: encryptField(parsed.value.phone, secret),
        detail: encryptField(parsed.value.detail, secret),
      },
    });
    return { ...saved, phone: decryptField(saved.phone, secret), detail: decryptField(saved.detail, secret) };
  }

  async listAddresses(authorization: string | undefined) {
    const customerId = await this.auth.customerId(authorization);
    const secret = this.addressKey();
    const rows = await this.prisma.addressRecord.findMany({ where: { customerId } });
    return rows.map((row) => ({ ...row, phone: decryptField(row.phone, secret), detail: decryptField(row.detail, secret) }));
  }

  async updateAddress(authorization: string | undefined, id: string, input: Partial<AddressInput>) {
    const customerId = await this.auth.customerId(authorization);
    const existing = await this.prisma.addressRecord.findUnique({ where: { id } });
    if (!existing || existing.customerId !== customerId) throw new HttpException({ code: "NOT_FOUND", message: "Alamat tidak ditemukan." }, 404);
    const parsed = validateAddress(input);
    if (!parsed.ok) throw new HttpException({ code: "VALIDATION", message: parsed.message }, 422);
    const secret = this.addressKey();
    const saved = await this.prisma.addressRecord.update({
      where: { id },
      data: { ...parsed.value, phone: encryptField(parsed.value.phone, secret), detail: encryptField(parsed.value.detail, secret) },
    });
    return { ...saved, phone: parsed.value.phone, detail: parsed.value.detail };
  }

  async deleteAddress(authorization: string | undefined, id: string) {
    const customerId = await this.auth.customerId(authorization);
    const existing = await this.prisma.addressRecord.findUnique({ where: { id } });
    if (!existing || existing.customerId !== customerId) throw new HttpException({ code: "NOT_FOUND", message: "Alamat tidak ditemukan." }, 404);
    await this.prisma.addressRecord.delete({ where: { id } });
    return { deleted: true };
  }

  async removeWishlist(authorization: string | undefined, productId: string) {
    const customerId = await this.auth.customerId(authorization);
    await this.prisma.wishlistItem.deleteMany({ where: { customerId, productId } });
    return { deleted: true };
  }

  async cart(authorization: string | undefined, brand?: string) {
    const customerId = await this.auth.customerId(authorization);
    const id = `${customerId}:${brand === "halimun" ? "halimun" : "sambung"}`;
    const row = await this.prisma.savedCart.findUnique({ where: { id } });
    return { lines: (row?.lines as { sku: string; qty: number }[]) ?? [] };
  }

  async saveCart(authorization: string | undefined, body: { brand?: "halimun" | "sambung"; lines?: { sku: string; qty: number }[] }) {
    const customerId = await this.auth.customerId(authorization);
    const brand = body.brand === "halimun" ? "halimun" : "sambung";
    const lines = asLines(body.lines) as unknown as Prisma.InputJsonValue;
    const id = `${customerId}:${brand}`;
    await this.prisma.savedCart.upsert({
      where: { id },
      update: { lines },
      create: { id, customerId, brand, lines },
    });
    return { lines: lines as unknown as { sku: string; qty: number }[] };
  }

  async consents(authorization: string | undefined) {
    const customerId = await this.auth.customerId(authorization);
    const events = await this.prisma.consentEvent.findMany({ where: { customerId }, orderBy: { at: "desc" } });
    const latest = new Map<string, { granted: boolean; changedAt: string; source: string }>();
    for (const event of events) {
      if (!latest.has(event.key)) latest.set(event.key, { granted: event.granted, changedAt: event.at, source: event.source });
    }
    return Object.fromEntries(latest);
  }

  async updateConsents(authorization: string | undefined, changes: Record<string, boolean>) {
    const customerId = await this.auth.customerId(authorization);
    const allowed = ["emailPromo", "waOrderInfo", "personalised"];
    const at = new Date().toISOString();
    for (const [key, granted] of Object.entries(changes)) {
      if (!allowed.includes(key) || typeof granted !== "boolean") {
        throw new HttpException({ code: "VALIDATION", message: "Kunci persetujuan tidak dikenal." }, 422);
      }
      await this.prisma.consentEvent.create({ data: { customerId, key, granted, at, source: "Pelanggan" } });
    }
    return this.consents(authorization);
  }

  async listPages() {
    return this.prisma.contentPage.findMany({ where: { status: "published" } });
  }

  async page(slug: string) {
    const page = await this.prisma.contentPage.findUnique({ where: { slug } });
    if (!page || page.status !== "published") throw new HttpException({ code: "NOT_FOUND", message: "Halaman tidak ditemukan." }, 404);
    return page;
  }

  private addressKey(): string {
    const secret = process.env.ADDRESS_ENCRYPTION_KEY?.trim();
    if (!secret) throw new HttpException({ code: "INTERNAL", message: "Penyimpanan alamat belum dikonfigurasi." }, 500);
    return secret;
  }
}

function asLines(input: unknown): CartLine[] {
  if (!Array.isArray(input)) return [];
  return input.map((line) => {
    const sku = (line as { sku?: unknown })?.sku;
    const qty = (line as { qty?: unknown })?.qty;
    if (typeof sku !== "string" || !Number.isInteger(qty) || (qty as number) < 1) {
      throw new HttpException({ code: "VALIDATION", message: "Jumlah barang harus bilangan bulat." }, 422);
    }
    return { sku, qty: qty as number };
  });
}
