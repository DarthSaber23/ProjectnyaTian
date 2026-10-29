import { describe, expect, it } from "vitest";
import { STAFF, harness, keysOf, seededImage, settle } from "../test/media-harness";

const four = () => [0, 1, 2, 3].map((p) => seededImage(`i${p}`, p));
const positions = (h: ReturnType<typeof harness>, productId = "B01") =>
  h.state.images.filter((i) => i.productId === productId).sort((a, b) => a.position - b.position).map((i) => [i.id, i.position]);
const CHANGED = "409 CONFLICT Urutan foto berubah. Muat ulang halaman.";

describe("MediaService.reorder", () => {
  it.each([
    ["duplicate ids", ["i0", "i0", "i1", "i2"]],
    ["another product's id", ["i0", "i1", "i2", "a0"]],
    ["missing id (stale list)", ["i0", "i1", "i2"]],
    ["unknown id", ["i0", "i1", "i2", "zz"]],
    ["extra id", ["i0", "i1", "i2", "i3", "a0"]],
    ["empty list on a product with photos", []],
  ])("%s gives 409 with positions unchanged", async (_name, ids) => {
    const h = harness([...four(), seededImage("a0", 0, "A01")]);
    const before = positions(h);
    expect(await settle(h.service.reorder(STAFF, "B01", ids))).toBe(CHANGED);
    expect(positions(h)).toEqual(before);
    expect(h.state.audit).toHaveLength(0);
  });

  it.each([["a string", "i0"], ["numbers", [1, 2]], ["an object", { ids: ["i0"] }]])("a body of %s gives 422", async (_name, ids) => {
    const h = harness(four());
    expect(await settle(h.service.reorder(STAFF, "B01", ids))).toBe("422 VALIDATION Daftar urutan foto tidak valid.");
  });

  it("an empty list on a product with no photos is a 200 no-op with no audit", async () => {
    const h = harness(four());
    await expect(h.service.reorder(STAFF, "B02", [])).resolves.toEqual({ ids: [] });
    expect(h.state.audit).toHaveLength(0);
  });

  it("writes the new order and PRODUCT_IMAGE_REORDERED with before { ids } and after { ids, actorId }", async () => {
    const h = harness(four());
    await expect(h.service.reorder(STAFF, "B01", ["i3", "i1", "i2", "i0"])).resolves.toEqual({ ids: ["i3", "i1", "i2", "i0"] });
    expect(positions(h)).toEqual([["i3", 0], ["i1", 1], ["i2", 2], ["i0", 3]]);
    expect(h.state.audit).toEqual([expect.objectContaining({
      code: "PRODUCT_IMAGE_REORDERED", action: "Urutan foto diubah", object: "B01",
      before: { ids: ["i0", "i1", "i2", "i3"] }, after: { ids: ["i3", "i1", "i2", "i0"], actorId: STAFF.id },
    })]);
    expect(h.catalog.refreshAfterWrite).toHaveBeenCalledTimes(1);
  });
});

describe("MediaService.remove", () => {
  it("renumbers the rest, promotes the next photo, clears links, hides other products' photos and can empty a product", async () => {
    const h = harness([...four(), seededImage("a0", 0, "A01")]);
    await h.service.remove(STAFF, "B01", "i1");
    expect(positions(h)).toEqual([["i0", 0], ["i2", 1], ["i3", 2]]);

    h.state.variants.find((v) => v.sku === "B01-1M")!.imageId = "i0";
    await h.service.remove(STAFF, "B01", "i0");
    expect(positions(h)).toEqual([["i2", 0], ["i3", 1]]);
    expect(h.state.variants.find((v) => v.sku === "B01-1M")!.imageId).toBeNull();

    expect(await settle(h.service.remove(STAFF, "B01", "a0"))).toBe("404 NOT_FOUND Produk, varian atau foto tidak ditemukan.");
    await h.service.remove(STAFF, "B01", "i2");
    await h.service.remove(STAFF, "B01", "i3");
    expect(positions(h)).toEqual([]);
    expect(positions(h, "A01")).toEqual([["a0", 0]]);
  });

  it("audits the full removed row, removes its files, and after 3 failed removals writes one PRODUCT_IMAGE_FILE_DELETE_FAILED", async () => {
    const h = harness(four());
    const row = { ...h.state.images[1]! };
    await expect(h.service.remove(STAFF, "B01", "i1")).resolves.toEqual({ ok: true });
    expect(h.state.audit).toEqual([expect.objectContaining({ code: "PRODUCT_IMAGE_REMOVED", action: "Foto produk dihapus", object: "B01", before: row, after: { actorId: STAFF.id } })]);
    for (const key of keysOf(row)) expect(h.storage.objects.has(key)).toBe(false);

    const next = { ...h.state.images.find((i) => i.id === "i2")! };
    h.storage.failDeletes = true;
    h.storage.deleteCalls = [];
    await expect(h.service.remove(STAFF, "B01", "i2")).resolves.toEqual({ ok: true });
    expect(h.storage.deleteCalls).toHaveLength(3);
    expect(h.state.images.some((i) => i.id === "i2")).toBe(false);
    const failed = h.state.audit.filter((a) => a.code === "PRODUCT_IMAGE_FILE_DELETE_FAILED");
    expect(failed).toEqual([expect.objectContaining({ action: "File foto gagal dihapus", object: "B01", after: { keys: keysOf(next), actorId: STAFF.id } })]);
    expect(failed[0]!.before ?? null).toBeNull();
  });
});
