/**
 * Product photo rules for the storefront and the admin (spec sections 2-4). Pure: no React, no network.
 * The alt-text cleaning is a copy of server/src/media/rules.ts (two packages, no shared code); keep both in step.
 */
import type { Product, ProductImage, Variant } from "./types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALT_MAX = 125;

export type PhotoPlace =
  | "catalogCard" | "homeCard" | "searchCard" | "productMain" | "productThumb" | "cartRow" | "accountRecommended" | "accountWishlist";

/** `sizes` per place, matching each frame's rendered width (spec section 3). */
const SIZES: Record<PhotoPlace, string> = {
  catalogCard: "(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw",
  homeCard: "(min-width: 768px) 25vw, 50vw",
  searchCard: "(min-width: 1024px) 25vw, 50vw",
  productMain: "(min-width: 768px) 50vw, 100vw",
  productThumb: "48px",
  cartRow: "80px",
  accountRecommended: "56px",
  accountWishlist: "72px",
};

export function photoSizes(place: PhotoPlace): string {
  return SIZES[place];
}

/** The srcset, or undefined so the browser falls back to `src` alone. */
export function photoSrcSet(image: ProductImage): string | undefined {
  return image.srcset ? image.srcset : undefined;
}

/** The variant's linked photo, else the main photo, else null (the drawing). */
export function photoForVariant(product: Product, sku: string): ProductImage | null {
  const images = product.images ?? [];
  const linked = product.variants.find((v) => v.sku === sku)?.imageId;
  return images.find((i) => i.id === linked) ?? images[0] ?? null;
}

/**
 * Which gallery photo shows. First render: the variant's linked photo, else position 0. Later: switch to the
 * new variant's linked photo, else keep what the shopper is looking at.
 */
export function galleryPick(product: Product, variant: Variant | undefined, currentId: string | undefined): string | null {
  const images = product.images ?? [];
  const linked = images.find((i) => i.id === variant?.imageId);
  if (linked) return linked.id;
  if (currentId !== undefined && images.some((i) => i.id === currentId)) return currentId;
  return images[0]?.id ?? null;
}

export function showThumbnails(product: Product): boolean {
  return (product.images?.length ?? 0) > 1;
}

/** Accessible name of a thumbnail button; zero-based index. Alt text stays on the main photo only. */
export function thumbLabel(index: number, total: number): string {
  return `Foto ${index + 1} dari ${total}`;
}

const EDGE = /^[\s\u00A0\u034F\u180E\u200B-\u200F\u2060\uFEFF]+|[\s\u00A0\u034F\u180E\u200B-\u200F\u2060\uFEFF]+$/gu;
const INNER_CONTROL = /[\u0000-\u001f\u007f-\u009f]+/gu;

/** Trims whitespace and zero-width characters at both ends and turns inner control runs into one space. */
export function cleanAlt(text: string): string {
  return text.replace(INNER_CONTROL, " ").replace(EDGE, "").replace(/ {2,}/gu, " ");
}

/** Length in Unicode code points, the unit of the 125 limit. */
export function altLength(text: string): number {
  return [...text].length;
}

/** Returns a new list with the item at `index` moved one place; the ends stay put. */
export function moveId(ids: string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function canUpload(file: File | null | undefined, rightsConfirmed: boolean, busy: boolean): boolean {
  return !!file && rightsConfirmed && !busy;
}

/** Multipart upload request. No headers: the browser sets the multipart boundary itself. */
export function buildUploadInit(file: File, alt: string, rightsConfirmed: boolean): RequestInit {
  const form = new FormData();
  form.append("alt", alt);
  form.append("rightsConfirmed", rightsConfirmed ? "true" : "false");
  form.append("file", file);
  return { method: "POST", body: form };
}

/** Only https links are shown as links in the admin credit fields. */
export function safeSourceLink(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" && url.startsWith("https://") ? url : null;
  } catch {
    return null;
  }
}

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_NAME = /\.(jpe?g|png|webp)$/i;

/** Quick check in the browser before sending; the server checks the bytes again. */
export function uploadPrecheck(file: { name: string; type: string; size: number }): string | null {
  if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/i.test(file.type)) return "Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi.";
  // MIME type or extension: some systems send an empty or generic type for a valid photo. The server checks the bytes.
  if (!ACCEPTED.has(file.type) && !ACCEPTED_NAME.test(file.name)) return "Format tidak didukung. Gunakan JPG, PNG, atau WebP.";
  if (file.size > MAX_UPLOAD_BYTES) return "Ukuran file maksimal 10 MB.";
  return null;
}

/** `fetchpriority` as a plain HTML attribute: React 18 does not know the camelCase prop and would warn. */
export function fetchPriorityAttr(priority: "high" | "low" | undefined): Record<string, string> {
  return priority ? { fetchpriority: priority } : {};
}

/* ---- Photo manager state: each helper is applied to the latest list, never to a list captured earlier. ---- */

type Ordered = { id: string; position: number };

const renumbered = <T extends Ordered>(images: T[]): T[] => images.map((image, position) => (image.position === position ? image : { ...image, position }));

/** The latest photos in the given order; ids no longer present are dropped, photos missing from the list keep their place at the end. */
export function applyOrder<T extends Ordered>(images: T[], ids: string[]): T[] {
  const byId = new Map(images.map((image) => [image.id, image]));
  const ordered = ids.map((id) => byId.get(id)).filter((image): image is T => !!image);
  const rest = images.filter((image) => !ids.includes(image.id));
  return renumbered([...ordered, ...rest]);
}

export function withImageAdded<T extends Ordered>(images: T[], image: T): T[] {
  return images.some((i) => i.id === image.id) ? images : renumbered([...images, image]);
}

export function withImagePatched<T extends Ordered>(images: T[], id: string, patch: Partial<T>): T[] {
  return images.map((image) => (image.id === id ? { ...image, ...patch } : image));
}

export function withImageRemoved<T extends Ordered, P extends { images: T[]; variants: { imageId: string | null }[] }>(product: P, id: string): P {
  return {
    ...product,
    images: renumbered(product.images.filter((image) => image.id !== id)),
    variants: product.variants.map((v) => (v.imageId === id ? { ...v, imageId: null } : v)),
  };
}

/** A live region only speaks when its text changes, so a repeated message gets a trailing no-break space toggled on or off. */
export function nextAnnouncement(previous: string, message: string): string {
  return previous === message ? `${message}\u00A0` : message;
}

