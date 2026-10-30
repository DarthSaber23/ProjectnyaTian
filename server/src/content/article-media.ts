import type { ImageJobLimiter } from "../media/limiter";
import { inspectImage, processImage } from "../media/process";
import { articleMediaKey } from "../media/public-image";
import type { ObjectStorage } from "../storage.service";

export interface StoredArticleImage {
  hash: string;
  width: number;
  height: number;
  sizes: number[];
  keys: string[];
}

/**
 * Checks and resizes an article image with the item 1 photo code and writes its WebP copies under
 * media/articles/{articleId}/. If a write fails, only the keys this call wrote are removed, then the error is rethrown.
 */
export async function storeArticleImage(storage: ObjectStorage, limiter: ImageJobLimiter, articleId: string, buffer: Buffer): Promise<StoredArticleImage> {
  const info = await inspectImage(buffer);
  const processed = await limiter.run(() => processImage(buffer, info));
  const keys: string[] = [];
  try {
    for (const copy of processed.copies) {
      const key = articleMediaKey(articleId, processed.hash16, copy.target);
      await storage.putObject(key, copy.buffer, "image/webp");
      keys.push(key);
    }
  } catch (error) {
    if (keys.length) await storage.deleteObjects(keys).catch(() => undefined);
    throw error;
  }
  return { hash: processed.hash, width: processed.width, height: processed.height, sizes: processed.sizes, keys };
}
