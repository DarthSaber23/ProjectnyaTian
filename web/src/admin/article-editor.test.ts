import { describe, expect, it } from "vitest";
import type { ArticleView } from "../services/contracts";
import { ApiError } from "../services/http/client";
import { appendImage, emptyText, insertImage, isStale, mergeMeta, settleAfterSave, languagesLabel, slugWillRedirect, statusLabel, wibToIso, withTitle } from "./article-editor";

const view = (patch: Partial<ArticleView> = {}): ArticleView => ({
  id: "a1", store: "sambung", status: "draft", publishAt: null, publishedAt: null, updatedAt: "2026-10-30T03:00:00.000Z", version: 1,
  authorId: "U-05", authorName: "Sinta P.", cover: null, tags: [], sample: false, texts: { id: { ...emptyText(), slug: "lama", title: "Lama" } }, productIds: [], live: false, ...patch,
});

describe("article editor helpers", () => {
  it("status labels per spec section 3", () => {
    expect(statusLabel(view())).toBe("Draf");
    expect(statusLabel(view({ status: "published", live: true }))).toBe("Terbit");
    expect(statusLabel(view({ status: "published", live: false, publishAt: "2026-11-01T01:00:00.000Z" }))).toBe("Terjadwal 1 Nov 2026, 08:00 WIB");
    expect(statusLabel(view({ status: "unpublished" }))).toBe("Tidak terbit");
  });

  it("languages label", () => {
    expect(languagesLabel(view())).toBe("ID");
    expect(languagesLabel(view({ texts: { id: emptyText(), en: emptyText() } }))).toBe("ID + EN");
  });

  it("slug follows the title until edited by hand", () => {
    const text = emptyText();
    expect(withTitle(text, "Cara Memilih Kabel", false)).toMatchObject({ title: "Cara Memilih Kabel", slug: "cara-memilih-kabel" });
    expect(withTitle({ ...text, slug: "pilihan-saya" }, "Judul Baru", true)).toMatchObject({ title: "Judul Baru", slug: "pilihan-saya" });
  });

  it("WIB date and time input to ISO with +07:00", () => {
    expect(wibToIso("2026-11-01T08:00")).toBe("2026-11-01T08:00:00+07:00");
    expect(wibToIso("")).toBeNull();
    expect(wibToIso("nonsense")).toBeNull();
  });

  it("a stale version is the 409 conflict about another editor", () => {
    expect(isStale(new ApiError("CONFLICT", "Artikel diubah orang lain. Muat ulang halaman."))).toBe(true);
    expect(isStale(new ApiError("CONFLICT", "Slug sudah dipakai artikel lain."))).toBe(false);
    expect(isStale(new Error("x"))).toBe(false);
  });

  it("renaming the slug of a live language warns about the redirect", () => {
    const live = view({ status: "published", live: true });
    expect(slugWillRedirect(live, "id", "baru-sekali")).toBe(true);
    expect(slugWillRedirect(live, "id", "lama")).toBe(false);
    expect(slugWillRedirect(live, "en", "apa-saja")).toBe(false);
    expect(slugWillRedirect(view(), "id", "baru-sekali")).toBe(false);
  });

  it("inserts a body image on its own lines at the cursor", () => {
    expect(insertImage("Satu\nDua", 4, "Kabel", "/media/articles/a1/abc-960.webp")).toEqual({
      body: "Satu\n\n![Kabel](/media/articles/a1/abc-960.webp)\n\nDua",
      cursor: 49,
    });
    expect(insertImage("", 0, "A", "/media/articles/a1/x-960.webp").body).toBe("![A](/media/articles/a1/x-960.webp)\n\n");
    expect(insertImage("x", 1, "a]b", "/m.webp").body).toBe("x\n\n![ab](/m.webp)\n\n");
  });

  it("appends an uploaded image to the latest body of the language it was started in", () => {
    const drafts = { id: { ...emptyText(), body: "Tulisan baru yang diketik saat unggah" }, en: { ...emptyText(), body: "English" } };
    const next = appendImage(drafts, "id", "Kabel", "/m.webp")!;
    expect(next.id.body).toBe("Tulisan baru yang diketik saat unggah\n\n![Kabel](/m.webp)\n\n");
    expect(next.en).toBe(drafts.en);
    expect(appendImage(drafts, "en", "A", "/m.webp")!.en!.body).toBe("English\n\n![A](/m.webp)\n\n");
    expect(appendImage(drafts, "en", "A", "/m.webp")!.id).toBe(drafts.id);
  });

  it("does not bring back an English text that was removed during the upload", () => {
    const drafts = { id: emptyText(), en: null };
    expect(appendImage(drafts, "en", "A", "/m.webp")).toBe(drafts);
  });

  it("an action that saves no text updates the status fields and keeps the server texts", () => {
    const prev = view({ version: 3, cover: null });
    const next = view({ version: 4, status: "unpublished", live: false, updatedAt: "2026-10-30T04:00:00.000Z", texts: { id: { ...emptyText(), slug: "lama", title: "Lama" } } });
    expect(mergeMeta(prev, next)).toMatchObject({ version: 4, status: "unpublished", live: false, updatedAt: "2026-10-30T04:00:00.000Z" });
    expect(mergeMeta(null, next)).toBe(next);
  });

  it("after a save the server copy replaces the drafts only when nothing was typed meanwhile", () => {
    expect(settleAfterSave("a", "a")).toBe("adopt");
    expect(settleAfterSave("a", "b")).toBe("keep");
  });
});
