import { HttpException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { toWibIso } from "../domain/time";
import type { BrandId } from "../domain/types";
import { toMediaError } from "../media/error-map";
import { mediaError } from "../media/errors";
import { ImageJobLimiter } from "../media/limiter";
import { MAX_UPLOAD_BYTES } from "../media/limits";
import type { MediaActor } from "../media/media.types";
import { articleMediaKey, toPublicArticleImage } from "../media/public-image";
import { UploadRateLimiter } from "../media/rate-limit";
import { parseAlt } from "../media/rules";
import { PrismaService } from "../prisma.service";
import { ObjectStorage } from "../storage.service";
import { storeArticleImage } from "./article-media";
import { ContentEvents } from "./content-events";
import type { ArticleStatus, ArticleTextInput, ArticleView, Lang } from "./content.types";
import { checkLengths, slugFromTitle } from "./rules";

type Tx = Prisma.TransactionClient;
type UploadFile = { buffer: Buffer; originalname: string; size: number };
type TextRow = { articleId: string; lang: string; storeId: string; slug: string; title: string; seoTitle: string | null; metaDescription: string; summary: string; body: string; noindex: boolean; canonicalUrl: string | null };
type ArticleRow = {
  id: string; storeId: string; status: string; publishAt: string | null; publishedAt: string | null; updatedAt: string; version: number; authorId: string;
  coverHash: string | null; coverWidth: number | null; coverHeight: number | null; coverSizes: number[]; coverAlt: string | null; tags: string[]; sample: boolean;
  texts: TextRow[]; products: { productId: string; position: number }[];
};
export type SaveInput = { version: number; texts: Partial<Record<Lang, ArticleTextInput | null>>; tags: string[]; productIds: string[] };

const ACTION = {
  ARTICLE_CREATED: "Artikel dibuat",
  ARTICLE_UPDATED: "Artikel diubah",
  ARTICLE_PUBLISHED: "Artikel diterbitkan",
  ARTICLE_SCHEDULED: "Artikel dijadwalkan",
  ARTICLE_UNPUBLISHED: "Artikel dibatalkan terbitnya",
  ARTICLE_DELETED: "Artikel dihapus",
  ARTICLE_SLUG_CHANGED: "Slug artikel diubah",
  ARTICLE_COVER_CHANGED: "Sampul artikel diubah",
} as const;
type Code = keyof typeof ACTION;

const TEXT_FIELDS = ["slug", "title", "seoTitle", "metaDescription", "summary", "body", "noindex", "canonicalUrl"] as const;
const MAX_PRODUCTS = 6;
const IMAGE_TARGETS = [480, 960, 1600];

const fail = (status: number, code: string, message: string) => new HttpException({ code, message }, status);
const invalid = (message: string) => fail(422, "VALIDATION", message);
const conflict = (message: string) => fail(409, "CONFLICT", message);
const STALE = "Artikel diubah orang lain. Muat ulang halaman.";

function normalise(text: ArticleTextInput): ArticleTextInput {
  const title = text.title.trim();
  return {
    slug: text.slug.trim() || slugFromTitle(title),
    title,
    seoTitle: text.seoTitle?.trim() || null,
    metaDescription: text.metaDescription.trim(),
    summary: text.summary.trim(),
    body: text.body,
    noindex: !!text.noindex,
    canonicalUrl: text.canonicalUrl?.trim() || null,
  };
}

const textOf = (row: TextRow): ArticleTextInput => ({
  slug: row.slug, title: row.title, seoTitle: row.seoTitle, metaDescription: row.metaDescription, summary: row.summary, body: row.body, noindex: row.noindex, canonicalUrl: row.canonicalUrl,
});

function isSlugConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && String(error.meta?.target ?? "").includes("slug");
}

/**
 * Articles (spec sections 2, 3 and 7). Every write runs in one transaction, checks the version the editor saw,
 * writes one audit entry with actorId in `after`, and signals ContentEvents so rendered pages are rebuilt.
 */
@Injectable()
export class ArticleService {
  limiter = new ImageJobLimiter();
  rateLimiter = new UploadRateLimiter();
  now: () => string = () => toWibIso(new Date());

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(ContentEvents) private readonly events: ContentEvents,
  ) {}

  isLive(article: { status: string; publishAt: string | null }, now = this.now()): boolean {
    return article.status === "published" && !!article.publishAt && Date.parse(article.publishAt) <= Date.parse(now);
  }

  async list(store: BrandId): Promise<ArticleView[]> {
    const rows = (await this.prisma.article.findMany({ where: { storeId: store }, include: { texts: true, products: true }, orderBy: { updatedAt: "desc" } })) as unknown as ArticleRow[];
    return Promise.all(rows.map((row) => this.view(row)));
  }

  async get(id: string): Promise<ArticleView> {
    return this.view(await this.load(id));
  }

  /** `sample` is set only by `content:seed` (demo articles that `content:remove-samples` deletes). */
  async create(actor: MediaActor, store: BrandId, input: ArticleTextInput, opts: { sample?: boolean } = {}): Promise<ArticleView> {
    if (!input.title.trim()) throw invalid("Judul wajib diisi.");
    const text = normalise(input);
    const problems = checkLengths(text, false);
    if (problems.length) throw invalid(problems[0]!);
    const now = this.now();
    const id = await this.write(async (tx) => {
      const article = await tx.article.create({
        data: { storeId: store, status: "draft", updatedAt: now, version: 1, authorId: actor.id, coverSizes: [], tags: [], sample: opts.sample ?? false, createdAt: now, createdBy: actor.label },
      });
      await tx.articleText.create({ data: { ...text, articleId: article.id, lang: "id", storeId: store } as never });
      await this.audit(tx, actor, "ARTICLE_CREATED", article.id, null, { articleId: article.id, slug: text.slug, title: text.title, ...(opts.sample ? { sample: true } : {}), actorId: actor.id });
      return article.id;
    });
    return this.get(id);
  }

  async save(actor: MediaActor, id: string, input: SaveInput): Promise<ArticleView> {
    const article = await this.load(id);
    if (article.version !== input.version) throw conflict(STALE);
    if (input.texts.id === null) throw invalid("Versi Bahasa Indonesia wajib ada.");
    const forPublish = article.status === "published";
    const texts = new Map<Lang, ArticleTextInput | null>();
    for (const [lang, value] of Object.entries(input.texts) as [Lang, ArticleTextInput | null | undefined][]) {
      if (value === undefined) continue;
      if (value === null) { texts.set(lang, null); continue; }
      const text = normalise(value);
      const problems = checkLengths(text, forPublish);
      if (problems.length) throw invalid(problems[0]!);
      texts.set(lang, text);
    }
    const productIds = [...new Set(input.productIds)];
    if (productIds.length > MAX_PRODUCTS) throw invalid("Maksimal 6 produk per artikel.");
    if (productIds.length) {
      const found = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
      if (productIds.some((pid) => !found.some((p) => p.id === pid && p.storeId === article.storeId))) throw invalid("Produk tidak ada di toko ini.");
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [lang, text] of texts) {
      const old = article.texts.find((t) => t.lang === lang);
      if (text === null) {
        if (old) { before[lang] = { slug: old.slug, title: old.title }; after[lang] = null; }
        continue;
      }
      for (const field of TEXT_FIELDS) {
        const was = old ? (old[field] ?? null) : null;
        const now = text[field] ?? null;
        if (was !== now) { before[`${lang}.${field}`] = was; after[`${lang}.${field}`] = now; }
      }
    }
    const tags = [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))];
    if (JSON.stringify(tags) !== JSON.stringify(article.tags)) { before.tags = article.tags; after.tags = tags; }
    const oldProducts = [...article.products].sort((a, b) => a.position - b.position).map((p) => p.productId);
    if (JSON.stringify(productIds) !== JSON.stringify(oldProducts)) { before.productIds = oldProducts; after.productIds = productIds; }
    if (!Object.keys(after).length) return this.view(article);

    const now = this.now();
    const live = this.isLive(article, now);
    await this.write(async (tx) => {
      await this.bump(tx, id, input.version, { updatedAt: now, tags });
      for (const [lang, text] of texts) {
        const old = article.texts.find((t) => t.lang === lang);
        if (text === null) {
          if (old) await tx.articleText.delete({ where: { articleId_lang: { articleId: id, lang } } });
          continue;
        }
        if (old && old.slug !== text.slug) {
          if (live) {
            await this.releaseSlug(tx, article.storeId, lang, text.slug);
            await tx.slugRedirect.deleteMany({ where: { storeId: article.storeId, kind: "article", lang, fromSlug: old.slug } });
            await tx.slugRedirect.create({ data: { storeId: article.storeId, kind: "article", lang, fromSlug: old.slug, toArticleId: id } });
          }
          await this.audit(tx, actor, "ARTICLE_SLUG_CHANGED", id, { lang, slug: old.slug }, { lang, slug: text.slug, actorId: actor.id });
        }
        if (old) await tx.articleText.update({ where: { articleId_lang: { articleId: id, lang } }, data: text as never });
        else {
          if (live) await this.releaseSlug(tx, article.storeId, lang, text.slug);
          await tx.articleText.create({ data: { ...text, articleId: id, lang, storeId: article.storeId } as never });
        }
      }
      if ("productIds" in after) {
        await tx.articleProduct.deleteMany({ where: { articleId: id } });
        if (productIds.length) await tx.articleProduct.createMany({ data: productIds.map((productId, position) => ({ articleId: id, productId, position })) });
      }
      await this.audit(tx, actor, "ARTICLE_UPDATED", id, before, { ...after, actorId: actor.id });
    });
    return this.get(id);
  }

  async publish(actor: MediaActor, id: string, input: { version: number; publishAt?: string | null }): Promise<ArticleView> {
    const article = await this.load(id);
    if (article.version !== input.version) throw conflict(STALE);
    if (this.isLive(article)) throw conflict("Artikel sudah terbit. Batalkan terbit dulu untuk menjadwalkan ulang.");
    const bahasa = article.texts.find((t) => t.lang === "id");
    const problems = bahasa ? checkLengths(textOf(bahasa), true) : ["Versi Bahasa Indonesia wajib ada."];
    if (problems.length) throw invalid(problems[0]!);
    const english = article.texts.find((t) => t.lang === "en");
    if (english && checkLengths(textOf(english), true).length) throw invalid("Lengkapi versi English atau hapus dulu.");
    if (article.coverHash && !article.coverAlt) throw invalid("Lengkapi teks alternatif sampul.");
    const now = this.now();
    let publishAt = now;
    if (input.publishAt) {
      const at = Date.parse(input.publishAt);
      if (Number.isNaN(at)) throw invalid("Waktu terbit tidak valid.");
      if (at <= Date.parse(now)) throw invalid("Waktu terbit harus di masa depan.");
      publishAt = toWibIso(new Date(at));
    }
    const code: Code = input.publishAt ? "ARTICLE_SCHEDULED" : "ARTICLE_PUBLISHED";
    // an old publishedAt counts only when the article really went live then, not when it was only scheduled
    const wentLive = !!article.publishedAt && Date.parse(article.publishedAt) <= Date.parse(now);
    await this.write(async (tx) => {
      await this.bump(tx, id, input.version, { status: "published", publishAt, publishedAt: wentLive ? article.publishedAt : publishAt, updatedAt: now });
      if (!input.publishAt) for (const text of article.texts) await this.releaseSlug(tx, article.storeId, text.lang, text.slug);
      await this.audit(tx, actor, code, id, { status: article.status, publishAt: article.publishAt }, { status: "published", publishAt, actorId: actor.id });
    });
    return this.get(id);
  }

  async unpublish(actor: MediaActor, id: string, input: { version: number }): Promise<ArticleView> {
    const article = await this.load(id);
    if (article.version !== input.version) throw conflict(STALE);
    if (article.status !== "published") return this.view(article);
    await this.write(async (tx) => {
      await this.bump(tx, id, input.version, { status: "unpublished", updatedAt: this.now() });
      await this.audit(tx, actor, "ARTICLE_UNPUBLISHED", id, { status: article.status, publishAt: article.publishAt }, { status: "unpublished", actorId: actor.id });
    });
    return this.get(id);
  }

  async remove(actor: MediaActor, id: string): Promise<{ ok: true }> {
    const article = await this.load(id);
    if (article.status === "published") throw conflict("Batalkan terbit dulu sebelum menghapus.");
    await this.write(async (tx) => {
      const { count } = await tx.article.deleteMany({ where: { id, status: { not: "published" } } });
      if (count !== 1) {
        if (await tx.article.findUnique({ where: { id } })) throw conflict("Batalkan terbit dulu sebelum menghapus.");
        throw fail(404, "NOT_FOUND", "Artikel tidak ditemukan.");
      }
      await this.audit(tx, actor, "ARTICLE_DELETED", id, { status: article.status, slugs: Object.fromEntries(article.texts.map((t) => [t.lang, t.slug])) }, { actorId: actor.id });
    });
    await this.storage.deleteObjects(this.mediaKeys(article)).catch(() => undefined);
    return { ok: true };
  }

  async setCover(actor: MediaActor, id: string, file: UploadFile, input: { alt?: string; rightsConfirmed?: string }): Promise<ArticleView> {
    const article = await this.uploadChecks(actor, id, file, input.rightsConfirmed);
    const alt = parseAlt(input.alt);
    const stored = await this.store(id, file);
    try {
      await this.write(async (tx) => {
        await tx.article.update({
          where: { id },
          data: { coverHash: stored.hash, coverWidth: stored.width, coverHeight: stored.height, coverSizes: stored.sizes, coverAlt: alt, version: { increment: 1 }, updatedAt: this.now() },
        });
        await this.audit(tx, actor, "ARTICLE_COVER_CHANGED", id, { coverHash: article.coverHash, alt: article.coverAlt }, { coverHash: stored.hash, alt, actorId: actor.id });
      });
    } catch (error) {
      await this.storage.deleteObjects(stored.keys).catch(() => undefined);
      throw error;
    }
    if (article.coverHash && article.coverHash !== stored.hash) await this.storage.deleteObjects(this.ownCoverKeys(article)).catch(() => undefined);
    return this.get(id);
  }

  async removeCover(actor: MediaActor, id: string): Promise<ArticleView> {
    const article = await this.load(id);
    if (!article.coverHash) return this.view(article);
    await this.write(async (tx) => {
      await tx.article.update({ where: { id }, data: { coverHash: null, coverWidth: null, coverHeight: null, coverSizes: [], coverAlt: null, version: { increment: 1 }, updatedAt: this.now() } });
      await this.audit(tx, actor, "ARTICLE_COVER_CHANGED", id, { coverHash: article.coverHash, alt: article.coverAlt }, { coverHash: null, alt: null, actorId: actor.id });
    });
    await this.storage.deleteObjects(this.ownCoverKeys(article)).catch(() => undefined);
    return this.get(id);
  }

  /** Stores a body image; it becomes part of the article only when the body that uses it is saved (no audit here). */
  async addBodyImage(actor: MediaActor, id: string, file: UploadFile, input: { rightsConfirmed?: string }): Promise<{ src: string; width: number; height: number }> {
    await this.uploadChecks(actor, id, file, input.rightsConfirmed);
    const stored = await this.store(id, file);
    const image = toPublicArticleImage({ articleId: id, hash: stored.hash, width: stored.width, height: stored.height, sizes: stored.sizes, alt: "" });
    return { src: image.src, width: stored.width, height: stored.height };
  }

  /** The live article behind a public URL, the current slug of a renamed one, or null. */
  async resolvePublic(store: BrandId, lang: Lang, slug: string, now = this.now()): Promise<{ article: ArticleRow } | { redirectTo: string } | null> {
    const text = await this.prisma.articleText.findFirst({ where: { storeId: store, lang, slug } });
    if (text) {
      const article = (await this.prisma.article.findUnique({ where: { id: text.articleId }, include: { texts: true, products: true } })) as unknown as ArticleRow | null;
      if (article && this.isLive(article, now)) return { article };
      // a draft or unpublished text holding the slug must not hide a redirect that is still valid
    }
    const redirect = await this.prisma.slugRedirect.findFirst({ where: { storeId: store, kind: "article", lang, fromSlug: slug } });
    if (!redirect) return null;
    const article = (await this.prisma.article.findUnique({ where: { id: redirect.toArticleId }, include: { texts: true, products: true } })) as unknown as ArticleRow | null;
    const current = article?.texts.find((t) => t.lang === lang);
    return article && current && this.isLive(article, now) ? { redirectTo: current.slug } : null;
  }

  private async load(id: string): Promise<ArticleRow> {
    const row = (await this.prisma.article.findUnique({ where: { id }, include: { texts: true, products: true } })) as unknown as ArticleRow | null;
    if (!row) throw fail(404, "NOT_FOUND", "Artikel tidak ditemukan.");
    return row;
  }

  private async view(row: ArticleRow): Promise<ArticleView> {
    const author = await this.prisma.staffAccount.findUnique({ where: { id: row.authorId } });
    const cover = row.coverHash
      ? toPublicArticleImage({ articleId: row.id, hash: row.coverHash, width: row.coverWidth ?? 0, height: row.coverHeight ?? 0, sizes: row.coverSizes, alt: row.coverAlt ?? "" })
      : null;
    return {
      id: row.id,
      store: row.storeId === "halimun" ? "halimun" : "sambung",
      status: row.status as ArticleStatus,
      publishAt: row.publishAt,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      version: row.version,
      authorId: row.authorId,
      authorName: author?.name ?? "",
      cover: cover ? { ...cover, alt: row.coverAlt ?? "" } : null,
      tags: row.tags,
      sample: row.sample,
      texts: Object.fromEntries(row.texts.map((t) => [t.lang, textOf(t)])) as ArticleView["texts"],
      productIds: [...row.products].sort((a, b) => a.position - b.position).map((p) => p.productId),
      live: this.isLive(row),
    };
  }

  /** Runs a transaction; a slug unique-key race answers 409 instead of 500, and readers are told content changed. */
  private async write<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      const result = await this.prisma.$transaction((tx) => fn(tx));
      this.events.changed();
      return result;
    } catch (error) {
      if (isSlugConflict(error)) throw conflict("Slug sudah dipakai artikel lain.");
      throw error;
    }
  }

  private async bump(tx: Tx, id: string, version: number, data: Record<string, unknown>): Promise<void> {
    const { count } = await tx.article.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
    if (count !== 1) throw conflict(STALE);
  }

  /** A slug taken by a live text never stays a redirect source (reuse, or renaming back); drafts leave redirects alone. */
  private async releaseSlug(tx: Tx, store: string, lang: string, slug: string): Promise<void> {
    await tx.slugRedirect.deleteMany({ where: { storeId: store, kind: "article", lang, fromSlug: slug } });
  }

  private async uploadChecks(actor: MediaActor, id: string, file: UploadFile, rightsConfirmed?: string): Promise<ArticleRow> {
    if (!this.rateLimiter.hit(actor.id)) throw mediaError("rateLimited");
    const article = await this.load(id);
    if (rightsConfirmed !== "true") throw mediaError("rightsRequired");
    if (file.size > MAX_UPLOAD_BYTES || file.buffer.length > MAX_UPLOAD_BYTES) throw mediaError("tooLarge");
    if (!this.storage.ready) throw mediaError("storageUnavailable");
    return article;
  }

  private async store(id: string, file: UploadFile) {
    try {
      return await storeArticleImage(this.storage, this.limiter, id, file.buffer);
    } catch (error) {
      throw toMediaError(error);
    }
  }

  private coverKeys(article: ArticleRow): string[] {
    return article.coverHash ? article.coverSizes.map((t) => articleMediaKey(article.id, article.coverHash!.slice(0, 16), t)) : [];
  }

  /** The 16-character hashes of the images named in the body of any language. */
  private bodyHashes(article: ArticleRow): Set<string> {
    const hashes = new Set<string>();
    const pattern = new RegExp(`/media/articles/${article.id}/([0-9a-f]{16})-\\d{3,4}\\.webp`, "g");
    for (const text of article.texts) for (const match of text.body.matchAll(pattern)) hashes.add(match[1]!);
    return hashes;
  }

  /** Cover files to delete: none when a body image uses the same file (same hash16 scheme, same keys). */
  private ownCoverKeys(article: ArticleRow): string[] {
    return article.coverHash && this.bodyHashes(article).has(article.coverHash.slice(0, 16)) ? [] : this.coverKeys(article);
  }

  /** Cover files plus the body images named in any language (480, 960 and 1600 copies; other targets stay). */
  private mediaKeys(article: ArticleRow): string[] {
    const keys = new Set(this.coverKeys(article));
    for (const hash of this.bodyHashes(article)) for (const t of IMAGE_TARGETS) keys.add(articleMediaKey(article.id, hash, t));
    return [...keys];
  }

  private audit(tx: Pick<Tx, "auditRecord">, actor: MediaActor, code: Code, object: string, before: Record<string, unknown> | null, after: Record<string, unknown>) {
    return tx.auditRecord.create({
      data: {
        at: this.now(), actor: actor.label, code, action: ACTION[code], object,
        ...(before === null ? {} : { before: before as Prisma.InputJsonValue }),
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}
