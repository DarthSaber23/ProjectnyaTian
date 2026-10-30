import { createHash } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import { CatalogService } from "../commerce/catalog.service";
import { ContentEvents } from "../content/content-events";
import type { Lang, PublicArticle } from "../content/content.types";
import { PublicContentService } from "../content/public-content.service";
import { BRAND_NAME, SeoService, type SeoText } from "../content/seo.service";
import { available } from "../domain/stock";
import type { BrandId, Product, ProductImage } from "../domain/types";
import { PrismaService } from "../prisma.service";
import { buildHead, injectShell, type HeadInput } from "./head";
import { articleJsonLd, breadcrumbJsonLd, collectionJsonLd, productJsonLd } from "./jsonld";
import { SHELL_SOURCE, type ShellSourceLike } from "./shell";
import { renderSitemap, type SitemapEntry } from "./sitemap";
import { siteConfig } from "./site-config";
import { cardLinks, ssrArticle, ssrList, ssrProduct } from "./ssr-body";

export interface RenderedPage {
  status: number;
  body: string;
  headers: Record<string, string>;
}

const BLOG_LINE: Record<string, string> = {
  sambung: "Panduan dan tips aksesori komputer dari Sambung.",
  halimun: "Panduan dan tips perawatan kulit dari Halimun.",
};
const ARTICLE = /^\/(en\/)?blog\/([^/]+)\/?$/;
const BLOG = /^\/(en\/)?blog\/?$/;
const PRODUCT = /^\/produk\/([^/]+)\/?$/;
const CATEGORY = /^\/kategori\/([^/]+)\/?$/;
const CACHE_MAX = 500;

/** True when an If-None-Match value (a list; entries are weak after nginx gzip) names the page's ETag. */
const matches = (header: string, etag: string) => header.split(",").some((v) => { const t = v.trim().replace(/^W\//, ""); return t === etag || t === "*"; });

/** Largest copy of a photo (its srcset's last entry), as an absolute URL. */
const largest = (image: ProductImage | null | undefined, base: string) => (image ? `${base}${image.srcset.split(", ").at(-1)!.split(" ")[0]}` : undefined);

/**
 * Server-filled HTML for blog, product and category URLs (spec section 5): real head tags, JSON-LD and a readable
 * #ssr body in the built index.html. Pages are kept for 60 s and dropped whenever content changes. Only 200 pages
 * are kept, at most 500 (oldest out first), so arbitrary URLs cannot grow memory.
 */
@Injectable()
export class RenderService {
  private readonly cache = new Map<string, { page: RenderedPage; at: number }>();
  ttlMs = 60_000;

  constructor(
    @Inject(SHELL_SOURCE) private readonly shell: ShellSourceLike,
    @Inject(PublicContentService) private readonly content: PublicContentService,
    @Inject(SeoService) private readonly seo: SeoService,
    @Inject(CatalogService) private readonly catalog: Pick<CatalogService, "snapshot">,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ContentEvents) events: ContentEvents,
  ) {
    events.subscribe(() => this.clear());
  }

  clear(): void {
    this.cache.clear();
  }

  async render(path: string, opts: { page?: number; ifNoneMatch?: string } = {}): Promise<RenderedPage> {
    const key = `${path}|${opts.page ?? 1}`;
    const hit = this.cache.get(key);
    let page: RenderedPage;
    if (hit && Date.now() - hit.at < this.ttlMs) page = hit.page;
    else {
      try {
        page = await this.build(path, opts.page ?? 1);
      } catch {
        return { status: 502, body: "Bad Gateway", headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } };
      }
      if (page.status === 200) this.remember(key, page);
    }
    if (page.status === 200 && opts.ifNoneMatch && matches(opts.ifNoneMatch, page.headers.ETag!)) {
      return { status: 304, body: "", headers: { ETag: page.headers.ETag!, "Cache-Control": "no-cache" } };
    }
    return page;
  }

  private remember(key: string, page: RenderedPage): void {
    this.cache.delete(key);
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { page, at: Date.now() });
  }

  async sitemap(): Promise<string> {
    const { baseUrl: base, brand } = siteConfig();
    const entries: SitemapEntry[] = [{ loc: `${base}/` }];
    for (const c of await this.prisma.category.findMany({ where: { storeId: brand } })) entries.push({ loc: `${base}/kategori/${c.slug}` });
    for (const p of this.catalog.snapshot(brand).products.filter((x) => x.brand === brand)) entries.push({ loc: `${base}/produk/${p.slug}` });
    const { pages } = await this.content.list(brand, "id", 1);
    entries.push({ loc: `${base}/blog` });
    for (let n = 2; n <= pages; n++) entries.push({ loc: `${base}/blog?page=${n}` });
    for (const row of await this.content.live(brand)) {
      const indexable = row.texts.filter((t) => !t.noindex);
      const url = (t: { lang: string; slug: string }) => `${base}${t.lang === "en" ? "/en" : ""}/blog/${t.slug}`;
      const alternates = indexable.length === 2 ? indexable.map((t) => ({ hreflang: t.lang, href: url(t) })) : undefined;
      for (const t of indexable) entries.push({ loc: url(t), lastmod: row.updatedAt, ...(alternates ? { alternates } : {}) });
    }
    return renderSitemap(entries);
  }

  private async build(path: string, page: number): Promise<RenderedPage> {
    const article = ARTICLE.exec(path);
    if (article) return this.article(article[1] ? "en" : "id", article[2]!);
    const blog = BLOG.exec(path);
    if (blog) return this.blog(blog[1] ? "en" : "id", page);
    const product = PRODUCT.exec(path);
    if (product) return this.product(product[1]!);
    const category = CATEGORY.exec(path);
    if (category) return this.category(category[1]!);
    return this.notFound("id");
  }

  private async article(lang: Lang, slug: string): Promise<RenderedPage> {
    const { baseUrl: base, brand } = siteConfig();
    const found = await this.content.article(brand, lang, slug);
    if (!found) return this.notFound(lang);
    const prefix = lang === "en" ? "/en" : "";
    if ("redirect" in found) return { status: 301, body: "", headers: { Location: `${prefix}/blog/${encodeURIComponent(found.redirect)}`, "Cache-Control": "no-cache" } };
    const a = found as PublicArticle;
    const brandName = BRAND_NAME[brand];
    const self = `${base}${prefix}/blog/${a.slug}`;
    // Same rule as the sitemap, plus no canonical override: alternates only link pages that both stand on their own.
    const other = a.otherLang && !a.noindex && !a.canonicalUrl && (await this.otherIsPlain(brand, a.id, a.otherLang.lang))
      ? `${base}${a.otherLang.lang === "en" ? "/en" : ""}/blog/${a.otherLang.slug}`
      : null;
    const idUrl = lang === "id" ? self : other;
    const alternates = other
      ? [{ hreflang: "id", href: idUrl! }, { hreflang: "en", href: lang === "en" ? self : other }, { hreflang: "x-default", href: idUrl! }]
      : [];
    const image = largest(a.cover, base);
    return this.page(lang, {
      title: a.seoTitle,
      description: a.metaDescription,
      canonical: a.canonicalUrl || self,
      alternates,
      noindex: a.noindex,
      ogType: "article",
      image,
      jsonLd: [
        articleJsonLd({ headline: a.title, description: a.metaDescription, url: self, image, datePublished: a.publishedAt, dateModified: a.updatedAt, author: a.authorName, publisher: brandName, lang }),
        breadcrumbJsonLd([{ name: lang === "en" ? "Home" : "Beranda", url: `${base}/` }, { name: "Blog", url: `${base}${prefix}/blog` }, { name: a.title, url: self }]),
      ],
    }, ssrArticle(a, lang));
  }

  /** True when the article's text in `lang` is indexable and has no canonical override. */
  private async otherIsPlain(brand: BrandId, id: string, lang: Lang): Promise<boolean> {
    const row = (await this.content.live(brand)).find((r) => r.id === id);
    const text = row?.texts.find((t) => t.lang === lang);
    return !!text && !text.noindex && !text.canonicalUrl;
  }

  private async blog(lang: Lang, page: number): Promise<RenderedPage> {
    const { baseUrl: base, brand } = siteConfig();
    const list = await this.content.list(brand, lang, page);
    const prefix = lang === "en" ? "/en" : "";
    const url = `${base}${prefix}/blog${list.page > 1 ? `?page=${list.page}` : ""}`;
    const description = lang === "en" ? `Guides and tips from ${BRAND_NAME[brand]}.` : BLOG_LINE[brand]!;
    const links = cardLinks(list.items, lang);
    return this.page(lang, {
      title: `Blog | ${BRAND_NAME[brand]}`, description, canonical: url, alternates: [], noindex: false, ogType: "website",
      jsonLd: [
        collectionJsonLd({ name: "Blog", description, url, items: links.map((l) => ({ name: l.name, url: `${base}${l.href}` })) }),
        breadcrumbJsonLd([{ name: lang === "en" ? "Home" : "Beranda", url: `${base}/` }, { name: "Blog", url: `${base}${prefix}/blog` }]),
      ],
    }, ssrList("Blog", description, links));
  }

  private async product(slug: string): Promise<RenderedPage> {
    const { baseUrl: base, brand } = siteConfig();
    const catalog = this.catalog.snapshot(brand);
    const product = catalog.products.find((p) => p.slug === slug && p.brand === brand);
    if (!product) return this.notFound("id");
    const seo = await this.effective("product", product.id, () => ({ title: `${product.name} | ${BRAND_NAME[brand]}`, description: product.spec ?? product.name }));
    const inStock = product.variants.some((v) => available(catalog, v.sku) > 0);
    const url = `${base}/produk/${product.slug}`;
    const images = (product.images ?? []).map((i) => largest(i, base)!).filter(Boolean);
    const category = (await this.prisma.category.findMany({ where: { storeId: brand } })).find((c) => c.id === product.categoryId);
    return this.page("id", {
      title: seo.title, description: seo.description, canonical: url, alternates: [], noindex: false, ogType: "product", image: images[0],
      jsonLd: [
        productJsonLd({ name: product.name, description: seo.description, url, images, sku: product.variants[0]?.sku ?? product.id, brand: BRAND_NAME[brand], price: Math.min(...product.variants.map((v) => v.price)), inStock }),
        breadcrumbJsonLd([{ name: "Beranda", url: `${base}/` }, ...(category ? [{ name: category.name, url: `${base}/kategori/${category.slug}` }] : []), { name: product.name, url }]),
      ],
    }, ssrProduct(product, inStock));
  }

  private async category(slug: string): Promise<RenderedPage> {
    const { baseUrl: base, brand } = siteConfig();
    const category = (await this.prisma.category.findMany({ where: { storeId: brand } })).find((c) => c.slug === slug);
    if (!category) return this.notFound("id");
    const seo = await this.effective("category", category.id, () => ({ title: `${category.name} | ${BRAND_NAME[brand]}`, description: `Belanja ${category.name} di ${BRAND_NAME[brand]}.` }));
    const url = `${base}/kategori/${category.slug}`;
    const products: Product[] = this.catalog.snapshot(brand).products.filter((p) => p.brand === brand && p.categoryId === category.id);
    const links = products.map((p) => ({ href: `/produk/${p.slug}`, name: p.name }));
    return this.page("id", {
      title: seo.title, description: seo.description, canonical: url, alternates: [], noindex: false, ogType: "website",
      jsonLd: [
        collectionJsonLd({ name: category.name, description: seo.description, url, items: links.map((l) => ({ name: l.name, url: `${base}${l.href}` })) }),
        breadcrumbJsonLd([{ name: "Beranda", url: `${base}/` }, { name: category.name, url }]),
      ],
    }, ssrList(category.name, seo.description, links));
  }

  private async notFound(lang: Lang): Promise<RenderedPage> {
    const { brand } = siteConfig();
    const page = await this.page(lang, {
      title: `Halaman tidak ditemukan | ${BRAND_NAME[brand]}`, description: "Halaman tidak ditemukan.", alternates: [], noindex: true, ogType: "website", jsonLd: [],
    }, "<h1>Halaman tidak ditemukan</h1>");
    return { ...page, status: 404 };
  }

  private async effective(kind: "product" | "category", key: string, fallback: () => SeoText): Promise<SeoText> {
    try {
      return await this.seo.effective(siteConfig().brand, kind, key);
    } catch {
      return fallback();
    }
  }

  private async page(lang: Lang, head: Omit<HeadInput, "lang" | "siteName" | "verification">, ssr: string): Promise<RenderedPage> {
    const { brand, verification } = siteConfig();
    const shell = await this.shell.get();
    const body = injectShell(shell, { lang, head: buildHead({ ...head, lang, siteName: BRAND_NAME[brand], ...(verification ? { verification } : {}) }), ssr });
    const etag = `"${createHash("sha1").update(body).digest("hex")}"`;
    return { status: 200, body, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ETag: etag } };
  }
}
