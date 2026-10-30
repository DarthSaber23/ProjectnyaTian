import { Inject, Injectable } from "@nestjs/common";
import { CatalogService } from "../commerce/catalog.service";
import { toWibIso } from "../domain/time";
import type { BrandId, Product } from "../domain/types";
import { toPublicArticleImage } from "../media/public-image";
import { PrismaService } from "../prisma.service";
import { ArticleService } from "./article.service";
import type { Lang, PublicArticle, PublicArticleCard } from "./content.types";
import { plainText, renderMarkdown } from "./markdown";
import { readingMinutes } from "./rules";

const PAGE_SIZE = 12;
const RELATED = 3;

type TextRow = { lang: string; slug: string; title: string; seoTitle: string | null; metaDescription: string; summary: string; body: string; noindex: boolean; canonicalUrl: string | null };
type Row = {
  id: string; storeId: string; status: string; publishAt: string | null; publishedAt: string | null; updatedAt: string; authorId: string;
  coverHash: string | null; coverWidth: number | null; coverHeight: number | null; coverSizes: number[]; coverAlt: string | null;
  texts: TextRow[]; products: { productId: string; position: number }[];
};

/** Read side of articles for shoppers and the page renderer: live articles only, in the deployment's store. */
@Injectable()
export class PublicContentService {
  now: () => string = () => toWibIso(new Date());

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArticleService) private readonly articles: ArticleService,
    @Inject(CatalogService) private readonly catalog: Pick<CatalogService, "snapshot">,
  ) {}

  async list(store: BrandId, lang: Lang, page: number): Promise<{ page: number; pages: number; items: PublicArticleCard[] }> {
    const cards = (await this.live(store)).flatMap((row) => { const card = this.card(row, lang); return card ? [card] : []; });
    const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
    const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
    return { page: current, pages, items: cards.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) };
  }

  async article(store: BrandId, lang: Lang, slug: string): Promise<PublicArticle | { redirect: string } | null> {
    const found = await this.articles.resolvePublic(store, lang, slug, this.now());
    if (!found) return null;
    if ("redirectTo" in found) return { redirect: found.redirectTo };
    const row = found.article as unknown as Row;
    const card = this.card(row, lang)!;
    const text = row.texts.find((t) => t.lang === lang)!;
    const other = row.texts.find((t) => t.lang !== lang);
    const author = await this.prisma.staffAccount.findUnique({ where: { id: row.authorId } });
    return {
      ...card,
      seoTitle: text.seoTitle || text.title,
      metaDescription: text.metaDescription,
      html: renderMarkdown(text.body),
      plain: plainText(text.body),
      noindex: text.noindex,
      canonicalUrl: text.canonicalUrl,
      updatedAt: row.updatedAt,
      authorName: author?.name ?? "",
      otherLang: other ? { lang: other.lang as Lang, slug: other.slug } : null,
      products: this.products(store, row),
    };
  }

  /** "Artikel terkait": up to 3 live Bahasa articles that link to the product, newest first. */
  async forProduct(store: BrandId, productSlug: string): Promise<PublicArticleCard[]> {
    const product = this.catalog.snapshot(store).products.find((p) => p.slug === productSlug);
    if (!product) return [];
    const links = await this.prisma.articleProduct.findMany({ where: { productId: product.id } });
    const ids = new Set(links.map((l) => l.articleId));
    return (await this.live(store)).filter((row) => ids.has(row.id)).flatMap((row) => { const c = this.card(row, "id"); return c ? [c] : []; }).slice(0, RELATED);
  }

  /** Live articles of the store, newest first (sitemap and renderer use it too). */
  async live(store: BrandId): Promise<Row[]> {
    return (await this.prisma.article.findMany({
      where: { storeId: store, status: "published", publishAt: { lte: this.now() } },
      include: { texts: true, products: true },
      orderBy: { publishAt: "desc" },
    })) as unknown as Row[];
  }

  card(row: Row, lang: Lang): PublicArticleCard | null {
    const text = row.texts.find((t) => t.lang === lang);
    if (!text) return null;
    return {
      id: row.id,
      lang,
      slug: text.slug,
      title: text.title,
      summary: text.summary,
      cover: row.coverHash
        ? toPublicArticleImage({ articleId: row.id, hash: row.coverHash, width: row.coverWidth ?? 0, height: row.coverHeight ?? 0, sizes: row.coverSizes, alt: row.coverAlt ?? "" })
        : null,
      coverProduct: row.coverHash ? null : this.coverProduct(row),
      readingMinutes: readingMinutes(text.body),
      publishedAt: row.publishedAt ?? row.publishAt ?? row.updatedAt,
    };
  }

  private coverProduct(row: Row): PublicArticleCard["coverProduct"] {
    const first = this.products(row.storeId as BrandId, row)[0];
    return first ? { name: first.name, art: first.art, image: first.images?.[0] ?? null } : null;
  }

  /** Linked products that are still in this store's catalogue, in the article's order. */
  private products(store: BrandId, row: Row): Product[] {
    const catalogue = this.catalog.snapshot(store).products;
    return [...row.products]
      .sort((a, b) => a.position - b.position)
      .flatMap((link) => { const p = catalogue.find((x) => x.id === link.productId); return p ? [p] : []; });
  }
}
