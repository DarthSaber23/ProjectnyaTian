import { describe, expect, it } from "vitest";
import type { PrismaService } from "../prisma.service";
import { fakeContentDb } from "../test/fake-content-db";
import { SEO, outcome } from "../test/content-harness";
import { ContentEvents } from "./content-events";
import { SeoService } from "./seo.service";

function harness() {
  const db = fakeContentDb({
    products: [
      { id: "B01", storeId: "sambung", slug: "kabel-usb-c", name: "Kabel USB-C", spec: "USB-C ke USB-C · 100W" },
      { id: "B02", storeId: "sambung", slug: "adaptor", name: "Adaptor", spec: null },
      { id: "A01", storeId: "halimun", name: "Krim", spec: "50 ml" },
    ],
    categories: [{ id: "kabel", storeId: "sambung", name: "Kabel", slug: "kabel-data" }],
  });
  const events = new ContentEvents();
  let changes = 0;
  events.subscribe(() => { changes += 1; });
  const service = new SeoService(db.prisma as unknown as PrismaService, events);
  service.now = () => "2026-10-30T10:00:00+07:00";
  return { ...db, service, changes: () => changes };
}

describe("SeoService", () => {
  it("rows list the store's products with automatic text and no override", async () => {
    const h = harness();
    expect(await h.service.rows("sambung", "product")).toEqual([
      { key: "B02", name: "Adaptor", path: "/produk/adaptor", auto: { title: "Adaptor | Sambung", description: "Beli Adaptor di Sambung." }, override: null },
      { key: "B01", name: "Kabel USB-C", path: "/produk/kabel-usb-c", auto: { title: "Kabel USB-C | Sambung", description: "USB-C ke USB-C · 100W" }, override: null },
    ]);
    expect((await h.service.rows("sambung", "category")).map((r) => r.path)).toEqual(["/kategori/kabel-data"]);
    expect((await h.service.rows("sambung", "category")).map((r) => r.auto)).toEqual([{ title: "Kabel | Sambung", description: "Belanja Kabel di Sambung." }]);
  });

  it("set stores an override, audits it and wins in effective(); clear returns to automatic", async () => {
    const h = harness();
    await h.service.set(SEO, "sambung", "product", "B01", { seoTitle: "Kabel USB-C 100W terbaik", metaDescription: null });
    expect(await h.service.effective("sambung", "product", "B01")).toEqual({ title: "Kabel USB-C 100W terbaik", description: "USB-C ke USB-C · 100W" });
    expect(h.state.audit.at(-1)).toMatchObject({ code: "SEO_OVERRIDE_CHANGED", object: "product:B01", after: { seoTitle: "Kabel USB-C 100W terbaik", metaDescription: null, actorId: "U-05" } });
    await h.service.clear(SEO, "sambung", "product", "B01");
    expect(await h.service.effective("sambung", "product", "B01")).toEqual({ title: "Kabel USB-C | Sambung", description: "USB-C ke USB-C · 100W" });
    expect(h.state.audit).toHaveLength(2);
    expect(h.changes()).toBe(2);
  });

  it("lengths, unknown keys, other stores and kinds are refused without writing", async () => {
    const h = harness();
    expect(await outcome(h.service.set(SEO, "sambung", "product", "B01", { seoTitle: "x".repeat(61), metaDescription: null }))).toBe("422 VALIDATION Judul SEO maksimal 60 karakter.");
    expect(await outcome(h.service.set(SEO, "sambung", "product", "B01", { seoTitle: null, metaDescription: "x".repeat(161) }))).toBe("422 VALIDATION Deskripsi meta maksimal 160 karakter.");
    expect(await outcome(h.service.set(SEO, "sambung", "product", "A01", { seoTitle: "x", metaDescription: null }))).toBe("404 NOT_FOUND Produk atau kategori tidak ditemukan.");
    expect(await outcome(h.service.set(SEO, "sambung", "category", "nope", { seoTitle: "x", metaDescription: null }))).toBe("404 NOT_FOUND Produk atau kategori tidak ditemukan.");
    expect(await outcome(h.service.set(SEO, "sambung", "page" as never, "tentang", { seoTitle: "x", metaDescription: null }))).toBe("422 VALIDATION Jenis SEO tidak dikenal.");
    expect(h.state.overrides).toHaveLength(0);
    expect(h.state.audit).toHaveLength(0);
  });

  it("an override with both fields empty is the same as clearing it", async () => {
    const h = harness();
    await h.service.set(SEO, "sambung", "product", "B01", { seoTitle: "Judul", metaDescription: null });
    await h.service.set(SEO, "sambung", "product", "B01", { seoTitle: "  ", metaDescription: "" });
    expect(h.state.overrides).toHaveLength(0);
  });
});
