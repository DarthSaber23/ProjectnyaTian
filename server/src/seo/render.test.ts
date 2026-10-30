import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCatalog } from "../domain/catalog";
import type { Product } from "../domain/types";
import type { CatalogService } from "../commerce/catalog.service";
import { PublicContentService } from "../content/public-content.service";
import { SeoService } from "../content/seo.service";
import type { PrismaService } from "../prisma.service";
import type { ArticleTextInput } from "../content/content.types";
import { SEO, contentHarness, enText, idText } from "../test/content-harness";
import { RenderController } from "./render.controller";
import { RenderService } from "./render.service";

const SHELL = '<!doctype html>\n<html lang="id">\n  <head>\n    <title>E-Commerce Starter · prototipe</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>';
const product = (id: string, slug: string, onHand: number): Product => ({
  id, brand: "sambung", slug, name: `Produk ${id}`, categoryId: "kabel", spec: "USB-C · 100W", art: { kind: "cable", bg: "#fff", accent: "#000" },
  variants: [{ sku: `${id}-1`, label: "1 m", price: 129000, onHand, reserved: 0 }], images: [],
});

async function setup() {
  const h = contentHarness({
    products: [{ id: "B01", storeId: "sambung", name: "Produk B01", spec: "USB-C · 100W" }, { id: "B02", storeId: "sambung", name: "Produk B02", spec: null }],
    categories: [{ id: "kabel", storeId: "sambung", name: "Kabel", slug: "kabel" }],
  });
  const catalog = buildCatalog([product("B01", "kabel-a", 5), product("B02", "kabel-b", 0)]);
  const catalogService = { snapshot: () => catalog } as unknown as CatalogService;
  const content = new PublicContentService(h.prisma as unknown as PrismaService, h.service, catalogService);
  content.now = () => h.clock.now;
  const seo = new SeoService(h.prisma as unknown as PrismaService, h.events);
  const shell = { calls: 0, fail: false, async get() { this.calls += 1; if (this.fail) throw new Error("down"); return SHELL; } };
  const render = new RenderService(shell, content, seo, catalogService, h.prisma as unknown as PrismaService, h.events);
  const publish = async (slug: string, opts: { english?: boolean; noindex?: boolean; products?: string[]; at?: string; id?: Partial<ArticleTextInput>; en?: Partial<ArticleTextInput> } = {}) => {
    const v = await h.service.create(SEO, "sambung", idText({ slug, noindex: opts.noindex ?? false, title: `Judul ${slug}`, ...opts.id }));
    const saved = await h.service.save(SEO, v.id, { version: 1, texts: opts.english ? { en: enText({ slug: `${slug}-en`, ...opts.en }) } : {}, tags: [], productIds: opts.products ?? [] });
    return h.service.publish(SEO, v.id, { version: saved.version, publishAt: opts.at });
  };
  return { h, render, shell, seo, publish };
}

beforeEach(() => { process.env.PUBLIC_BASE_URL = "http://shop.test"; });
afterEach(() => { delete process.env.PUBLIC_BASE_URL; delete process.env.GOOGLE_SITE_VERIFICATION; });

describe("RenderService pages", () => {
  it("article: 200 with title, canonical, hreflang pair, og, BlogPosting and BreadcrumbList, #ssr text and html lang", async () => {
    const { render, publish } = await setup();
    await publish("dua-bahasa", { english: true, products: ["B01"] });
    const page = await render.render("/blog/dua-bahasa");
    expect(page.status).toBe(200);
    expect(page.headers["Cache-Control"]).toBe("no-cache");
    expect(page.body).toContain("<title>Judul dua-bahasa</title>");
    expect(page.body).toContain('<meta property="og:title" content="Judul dua-bahasa">');
    expect(page.body).toContain('<link rel="canonical" href="http://shop.test/blog/dua-bahasa">');
    expect(page.body).toContain('hreflang="en" href="http://shop.test/en/blog/dua-bahasa-en"');
    expect(page.body).toContain('hreflang="x-default" href="http://shop.test/blog/dua-bahasa"');
    expect(page.body).toContain('"@type":"BlogPosting"');
    expect(page.body).toContain('"@type":"BreadcrumbList"');
    expect(page.body).toContain('<div id="ssr"><article><h1>Judul dua-bahasa</h1>');
    expect(page.body).toContain('<a href="/produk/kabel-a">Produk B01</a>');
    const en = await render.render("/en/blog/dua-bahasa-en");
    expect(en.body).toContain('<html lang="en">');
    expect(en.body).toContain("Products in this article");
  });

  it("Review Focus 5: a one-language article has no hreflang", async () => {
    const { render, publish } = await setup();
    await publish("satu-bahasa");
    expect((await render.render("/blog/satu-bahasa")).body).not.toContain("hreflang");
  });

  it("product: Product JSON-LD with IDR price and stock; an override title wins", async () => {
    const { render, seo, h } = await setup();
    const inStock = await render.render("/produk/kabel-a");
    expect(inStock.body).toContain("<title>Produk B01 | Sambung</title>");
    expect(inStock.body).toContain('"priceCurrency":"IDR","price":129000,"availability":"https://schema.org/InStock"');
    expect((await render.render("/produk/kabel-b")).body).toContain("https://schema.org/OutOfStock");
    await seo.set(SEO, "sambung", "product", "B01", { seoTitle: "Kabel USB-C 100W terbaik", metaDescription: null });
    void h;
    expect((await render.render("/produk/kabel-a")).body).toContain("<title>Kabel USB-C 100W terbaik</title>");
  });

  it("category and blog list render with their own titles", async () => {
    const { render, publish } = await setup();
    await publish("satu");
    expect((await render.render("/kategori/kabel")).body).toContain("<title>Kabel | Sambung</title>");
    const list = await render.render("/blog");
    expect(list.body).toContain("<title>Blog | Sambung</title>");
    expect(list.body).toContain('<a href="/blog/satu">Judul satu</a>');
  });

  it("old slug 301 with Location; unknown article, product and category 404; noindex adds robots", async () => {
    const { h, render, publish } = await setup();
    const live = await publish("lama");
    await h.service.save(SEO, live.id, { version: live.version, texts: { id: idText({ slug: "baru-sekali", title: "Judul baru" }) }, tags: [], productIds: [] });
    expect(await render.render("/blog/lama")).toMatchObject({ status: 301, headers: { Location: "/blog/baru-sekali" } });
    for (const path of ["/blog/tidak-ada", "/en/blog/baru-sekali", "/produk/tidak-ada", "/kategori/tidak-ada", "/blog/a/b"]) {
      const page = await render.render(path);
      expect(page.status, path).toBe(404);
      expect(page.body, path).toContain('<meta name="robots" content="noindex">');
    }
    await publish("rahasia", { noindex: true });
    expect((await render.render("/blog/rahasia")).body).toContain('<meta name="robots" content="noindex">');
  });

  it("Review Focus 2: a scheduled article is 404 until its time", async () => {
    const { h, render, publish } = await setup();
    await publish("nanti", { at: "2026-11-01T08:00:00+07:00" });
    expect((await render.render("/blog/nanti")).status).toBe(404);
    h.clock.now = "2026-11-01T08:00:00+07:00";
    render.clear();
    expect((await render.render("/blog/nanti")).status).toBe(200);
  });

  it("a shell fetch failure gives 502 so nginx can fall back to index.html", async () => {
    const { render, shell } = await setup();
    shell.fail = true;
    expect((await render.render("/produk/kabel-a")).status).toBe(502);
  });

  it("ETag and If-None-Match give 304; pages are cached until content changes", async () => {
    const { h, render, shell, publish } = await setup();
    const first = await render.render("/produk/kabel-a");
    expect(first.headers.ETag).toMatch(/^"[0-9a-f]+"$/);
    expect(await render.render("/produk/kabel-a", { ifNoneMatch: first.headers.ETag })).toMatchObject({ status: 304, body: "" });
    const calls = shell.calls;
    await render.render("/produk/kabel-a");
    expect(shell.calls).toBe(calls);
    await publish("artikel-baru");
    void h;
    await render.render("/produk/kabel-a");
    expect(shell.calls).toBe(calls + 1);
  });

  it("verification meta appears when GOOGLE_SITE_VERIFICATION is set", async () => {
    process.env.GOOGLE_SITE_VERIFICATION = "kode-uji";
    const { render } = await setup();
    expect((await render.render("/produk/kabel-a")).body).toContain('<meta name="google-site-verification" content="kode-uji">');
  });
});

const cacheOf = (render: RenderService) => (render as unknown as { cache: Map<string, unknown> }).cache;
const ldScripts = (body: string) => [...body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!));
const ldTypes = (body: string) => ldScripts(body).map((j) => j["@type"]);
const ldOf = (body: string, type: string) => ldScripts(body).find((j) => j["@type"] === type);

describe("RenderService review fixes", () => {
  it("findings 7/19/23: 404s are not cached and the cache never exceeds 500 entries", async () => {
    const { render } = await setup();
    for (let i = 0; i < 600; i++) expect((await render.render(`/blog/tidak-ada-${i}`)).status).toBe(404);
    expect(cacheOf(render).size).toBe(0);
    for (let n = 1; n <= 1000; n++) {
      expect((await render.render("/blog", { page: n })).status).toBe(200);
      expect(cacheOf(render).size).toBeLessThanOrEqual(500);
    }
    expect(cacheOf(render).size).toBe(500);
  });

  it("findings 8/17: $-patterns in titles and text come out literally", async () => {
    const { render, publish } = await setup();
    await publish("harga", { id: { title: "Harga $& dan $' dan $$ dan $`", body: "Biaya $& lalu $' serta $` dan $$.", seoTitle: "SEO $& $'" } });
    const body = (await render.render("/blog/harga")).body;
    expect(body).toContain("<title>SEO $&amp; $&#39;</title>");
    expect(body).toContain("<h1>Harga $&amp; dan $&#39; dan $$ dan $`</h1>");
    expect(body).toContain("Biaya $&amp; lalu $&#39; serta $` dan $$.");
    expect(body.match(/<\/head>/g)).toHaveLength(1);
    expect(body.match(/<div id="root">/g)).toHaveLength(1);
  });

  it("finding 21: hreflang only when both languages are indexable and neither has a canonical override", async () => {
    const { render, publish } = await setup();
    await publish("oke", { english: true });
    expect((await render.render("/blog/oke")).body).toContain("hreflang");
    await publish("en-noindex", { english: true, en: { noindex: true } });
    expect((await render.render("/blog/en-noindex")).body).not.toContain("hreflang");
    await publish("id-noindex", { english: true, noindex: true });
    expect((await render.render("/blog/id-noindex")).body).not.toContain("hreflang");
    expect((await render.render("/en/blog/id-noindex-en")).body).not.toContain("hreflang");
    await publish("id-canon", { english: true, id: { canonicalUrl: "https://other.test/a" } });
    expect((await render.render("/blog/id-canon")).body).not.toContain("hreflang");
    expect((await render.render("/en/blog/id-canon-en")).body).not.toContain("hreflang");
    await publish("en-canon", { english: true, en: { canonicalUrl: "https://other.test/b" } });
    expect((await render.render("/blog/en-canon")).body).not.toContain("hreflang");
  });

  it("finding 24: the blog list has CollectionPage and BreadcrumbList in both languages", async () => {
    const { render, publish } = await setup();
    await publish("satu", { english: true });
    const id = await render.render("/blog");
    expect(ldTypes(id.body)).toEqual(["CollectionPage", "BreadcrumbList"]);
    expect(ldOf(id.body, "BreadcrumbList").itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Beranda", item: "http://shop.test/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "http://shop.test/blog" },
    ]);
    const en = await render.render("/en/blog");
    expect(ldOf(en.body, "BreadcrumbList").itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "http://shop.test/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "http://shop.test/en/blog" },
    ]);
  });

  it("finding 25: an empty SEO title uses the bare title; a set one wins", async () => {
    const { render, publish } = await setup();
    await publish("polos");
    const bare = (await render.render("/blog/polos")).body;
    expect(bare).toContain("<title>Judul polos</title>");
    expect(bare).toContain('<meta property="og:title" content="Judul polos">');
    await publish("khusus", { id: { seoTitle: "Judul SEO khusus" } });
    expect((await render.render("/blog/khusus")).body).toContain('<meta property="og:title" content="Judul SEO khusus">');
  });

  it("finding 27: product page carries every tag", async () => {
    const { render } = await setup();
    const body = (await render.render("/produk/kabel-a")).body;
    expect(body).toContain("<title>Produk B01 | Sambung</title>");
    expect(body).toContain('<meta name="description" content="USB-C · 100W">');
    expect(body).toContain('<link rel="canonical" href="http://shop.test/produk/kabel-a">');
    expect(body).toContain('<meta property="og:type" content="product">');
    expect(body).toContain('<meta property="og:title" content="Produk B01 | Sambung">');
    expect(body).toContain('<meta property="og:url" content="http://shop.test/produk/kabel-a">');
    expect(ldTypes(body)).toEqual(["Product", "BreadcrumbList"]);
    expect(body).toContain('<div id="ssr"><article><h1>Produk B01</h1>');
    expect(body).toContain("Tersedia");
  });

  it("finding 27: category page carries every tag", async () => {
    const { render } = await setup();
    const body = (await render.render("/kategori/kabel")).body;
    expect(body).toContain("<title>Kabel | Sambung</title>");
    expect(body).toContain('<meta name="description" content="Belanja Kabel di Sambung.">');
    expect(body).toContain('<link rel="canonical" href="http://shop.test/kategori/kabel">');
    expect(body).toContain('<meta property="og:title" content="Kabel | Sambung">');
    expect(body).toContain('<meta property="og:url" content="http://shop.test/kategori/kabel">');
    expect(ldTypes(body)).toEqual(["CollectionPage", "BreadcrumbList"]);
    expect(body).toContain('<div id="ssr"><h1>Kabel</h1>');
    expect(body).toContain('<a href="/produk/kabel-a">Produk B01</a>');
  });

  it("finding 29: If-None-Match accepts a weak ETag and a comma-separated list", async () => {
    const { render } = await setup();
    const etag = (await render.render("/produk/kabel-a")).headers.ETag!;
    for (const header of [`W/${etag}`, `"zzz", ${etag}`, `W/"zzz", W/${etag}`]) {
      expect((await render.render("/produk/kabel-a", { ifNoneMatch: header })).status, header).toBe(304);
    }
    expect((await render.render("/produk/kabel-a", { ifNoneMatch: '"zzz", W/"yyy"' })).status).toBe(200);
  });
});

describe("RenderController with the real service (findings 18/30)", () => {
  const res = () => {
    const headers: Record<string, string> = {};
    return { headers, statusCode: 200, status(c: number) { this.statusCode = c; return this; }, setHeader(n: string, v: string) { headers[n] = v; }, removeHeader() {} };
  };
  const none = undefined as never;

  it("an encoded & or # in the slug looks up that exact slug and never another page", async () => {
    const { render, publish } = await setup();
    await publish("abc");
    const controller = new RenderController(render);
    const spy = vi.spyOn(render, "render");
    for (const uri of ["/blog/a%26b", "/blog/a%23x?utm=1"]) {
      const r = res();
      await controller.page(none, none, none, r, uri);
      expect(r.statusCode, uri).toBe(404);
    }
    expect(spy).toHaveBeenNthCalledWith(1, "/blog/a&b", expect.objectContaining({ page: 1 }));
    expect(spy).toHaveBeenNthCalledWith(2, "/blog/a#x", expect.objectContaining({ page: 1 }));
  });

  it("a malformed escape is a 404 page, not a 502", async () => {
    const { render } = await setup();
    const r = res();
    await new RenderController(render).page(none, none, none, r, "/blog/%E0%A4%A");
    expect(r.statusCode).toBe(404);
    expect(r.headers["Content-Type"]).toContain("text/html");
  });

  it("page comes from X-Render-Uri's query string; the path/page query params still work without it", async () => {
    const { render, publish } = await setup();
    const controller = new RenderController(render);
    const spy = vi.spyOn(render, "render");
    await controller.page(none, none, none, res(), "/blog?page=2");
    expect(spy).toHaveBeenLastCalledWith("/blog", expect.objectContaining({ page: 2 }));
    await controller.page("/produk/kabel-a", "3", none, res());
    expect(spy).toHaveBeenLastCalledWith("/produk/kabel-a", expect.objectContaining({ page: 3 }));
    await publish("xyz");
    await controller.page("/produk/kabel-a", "1", none, res(), "/blog/xyz?path=/produk/kabel-a");
    expect(spy).toHaveBeenLastCalledWith("/blog/xyz", expect.anything());
  });
});

describe("sitemap.xml", () => {
  it("lists home, categories, products, blog and indexable live articles with alternates", async () => {
    const { render, publish } = await setup();
    await publish("dua-bahasa", { english: true });
    await publish("rahasia", { noindex: true });
    await publish("nanti", { at: "2026-11-01T08:00:00+07:00" });
    const xml = await render.sitemap();
    for (const loc of ["http://shop.test/", "http://shop.test/kategori/kabel", "http://shop.test/produk/kabel-a", "http://shop.test/blog", "http://shop.test/blog/dua-bahasa", "http://shop.test/en/blog/dua-bahasa-en"]) {
      expect(xml, loc).toContain(`<loc>${loc}</loc>`);
    }
    expect(xml).not.toContain("rahasia");
    expect(xml).not.toContain("nanti");
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="http://shop.test/en/blog/dua-bahasa-en"/>');
  });
});
