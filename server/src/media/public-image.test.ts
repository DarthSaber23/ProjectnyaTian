import { describe, expect, it } from "vitest";
import { mediaKey, toPublicImage } from "./public-image";

const row = { id: "i1", productId: "B01", alt: "Kabel", hash: "1a2b3c4d5e6f7a8b" + "0".repeat(48), width: 2400, height: 1600, sizes: [480, 960, 1600], source: "upload" };

describe("toPublicImage", () => {
  it("builds srcset descriptors from the stored targets, src is the largest target <= 960", () => {
    const img = toPublicImage(row);
    expect(img.src).toBe("/media/products/B01/1a2b3c4d5e6f7a8b-960.webp");
    expect(img.srcset).toBe("/media/products/B01/1a2b3c4d5e6f7a8b-480.webp 480w, /media/products/B01/1a2b3c4d5e6f7a8b-960.webp 960w, /media/products/B01/1a2b3c4d5e6f7a8b-1600.webp 1600w");
  });

  it("src falls back to the smallest target when sizes is [480]", () => {
    expect(toPublicImage({ ...row, sizes: [480] }).src).toBe("/media/products/B01/1a2b3c4d5e6f7a8b-480.webp");
  });

  it("sample is true only for source sample and no credit or licence keys leak", () => {
    expect(toPublicImage({ ...row, source: "sample" }).sample).toBe(true);
    expect("sample" in toPublicImage({ ...row, source: "upload" })).toBe(false);
    expect(Object.keys(toPublicImage({ ...row, source: "sample" })).sort()).toEqual(["alt", "height", "id", "sample", "src", "srcset", "width"]);
  });

  it("mediaKey builds the storage key", () => {
    expect(mediaKey("B01", "1a2b3c4d5e6f7a8b", 960)).toBe("media/products/B01/1a2b3c4d5e6f7a8b-960.webp");
  });
});
