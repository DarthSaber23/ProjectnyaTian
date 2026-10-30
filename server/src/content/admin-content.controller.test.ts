import "reflect-metadata";
import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AdminContentController } from "./admin-content.controller";
import type { ArticleService } from "./article.service";
import type { SeoService } from "./seo.service";

const actor = { id: "U-05", label: "Sinta P. (SEO)" };
const req = { staffActor: actor };
const text = { slug: "a-b-c", title: "Judul", seoTitle: null, metaDescription: "", summary: "", body: "", noindex: false, canonicalUrl: null };

function controller() {
  const articles = {
    list: vi.fn(async () => []), create: vi.fn(async () => ({ id: "a1" })), get: vi.fn(async () => ({ id: "a1" })), save: vi.fn(async () => ({ id: "a1" })),
    publish: vi.fn(async () => ({ id: "a1" })), unpublish: vi.fn(async () => ({ id: "a1" })), remove: vi.fn(async () => ({ ok: true })),
    setCover: vi.fn(async () => ({ id: "a1" })), removeCover: vi.fn(async () => ({ id: "a1" })), addBodyImage: vi.fn(async () => ({ src: "/x" })),
  };
  const seo = { rows: vi.fn(async () => []), set: vi.fn(async () => undefined), clear: vi.fn(async () => undefined) };
  return { articles, seo, c: new AdminContentController(articles as unknown as ArticleService, seo as unknown as SeoService) };
}
const refused = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as HttpException).getStatus(); } return 200; };

describe("AdminContentController", () => {
  it("passes bodies through to the services with the staff actor", async () => {
    const { articles, seo, c } = controller();
    await c.list("sambung");
    expect(articles.list).toHaveBeenCalledWith("sambung");
    await c.create(req, { store: "sambung", text });
    expect(articles.create).toHaveBeenCalledWith(actor, "sambung", text);
    await c.save(req, "a1", { version: 2, texts: { id: text, en: null }, tags: ["kabel"], productIds: ["B01"] });
    expect(articles.save).toHaveBeenCalledWith(actor, "a1", { version: 2, texts: { id: text, en: null }, tags: ["kabel"], productIds: ["B01"] });
    await c.publish(req, "a1", { version: 3, publishAt: "2026-11-01T08:00:00+07:00" });
    expect(articles.publish).toHaveBeenCalledWith(actor, "a1", { version: 3, publishAt: "2026-11-01T08:00:00+07:00" });
    await c.setSeo(req, "product", "B01", { store: "sambung", seoTitle: "Judul", metaDescription: null });
    expect(seo.set).toHaveBeenCalledWith(actor, "sambung", "product", "B01", { seoTitle: "Judul", metaDescription: null });
  });

  it("refuses an unknown store, a missing version and a malformed body with 422", () => {
    const { c } = controller();
    expect(refused(() => c.list("toko-lain"))).toBe(422);
    expect(refused(() => c.create(req, { store: "sambung", text: "x" }))).toBe(422);
    expect(refused(() => c.save(req, "a1", { texts: {}, tags: [], productIds: [] }))).toBe(422);
    expect(refused(() => c.save(req, "a1", { version: 1, texts: [], tags: [], productIds: [] }))).toBe(422);
    expect(refused(() => c.publish(req, "a1", {}))).toBe(422);
  });

  it("an upload without a file gives 422 'Pilih satu file foto.'", () => {
    const { c } = controller();
    let error: unknown;
    try { c.setCover(req, "a1", undefined, {}); } catch (e) { error = e; }
    expect((error as HttpException).getResponse()).toEqual({ code: "VALIDATION", message: "Pilih satu file foto." });
  });
});
