import { describe, expect, it } from "vitest";
import { autoCategorySeo, autoProductSeo, checkLengths, cutAtWord, isValidSlug, readingMinutes, RESERVED_SLUGS, slugFromTitle } from "./rules";

const text = (over: Partial<Parameters<typeof checkLengths>[0]> = {}) => ({
  slug: "cara-memilih-kabel", title: "Cara memilih kabel", seoTitle: "", metaDescription: "x".repeat(60), summary: "Ringkasan", body: "Isi artikel.",
  noindex: false, canonicalUrl: "", ...over,
});

describe("slugs", () => {
  it.each(["cara-memilih-kabel", "abc", "a1-b2", "x".repeat(80)])("%s is valid", (s) => expect(isValidSlug(s)).toBe(true));
  it.each(["ab", "x".repeat(81), "Kabel", "a--b", "-ab", "ab-", "a_b", "kabel usb", ...RESERVED_SLUGS])("%s is invalid", (s) => expect(isValidSlug(s)).toBe(false));
  it("reserved slugs are the spec list", () => expect([...RESERVED_SLUGS].sort()).toEqual(["baru", "en", "halaman", "penulis", "tag"]));

  it("slugFromTitle lowercases, folds accents, joins with hyphens and cuts at a hyphen within 80", () => {
    expect(slugFromTitle("Cara Memilih Kabel USB-C yang Tepat!")).toBe("cara-memilih-kabel-usb-c-yang-tepat");
    expect(slugFromTitle("  Café   crème — 100% ")).toBe("cafe-creme-100");
    const long = slugFromTitle(Array.from({ length: 30 }, (_, i) => `kata${i}`).join(" "));
    expect(long.length).toBeLessThanOrEqual(80);
    expect(long.endsWith("-")).toBe(false);
    expect(isValidSlug(long)).toBe(true);
    expect(slugFromTitle("!!!")).toBe("");
  });
});

describe("reading time and cutting", () => {
  it("readingMinutes is words / 200 rounded up, at least 1, ignoring Markdown marks", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes(Array(200).fill("kata").join(" "))).toBe(1);
    expect(readingMinutes(Array(201).fill("kata").join(" "))).toBe(2);
    expect(readingMinutes("## ** - * [ ] ( )")).toBe(1);
  });

  it("cutAtWord keeps whole words within the code-point limit", () => {
    expect(cutAtWord("aaa bbb ccc", 7)).toBe("aaa bbb");
    expect(cutAtWord("aaa bbb", 20)).toBe("aaa bbb");
    expect([...cutAtWord("😀😀 😀😀 😀😀", 5)].length).toBeLessThanOrEqual(5);
    expect(cutAtWord("panjangsekali", 5)).toBe("panja");
  });
});

describe("automatic SEO text", () => {
  it("product: '{name} | {brand}' and the spec line cut to 160", () => {
    expect(autoProductSeo({ name: "Kabel USB-C", spec: "USB-C ke USB-C · 100W" }, "Sambung")).toEqual({ title: "Kabel USB-C | Sambung", description: "USB-C ke USB-C · 100W" });
    expect([...autoProductSeo({ name: "K", spec: "kata ".repeat(60) }, "Sambung").description].length).toBeLessThanOrEqual(160);
    expect(autoProductSeo({ name: "Kabel", spec: null }, "Sambung").description).toBe("Beli Kabel di Sambung.");
  });

  it("category: '{name} | {brand}' and 'Belanja {name} di {brand}.'", () => {
    expect(autoCategorySeo({ name: "Kabel" }, "Sambung")).toEqual({ title: "Kabel | Sambung", description: "Belanja Kabel di Sambung." });
  });
});

describe("checkLengths", () => {
  it("a complete text passes for publish", () => expect(checkLengths(text(), true)).toEqual([]));

  it("drafts only enforce maximums", () => {
    expect(checkLengths(text({ title: "", metaDescription: "", summary: "", body: "" }), false)).toEqual([]);
    expect(checkLengths(text({ seoTitle: "x".repeat(61) }), false)).toEqual(["Judul SEO maksimal 60 karakter."]);
  });

  it("publish requires the fields and the meta description minimum", () => {
    expect(checkLengths(text({ title: "", summary: "", body: "" }), true)).toEqual([
      "Lengkapi Judul sebelum terbit.", "Lengkapi Ringkasan sebelum terbit.", "Lengkapi Isi sebelum terbit.",
    ]);
    expect(checkLengths(text({ metaDescription: "pendek" }), true)).toEqual(["Deskripsi meta minimal 50 karakter."]);
  });

  it("maximums: title 120, SEO title 60, meta 160, summary 200, body 50 000 (code points)", () => {
    expect(checkLengths(text({ title: "😀".repeat(120) }), true)).toEqual([]);
    expect(checkLengths(text({ title: "x".repeat(121), metaDescription: "x".repeat(161), summary: "x".repeat(201), body: "x".repeat(50_001) }), true)).toEqual([
      "Judul maksimal 120 karakter.", "Deskripsi meta maksimal 160 karakter.", "Ringkasan maksimal 200 karakter.", "Isi maksimal 50000 karakter.",
    ]);
  });

  it("slug and canonical rules", () => {
    expect(checkLengths(text({ slug: "Bad Slug" }), false)).toEqual(["Slug hanya huruf kecil, angka dan tanda hubung (3–80 karakter)."]);
    expect(checkLengths(text({ slug: "baru" }), false)).toEqual(["Slug ini tidak boleh dipakai."]);
    expect(checkLengths(text({ canonicalUrl: "http://a.example" }), false)).toEqual(["Canonical harus berupa URL https://."]);
    expect(checkLengths(text({ canonicalUrl: "https://a.example/x" }), false)).toEqual([]);
  });
});
