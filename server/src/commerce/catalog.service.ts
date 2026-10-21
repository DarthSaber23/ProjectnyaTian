import { Injectable, OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { buildCatalog, type Catalog } from "../domain/catalog";
import { computeTotals } from "../domain/pricing";
import { available } from "../domain/stock";
import { isWithin, toWibIso } from "../domain/time";
import type { BrandId, Product, Promotion, ShippingQuote, Totals } from "../domain/types";
import { categories, products, promotions, shippingQuotes } from "../data/fixtures";
import { toStorefrontQuotes } from "./kiriminaja";
import { PrismaService } from "../prisma.service";

export interface PriceRequest {
  brand?: BrandId;
  lines?: { sku: string; qty: number }[];
  orderVoucher?: string;
  shippingVoucher?: string;
  courierId?: string;
  now?: string;
}

@Injectable()
export class CatalogService implements OnModuleInit {
  private catalogs = new Map<BrandId, Catalog>();
  private promos = new Map<BrandId, Promotion[]>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if ((await this.prisma.variant.count()) === 0) await this.seed();
    await this.reload();
  }

  async reload(): Promise<void> {
    await this.refresh();
  }

  snapshot(brand: BrandId): Catalog {
    return this.requireCatalog(brand);
  }

  promotionsFor(brand: BrandId): Promotion[] {
    return this.requirePromos(brand);
  }

  list(brand: BrandId): { brand: BrandId; products: Array<Product & { variants: Array<Product["variants"][number] & { available: number }> }> } {
    const catalog = this.requireCatalog(brand);
    return {
      brand,
      products: catalog.products.filter((p) => p.brand === brand).map((p) => ({
        ...p,
        variants: p.variants.map((v) => ({ ...v, available: available(catalog, v.sku) })),
      })),
    };
  }

  bySlug(slug: string) {
    for (const brand of ["sambung", "halimun"] as const) {
      const product = this.list(brand).products.find((item) => item.slug === slug);
      if (product) return { brand, product };
    }
    return undefined;
  }

  /** Price and gift promotions only. Voucher codes stay off this public list. */
  activePromotions(brand: BrandId, now = toWibIso(new Date())): Promotion[] {
    return this.requirePromos(brand).filter(
      (p) => (p.kind === "price" || p.kind === "gift") && isWithin(now, "window" in p ? p.window : undefined),
    );
  }

  quotes(): ShippingQuote[] {
    return toStorefrontQuotes();
  }

  price(body: PriceRequest): Totals & { totalDisplay: string } {
    const brand: BrandId = body.brand === "halimun" ? "halimun" : "sambung";
    const lines = body.lines ?? [];
    if (lines.length === 0) {
      throw new RangeError("Keranjang kosong.");
    }
    let shippingCost: number | null | undefined;
    if (body.courierId) {
      const quote = shippingQuotes.find((q) => q.courierId === body.courierId);
      if (!quote) throw new RangeError(`Kurir tidak dikenal: ${body.courierId}`);
      if (quote.cost === null) throw new RangeError(`${quote.service} tidak tersedia untuk alamat ini.`);
      shippingCost = quote.cost;
    }
    const totals = computeTotals({
      catalog: this.requireCatalog(brand),
      promotions: this.requirePromos(brand),
      now: body.now ?? toWibIso(new Date()),
      lines,
      orderVoucherCode: body.orderVoucher,
      shippingVoucherCode: body.shippingVoucher,
      shippingCost,
    });
    return { ...totals, totalDisplay: formatTotal(totals.total) };
  }

  private requireCatalog(brand: BrandId): Catalog {
    const catalog = this.catalogs.get(brand);
    if (!catalog) throw new RangeError(`Toko tidak dikenal: ${brand}`);
    return catalog;
  }

  private requirePromos(brand: BrandId): Promotion[] {
    return this.promos.get(brand) ?? [];
  }

  private async refresh(): Promise<void> {
    const rows = await this.prisma.product.findMany({ include: { variants: true } });
    const promoRows = await this.prisma.promotion.findMany();
    const all = rows.map(toProduct);
    for (const brand of ["sambung", "halimun"] as const) {
      this.catalogs.set(brand, buildCatalog(all.filter((p) => p.brand === brand)));
      this.promos.set(
        brand,
        promoRows.filter((p) => p.storeId === brand).map((p) => p.rule as unknown as Promotion),
      );
    }
  }

  private async seed(): Promise<void> {
    for (const brand of ["halimun", "sambung"] as const) {
      await this.prisma.store.upsert({
        where: { id: brand },
        update: {},
        create: { id: brand, name: brand === "halimun" ? "Halimun" : "Sambung" },
      });
    }
    for (const c of categories) {
      await this.prisma.category.upsert({
        where: { id: c.id },
        update: { name: c.name, slug: c.slug },
        create: { id: c.id, storeId: c.brand, name: c.name, slug: c.slug },
      });
    }
    for (const p of products) {
      await this.prisma.product.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          storeId: p.brand,
          categoryId: p.categoryId,
          slug: p.slug,
          name: p.name,
          spec: p.spec,
          tags: p.tags ?? [],
          art: p.art as Prisma.InputJsonValue,
          specs: (p.specs ?? undefined) as Prisma.InputJsonValue | undefined,
          components: (p.components ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      for (const v of p.variants) {
        await this.prisma.variant.upsert({
          where: { sku: v.sku },
          update: {},
          create: {
            sku: v.sku,
            productId: p.id,
            label: v.label,
            price: v.price,
            compareAt: v.compareAt,
            onHand: v.onHand,
            reserved: v.reserved,
            attrs: (v.attrs ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        });
      }
    }
    for (const brand of ["sambung", "halimun"] as const) {
      for (const promo of promotions[brand]) {
        await this.prisma.promotion.upsert({
          where: { storeId_code: { storeId: brand, code: promo.code } },
          update: { kind: promo.kind, rule: promo as unknown as Prisma.InputJsonValue },
          create: {
            storeId: brand,
            code: promo.code,
            kind: promo.kind,
            rule: promo as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
  }
}

function toProduct(row: {
  id: string;
  storeId: string;
  slug: string;
  name: string;
  categoryId: string;
  spec: string | null;
  tags: string[];
  art: Prisma.JsonValue;
  specs: Prisma.JsonValue | null;
  components: Prisma.JsonValue | null;
  variants: Array<{
    sku: string;
    label: string;
    price: number;
    compareAt: number | null;
    onHand: number;
    reserved: number;
    attrs: Prisma.JsonValue | null;
  }>;
}): Product {
  return {
    id: row.id,
    brand: row.storeId as BrandId,
    slug: row.slug,
    name: row.name,
    categoryId: row.categoryId,
    spec: row.spec ?? undefined,
    tags: row.tags,
    art: row.art as Product["art"],
    specs: (row.specs ?? undefined) as Product["specs"],
    components: (row.components ?? undefined) as Product["components"],
    variants: row.variants.map((v) => ({
      sku: v.sku,
      label: v.label,
      price: v.price,
      compareAt: v.compareAt ?? undefined,
      onHand: v.onHand,
      reserved: v.reserved,
      attrs: (v.attrs ?? undefined) as Product["variants"][number]["attrs"],
    })),
  };
}

function formatTotal(amount: number): string {
  const digits = String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp${digits}`;
}
