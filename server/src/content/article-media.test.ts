import { describe, expect, it } from "vitest";
import { fakeStorage } from "../test/fake-storage";
import { solidJpeg, svgBytes } from "../test/image-fixtures";
import { ImageJobLimiter } from "../media/limiter";
import { articleMediaKey, toPublicArticleImage } from "../media/public-image";
import { storeArticleImage } from "./article-media";

describe("article image storage", () => {
  it("articleMediaKey uses media/articles/{articleId}/{hash16}-{target}.webp", () => {
    expect(articleMediaKey("art1", "0123456789abcdef", 960)).toBe("media/articles/art1/0123456789abcdef-960.webp");
  });

  it("stores three WebP copies under the article and answers their size and keys", async () => {
    const storage = fakeStorage();
    const stored = await storeArticleImage(storage, new ImageJobLimiter(), "art1", await solidJpeg(1600, 1000));
    expect(stored.sizes).toEqual([480, 960, 1000]);
    expect(stored.keys).toEqual(stored.sizes.map((t) => articleMediaKey("art1", stored.hash.slice(0, 16), t)));
    expect([...storage.objects.keys()].sort()).toEqual([...stored.keys].sort());
    for (const object of storage.objects.values()) expect(object.contentType).toBe("image/webp");
    expect(toPublicArticleImage({ articleId: "art1", hash: stored.hash, width: stored.width, height: stored.height, sizes: stored.sizes, alt: "Sampul" }))
      .toMatchObject({ alt: "Sampul", src: `/${articleMediaKey("art1", stored.hash.slice(0, 16), 960)}` });
  });

  it("a failed second put leaves no files and rethrows the storage error", async () => {
    const storage = fakeStorage();
    storage.failNthPut = 2;
    await expect(storeArticleImage(storage, new ImageJobLimiter(), "art1", await solidJpeg(1600, 1600))).rejects.toMatchObject({ name: "ServiceUnavailable" });
    expect(storage.objects.size).toBe(0);
  });

  it("refuses an unsupported file with the item 1 message and writes nothing", async () => {
    const storage = fakeStorage();
    await expect(storeArticleImage(storage, new ImageJobLimiter(), "art1", svgBytes())).rejects.toMatchObject({ status: 415 });
    expect(storage.objects.size).toBe(0);
  });
});
