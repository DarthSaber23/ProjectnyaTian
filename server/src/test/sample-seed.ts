import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { CliDeps, SampleEntry } from "../media/cli/common";
import { processImage } from "../media/process";
import type { harness } from "./media-harness";
import { photo } from "./media-harness";

/** Builds a temporary seed directory with processed WebP files and a samples.json, like server/seed/media. */
export async function makeSeedDir(specs: Array<{ productId: string; n: number; position?: number; variantSkus?: string[] }>) {
  const dir = mkdtempSync(path.join(tmpdir(), "tian-seed-"));
  const entries: SampleEntry[] = [];
  for (const spec of specs) {
    const processed = await processImage(await photo(spec.n));
    const files = processed.copies.map((copy) => {
      const name = `${processed.hash16}-${copy.target}.webp`;
      writeFileSync(path.join(dir, name), copy.buffer);
      return name;
    });
    entries.push({
      productId: spec.productId, position: spec.position ?? 0, alt: "Benda contoh di atas latar polos", variantSkus: spec.variantSkus ?? [], files,
      creator: "Fotografer Uji", licence: "CC0 1.0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: `https://commons.wikimedia.org/wiki/File:Uji_${spec.n}.jpg`, retrievedAt: "2026-10-28",
      licenceCheck: "Diperiksa oleh Uji pada 2026-10-28; salinan: docs/07-delivery/photo-licences/uji.txt",
    });
  }
  const write = (list: SampleEntry[]) => writeFileSync(path.join(dir, "samples.json"), JSON.stringify(list, null, 2));
  write(entries);
  return { dir, entries, write };
}

export function cliDeps(h: ReturnType<typeof harness>, seedDir: string): CliDeps {
  return { prisma: h.prisma as unknown as CliDeps["prisma"], storage: h.storage, media: h.service, seedDir };
}
