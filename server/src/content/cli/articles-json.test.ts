import path from "path";
import { describe, expect, it } from "vitest";
import { products } from "../../data/fixtures";
import { plainText } from "../markdown";
import { readArticles, validateArticles } from "./common";

/** The shipped demo articles (server/seed/content/articles.json) against the real catalogue and sample photos. */

const root = path.resolve(__dirname, "../../../seed");
const entries = readArticles(path.join(root, "content/articles.json"));
const catalogue = {
  product: { async findUnique({ where }: { where: { id: string } }) { const p = products.find((x) => x.id === where.id); return p ? { id: p.id, storeId: p.brand } : null; } },
};

/** Figures with a unit (100W, 3A, 480 Mbps, 50 ml, 8K60, 4K120 …): each must be stated by a product of that store. */
const FIGURE = /\b\d+(?:[.,]\d+)?\s?(?:W|A|ml|Mbps|Gbps|Hz)\b|\b\dK\d*\b/g;
const stated = (store: string) => products.filter((p) => p.brand === store).map((p) => JSON.stringify([p.name, p.spec, p.specs]).replace(/\s/g, "")).join(" ");

describe("demo articles", () => {
  it("pass every publish rule against the real catalogue and sample photos", async () => {
    expect(await validateArticles(entries, { prisma: catalogue, mediaDir: path.join(root, "media") })).toEqual([]);
  });

  it("two per store, the first of each with English, each linking 2-3 products", () => {
    for (const store of ["sambung", "halimun"]) {
      const own = entries.filter((e) => e.store === store);
      expect(own).toHaveLength(2);
      expect(own[0]!.texts.en).toBeTruthy();
      for (const e of own) {
        expect(e.productIds.length).toBeGreaterThanOrEqual(2);
        expect(e.productIds.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("states no product figure the catalogue does not state", () => {
    for (const e of entries) {
      const known = stated(e.store);
      for (const text of Object.values(e.texts)) {
        for (const figure of plainText(`${text!.title}\n${text!.summary}\n${text!.body}`).match(FIGURE) ?? []) {
          expect(known, `${e.store}/${text!.slug}: ${figure}`).toContain(figure.replace(/\s/g, ""));
        }
      }
    }
  });

  it("Halimun articles make no medical claims", () => {
    for (const e of entries.filter((x) => x.store === "halimun")) {
      for (const text of Object.values(e.texts)) {
        expect(`${text!.title} ${text!.summary} ${text!.body}`).not.toMatch(/menyembuhkan|mengobati|\bobat\b|terapi|jerawat hilang|cure|heal|treat|guarantee|dijamin/i);
      }
    }
  });
});
