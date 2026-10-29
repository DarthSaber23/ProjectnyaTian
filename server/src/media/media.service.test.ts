import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { solidJpeg, svgBytes } from "../test/image-fixtures";
import { CLI, OK_INPUT, OTHER_STAFF, STAFF, file, harness, instrument, keysOf, photo, seededImage, settle } from "../test/media-harness";
import { MediaBusyException } from "./errors";
import { ImageJobLimiter } from "./limiter";
import { MAX_UPLOAD_BYTES } from "./limits";

const STORAGE_DOWN = "503 STORAGE_UNAVAILABLE Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar.";
const KEY = /^media\/products\/B01\/[0-9a-f]{16}-\d+\.webp$/;
const snapshot = (h: ReturnType<typeof harness>) => ({
  rows: JSON.stringify(h.state.images),
  files: [...h.storage.objects.keys()].sort(),
  audit: h.state.audit.length,
});

afterEach(() => vi.restoreAllMocks());

describe("MediaService.upload", () => {
  it("stores three WebP files, one row at position 0 and one PRODUCT_IMAGE_ADDED audit entry", async () => {
    const h = harness();
    const big = await solidJpeg(1600, 1600);
    const image = await h.service.upload(STAFF, "B01", file(big, "kabel.jpg"), OK_INPUT);

    expect(h.storage.objects.size).toBe(3);
    for (const [key, object] of h.storage.objects) {
      expect(key).toMatch(KEY);
      expect(object.contentType).toBe("image/webp");
    }
    const row = h.state.images[0]!;
    expect(h.state.images).toHaveLength(1);
    expect(row).toMatchObject({ productId: "B01", position: 0, alt: OK_INPUT.alt, source: "upload", createdBy: STAFF.label, sizes: [480, 960, 1600], width: 1600, height: 1600 });
    expect(image).toMatchObject({ id: row.id, position: 0, alt: OK_INPUT.alt, source: "upload", createdBy: STAFF.label, width: 1600, height: 1600 });
    expect(image.srcset).toContain("1600w");

    expect(h.state.audit).toHaveLength(1);
    const entry = h.state.audit[0]!;
    expect(entry).toMatchObject({ code: "PRODUCT_IMAGE_ADDED", action: "Foto produk ditambahkan", object: "B01", actor: STAFF.label });
    expect(entry.before ?? null).toBeNull();
    expect(entry.after).toEqual({
      imageId: row.id, position: 0, alt: OK_INPUT.alt, hash: row.hash, sizes: [480, 960, 1600], width: 1600, height: 1600, source: "upload",
      rightsConfirmed: true, uploadedBytes: big.length, uploadedFilename: "kabel.jpg", actorId: STAFF.id,
    });
    expect(h.catalog.refreshAfterWrite).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, "false", "yes"])("refuses rightsConfirmed %s with 422 and writes nothing", async (rightsConfirmed) => {
    const h = harness();
    const out = await settle(h.service.upload(STAFF, "B01", file(await photo(1)), { alt: "Foto", rightsConfirmed }));
    expect(out).toBe("422 VALIDATION Konfirmasi hak foto wajib dicentang.");
    expect(h.state.images).toHaveLength(0);
    expect(h.storage.objects.size).toBe(0);
    expect(h.state.audit).toHaveLength(0);
  });

  it.each([
    ["duplicate", "409 CONFLICT"],
    ["seventh photo", "409 LIMIT_REACHED"],
    ["oversize", "413 TOO_LARGE"],
    ["svg", "415 UNSUPPORTED_MEDIA"],
    ["too small", "422 VALIDATION"],
    ["storage down", "503 STORAGE_UNAVAILABLE"],
  ])("a rejected request (%s) leaves no new rows, files or audit entries", async (kind, expected) => {
    const h = harness(kind === "seventh photo" ? [0, 1, 2, 3, 4, 5].map((p) => seededImage(`i${p}`, p)) : []);
    const one = await photo(1);
    if (kind === "duplicate") await h.service.upload(STAFF, "B01", file(one), OK_INPUT);
    const before = snapshot(h);
    const upload =
      kind === "oversize" ? { buffer: one, originalname: "x.jpg", size: MAX_UPLOAD_BYTES + 1 }
      : kind === "svg" ? file(svgBytes(), "x.svg")
      : kind === "too small" ? file(await solidJpeg(300, 300))
      : file(one);
    if (kind === "storage down") h.storage.failAll = true;
    expect(await settle(h.service.upload(STAFF, "B01", upload, OK_INPUT))).toContain(expected);
    expect(snapshot(h)).toEqual(before);
  });

  it("(a) the 2nd of 3 puts fails: 503, no row, no files", async () => {
    const h = harness();
    h.storage.failNthPut = 2;
    expect(await settle(h.service.upload(STAFF, "B01", file(await solidJpeg(1600, 1600)), OK_INPUT))).toBe(STORAGE_DOWN);
    expect(h.state.images).toHaveLength(0);
    expect(h.storage.objects.size).toBe(0);
    expect(h.state.audit).toHaveLength(0);
  });

  it("(b) the transaction fails after the puts: only this request's files are deleted and the original error is returned", async () => {
    const h = harness();
    const tx = instrument(h.prisma);
    await h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT);
    const before = snapshot(h);
    tx.failNextAudit();
    await expect(h.service.upload(STAFF, "B01", file(await photo(2)), OK_INPUT)).rejects.toThrow("db down");
    expect(snapshot(h)).toEqual(before);
  });

  it("(c) the file removal fails after the row delete: the request succeeds and only the removed photo's files remain", async () => {
    const h = harness();
    const first = await h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT);
    await h.service.upload(STAFF, "B01", file(await photo(2)), OK_INPUT);
    const firstKeys = keysOf(h.state.images.find((i) => i.id === first.id)!);
    h.storage.failDeletes = true;
    await expect(h.service.remove(STAFF, "B01", first.id)).resolves.toEqual({ ok: true });
    const kept = keysOf(h.state.images[0]!);
    expect([...h.storage.objects.keys()].sort()).toEqual([...firstKeys, ...kept].sort());
  });

  it("(g) storage errors give 503 with the Bahasa message; while storage is not ready upload and delete answer 503", async () => {
    const h = harness([seededImage("i0", 0)]);
    h.storage.failAll = true;
    expect(await settle(h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT))).toBe(STORAGE_DOWN);
    h.storage.failAll = false;
    h.storage.ready = false;
    expect(await settle(h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT))).toBe(STORAGE_DOWN);
    expect(await settle(h.service.remove(STAFF, "B01", "i0"))).toBe(STORAGE_DOWN);
    expect(h.state.images).toHaveLength(1);
  });

  it("(h) a failed compensation and a failed post-delete removal log at error level with the keys, never the filename or alt", async () => {
    const errors = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const infos = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const h = harness();
    const name = "kabel-rahasia.jpg";
    h.storage.failNthPut = 2;
    h.storage.failDeletes = true;
    await settle(h.service.upload(STAFF, "B01", file(await solidJpeg(1600, 1600), name), OK_INPUT));
    expect(errors.mock.calls.map(String).join("\n")).toMatch(/event=media_compensation_failed .*leftBehindKeys=media\/products\/B01\//);

    h.storage.failNthPut = undefined;
    h.storage.failDeletes = false;
    const image = await h.service.upload(STAFF, "B01", file(await photo(3), name), OK_INPUT);
    h.storage.failDeletes = true;
    await h.service.remove(STAFF, "B01", image.id);
    expect(errors.mock.calls.map(String).join("\n")).toMatch(/event=media_delete_files_failed .*leftBehindKeys=media\/products\/B01\//);

    const everything = [...errors.mock.calls, ...infos.mock.calls].map(String).join("\n");
    expect(everything).not.toContain(name);
    expect(everything).not.toContain(OK_INPUT.alt);
  });

  it("sixth photo ok, seventh 409; the same bytes twice give 409 duplicate and leave the original's files untouched", async () => {
    const h = harness([0, 1, 2, 3, 4].map((p) => seededImage(`i${p}`, p)));
    await expect(h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT)).resolves.toMatchObject({ position: 5 });
    expect(await settle(h.service.upload(STAFF, "B01", file(await photo(2)), OK_INPUT))).toBe("409 LIMIT_REACHED Maksimal 6 foto per produk.");

    const d = harness();
    await d.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT);
    const files = new Map(d.storage.objects);
    expect(await settle(d.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT))).toBe("409 CONFLICT Foto ini sudah ada di produk ini.");
    expect(d.storage.objects).toEqual(files);
  });

  it("Review Focus 3: hostile or long filenames never reach a key; the audit keeps the name cut to 120 characters", async () => {
    const h = harness();
    const hostile = "../../etc/passwd\u202E.jpg";
    const long = `${"a".repeat(296)}.jpg`;
    await h.service.upload(STAFF, "B01", file(await photo(1), hostile), OK_INPUT);
    await h.service.upload(STAFF, "B01", file(await photo(2), long), OK_INPUT);
    for (const key of h.storage.objects.keys()) {
      expect(key).toMatch(KEY);
      expect(key).not.toMatch(/passwd|aaaa/);
    }
    const names = h.state.audit.map((a) => (a.after as { uploadedFilename: string }).uploadedFilename);
    expect(names[0]).toBe(hostile);
    expect([...names[1]!]).toHaveLength(120);
  });
});

describe("MediaService.changeAlt", () => {
  it("Review Focus 4: the stored value again is 200 with no audit; a new value writes PRODUCT_IMAGE_ALT_CHANGED", async () => {
    const h = harness([seededImage("i0", 0)]);
    await expect(h.service.changeAlt(STAFF, "B01", "i0", "  Foto i0 ")).resolves.toMatchObject({ id: "i0", alt: "Foto i0" });
    expect(h.state.audit).toHaveLength(0);
    expect(h.catalog.refreshAfterWrite).not.toHaveBeenCalled();

    await expect(h.service.changeAlt(STAFF, "B01", "i0", "Kabel baru")).resolves.toMatchObject({ alt: "Kabel baru" });
    expect(h.state.images[0]!.alt).toBe("Kabel baru");
    expect(h.state.audit).toEqual([expect.objectContaining({
      code: "PRODUCT_IMAGE_ALT_CHANGED", action: "Teks alternatif foto diubah", object: "B01",
      before: { imageId: "i0", alt: "Foto i0" }, after: { imageId: "i0", alt: "Kabel baru", actorId: STAFF.id },
    })]);
    expect(h.catalog.refreshAfterWrite).toHaveBeenCalledTimes(1);
  });

  it("the alt rules apply, and a photo of another product gives 404", async () => {
    const h = harness([seededImage("i0", 0), seededImage("a0", 0, "A01")]);
    expect(await settle(h.service.changeAlt(STAFF, "B01", "i0", " \u200B "))).toBe("422 VALIDATION Teks alternatif wajib diisi (1–125 karakter).");
    expect(await settle(h.service.changeAlt(STAFF, "B01", "i0", "x".repeat(126)))).toContain("422 VALIDATION");
    expect(await settle(h.service.changeAlt(STAFF, "B01", "a0", "Foto"))).toBe("404 NOT_FOUND Produk, varian atau foto tidak ditemukan.");
    expect(h.state.audit).toHaveLength(0);
  });
});

describe("MediaService.linkVariant", () => {
  it("checks ownership, ignores no-ops and maps a vanished photo to 409", async () => {
    const h = harness([seededImage("i0", 0), seededImage("i1", 1), seededImage("a0", 0, "A01")]);
    const notOurs = "422 VALIDATION Foto tidak milik produk ini.";
    expect(await settle(h.service.linkVariant(STAFF, "B01-1M", "a0"))).toBe(notOurs);
    expect(await settle(h.service.linkVariant(STAFF, "B01-1M", "nope"))).toBe(notOurs);
    expect(await settle(h.service.linkVariant(STAFF, "NOPE", "i0"))).toContain("404 NOT_FOUND");

    await expect(h.service.linkVariant(STAFF, "B01-1M", "i0")).resolves.toEqual({ sku: "B01-1M", imageId: "i0" });
    expect(h.state.audit).toEqual([expect.objectContaining({
      code: "VARIANT_IMAGE_LINKED", action: "Foto varian ditautkan", object: "B01-1M", before: { imageId: null }, after: { imageId: "i0", actorId: STAFF.id },
    })]);
    await expect(h.service.linkVariant(STAFF, "B01-1M", "i0")).resolves.toEqual({ sku: "B01-1M", imageId: "i0" });
    await expect(h.service.linkVariant(STAFF, "B01-2M", null)).resolves.toEqual({ sku: "B01-2M", imageId: null });
    expect(h.state.audit).toHaveLength(1);

    h.inject.p2003OnVariantUpdate = true;
    expect(await settle(h.service.linkVariant(STAFF, "B01-1M", "i1"))).toBe("409 CONFLICT Foto baru saja dihapus. Muat ulang halaman.");
    expect(h.state.variants.find((v) => v.sku === "B01-1M")!.imageId).toBe("i0");
  });
});

describe("MediaService limits", () => {
  it("the 21st upload in 10 minutes gives 429 and is logged; another staff member and the CLI are unaffected", async () => {
    const infos = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    const h = harness();
    const one = file(await photo(1));
    for (let i = 0; i < 20; i++) expect(await settle(h.service.upload(STAFF, "NOPE", one, OK_INPUT))).toContain("404");
    expect(await settle(h.service.upload(STAFF, "NOPE", one, OK_INPUT))).toBe("429 RATE_LIMITED Terlalu banyak unggahan. Coba lagi nanti.");
    expect(infos.mock.calls.map(String).join("\n")).toMatch(/event=media_upload_rejected .*rule=RATE_LIMITED/);
    expect(await settle(h.service.upload(OTHER_STAFF, "NOPE", one, OK_INPUT))).toContain("404");
    for (let i = 0; i < 25; i++) expect(await settle(h.service.upload(CLI, "NOPE", one, OK_INPUT))).toContain("404");
  });

  it("an image job that cannot start in time gives 503 MediaBusyException", async () => {
    const h = harness();
    h.service.limiter = new ImageJobLimiter(1, 20);
    let release!: () => void;
    const blocker = h.service.limiter.run(() => new Promise<void>((r) => { release = r; }));
    await expect(h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT)).rejects.toBeInstanceOf(MediaBusyException);
    release();
    await blocker;
    expect(h.state.images).toHaveLength(0);
  });
});

describe("MediaService.list", () => {
  it("lists both brands with admin photo fields and variant links", async () => {
    const h = harness([seededImage("i1", 1), seededImage("i0", 0), seededImage("a0", 0, "A01")]);
    h.state.variants[0]!.imageId = "i1";
    const products = await h.service.list();
    const b01 = products.find((p) => p.id === "B01")!;
    expect(b01).toMatchObject({ brand: "sambung", slug: "kabel-usb-c", name: "Kabel USB-C" });
    expect(b01.images.map((i) => [i.id, i.position, i.source, i.licence])).toEqual([["i0", 0, "upload", null], ["i1", 1, "upload", null]]);
    expect(b01.variants).toContainEqual({ sku: "B01-1M", label: "1 m", imageId: "i1" });
    expect(products.find((p) => p.id === "A01")).toMatchObject({ brand: "halimun", images: [expect.objectContaining({ id: "a0" })] });
    expect(products.find((p) => p.id === "B02")!.images).toEqual([]);
  });
});
