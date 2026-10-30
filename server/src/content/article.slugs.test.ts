import { describe, expect, it } from "vitest";
import { NOW, SEO, contentHarness, enText, idText, outcome } from "../test/content-harness";

async function published(h: ReturnType<typeof contentHarness>, slug: string, withEnglish = false) {
  const v = await h.service.create(SEO, "sambung", idText({ slug }));
  const saved = withEnglish ? await h.service.save(SEO, v.id, { version: 1, texts: { en: enText() }, tags: [], productIds: [] }) : v;
  return h.service.publish(SEO, v.id, { version: saved.version });
}
const rename = (h: ReturnType<typeof contentHarness>, id: string, version: number, slug: string) =>
  h.service.save(SEO, id, { version, texts: { id: idText({ slug }) }, tags: [], productIds: [] });

describe("article slugs and redirects", () => {
  it("a slug taken in the same store and language gives 409; another language or store is allowed", async () => {
    const h = contentHarness();
    await h.service.create(SEO, "sambung", idText({ slug: "sama" }));
    expect(await outcome(h.service.create(SEO, "sambung", idText({ slug: "sama" })))).toBe("409 CONFLICT Slug sudah dipakai artikel lain.");
    await expect(h.service.create(SEO, "halimun", idText({ slug: "sama" }))).resolves.toMatchObject({ store: "halimun" });
    const other = await h.service.create(SEO, "sambung", idText({ slug: "lain" }));
    await expect(h.service.save(SEO, other.id, { version: 1, texts: { en: enText({ slug: "sama" }) }, tags: [], productIds: [] })).resolves.toMatchObject({ version: 2 });
  });

  it("reserved and malformed slugs give 422", async () => {
    const h = contentHarness();
    expect(await outcome(h.service.create(SEO, "sambung", idText({ slug: "baru" })))).toBe("422 VALIDATION Slug ini tidak boleh dipakai.");
    expect(await outcome(h.service.create(SEO, "sambung", idText({ slug: "Bad Slug" })))).toBe("422 VALIDATION Slug hanya huruf kecil, angka dan tanda hubung (3–80 karakter).");
  });

  it("renaming a draft creates no redirect", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText({ slug: "draf-a" }));
    await rename(h, v.id, 1, "draf-b");
    expect(h.state.redirects).toHaveLength(0);
  });

  it("Review Focus 1: A -> B -> C keeps 301s from A and B to C; a new article taking A serves A and removes its redirect", async () => {
    const h = contentHarness();
    const live = await published(h, "slug-a");
    const b = await rename(h, live.id, live.version, "slug-b");
    await rename(h, live.id, b.version, "slug-c");
    expect(h.state.audit.filter((a) => a.code === "ARTICLE_SLUG_CHANGED")).toHaveLength(2);
    expect(await h.service.resolvePublic("sambung", "id", "slug-a", NOW)).toEqual({ redirectTo: "slug-c" });
    expect(await h.service.resolvePublic("sambung", "id", "slug-b", NOW)).toEqual({ redirectTo: "slug-c" });
    expect(await h.service.resolvePublic("sambung", "id", "slug-c", NOW)).toMatchObject({ article: { id: live.id } });

    const newcomer = await published(h, "slug-a");
    expect(await h.service.resolvePublic("sambung", "id", "slug-a", NOW)).toMatchObject({ article: { id: newcomer.id } });
    expect(h.state.redirects.map((r) => r.fromSlug)).toEqual(["slug-b"]);
  });

  it("renaming back to an old slug removes that redirect instead of looping", async () => {
    const h = contentHarness();
    const live = await published(h, "awal");
    const b = await rename(h, live.id, live.version, "kedua");
    await rename(h, live.id, b.version, "awal");
    expect(h.state.redirects.map((r) => r.fromSlug)).toEqual(["kedua"]);
    expect(await h.service.resolvePublic("sambung", "id", "awal", NOW)).toMatchObject({ article: { id: live.id } });
  });

  it("Review Focus 5: removing the English version of a published article makes the English URL unknown", async () => {
    const h = contentHarness();
    const live = await published(h, "dua-bahasa", true);
    expect(await h.service.resolvePublic("sambung", "en", "choosing-a-usb-c-cable", NOW)).toMatchObject({ article: { id: live.id } });
    const saved = await h.service.save(SEO, live.id, { version: live.version, texts: { en: null }, tags: [], productIds: [] });
    expect(saved.texts.en).toBeUndefined();
    expect(await h.service.resolvePublic("sambung", "en", "choosing-a-usb-c-cable", NOW)).toBeNull();
  });

  it("the Bahasa version cannot be removed", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    expect(await outcome(h.service.save(SEO, v.id, { version: 1, texts: { id: null }, tags: [], productIds: [] }))).toBe("422 VALIDATION Versi Bahasa Indonesia wajib ada.");
  });

  it("an unpublished article's URL is unknown and its old slugs do not redirect", async () => {
    const h = contentHarness();
    const live = await published(h, "lama");
    const b = await rename(h, live.id, live.version, "baru-sekali");
    await h.service.unpublish(SEO, live.id, { version: b.version });
    expect(await h.service.resolvePublic("sambung", "id", "baru-sekali", NOW)).toBeNull();
    expect(await h.service.resolvePublic("sambung", "id", "lama", NOW)).toBeNull();
  });

  it("Finding 4: a draft taking a redirected slug leaves the 301 alone until that draft is published", async () => {
    const h = contentHarness();
    const live = await published(h, "slug-a");
    await rename(h, live.id, live.version, "slug-b");
    const draft = await h.service.create(SEO, "sambung", idText({ slug: "slug-a", title: "Artikel baru" }));
    expect(h.state.redirects.map((r) => r.fromSlug)).toEqual(["slug-a"]);
    expect(await h.service.resolvePublic("sambung", "id", "slug-a", NOW)).toEqual({ redirectTo: "slug-b" });
    const now = await h.service.publish(SEO, draft.id, { version: draft.version });
    expect(h.state.redirects).toHaveLength(0);
    expect(await h.service.resolvePublic("sambung", "id", "slug-a", NOW)).toMatchObject({ article: { id: now.id } });
  });

  it("Finding 4: renaming a draft onto a redirected slug keeps the redirect too", async () => {
    const h = contentHarness();
    const live = await published(h, "slug-a");
    await rename(h, live.id, live.version, "slug-b");
    const draft = await h.service.create(SEO, "sambung", idText({ slug: "slug-x", title: "Artikel baru" }));
    await rename(h, draft.id, draft.version, "slug-a");
    expect(await h.service.resolvePublic("sambung", "id", "slug-a", NOW)).toEqual({ redirectTo: "slug-b" });
  });

  it("Finding 4: an English slug redirect is released when the draft that took it goes live", async () => {
    const h = contentHarness();
    const live = await published(h, "dua-bahasa", true);
    await h.service.save(SEO, live.id, { version: live.version, texts: { en: enText({ slug: "renamed-cable" }) }, tags: [], productIds: [] });
    expect(h.state.redirects.map((r) => r.fromSlug)).toEqual(["choosing-a-usb-c-cable"]);
    const draft = await h.service.create(SEO, "sambung", idText({ slug: "satu-lagi" }));
    const saved = await h.service.save(SEO, draft.id, { version: draft.version, texts: { en: enText({ slug: "choosing-a-usb-c-cable", title: "Another" }) }, tags: [], productIds: [] });
    expect(h.state.redirects).toHaveLength(1);
    await h.service.publish(SEO, draft.id, { version: saved.version });
    expect(h.state.redirects).toHaveLength(0);
  });
});
