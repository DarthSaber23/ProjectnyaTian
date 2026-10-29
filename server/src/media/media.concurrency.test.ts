import { describe, expect, it } from "vitest";
import { OK_INPUT, STAFF, file, gate, gatePuts, harness, instrument, keysOf, photo, seededImage, settle, sleep, until } from "../test/media-harness";

/**
 * Races between photo operations. An upload whose file writes are held keeps its product lock, so the other
 * operation must wait for it. Each case fails when the lockProduct call of the racing operation is removed.
 */

const seeded = (n: number) => Array.from({ length: n }, (_, p) => seededImage(`i${p}`, p));
const positionsAreDense = (h: ReturnType<typeof harness>) => {
  const list = h.state.images.filter((i) => i.productId === "B01").map((i) => i.position).sort((a, b) => a - b);
  expect(list).toEqual(list.map((_, i) => i));
};

describe("media concurrency", () => {
  it("two simultaneous uploads at 5 photos: one success, one 409 LIMIT_REACHED, the loser's files absent", async () => {
    const h = harness(seeded(5));
    const tx = instrument(h.prisma);
    const puts = gatePuts(h.storage);
    const [one, two] = [await photo(1), await photo(2)];
    const a = settle(h.service.upload(STAFF, "B01", file(one), OK_INPUT));
    const b = settle(h.service.upload(STAFF, "B01", file(two), OK_INPUT));
    await until(() => tx.started() >= 2 && puts.entered() >= 1);
    await sleep(30);
    puts.open();
    const results = await Promise.all([a, b]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.find((r) => r !== "ok")).toMatch(/^409 LIMIT_REACHED/);
    expect(h.state.images).toHaveLength(6);
    positionsAreDense(h);
    const live = new Set(h.state.images.flatMap(keysOf));
    expect([...h.storage.objects.keys()].every((k) => live.has(k))).toBe(true);
  });

  it("upload during reorder: the reorder waits, then sees the new photo and answers 409", async () => {
    const h = harness(seeded(5));
    const puts = gatePuts(h.storage);
    const upload = settle(h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT));
    await until(() => puts.entered() >= 1);
    const reorder = settle(h.service.reorder(STAFF, "B01", ["i4", "i3", "i2", "i1", "i0"]));
    await sleep(30);
    puts.open();
    expect(await upload).toBe("ok");
    expect(await reorder).toBe("409 CONFLICT Urutan foto berubah. Muat ulang halaman.");
    positionsAreDense(h);
  });

  it("delete and variant link during an upload: both wait; the delete renumbers densely and the link sees the photo gone", async () => {
    const h = harness(seeded(5));
    const puts = gatePuts(h.storage);
    const upload = settle(h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT));
    await until(() => puts.entered() >= 1);
    const remove = settle(h.service.remove(STAFF, "B01", "i1"));
    await sleep(5);
    const link = settle(h.service.linkVariant(STAFF, "B01-1M", "i1"));
    await sleep(30);
    puts.open();
    expect(await upload).toBe("ok");
    expect(await remove).toBe("ok");
    expect(await link).toBe("422 VALIDATION Foto tidak milik produk ini.");
    expect(h.state.images).toHaveLength(5);
    positionsAreDense(h);
    expect(h.state.variants.find((v) => v.sku === "B01-1M")!.imageId).toBeNull();
  });

  it("upload during a delete on a full product takes the freed slot", async () => {
    const h = harness(seeded(6));
    const remove = settle(h.service.remove(STAFF, "B01", "i5"));
    const upload = settle(h.service.upload(STAFF, "B01", file(await photo(1)), OK_INPUT));
    expect(await remove).toBe("ok");
    expect(await upload).toBe("ok");
    expect(h.state.images).toHaveLength(6);
    positionsAreDense(h);
  });

  it("the same photo uploaded twice at once keeps the first row's files", async () => {
    const h = harness();
    const tx = instrument(h.prisma);
    const puts = gatePuts(h.storage);
    const same = await photo(1);
    const a = settle(h.service.upload(STAFF, "B01", file(same), OK_INPUT));
    const b = settle(h.service.upload(STAFF, "B01", file(same), OK_INPUT));
    await until(() => tx.started() >= 2 && puts.entered() >= 1);
    await sleep(30);
    puts.open();
    const results = await Promise.all([a, b]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(results.find((r) => r !== "ok")).toBe("409 CONFLICT Foto ini sudah ada di produk ini.");
    expect(h.state.images).toHaveLength(1);
    for (const key of keysOf(h.state.images[0]!)) expect(h.storage.objects.has(key)).toBe(true);
  });

  it("a delete followed at once by a re-upload of the same photo leaves the files in place", async () => {
    const h = harness();
    const same = await photo(1);
    const first = await h.service.upload(STAFF, "B01", file(same), OK_INPUT);
    const held = gate();
    h.catalog.refreshAfterWrite.mockImplementationOnce(() => held.wait);
    const remove = h.service.remove(STAFF, "B01", first.id);
    await until(() => h.catalog.refreshAfterWrite.mock.calls.length >= 2);
    const again = await h.service.upload(STAFF, "B01", file(same), OK_INPUT);
    held.open();
    await remove;
    const row = h.state.images.find((i) => i.id === again.id)!;
    for (const key of keysOf(row)) expect(h.storage.objects.has(key)).toBe(true);
  });

  it("an unknown product gives 404 for every operation", async () => {
    const h = harness();
    const notFound = /^404 NOT_FOUND/;
    expect(await settle(h.service.upload(STAFF, "NOPE", file(await photo(1)), OK_INPUT))).toMatch(notFound);
    expect(await settle(h.service.changeAlt(STAFF, "NOPE", "i0", "Foto"))).toMatch(notFound);
    expect(await settle(h.service.reorder(STAFF, "NOPE", []))).toMatch(notFound);
    expect(await settle(h.service.remove(STAFF, "NOPE", "i0"))).toMatch(notFound);
    expect(await settle(h.service.linkVariant(STAFF, "NOPE-1", null))).toMatch(notFound);
  });
});
