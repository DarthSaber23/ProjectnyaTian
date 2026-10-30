import { HttpException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { toWibIso } from "../domain/time";
import type { BrandId } from "../domain/types";
import type { MediaActor } from "../media/media.types";
import { PrismaService } from "../prisma.service";
import { ContentEvents } from "./content-events";
import { autoCategorySeo, autoProductSeo } from "./rules";

export type SeoKind = "product" | "category";
export type SeoText = { title: string; description: string };
/** `path` is the shop page the text belongs to (for the admin search-result preview). */
export type SeoRow = { key: string; name: string; path: string; auto: SeoText; override: { seoTitle: string | null; metaDescription: string | null } | null };

export const BRAND_NAME: Record<BrandId, string> = { sambung: "Sambung", halimun: "Halimun" };
const KINDS: readonly SeoKind[] = ["product", "category"];
const invalid = (message: string) => new HttpException({ code: "VALIDATION", message }, 422);
const notFound = () => new HttpException({ code: "NOT_FOUND", message: "Produk atau kategori tidak ditemukan." }, 404);

/** Hand-written SEO title and description for products and categories (spec section 2); empty means automatic. */
@Injectable()
export class SeoService {
  now: () => string = () => toWibIso(new Date());

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ContentEvents) private readonly events: ContentEvents,
  ) {}

  async rows(store: BrandId, kind: SeoKind): Promise<SeoRow[]> {
    this.checkKind(kind);
    const items = await this.items(store, kind);
    const overrides = await this.prisma.seoOverride.findMany({ where: { storeId: store, kind } });
    return items
      .map((item) => {
        const o = overrides.find((x) => x.key === item.key);
        return { key: item.key, name: item.name, path: item.path, auto: item.auto, override: o ? { seoTitle: o.seoTitle, metaDescription: o.metaDescription } : null };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }

  async effective(store: BrandId, kind: SeoKind, key: string): Promise<SeoText> {
    const item = (await this.items(store, kind)).find((i) => i.key === key);
    if (!item) throw notFound();
    const o = await this.prisma.seoOverride.findUnique({ where: { storeId_kind_key: { storeId: store, kind, key } } });
    return { title: o?.seoTitle || item.auto.title, description: o?.metaDescription || item.auto.description };
  }

  async set(actor: MediaActor, store: BrandId, kind: SeoKind, key: string, input: { seoTitle?: string | null; metaDescription?: string | null }): Promise<void> {
    this.checkKind(kind);
    const seoTitle = input.seoTitle?.trim() || null;
    const metaDescription = input.metaDescription?.trim() || null;
    if (seoTitle && [...seoTitle].length > 60) throw invalid("Judul SEO maksimal 60 karakter.");
    if (metaDescription && [...metaDescription].length > 160) throw invalid("Deskripsi meta maksimal 160 karakter.");
    if (!(await this.items(store, kind)).some((i) => i.key === key)) throw notFound();
    if (!seoTitle && !metaDescription) return this.clear(actor, store, kind, key);
    const where = { storeId_kind_key: { storeId: store, kind, key } };
    const before = await this.prisma.seoOverride.findUnique({ where });
    const now = this.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.seoOverride.upsert({ where, create: { storeId: store, kind, key, seoTitle, metaDescription, updatedAt: now, updatedBy: actor.label }, update: { seoTitle, metaDescription, updatedAt: now, updatedBy: actor.label } });
      await this.audit(tx, actor, kind, key, before ? { seoTitle: before.seoTitle, metaDescription: before.metaDescription } : null, { seoTitle, metaDescription, actorId: actor.id });
    });
    this.events.changed();
  }

  async clear(actor: MediaActor, store: BrandId, kind: SeoKind, key: string): Promise<void> {
    this.checkKind(kind);
    const where = { storeId_kind_key: { storeId: store, kind, key } };
    const before = await this.prisma.seoOverride.findUnique({ where });
    if (!before) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.seoOverride.deleteMany({ where: { storeId: store, kind, key } });
      await this.audit(tx, actor, kind, key, { seoTitle: before.seoTitle, metaDescription: before.metaDescription }, { seoTitle: null, metaDescription: null, actorId: actor.id });
    });
    this.events.changed();
  }

  private checkKind(kind: string): asserts kind is SeoKind {
    if (!KINDS.includes(kind as SeoKind)) throw invalid("Jenis SEO tidak dikenal.");
  }

  private async items(store: BrandId, kind: SeoKind): Promise<{ key: string; name: string; path: string; auto: SeoText }[]> {
    const brand = BRAND_NAME[store];
    if (kind === "product") {
      const products = await this.prisma.product.findMany({ where: { storeId: store } });
      return products.map((p) => ({ key: p.id, name: p.name, path: `/produk/${p.slug}`, auto: autoProductSeo({ name: p.name, spec: p.spec }, brand) }));
    }
    const categories = await this.prisma.category.findMany({ where: { storeId: store } });
    return categories.map((c) => ({ key: c.id, name: c.name, path: `/kategori/${c.slug}`, auto: autoCategorySeo(c, brand) }));
  }

  private audit(tx: Pick<Prisma.TransactionClient, "auditRecord">, actor: MediaActor, kind: SeoKind, key: string, before: Record<string, unknown> | null, after: Record<string, unknown>) {
    return tx.auditRecord.create({
      data: {
        at: this.now(), actor: actor.label, code: "SEO_OVERRIDE_CHANGED", action: "Teks SEO diubah", object: `${kind}:${key}`,
        ...(before === null ? {} : { before: before as Prisma.InputJsonValue }),
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}
