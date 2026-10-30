import { describe, expect, it } from "vitest";
import { articleDate, articleUrl, blogUrl, readingLabel, seoCount, slugFromTitle, snippet } from "./articles";

describe("article helpers", () => {
  it("urls per language and page", () => {
    expect(articleUrl("id", "cara-memilih")).toBe("/blog/cara-memilih");
    expect(articleUrl("en", "choosing")).toBe("/en/blog/choosing");
    expect(blogUrl("id", 1)).toBe("/blog");
    expect(blogUrl("id", 2)).toBe("/blog?page=2");
    expect(blogUrl("en", 3)).toBe("/en/blog?page=3");
  });

  it("reading label and date per language", () => {
    expect(readingLabel(4, "id")).toBe("4 menit baca");
    expect(readingLabel(1, "en")).toBe("1 min read");
    expect(articleDate("2026-10-30T10:00:00+07:00", "id")).toBe("30 Okt 2026");
    expect(articleDate("2026-08-05T23:59:00+07:00", "en")).toBe("5 Aug 2026");
  });

  it("slugFromTitle matches the server rule", () => {
    expect(slugFromTitle("Cara Memilih Kabel USB-C yang Tepat!")).toBe("cara-memilih-kabel-usb-c-yang-tepat");
    expect(slugFromTitle("  Café   crème — 100% ")).toBe("cafe-creme-100");
    expect(slugFromTitle(Array.from({ length: 30 }, (_, i) => `kata${i}`).join(" ")).length).toBeLessThanOrEqual(80);
  });

  it("seoCount counts code points against the limit", () => {
    expect(seoCount("😀".repeat(60), 60)).toEqual({ count: 60, over: false, label: "60/60" });
    expect(seoCount("x".repeat(61), 60)).toEqual({ count: 61, over: true, label: "61/60" });
  });

  it("snippet cuts title and description like a search result", () => {
    const s = snippet("x".repeat(70), "https://toko.test/blog/a", "kata ".repeat(50));
    expect([...s.title].length).toBeLessThanOrEqual(60);
    expect(s.title.endsWith("…")).toBe(true);
    expect([...s.description].length).toBeLessThanOrEqual(160);
    expect(snippet("Pendek", "u", "Singkat")).toEqual({ title: "Pendek", url: "u", description: "Singkat" });
  });
});
