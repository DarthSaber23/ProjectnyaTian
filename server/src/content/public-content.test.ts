import { afterEach, describe, expect, it } from "vitest";
import { cachePolicy } from "../cache-policy";
import type { CatalogService } from "../commerce/catalog.service";
import type { PrismaService } from "../prisma.service";
import { siteConfig } from "../seo/site-config";
import { NOW, SEO, contentHarness, enText, idText } from "../test/content-harness";
import { PublicContentService } from "./public-content.service";

const catalogueProducts = [
  { id: "B01", slug: "kabel-usb-c", name: "Kabel USB-C", brand: "sambung", variants: [] },
  { id: "B02", slug: "adaptor", name: "Adaptor", brand: "sambung", variants: [] },
];

async function setup() {
  const h = contentHarness();
  const catalog = {
    snapshot: () => ({ products: catalogueProducts }),
    bySlug: (slug: string) => catalogueProducts.find((p) => p.slug === slug) ?? null,
  } as unknown as CatalogService;
  const service = new PublicContentService(h.prisma as unknown as PrismaService, h.service, catalog);
  service.now = () => h.clock.now;
  const publish = async (slug: string, opts: { at?: string; english?: boolean; products?: string[] } = {}) => {
    const v = await h.service.create(SEO, "sambung", idText({ slug, title: `Judul ${slug}` }));
    const saved = await h.service.save(SEO, v.id, { version: 1, texts: opts.english ? { en: enText({ slug: `${slug}-en` }) } : {}, tags: [], productIds: opts.products ?? [] });
    return h.service.publish(SEO, v.id, { version: saved.version, publishAt: opts.at });
  };
  return { h, service, publish };
}

afterEach(() => {
  delete process.env.SITE_BRAND;
  delete process.env.PUBLIC_BASE_URL;
});

describe("siteConfig", () => {
  it("reads PUBLIC_BASE_URL without a trailing slash and SITE_BRAND with sambung as default", () => {
    process.env.PUBLIC_BASE_URL = "http://43.159.54.222/";
    expect(siteConfig()).toMatchObject({ baseUrl: "http://43.159.54.222", brand: "sambung" });
    process.env.SITE_BRAND = "halimun";
    expect(siteConfig().brand).toBe("halimun");
  });

  it("refuses an unknown SITE_BRAND", () => {
    process.env.SITE_BRAND = "toko-lain";
    expect(() => siteConfig()).toThrow(/SITE_BRAND/);
  });
});

describe("PublicContentService", () => {
  it("lists live articles newest first, 12 per page, cards only", async () => {
    const { h, service, publish } = await setup();
    for (let i = 0; i < 13; i++) {
      h.clock.now = `2026-10-${String(10 + i).padStart(2, "0")}T10:00:00+07:00`;
      await publish(`artikel-${i}`);
    }
    h.clock.now = NOW;
    const first = await service.list("sambung", "id", 1);
    expect(first).toMatchObject({ page: 1, pages: 2 });
    expect(first.items).toHaveLength(12);
    expect(first.items[0]).toMatchObject({ slug: "artikel-12", lang: "id", readingMinutes: 1, cover: null });
    expect(Object.keys(first.items[0]!)).not.toContain("html");
    expect((await service.list("sambung", "id", 2)).items.map((c) => c.slug)).toEqual(["artikel-0"]);
  });

  it("Review Focus 2: a scheduled article is absent from the list, its page and related articles until its time", async () => {
    const { h, service, publish } = await setup();
    await publish("nanti", { at: "2026-11-01T08:00:00+07:00", products: ["B01"] });
    expect((await service.list("sambung", "id", 1)).items).toEqual([]);
    expect(await service.article("sambung", "id", "nanti")).toBeNull();
    expect(await service.forProduct("sambung", "kabel-usb-c")).toEqual([]);
    h.clock.now = "2026-11-01T08:00:00+07:00";
    expect((await service.list("sambung", "id", 1)).items.map((c) => c.slug)).toEqual(["nanti"]);
    expect((await service.forProduct("sambung", "kabel-usb-c")).map((c) => c.slug)).toEqual(["nanti"]);
  });

  it("an article page carries rendered html, both languages and its live catalogue products in order", async () => {
    const { service, publish } = await setup();
    await publish("lengkap", { english: true, products: ["B02", "B01"] });
    const page = await service.article("sambung", "id", "lengkap");
    expect(page).toMatchObject({ slug: "lengkap", html: "<h2>Daya</h2>\n<p>Laptop butuh 65W ke atas.</p>", otherLang: { lang: "en", slug: "lengkap-en" }, authorName: "Sinta P." });
    expect((page as { products: { id: string }[] }).products.map((p) => p.id)).toEqual(["B02", "B01"]);
    expect(await service.article("sambung", "en", "lengkap-en")).toMatchObject({ lang: "en", otherLang: { lang: "id", slug: "lengkap" } });
    expect((await service.list("sambung", "en", 1)).items.map((c) => c.slug)).toEqual(["lengkap-en"]);
  });

  it("Review Focus 3: a linked product that left the catalogue is skipped, never an error", async () => {
    const { h, service, publish } = await setup();
    h.state.products.push({ id: "B09", storeId: "sambung", name: "Lama" });
    await publish("produk-hilang", { products: ["B09", "B01"] });
    expect(((await service.article("sambung", "id", "produk-hilang")) as { products: { id: string }[] }).products.map((p) => p.id)).toEqual(["B01"]);
  });

  it("an old slug answers a redirect; an unknown slug or a missing English version answers null", async () => {
    const { h, service, publish } = await setup();
    const live = await publish("lama");
    await h.service.save(SEO, live.id, { version: live.version, texts: { id: idText({ slug: "baru-sekali" }) }, tags: [], productIds: [] });
    expect(await service.article("sambung", "id", "lama")).toEqual({ redirect: "baru-sekali" });
    expect(await service.article("sambung", "id", "tidak-ada")).toBeNull();
    expect(await service.article("sambung", "en", "baru-sekali")).toBeNull();
  });

  it("related articles: at most 3, newest first, other store's article never shown", async () => {
    const { h, service, publish } = await setup();
    for (let i = 0; i < 4; i++) {
      h.clock.now = `2026-10-2${i}T10:00:00+07:00`;
      await publish(`terkait-${i}`, { products: ["B01"] });
    }
    h.clock.now = NOW;
    expect((await service.forProduct("sambung", "kabel-usb-c")).map((c) => c.slug)).toEqual(["terkait-3", "terkait-2", "terkait-1"]);
    expect(await service.forProduct("halimun", "kabel-usb-c")).toEqual([]);
    expect(await service.forProduct("sambung", "tidak-ada")).toEqual([]);
  });
});

describe("cache policy for public article reads", () => {
  it("article reads cache like the catalogue; admin article routes stay private", () => {
    const catalogue = "public, max-age=15, stale-while-revalidate=45";
    expect(cachePolicy("GET", "/v1/articles")).toBe(catalogue);
    expect(cachePolicy("GET", "/v1/articles/cara-memilih-kabel")).toBe(catalogue);
    expect(cachePolicy("GET", "/v1/products/kabel-usb-c/articles")).toBe(catalogue);
    expect(cachePolicy("GET", "/v1/admin/articles")).toBe("private, no-store");
    expect(cachePolicy("POST", "/v1/articles")).toBe("private, no-store");
  });
});
