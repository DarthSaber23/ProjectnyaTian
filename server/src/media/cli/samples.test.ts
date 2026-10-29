import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { products } from "../../data/fixtures";
import { validateSamples, type SampleEntry } from "./common";

/** Checks the committed server/seed/media against the fixture catalogue (the same ids and SKUs the seed upserts). */

const seedDir = path.resolve(__dirname, "../../../seed/media");
const entries = (): SampleEntry[] => JSON.parse(readFileSync(path.join(seedDir, "samples.json"), "utf8"));
const variants = products.flatMap((p) => p.variants.map((v) => ({ sku: v.sku, productId: p.id })));
const prisma = { variant: { findUnique: async ({ where }: { where: { sku: string } }) => variants.find((v) => v.sku === where.sku) ?? null } };

describe("committed sample photos", () => {
  it("every real sample validates against the committed files and the fixture catalogue SKUs", async () => {
    const list = entries();
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(6);
    expect(await validateSamples(list, { prisma, seedDir })).toEqual([]);
    for (const entry of list) expect(products.some((p) => p.id === entry.productId)).toBe(true);
  });

  it("no sample alt starts with 'Foto contoh' or states a size, capacity or power", () => {
    for (const entry of entries()) {
      expect(entry.alt.startsWith("Foto contoh")).toBe(false);
      expect(entry.alt).not.toMatch(/\d\s?(cm|m|ml|g|GB|W)\b/i);
    }
  });

  it("no sample entry exists for B01, B08, B02, B04, B03, A01, A05 or BND-PAGI (drawings stay)", () => {
    const ids = entries().map((e) => e.productId);
    for (const id of ["B01", "B08", "B02", "B04", "B03", "A01", "A05", "BND-PAGI"]) expect(ids).not.toContain(id);
  });

  it("every licence is one of the accepted kinds and every sample has a dated licence check", () => {
    for (const entry of entries()) {
      expect(entry.licence).toMatch(/^(CC0 1\.0|Public Domain|Unsplash License|Pexels License)$/);
      expect(entry.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.licenceCheck).toMatch(/^Diperiksa oleh .+ pada \d{4}-\d{2}-\d{2}; salinan: docs\/07-delivery\/photo-licences\/.+\.txt$/);
    }
  });
});
