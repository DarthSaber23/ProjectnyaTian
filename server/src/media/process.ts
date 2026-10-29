import { createHash } from "crypto";
import { HttpException } from "@nestjs/common";
import sharp from "sharp";
import { mediaError } from "./errors";
import { MAX_PIXELS, MAX_WEBP_SIDE, MIN_SHORTER_SIDE, WEBP_QUALITY } from "./limits";
import { detectImageType, targetsFor } from "./rules";

export interface ImageInfo {
  format: "jpeg" | "png" | "webp";
  /** Oriented size (width and height swapped for EXIF orientations 5 to 8). */
  width: number;
  height: number;
}

export interface ProcessedImage {
  /** SHA-256 hex of the largest copy. */
  hash: string;
  hash16: string;
  /** Real pixel size of the largest copy. */
  width: number;
  height: number;
  /** Shorter-side targets that exist, ascending. */
  sizes: number[];
  copies: { target: number; width: number; height: number; buffer: Buffer }[];
}

const OPEN = { limitInputPixels: MAX_PIXELS, failOn: "error" as const };

/** sharp's own pixel-limit error is the over-size refusal; any other sharp failure means the file cannot be read. */
function readFailure(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  const message = error instanceof Error ? error.message : "";
  return /pixel limit/i.test(message) ? mediaError("tooManyPixels") : mediaError("corrupt");
}

export function configureSharp(): void {
  sharp.cache(false);
  sharp.concurrency(2);
}

/** Header-only checks, in the spec's order: type from bytes, readable, pixel limit, WebP side limit, 480 px minimum. */
export async function inspectImage(buffer: Buffer): Promise<ImageInfo> {
  const type = detectImageType(buffer);
  if (type === "heic") throw mediaError("heic");
  if (type === "unsupported") throw mediaError("unsupportedFormat");
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer, OPEN).metadata();
  } catch (error) {
    throw readFailure(error);
  }
  if (meta.format !== type || !meta.width || !meta.height) throw mediaError("corrupt");
  const swap = (meta.orientation ?? 1) >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;
  if (width * height > MAX_PIXELS) throw mediaError("tooManyPixels");
  const shorter = Math.min(width, height);
  const longer = Math.max(width, height);
  const largest = targetsFor(shorter).at(-1);
  if (largest !== undefined && Math.round((longer * largest) / shorter) > MAX_WEBP_SIDE) throw mediaError("tooManyPixels");
  if (shorter < MIN_SHORTER_SIDE) throw mediaError("tooSmall");
  return { format: type, width, height };
}

/**
 * One WebP copy per shorter-side target, oriented, sRGB, no metadata, never enlarged or cropped
 * (spec section 2). Only the first frame of an animated input is read.
 */
export async function processImage(buffer: Buffer, info?: ImageInfo): Promise<ProcessedImage> {
  const checked = info ?? (await inspectImage(buffer));
  const landscape = checked.width > checked.height;
  const copies: ProcessedImage["copies"] = [];
  for (const target of targetsFor(Math.min(checked.width, checked.height))) {
    try {
      const { data, info: out } = await sharp(buffer, OPEN)
        .rotate()
        .resize(landscape ? { height: target, withoutEnlargement: true } : { width: target, withoutEnlargement: true })
        .toColourspace("srgb")
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      copies.push({ target, width: out.width, height: out.height, buffer: data });
    } catch (error) {
      throw readFailure(error);
    }
  }
  const largest = copies[copies.length - 1];
  if (!largest) throw mediaError("tooSmall");
  const hash = createHash("sha256").update(largest.buffer).digest("hex");
  return { hash, hash16: hash.slice(0, 16), width: largest.width, height: largest.height, sizes: copies.map((c) => c.target), copies };
}
