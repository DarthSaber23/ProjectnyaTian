import { createHash } from "crypto";
import { HttpException } from "@nestjs/common";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { animatedWebp, cmykJpeg, heicBytes, jpegWithMetadata, orientedJpeg, riffChunks, solidJpeg, solidPng, svgBytes } from "../test/image-fixtures";
import { configureSharp, inspectImage, processImage } from "./process";

async function refusal(promise: Promise<unknown>): Promise<{ status: number; code: string; message: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { code: string; message: string };
      return { status: error.getStatus(), code: body.code, message: body.message };
    }
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("metadata stripping", () => {
  it("precondition: the metadata fixture really carries exif, xmp and icc", async () => {
    const m = await sharp(await jpegWithMetadata()).metadata();
    expect(m.exif && m.xmp && m.icc).toBeTruthy();
  });

  it("every copy has no exif, xmp, iptc, icc or orientation and no EXIF/XMP /ICCP RIFF chunk", async () => {
    const { copies } = await processImage(await jpegWithMetadata());
    expect(copies.length).toBeGreaterThan(0);
    for (const copy of copies) {
      const m = await sharp(copy.buffer).metadata();
      expect([m.exif, m.xmp, m.iptc, m.icc, m.orientation]).toEqual([undefined, undefined, undefined, undefined, undefined]);
      const chunks = riffChunks(copy.buffer);
      expect(chunks).not.toContain("EXIF");
      expect(chunks).not.toContain("XMP ");
      expect(chunks).not.toContain("ICCP");
    }
  });

  it("outputs sRGB for a Display-P3 and a CMYK input", async () => {
    for (const input of [await jpegWithMetadata(), await cmykJpeg(800, 600)]) {
      for (const copy of (await processImage(input)).copies) {
        expect((await sharp(copy.buffer).metadata()).space).toBe("srgb");
      }
    }
  });
});

describe("rotation and widths", () => {
  it.each<[number, number, Array<[number, number, number]>]>([
    [3000, 2000, [[480, 720, 480], [960, 1440, 960], [1600, 2400, 1600]]],
    [2000, 3000, [[480, 480, 720], [960, 960, 1440], [1600, 1600, 2400]]],
  ])("%ix%i gives (target,w,h) %j", async (w, h, expected) => {
    const result = await processImage(await solidJpeg(w, h));
    expect(result.copies.map((c) => [c.target, c.width, c.height])).toEqual(expected);
    expect([result.width, result.height]).toEqual(expected[expected.length - 1]!.slice(1));
    expect(result.sizes).toEqual(expected.map((e) => e[0]));
  });

  it("shorter side 1200 gives targets 480/960/1200; 480 gives [480]; 960 gives [480,960]; nothing enlarged", async () => {
    expect((await processImage(await solidJpeg(1800, 1200))).sizes).toEqual([480, 960, 1200]);
    expect((await processImage(await solidJpeg(480, 700))).sizes).toEqual([480]);
    const r960 = await processImage(await solidJpeg(960, 960));
    expect(r960.sizes).toEqual([480, 960]);
    for (const copy of r960.copies) expect(Math.min(copy.width, copy.height)).toBe(copy.target);
  });

  it("orientation 6 on 1200x900 is read as 900x1200, passes 480, stores width 900 height 1200, no orientation tag", async () => {
    const input = await orientedJpeg(1200, 900, 6);
    expect(await inspectImage(input)).toMatchObject({ width: 900, height: 1200 });
    const result = await processImage(input);
    expect([result.width, result.height]).toEqual([900, 1200]);
    expect((await sharp(result.copies[result.copies.length - 1]!.buffer).metadata()).orientation).toBeUndefined();
  });

  it("hash is SHA-256 of the largest copy and hash16 its first 16 hex chars", async () => {
    const result = await processImage(await solidJpeg(1200, 1200));
    const largest = result.copies[result.copies.length - 1]!;
    expect(result.hash).toBe(createHash("sha256").update(largest.buffer).digest("hex"));
    expect(result.hash16).toBe(result.hash.slice(0, 16));
  });
});

describe("refusals", () => {
  it("479 refused (tooSmall) and 480 accepted", async () => {
    expect(await refusal(inspectImage(await solidJpeg(479, 800)))).toEqual({ status: 422, code: "VALIDATION", message: "Foto terlalu kecil. Sisi terpendek minimal 480 px." });
    await expect(inspectImage(await solidJpeg(480, 800))).resolves.toMatchObject({ format: "jpeg", width: 480 });
  });

  it("rejects a solid PNG of 8001x5000 (40.005 MP) with tooManyPixels before decoding", async () => {
    const input = await solidPng(8001, 5000);
    const started = Date.now();
    expect(await refusal(inspectImage(input))).toEqual({ status: 422, code: "VALIDATION", message: "Foto terlalu besar untuk diproses (maks. 40 megapiksel)." });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("Review Focus 1: 25000x1600 (40 MP) is refused with tooManyPixels because the 1600 copy would be 25000 px wide (> 16383)", async () => {
    expect((await refusal(inspectImage(await solidPng(25000, 1600)))).message).toBe("Foto terlalu besar untuk diproses (maks. 40 megapiksel).");
    await expect(inspectImage(await solidPng(16000, 2000))).resolves.toMatchObject({ width: 16000, height: 2000 });
  });

  it("Review Focus 2: PNG with alpha gives static WebP copies that keep alpha; animated WebP gives single-frame output", async () => {
    for (const copy of (await processImage(await solidPng(800, 800, { alpha: true }))).copies) {
      expect((await sharp(copy.buffer).metadata()).hasAlpha).toBe(true);
    }
    const animated = await processImage(await animatedWebp());
    for (const copy of animated.copies) {
      const m = await sharp(copy.buffer, { animated: true }).metadata();
      expect(m.pages ?? 1).toBe(1);
      expect([copy.width, copy.height]).toEqual([copy.target, copy.target]); // one 600x600 frame, not the 600x1200 strip
    }
    expect(animated.sizes).toEqual([480, 600]);
    {
    }
  });

  it("rejects truncated and corrupt files with corrupt, SVG/GIF with unsupportedFormat, HEIC bytes with heic", async () => {
    const jpeg = await solidJpeg(800, 800);
    const corrupt = { status: 422, code: "VALIDATION", message: "File foto rusak atau tidak bisa dibaca." };
    expect(await refusal(processImage(jpeg.subarray(0, Math.floor(jpeg.length / 2))))).toEqual(corrupt);
    expect(await refusal(inspectImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)])))).toEqual(corrupt);
    const unsupported = { status: 415, code: "UNSUPPORTED_MEDIA", message: "Format tidak didukung. Gunakan JPG, PNG, atau WebP." };
    expect(await refusal(inspectImage(svgBytes()))).toEqual(unsupported);
    expect(await refusal(inspectImage(await sharp({ create: { width: 600, height: 600, channels: 3, background: "#fff" } }).gif().toBuffer()))).toEqual(unsupported);
    expect(await refusal(inspectImage(heicBytes()))).toMatchObject({ status: 415, message: "Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi." });
  });

  it("configureSharp sets concurrency 2 and cache off", () => {
    configureSharp();
    expect(sharp.concurrency()).toBe(2);
    expect(sharp.cache()).toMatchObject({ memory: { max: 0 }, items: { max: 0 } });
  });
});
