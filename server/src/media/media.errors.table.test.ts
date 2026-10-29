import "reflect-metadata";
import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { heicBytes, solidJpeg, solidPng, svgBytes } from "../test/image-fixtures";
import { OK_INPUT, STAFF, file, harness, respond } from "../test/media-harness";
import { MAX_UPLOAD_BYTES } from "./limits";
import { StaffMediaGuard } from "./staff-media.guard";

/** The server rows of the spec's Error messages table, end to end through the service and the upload filter. */

const GENERIC = "Format tidak didukung. Gunakan JPG, PNG, atau WebP.";
const TOO_BIG = "Foto terlalu besar untuk diproses (maks. 40 megapiksel).";
const outcome = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return { status: 201 };
  } catch (error) {
    const out = respond(error);
    return { status: out.status, code: out.body.error.code, message: out.body.error.message };
  }
};
const upload = (buffer: Buffer, name = "foto.jpg") => {
  const h = harness();
  return { h, run: () => h.service.upload(STAFF, "B01", file(buffer, name), OK_INPUT) };
};

describe("error messages table (server rows)", () => {
  it.each([
    ["JPEG", () => solidJpeg(600, 600)],
    ["PNG", () => solidPng(600, 600)],
    ["WebP", () => sharp({ create: { width: 600, height: 600, channels: 3, background: "#456" } }).webp().toBuffer()],
    ["480 px exactly", () => solidJpeg(480, 640)],
  ])("%s is accepted", async (_name, make) => {
    expect(await outcome(upload(await make()).run)).toEqual({ status: 201 });
  });

  it("a file of exactly MAX_UPLOAD_BYTES is accepted", async () => {
    const jpeg = await solidJpeg(600, 600);
    const padded = Buffer.concat([jpeg, Buffer.alloc(MAX_UPLOAD_BYTES - jpeg.length)]);
    expect(padded.length).toBe(MAX_UPLOAD_BYTES);
    expect(await outcome(upload(padded).run)).toEqual({ status: 201 });
  });

  it.each([
    ["svg", () => svgBytes(), GENERIC],
    ["gif", () => Buffer.concat([Buffer.from("GIF89a", "latin1"), Buffer.alloc(64)]), GENERIC],
    ["a renamed text file", () => Buffer.from("bukan foto sama sekali"), GENERIC],
    ["HEIC bytes", () => heicBytes(), "Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi."],
  ])("%s gives 415", async (_name, make, message) => {
    expect(await outcome(upload(make()).run)).toEqual({ status: 415, code: "UNSUPPORTED_MEDIA", message });
  });

  it("one byte over the limit gives 413 TOO_LARGE (Multer limit and service check)", async () => {
    expect(await outcome(async () => { throw new PayloadTooLargeException(); })).toEqual({ status: 413, code: "TOO_LARGE", message: "Ukuran file maksimal 10 MB." });
    const h = harness();
    const jpeg = await solidJpeg(600, 600);
    expect(await outcome(() => h.service.upload(STAFF, "B01", { buffer: jpeg, originalname: "x.jpg", size: MAX_UPLOAD_BYTES + 1 }, OK_INPUT)))
      .toEqual({ status: 413, code: "TOO_LARGE", message: "Ukuran file maksimal 10 MB." });
  });

  it("479 px gives 422 too small", async () => {
    expect(await outcome(upload(await solidJpeg(479, 800)).run)).toEqual({ status: 422, code: "VALIDATION", message: "Foto terlalu kecil. Sisi terpendek minimal 480 px." });
  });

  it("an 8001x5000 PNG gives 422 and writes no file", async () => {
    const big = await sharp({ create: { width: 8001, height: 5000, channels: 3, background: "#fff" } }).png({ compressionLevel: 1 }).toBuffer();
    const { h, run } = upload(big, "besar.png");
    expect(await outcome(run)).toEqual({ status: 422, code: "VALIDATION", message: TOO_BIG });
    expect(h.storage.objects.size).toBe(0);
  }, 30_000);

  it("a corrupt file gives 422", async () => {
    const jpeg = await solidJpeg(800, 800);
    expect(await outcome(upload(jpeg.subarray(0, Math.floor(jpeg.length / 2))).run))
      .toEqual({ status: 422, code: "VALIDATION", message: "File foto rusak atau tidak bisa dibaca." });
  });

  it("no file or a wrong field name gives 422 'Pilih satu file foto.'", async () => {
    expect(await outcome(async () => { throw new BadRequestException("Unexpected field"); })).toEqual({ status: 422, code: "VALIDATION", message: "Pilih satu file foto." });
  });

  it.each([["operations", "Operasional"], ["cs", "CS"]] as const)("%s gives 403 with its role name", async (role, label) => {
    const guard = new StaffMediaGuard({ staff: async () => ({ id: "s", name: "Uji", role, email: "u@example.test" }) });
    const context = { switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as never;
    expect(await outcome(() => guard.canActivate(context))).toEqual({ status: 403, code: "FORBIDDEN", message: `Peran ${label} tidak punya izin untuk aksi ini.` });
  });
});
