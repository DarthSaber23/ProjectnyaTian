import { renameSync, unlinkSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { harness, seededImage } from "../../test/media-harness";
import { cliDeps, makeSeedDir } from "../../test/sample-seed";
import { runRemoveSamples } from "./remove-samples";
import { runSeed } from "./seed";

const nothingWritten = (h: ReturnType<typeof harness>) => {
  expect(h.state.images).toHaveLength(0);
  expect(h.storage.objects.size).toBe(0);
  expect(h.state.audit).toHaveLength(0);
};

describe("media:seed", () => {
  it("adds each sample once; running twice changes nothing; prints counts", async () => {
    const seed = await makeSeedDir([{ productId: "B01", n: 1 }, { productId: "A01", n: 2 }]);
    const h = harness();
    const first = await runSeed(cliDeps(h, seed.dir), { repairFiles: false, operator: "Rina" });
    expect(first).toMatchObject({ exitCode: 0, added: 2, skipped: 0 });
    expect(first.lines.join("\n")).toContain("Ditambahkan: 2, dilewati: 0");
    expect(h.state.images.map((i) => [i.productId, i.position, i.source, i.createdBy])).toEqual([["B01", 0, "sample", "seed"], ["A01", 0, "sample", "seed"]]);
    expect(h.state.images[0]).toMatchObject({ creator: "Fotografer Uji", licence: "CC0 1.0", retrievedAt: "2026-10-28", alt: "Benda contoh di atas latar polos" });
    expect(h.state.audit.map((a) => [a.code, a.object, a.actor])).toEqual([["PRODUCT_IMAGE_ADDED", "B01", "CLI: Rina"], ["PRODUCT_IMAGE_ADDED", "A01", "CLI: Rina"]]);
    expect(h.state.audit[0]!.after).toMatchObject({ source: "sample", actorId: "cli", position: 0 });
    const files = h.storage.objects.size;
    expect(files).toBe(seed.entries.flatMap((e) => e.files).length);

    const second = await runSeed(cliDeps(h, seed.dir), { repairFiles: false, operator: "Rina" });
    expect(second).toMatchObject({ exitCode: 0, added: 0, skipped: 2 });
    expect(h.state.images).toHaveLength(2);
    expect(h.state.audit).toHaveLength(2);
    expect(h.storage.objects.size).toBe(files);
  });

  it("skips products that already have photos, including one a staff upload reached first", async () => {
    const seed = await makeSeedDir([{ productId: "B01", n: 1 }, { productId: "A01", n: 2 }]);
    const h = harness([seededImage("u0", 0)]);
    const before = JSON.stringify(h.state.images[0]);
    expect(await runSeed(cliDeps(h, seed.dir), { repairFiles: false })).toMatchObject({ exitCode: 0, added: 1, skipped: 1 });
    expect(h.state.images.filter((i) => i.productId === "B01")).toHaveLength(1);
    expect(JSON.stringify(h.state.images.find((i) => i.productId === "B01"))).toBe(before);
  });

  it("skips a product with an earlier PRODUCT_IMAGE_REMOVED entry", async () => {
    const seed = await makeSeedDir([{ productId: "B01", n: 1 }]);
    const h = harness();
    h.state.audit.push({ code: "PRODUCT_IMAGE_REMOVED", object: "B01", before: {}, after: { actorId: "s1" } });
    expect(await runSeed(cliDeps(h, seed.dir), { repairFiles: false })).toMatchObject({ exitCode: 0, added: 0, skipped: 1 });
    expect(h.state.images).toHaveLength(0);
  });

  it.each(["hash mismatch", "target mismatch", "missing file", "unknown variant SKU", "http:// licence URL", "http:// source URL"])(
    "refuses on %s, exits 1, writes nothing for any product",
    async (problem) => {
      const seed = await makeSeedDir([{ productId: "A01", n: 2 }, { productId: "B01", n: 1 }]);
      const bad = seed.entries[1]!;
      const rename = (from: string, to: string) => {
        renameSync(path.join(seed.dir, from), path.join(seed.dir, to));
        bad.files = bad.files.map((f) => (f === from ? to : f));
      };
      if (problem === "hash mismatch") rename(bad.files[0]!, `ffffffffffffffff-${bad.files[0]!.split("-")[1]}`);
      if (problem === "target mismatch") rename(bad.files[0]!, `${bad.files[0]!.split("-")[0]}-500.webp`);
      if (problem === "missing file") unlinkSync(path.join(seed.dir, bad.files[0]!));
      if (problem === "unknown variant SKU") bad.variantSkus = ["B01-9M"];
      if (problem === "http:// licence URL") bad.licenceUrl = "http://creativecommons.org/publicdomain/zero/1.0/";
      if (problem === "http:// source URL") bad.sourceUrl = "http://commons.wikimedia.org/wiki/File:Uji.jpg";
      seed.write(seed.entries);
      const h = harness();
      const result = await runSeed(cliDeps(h, seed.dir), { repairFiles: false });
      expect(result.exitCode).toBe(1);
      expect(result.lines.some((l) => l.includes("B01"))).toBe(true);
      nothingWritten(h);
    },
  );

  it("storage not ready: both commands print 'Penyimpanan foto sedang tidak tersedia.', exit 1, write nothing", async () => {
    const seed = await makeSeedDir([{ productId: "B01", n: 1 }]);
    const h = harness();
    h.storage.failAll = true;
    const seeded = await runSeed(cliDeps(h, seed.dir), { repairFiles: false });
    expect(seeded.exitCode).toBe(1);
    expect(seeded.lines.join("\n")).toMatch(/^Penyimpanan foto sedang tidak tersedia\. \(ServiceUnavailable\)$/m);
    const removed = await runRemoveSamples(cliDeps(h, seed.dir), { operator: "Rina" });
    expect(removed.exitCode).toBe(1);
    expect(removed.lines.join("\n")).toContain("Penyimpanan foto sedang tidak tersedia.");
    h.storage.failAll = false;
    nothingWritten(h);
  });

  it("--repair-files restores a deleted sample object and writes no row and no audit entry", async () => {
    const seed = await makeSeedDir([{ productId: "B01", n: 1 }]);
    const h = harness();
    await runSeed(cliDeps(h, seed.dir), { repairFiles: false });
    const key = [...h.storage.objects.keys()][0]!;
    const body = h.storage.objects.get(key)!.body;
    h.storage.objects.delete(key);
    const rows = JSON.stringify(h.state.images);
    const result = await runSeed(cliDeps(h, seed.dir), { repairFiles: true });
    expect(result).toMatchObject({ exitCode: 0, added: 0 });
    expect(result.lines.join("\n")).toContain("Dipulihkan: 1");
    expect(h.storage.objects.get(key)).toEqual({ body, contentType: "image/webp" });
    expect(JSON.stringify(h.state.images)).toBe(rows);
    expect(h.state.audit).toHaveLength(1);
  });

  it("variant links resolve by SKU and the entry's position is used", async () => {
    const seed = await makeSeedDir([{ productId: "B01", n: 1, position: 0, variantSkus: ["B01-2M"] }]);
    const h = harness();
    await runSeed(cliDeps(h, seed.dir), { repairFiles: false });
    const row = h.state.images[0]!;
    expect(row.position).toBe(0);
    expect(h.state.variants.find((v) => v.sku === "B01-2M")!.imageId).toBe(row.id);
    expect(h.state.variants.find((v) => v.sku === "B01-1M")!.imageId).toBeNull();
  });
});
