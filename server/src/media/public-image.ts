import type { ProductImage } from "../domain/types";

/** Storage key of one WebP copy. The name comes from the content hash, so a changed photo gets a new key. */
export function mediaKey(productId: string, hash16: string, target: number): string {
  return `media/products/${productId}/${hash16}-${target}.webp`;
}

/**
 * Public catalogue shape of a photo. srcset descriptors are the shorter-side targets (spec section 1), so the
 * browser picks a copy by the size of the square frame. Licence and credit data never leave the admin API.
 */
export function toPublicImage(row: { id: string; productId: string; alt: string; hash: string; width: number; height: number; sizes: number[]; source: string }): ProductImage {
  const hash16 = row.hash.slice(0, 16);
  const url = (target: number) => `/${mediaKey(row.productId, hash16, target)}`;
  const sizes = [...row.sizes].sort((a, b) => a - b);
  const src = [...sizes].reverse().find((s) => s <= 960) ?? sizes[0]!;
  const image: ProductImage = {
    id: row.id,
    alt: row.alt,
    width: row.width,
    height: row.height,
    src: url(src),
    srcset: sizes.map((s) => `${url(s)} ${s}w`).join(", "),
  };
  if (row.source === "sample") image.sample = true;
  return image;
}

/** Storage key of one WebP copy of an article cover or body image. */
export function articleMediaKey(articleId: string, hash16: string, target: number): string {
  return `media/articles/${articleId}/${hash16}-${target}.webp`;
}

/** Public shape of an article image (same as a product photo, without the sample flag). */
export function toPublicArticleImage(row: { articleId: string; hash: string; width: number; height: number; sizes: number[]; alt: string }): ProductImage {
  const hash16 = row.hash.slice(0, 16);
  const url = (target: number) => `/${articleMediaKey(row.articleId, hash16, target)}`;
  const sizes = [...row.sizes].sort((a, b) => a - b);
  const src = [...sizes].reverse().find((s) => s <= 960) ?? sizes[0]!;
  return { id: `${row.articleId}:${hash16}`, alt: row.alt, width: row.width, height: row.height, src: url(src), srcset: sizes.map((s) => `${url(s)} ${s}w`).join(", ") };
}
