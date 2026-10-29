import { mediaError } from "./errors";
import { ALT_MAX, TARGET_LADDER } from "./limits";

const EDGE = /^[\s\u00A0\u034F\u180E\u200B-\u200F\u2060\uFEFF]+|[\s\u00A0\u034F\u180E\u200B-\u200F\u2060\uFEFF]+$/gu;
const INNER_CONTROL = /[\u0000-\u001f\u007f-\u009f]+/gu;

/** Trims whitespace and zero-width or invisible format characters (NBSP, U+034F, U+180E, U+200B–U+200F, U+2060, U+FEFF) at both ends and turns inner control runs into one space. No normalisation. */
export function cleanAlt(input: string): string {
  return input.replace(INNER_CONTROL, " ").replace(EDGE, "").replace(/ {2,}/gu, " ");
}

/** Length in Unicode code points, the unit of the 125 limit. */
export function altLength(text: string): number {
  return [...text].length;
}

/** Shared by upload and PATCH: cleaned alt text of 1 to 125 code points, else 422. HTML is kept as plain text. */
export function parseAlt(input: unknown): string {
  if (typeof input !== "string") throw mediaError("altInvalid");
  const alt = cleanAlt(input);
  const length = altLength(alt);
  if (length < 1 || length > ALT_MAX) throw mediaError("altInvalid");
  return alt;
}

/** Admin prefill "Foto {nama produk}", cut to 125 code points. */
export function defaultAlt(productName: string): string {
  return [...`Foto ${productName}`].slice(0, ALT_MAX).join("");
}

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "mif1", "msf1", "avif"]);

/** Type from the first bytes, never from the name or declared type. */
export function detectImageType(head: Buffer): "jpeg" | "png" | "webp" | "heic" | "unsupported" {
  const b = head.subarray(0, 32);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  if (b.length >= 12 && b.toString("latin1", 4, 8) === "ftyp" && HEIC_BRANDS.has(b.toString("latin1", 8, 12))) return "heic";
  return "unsupported";
}

/** Shorter-side targets: the ladder up to the shorter side, plus the shorter side itself when under 1600. */
export function targetsFor(shorterSide: number): number[] {
  if (shorterSide < TARGET_LADDER[0]) return [];
  const targets = new Set<number>(TARGET_LADDER.filter((t) => t <= shorterSide));
  if (shorterSide < TARGET_LADDER[TARGET_LADDER.length - 1]) targets.add(shorterSide);
  return [...targets].sort((a, b) => a - b);
}
