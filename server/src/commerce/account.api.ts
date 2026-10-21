import { HttpException, Injectable } from "@nestjs/common";
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
