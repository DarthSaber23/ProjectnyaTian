import "reflect-metadata";
import { BadRequestException, HttpException, PayloadTooLargeException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { respond } from "../test/media-harness";
import { MediaBusyException } from "./errors";
import { MediaController } from "./media.controller";
import type { MediaService } from "./media.service";

const actor = { id: "s1", label: "Maya (Marketing)" };
const request = { mediaActor: actor };

function controller() {
  const media = {
    list: vi.fn(async () => []),
    upload: vi.fn(async () => ({ id: "img1" })),
    changeAlt: vi.fn(async () => ({ id: "img1" })),
    reorder: vi.fn(async () => ({ ids: [] })),
    remove: vi.fn(async () => ({ ok: true })),
    linkVariant: vi.fn(async () => ({ sku: "B01-1M", imageId: null })),
  };
  return { media, controller: new MediaController(media as unknown as MediaService) };
}

describe("MediaController", () => {
  it("a missing file gives 422 noFile; alt and rightsConfirmed are forwarded; the created photo is returned", async () => {
    const { media, controller: c } = controller();
    const missing = (() => { try { c.upload(request, "B01", undefined, {}); } catch (e) { return e; } })();
    expect(missing).toBeInstanceOf(HttpException);
    expect((missing as HttpException).getResponse()).toEqual({ code: "VALIDATION", message: "Pilih satu file foto." });

    const file = { buffer: Buffer.from("x"), originalname: "a.jpg", size: 1 } as Express.Multer.File;
    await expect(c.upload(request, "B01", file, { alt: "Foto", rightsConfirmed: "true", extra: 1 })).resolves.toEqual({ id: "img1" });
    expect(media.upload).toHaveBeenCalledWith(actor, "B01", { buffer: file.buffer, originalname: "a.jpg", size: 1 }, { alt: "Foto", rightsConfirmed: "true" });
  });

  it("passes alt, ids and imageId bodies through, and refuses a non-string, non-null imageId", async () => {
    const { media, controller: c } = controller();
    await c.changeAlt(request, "B01", "img1", { alt: "Baru" });
    expect(media.changeAlt).toHaveBeenCalledWith(actor, "B01", "img1", "Baru");
    await c.reorder(request, "B01", { ids: ["a", "b"] });
    expect(media.reorder).toHaveBeenCalledWith(actor, "B01", ["a", "b"]);
    await c.linkVariant(request, "B01-1M", { imageId: null });
    expect(media.linkVariant).toHaveBeenCalledWith(actor, "B01-1M", null);
    expect(() => c.linkVariant(request, "B01-1M", { imageId: 5 })).toThrow(HttpException);
    await c.remove(request, "B01", "img1");
    expect(media.remove).toHaveBeenCalledWith(actor, "B01", "img1");
  });
});

describe("UploadExceptionFilter", () => {
  it("sets Retry-After 10 on MediaBusyException and answers 503 STORAGE_UNAVAILABLE", () => {
    const out = respond(new MediaBusyException());
    expect(out.headers["Retry-After"]).toBe("10");
    expect(out).toMatchObject({ status: 503, body: { error: { code: "STORAGE_UNAVAILABLE" } } });
  });

  it("turns Multer's plain exceptions into the spec's coded errors", () => {
    expect(respond(new PayloadTooLargeException("File too large"))).toMatchObject({ status: 413, body: { error: { code: "TOO_LARGE", message: "Ukuran file maksimal 10 MB." } } });
    expect(respond(new BadRequestException("Unexpected field"))).toMatchObject({ status: 422, body: { error: { code: "VALIDATION", message: "Pilih satu file foto." } } });
    expect(respond(new Error("boom"))).toMatchObject({ status: 500, body: { error: { code: "INTERNAL" } } });
  });
});
