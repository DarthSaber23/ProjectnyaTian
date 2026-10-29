import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { userInfo } from "os";
import path from "path";
import sharp from "sharp";
import { PrismaService } from "../../prisma.service";
import { ObjectStorage, S3ObjectStorage } from "../../storage.service";
import { MediaService } from "../media.service";
import type { MediaActor } from "../media.types";
import { CLI_ACTOR_ID } from "../media.types";
import { configureSharp } from "../process";

/** One sample photo in server/seed/media/samples.json; `files` are its WebP copies named `{hash16}-{target}.webp`. */
export interface SampleEntry {
  productId: string;
  position: number;
  alt: string;
  variantSkus: string[];
  files: string[];
  creator: string;
  licence: string;
  licenceUrl: string;
  sourceUrl: string;
  retrievedAt: string;
  licenceCheck: string;
}

export interface CliDeps {
  prisma: PrismaService;
  storage: ObjectStorage;
  media: MediaService;
  seedDir: string;
}

export interface LoadedSample {
  entry: SampleEntry;
  hash: string;
  copies: { target: number; name: string; buffer: Buffer }[];
}

type VariantLookup = { variant: { findUnique(args: { where: { sku: string } }): Promise<{ productId: string } | null> } };

export const STORAGE_DOWN = "Penyimpanan foto sedang tidak tersedia.";
const FILE_NAME = /^([0-9a-f]{16})-(\d+)\.webp$/;

export function readSamples(seedDir: string): SampleEntry[] {
  return JSON.parse(readFileSync(path.join(seedDir, "samples.json"), "utf8")) as SampleEntry[];
}

/** Reads an entry's files, smallest target first. The hash is the SHA-256 of the largest copy, as for uploads. */
export function loadSample(entry: SampleEntry, seedDir: string): LoadedSample {
  const copies = entry.files
    .map((name) => ({ name, target: Number(FILE_NAME.exec(name)?.[2]), buffer: readFileSync(path.join(seedDir, name)) }))
    .sort((a, b) => a.target - b.target);
  const largest = copies[copies.length - 1]!;
  return { entry, hash: createHash("sha256").update(largest.buffer).digest("hex"), copies };
}

/** Every problem in the list, as one line each naming the product. Empty means every entry is valid. */
export async function validateSamples(entries: SampleEntry[], deps: { prisma: VariantLookup; seedDir: string }): Promise<string[]> {
  const problems: string[] = [];
  for (const entry of entries) {
    const say = (text: string) => problems.push(`${entry.productId}: ${text}`);
    if (!entry.files?.length) { say("tidak ada file"); continue; }
    const missing = entry.files.filter((name) => !FILE_NAME.test(name) || !existsSync(path.join(deps.seedDir, name)));
    if (missing.length) { say(`file tidak ada atau nama salah: ${missing.join(", ")}`); continue; }
    const sample = loadSample(entry, deps.seedDir);
    const hash16 = sample.hash.slice(0, 16);
    for (const copy of sample.copies) {
      if (FILE_NAME.exec(copy.name)?.[1] !== hash16) say(`hash pada nama ${copy.name} tidak cocok dengan isi`);
      const meta = await sharp(copy.buffer).metadata().catch(() => null);
      if (!meta?.width || !meta.height || meta.format !== "webp") say(`${copy.name} bukan WebP yang terbaca`);
      else if (Math.min(meta.width, meta.height) !== copy.target) say(`target pada nama ${copy.name} tidak cocok dengan ukuran ${meta.width}x${meta.height}`);
    }
    for (const sku of entry.variantSkus ?? []) {
      const variant = await deps.prisma.variant.findUnique({ where: { sku } });
      if (!variant || variant.productId !== entry.productId) say(`varian ${sku} tidak ada di produk ini`);
    }
    if (!entry.licenceUrl?.startsWith("https://")) say("licenceUrl harus diawali https://");
    if (!entry.sourceUrl?.startsWith("https://")) say("sourceUrl harus diawali https://");
  }
  return problems;
}

/** Bucket and policy, once. Answers the line to print when storage is not ready, or null. */
export async function initStorage(storage: ObjectStorage): Promise<string | null> {
  if (await storage.init()) return null;
  return `${STORAGE_DOWN} (${storage.lastErrorClass ?? "UnknownError"})`;
}

export function cliActor(operator: string | undefined): MediaActor {
  return { id: CLI_ACTOR_ID, label: `CLI: ${operator ?? userInfo().username}` };
}

/** Value of `--operator "<nama>"` or `--operator=<nama>`. */
export function argValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index >= 0) return argv[index + 1]?.trim() || undefined;
  const inline = argv.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1).trim() || undefined : undefined;
}

/**
 * The commands run in their own Node process, so the API's catalogue snapshot is not refreshed here: the operator
 * restarts `api` afterwards.
 */
export function buildDeps(): CliDeps & { close(): Promise<void> } {
  configureSharp();
  const prisma = new PrismaService();
  const storage = new S3ObjectStorage();
  const media = new MediaService(prisma, storage, { refreshAfterWrite: async () => undefined });
  return { prisma, storage, media, seedDir: path.resolve(process.cwd(), "seed/media"), close: () => prisma.$disconnect() };
}
