import { describe, expect, it } from "vitest";
import { solidJpeg } from "../test/image-fixtures";
import { NOW, OWNER, SEO, contentHarness, enText, idText, outcome } from "../test/content-harness";

const file = (buffer: Buffer) => ({ buffer, originalname: "sampul.jpg", size: buffer.length });

describe("ArticleService", () => {
  it("create makes a draft with version 1, the Bahasa text, the author and one ARTICLE_CREATED entry", async () => {
    const h = contentHarness();
    const view = await h.service.create(SEO, "sambung", idText());
    expect(view).toMatchObject({ store: "sambung", status: "draft", version: 1, authorId: "U-05", authorName: "Sinta P.", live: false, productIds: [] });
    expect(view.texts.id).toMatchObject({ slug: "cara-memilih-kabel", title: "Cara memilih kabel USB-C" });
    expect(h.state.audit).toEqual([expect.objectContaining({ code: "ARTICLE_CREATED", object: view.id, actor: SEO.label, after: expect.objectContaining({ actorId: "U-05", slug: "cara-memilih-kabel" }) })]);
  });

  it("create fills an empty slug from the title and refuses a missing title", async () => {
    const h = contentHarness();
    expect((await h.service.create(SEO, "sambung", idText({ slug: "" }))).texts.id?.slug).toBe("cara-memilih-kabel-usb-c");
    expect(await outcome(h.service.create(SEO, "sambung", idText({ title: "", slug: "" })))).toBe("422 VALIDATION Judul wajib diisi.");
  });

  it("save with a stale version gives 409 and writes nothing", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    await h.service.save(OWNER, v.id, { version: 1, texts: { id: idText({ title: "Judul baru" }) }, tags: [], productIds: [] });
    const audit = h.state.audit.length;
    expect(await outcome(h.service.save(SEO, v.id, { version: 1, texts: { id: idText({ title: "Lain" }) }, tags: [], productIds: [] })))
      .toBe("409 CONFLICT Artikel diubah orang lain. Muat ulang halaman.");
    expect(h.state.texts.find((t) => t.articleId === v.id)!.title).toBe("Judul baru");
    expect(h.state.audit.length).toBe(audit);
  });

  it("save writes ARTICLE_UPDATED with only the changed fields", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    await h.service.save(SEO, v.id, { version: 1, texts: { id: idText({ title: "Judul baru" }) }, tags: ["kabel"], productIds: ["B01"] });
    const entry = h.state.audit.at(-1)!;
    expect(entry).toMatchObject({ code: "ARTICLE_UPDATED", object: v.id });
    expect(entry.before).toEqual({ "id.title": "Cara memilih kabel USB-C", tags: [], productIds: [] });
    expect(entry.after).toEqual({ "id.title": "Judul baru", tags: ["kabel"], productIds: ["B01"], actorId: "U-05" });
  });

  it("publish refuses missing Bahasa fields, an incomplete English row and a cover without alt", async () => {
    const h = contentHarness();
    const draft = await h.service.create(SEO, "sambung", idText({ summary: "" }));
    expect(await outcome(h.service.publish(SEO, draft.id, { version: 1 }))).toBe("422 VALIDATION Lengkapi Ringkasan sebelum terbit.");
    const v = await h.service.save(SEO, draft.id, { version: 1, texts: { id: idText(), en: enText({ metaDescription: "" }) }, tags: [], productIds: [] });
    expect(await outcome(h.service.publish(SEO, draft.id, { version: v.version }))).toBe("422 VALIDATION Lengkapi versi English atau hapus dulu.");
    h.state.articles[0]!.coverHash = "0123456789abcdef0123456789abcdef";
    h.state.articles[0]!.coverSizes = [480];
    const fixed = await h.service.save(SEO, draft.id, { version: v.version, texts: { en: enText() }, tags: [], productIds: [] });
    expect(await outcome(h.service.publish(SEO, draft.id, { version: fixed.version }))).toBe("422 VALIDATION Lengkapi teks alternatif sampul.");
  });

  it("publish now makes the article live with publishedAt; ARTICLE_PUBLISHED", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const live = await h.service.publish(SEO, v.id, { version: 1 });
    expect(live).toMatchObject({ status: "published", publishAt: NOW, publishedAt: NOW, live: true, version: 2 });
    expect(h.state.audit.at(-1)).toMatchObject({ code: "ARTICLE_PUBLISHED" });
  });

  it("schedule: a past time gives 422; a future one is live only once that time has passed", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    expect(await outcome(h.service.publish(SEO, v.id, { version: 1, publishAt: "2026-10-29T10:00:00+07:00" }))).toBe("422 VALIDATION Waktu terbit harus di masa depan.");
    const scheduled = await h.service.publish(SEO, v.id, { version: 1, publishAt: "2026-11-01T08:00:00+07:00" });
    expect(scheduled).toMatchObject({ status: "published", live: false });
    expect(h.state.audit.at(-1)).toMatchObject({ code: "ARTICLE_SCHEDULED" });
    expect(await h.service.resolvePublic("sambung", "id", "cara-memilih-kabel", NOW)).toBeNull();
    expect(await h.service.resolvePublic("sambung", "id", "cara-memilih-kabel", "2026-11-01T08:00:00+07:00")).toMatchObject({ article: { id: v.id } });
  });

  it("products: another store, unknown, or more than 6 give 422; the order is kept", async () => {
    const h = contentHarness({ products: Array.from({ length: 8 }, (_, i) => ({ id: `B0${i}`, storeId: "sambung" })).concat([{ id: "A01", storeId: "halimun" }]) });
    const v = await h.service.create(SEO, "sambung", idText());
    const save = (productIds: string[]) => h.service.save(SEO, v.id, { version: 1, texts: {}, tags: [], productIds });
    expect(await outcome(save(["A01"]))).toBe("422 VALIDATION Produk tidak ada di toko ini.");
    expect(await outcome(save(["NOPE"]))).toBe("422 VALIDATION Produk tidak ada di toko ini.");
    expect(await outcome(save(["B00", "B01", "B02", "B03", "B04", "B05", "B06"]))).toBe("422 VALIDATION Maksimal 6 produk per artikel.");
    expect((await save(["B03", "B01", "B02"])).productIds).toEqual(["B03", "B01", "B02"]);
  });

  it("unpublish then remove; removing a published article gives 409", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const live = await h.service.publish(SEO, v.id, { version: 1 });
    expect(await outcome(h.service.remove(SEO, v.id))).toBe("409 CONFLICT Batalkan terbit dulu sebelum menghapus.");
    const off = await h.service.unpublish(SEO, v.id, { version: live.version });
    expect(off).toMatchObject({ status: "unpublished", live: false });
    await h.service.remove(SEO, v.id);
    expect(h.state.articles).toHaveLength(0);
    expect(h.state.audit.map((a) => a.code)).toEqual(["ARTICLE_CREATED", "ARTICLE_PUBLISHED", "ARTICLE_UNPUBLISHED", "ARTICLE_DELETED"]);
    expect(await outcome(h.service.get(v.id))).toBe("404 NOT_FOUND Artikel tidak ditemukan.");
  });

  it("every change writes exactly one audit entry with actorId and signals a content change; rejected calls write none", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    await h.service.save(SEO, v.id, { version: 1, texts: { id: idText({ title: "Baru" }) }, tags: [], productIds: [] });
    await outcome(h.service.save(SEO, v.id, { version: 1, texts: { id: idText({ title: "Lagi" }) }, tags: [], productIds: [] }));
    expect(h.state.audit).toHaveLength(2);
    expect(h.state.audit.every((a) => (a.after as { actorId?: string }).actorId === "U-05")).toBe(true);
    expect(h.changes()).toBe(2);
  });

  it("cover: rights and alt required; three WebP files under the article; ARTICLE_COVER_CHANGED; the old cover's files go", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const jpeg = await solidJpeg(1200, 900);
    expect(await outcome(h.service.setCover(SEO, v.id, file(jpeg), { alt: "Kabel", rightsConfirmed: "false" }))).toBe("422 VALIDATION Konfirmasi hak foto wajib dicentang.");
    expect(await outcome(h.service.setCover(SEO, v.id, file(jpeg), { alt: "", rightsConfirmed: "true" }))).toContain("422 VALIDATION Teks alternatif");
    const withCover = await h.service.setCover(SEO, v.id, file(jpeg), { alt: "Kabel putih", rightsConfirmed: "true" });
    expect(withCover.cover).toMatchObject({ alt: "Kabel putih" });
    const first = [...h.storage.objects.keys()];
    expect(first.every((k) => k.startsWith(`media/articles/${v.id}/`))).toBe(true);
    await h.service.setCover(SEO, v.id, file(await solidJpeg(1200, 900, { colour: { r: 9, g: 9, b: 9 } })), { alt: "Kabel hitam", rightsConfirmed: "true" });
    expect(first.some((k) => h.storage.objects.has(k))).toBe(false);
    expect(h.state.audit.filter((a) => a.code === "ARTICLE_COVER_CHANGED")).toHaveLength(2);
  });

  it("body image: rights required, answers the 960 copy url and size, writes no audit", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const audit = h.state.audit.length;
    const image = await h.service.addBodyImage(SEO, v.id, file(await solidJpeg(1600, 1000)), { rightsConfirmed: "true" });
    expect(image.src).toMatch(new RegExp(`^/media/articles/${v.id}/[0-9a-f]{16}-960\\.webp$`));
    expect(h.state.audit.length).toBe(audit);
  });

  it("Finding 1: publishedAt is the real go-live time when an earlier schedule never went live", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const later = await h.service.publish(SEO, v.id, { version: 1, publishAt: "2026-11-05T08:00:00+07:00" });
    expect(later.publishedAt).toBe("2026-11-05T08:00:00+07:00");
    const earlier = await h.service.publish(SEO, v.id, { version: later.version, publishAt: "2026-11-01T08:00:00+07:00" });
    expect(earlier).toMatchObject({ publishAt: "2026-11-01T08:00:00+07:00", publishedAt: "2026-11-01T08:00:00+07:00" });
    const off = await h.service.unpublish(SEO, v.id, { version: earlier.version });
    const now = await h.service.publish(SEO, v.id, { version: off.version });
    expect(now).toMatchObject({ publishAt: NOW, publishedAt: NOW, live: true });
  });

  it("Finding 1: an article that really went live before keeps its first publishedAt when published again", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const live = await h.service.publish(SEO, v.id, { version: 1 });
    const off = await h.service.unpublish(SEO, v.id, { version: live.version });
    h.clock.now = "2026-10-31T10:00:00+07:00";
    const again = await h.service.publish(SEO, v.id, { version: off.version });
    expect(again).toMatchObject({ publishAt: "2026-10-31T10:00:00+07:00", publishedAt: NOW });
  });

  it("Finding 2: publishAt in Z form is normalised to +07:00 and compared by time; invalid input gives 422", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    expect(await outcome(h.service.publish(SEO, v.id, { version: 1, publishAt: "abc" }))).toBe("422 VALIDATION Waktu terbit tidak valid.");
    // 2026-10-30T02:00:00Z is 09:00 WIB, before NOW (10:00 WIB), though it sorts after "2026-10-30T10" as text
    expect(await outcome(h.service.publish(SEO, v.id, { version: 1, publishAt: "2026-10-30T02:00:00Z" }))).toBe("422 VALIDATION Waktu terbit harus di masa depan.");
    expect(await outcome(h.service.publish(SEO, v.id, { version: 1, publishAt: "2026-10-29T00:00:00Z" }))).toBe("422 VALIDATION Waktu terbit harus di masa depan.");
    const scheduled = await h.service.publish(SEO, v.id, { version: 1, publishAt: "2026-10-30T09:00:00Z" });
    expect(scheduled).toMatchObject({ publishAt: "2026-10-30T16:00:00+07:00", publishedAt: "2026-10-30T16:00:00+07:00", live: false });
    expect(h.state.articles[0]!.publishAt).toBe("2026-10-30T16:00:00+07:00");
  });

  it("Finding 3: publishing an article that is already live gives 409; a scheduled one can be rescheduled", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const scheduled = await h.service.publish(SEO, v.id, { version: 1, publishAt: "2026-11-01T08:00:00+07:00" });
    const moved = await h.service.publish(SEO, v.id, { version: scheduled.version, publishAt: "2026-11-02T08:00:00+07:00" });
    expect(moved).toMatchObject({ publishAt: "2026-11-02T08:00:00+07:00", live: false });
    h.clock.now = "2026-11-03T08:00:00+07:00";
    const msg = "409 CONFLICT Artikel sudah terbit. Batalkan terbit dulu untuk menjadwalkan ulang.";
    expect(await outcome(h.service.publish(SEO, v.id, { version: moved.version }))).toBe(msg);
    expect(await outcome(h.service.publish(SEO, v.id, { version: moved.version, publishAt: "2026-11-09T08:00:00+07:00" }))).toBe(msg);
    expect(h.state.articles[0]!.publishAt).toBe("2026-11-02T08:00:00+07:00");
  });

  it("Finding 5: remove is guarded inside the write; a status flip between load and delete gives 409 and keeps the article", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const load = h.prisma.article.findUnique;
    let flipped = false;
    h.prisma.article.findUnique = (async (args: never) => {
      const row = await load(args);
      if (!flipped) { flipped = true; h.state.articles[0]!.status = "published"; }
      return row;
    }) as typeof load;
    const audit = h.state.audit.length;
    expect(await outcome(h.service.remove(SEO, v.id))).toBe("409 CONFLICT Batalkan terbit dulu sebelum menghapus.");
    h.prisma.article.findUnique = load;
    expect(h.state.articles).toHaveLength(1);
    expect(h.state.texts).toHaveLength(1);
    expect(h.state.audit.length).toBe(audit);
  });

  it("Finding 5: remove of an article deleted in the meantime gives 404", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const load = h.prisma.article.findUnique;
    let gone = false;
    h.prisma.article.findUnique = (async (args: never) => {
      const row = await load(args);
      if (!gone) { gone = true; h.state.articles.splice(0, 1); }
      return row;
    }) as typeof load;
    expect(await outcome(h.service.remove(SEO, v.id))).toBe("404 NOT_FOUND Artikel tidak ditemukan.");
  });

  it("Finding 6: replacing or removing the cover keeps a body image that shares its file", async () => {
    const h = contentHarness();
    const v = await h.service.create(SEO, "sambung", idText());
    const same = await solidJpeg(1200, 900);
    const body = await h.service.addBodyImage(SEO, v.id, file(same), { rightsConfirmed: "true" });
    const withBody = await h.service.save(SEO, v.id, { version: 1, texts: { id: idText({ body: `## Foto\n\n![Kabel](${body.src})` }) }, tags: [], productIds: [] });
    expect(withBody.version).toBe(2);
    await h.service.setCover(SEO, v.id, file(same), { alt: "Kabel", rightsConfirmed: "true" });
    const shared = [...h.storage.objects.keys()];
    expect(shared.length).toBeGreaterThan(0);
    await h.service.setCover(SEO, v.id, file(await solidJpeg(1200, 900, { colour: { r: 9, g: 9, b: 9 } })), { alt: "Kabel hitam", rightsConfirmed: "true" });
    expect(shared.every((k) => h.storage.objects.has(k))).toBe(true);
    const others = [...h.storage.objects.keys()].filter((k) => !shared.includes(k));
    expect(others.length).toBeGreaterThan(0);
    await h.service.removeCover(SEO, v.id);
    expect(others.some((k) => h.storage.objects.has(k))).toBe(false);
    expect(shared.every((k) => h.storage.objects.has(k))).toBe(true);
  });
});
