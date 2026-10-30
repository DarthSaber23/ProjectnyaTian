import { afterEach, describe, expect, it, vi } from "vitest";
import { admin } from "../services/http/admin";
import { backend } from "../services/http/backend";

afterEach(() => vi.unstubAllGlobals());

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return () => fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? "GET", typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ?? null] as const);
}

const text = { slug: "a-b-c", title: "Judul", seoTitle: null, metaDescription: "", summary: "", body: "", noindex: false, canonicalUrl: null };

describe("admin article and SEO client", () => {
  it("article routes use the paths and bodies of spec section 3", async () => {
    const calls = stub({});
    await admin.listArticles("sambung");
    await admin.getArticle("a1");
    await admin.createArticle("sambung", text);
    await admin.saveArticle("a1", { version: 2, texts: { id: text, en: null }, tags: ["kabel"], productIds: ["B01"] });
    await admin.publishArticle("a1", 3, "2026-11-01T08:00:00+07:00");
    await admin.publishArticle("a1", 3);
    await admin.unpublishArticle("a1", 4);
    await admin.deleteArticle("a1");
    await admin.removeArticleCover("a1");
    expect(calls()).toEqual([
      ["/v1/admin/articles?store=sambung", "GET", null],
      ["/v1/admin/articles/a1", "GET", null],
      ["/v1/admin/articles", "POST", { store: "sambung", text }],
      ["/v1/admin/articles/a1", "PUT", { version: 2, texts: { id: text, en: null }, tags: ["kabel"], productIds: ["B01"] }],
      ["/v1/admin/articles/a1/publish", "POST", { version: 3, publishAt: "2026-11-01T08:00:00+07:00" }],
      ["/v1/admin/articles/a1/publish", "POST", { version: 3, publishAt: null }],
      ["/v1/admin/articles/a1/unpublish", "POST", { version: 4 }],
      ["/v1/admin/articles/a1", "DELETE", null],
      ["/v1/admin/articles/a1/cover", "DELETE", null],
    ]);
  });

  it("cover and body image uploads are multipart without a content-type header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    await admin.uploadArticleCover("a1", file, "Sampul", true);
    await admin.uploadArticleImage("a1", file, true);
    const [[coverUrl, cover], [imageUrl, image]] = fetchMock.mock.calls as unknown as [[string, RequestInit], [string, RequestInit]];
    expect(coverUrl).toBe("/v1/admin/articles/a1/cover");
    expect(imageUrl).toBe("/v1/admin/articles/a1/images");
    for (const init of [cover, image]) {
      expect(init.body).toBeInstanceOf(FormData);
      expect(new Headers(init.headers).get("content-type")).toBeNull();
      expect((init.body as FormData).get("rightsConfirmed")).toBe("true");
    }
    expect((cover.body as FormData).get("alt")).toBe("Sampul");
  });

  it("SEO routes", async () => {
    const calls = stub([]);
    await admin.seoRows("sambung", "product");
    await admin.setSeo("sambung", "category", "kabel", "Judul", null);
    await admin.clearSeo("sambung", "product", "B01");
    expect(calls()).toEqual([
      ["/v1/admin/seo?store=sambung&kind=product", "GET", null],
      ["/v1/admin/seo/category/kabel", "PUT", { store: "sambung", seoTitle: "Judul", metaDescription: null }],
      ["/v1/admin/seo/product/B01?store=sambung", "DELETE", null],
    ]);
  });
});

describe("public article client", () => {
  it("lists, reads and finds related articles; a missing article is null", async () => {
    const calls = stub({ page: 1, pages: 1, items: [] });
    await backend.articles("en", 2);
    await backend.productArticles("kabel-usb-c");
    expect(calls().map(([url]) => url)).toEqual(["/v1/articles?lang=en&page=2", "/v1/products/kabel-usb-c/articles"]);
    stub({ error: { code: "NOT_FOUND", message: "Artikel tidak ditemukan." } }, 404);
    await expect(backend.article("id", "tidak-ada")).resolves.toBeNull();
    stub({ id: "a1", slug: "ada" });
    await expect(backend.article("id", "ada")).resolves.toMatchObject({ slug: "ada" });
  });
});
