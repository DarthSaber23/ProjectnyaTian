import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { lockProduct } from "../commerce/order-lock";
import { fakeMediaDb, type FakeImage } from "./fake-media-db";

const img = (id: string, position: number, hash = id): FakeImage => ({
  id, productId: "B01", position, alt: id, hash, width: 1600, height: 1600, sizes: [480, 960, 1600], source: "upload", createdAt: "t", createdBy: "x",
});

const seed = () => fakeMediaDb({
  products: [{ id: "B01", name: "Kabel" }],
  variants: [{ sku: "B01-2M-BLK", productId: "B01", imageId: null }],
  images: [0, 1, 2, 3, 4].map((p) => img(`i${p}`, p)),
});

describe("fakeMediaDb", () => {
  it("does not serialise: two transactions interleave their reads", async () => {
    const { prisma } = seed();
    const seen: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const a = prisma.$transaction(async (tx) => { seen.push(await tx.productImage.count({ where: { productId: "B01" } })); await gate; });
    const b = prisma.$transaction(async (tx) => { seen.push(await tx.productImage.count({ where: { productId: "B01" } })); });
    await b;
    release();
    await a;
    expect(seen).toEqual([5, 5]);
  });

  it("a lock-holding transaction blocks a second lockProduct until it ends, FIFO", async () => {
    const { prisma } = seed();
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const first = prisma.$transaction(async (tx) => { await lockProduct(tx as unknown as Prisma.TransactionClient, "B01"); order.push("first locked"); await gate; order.push("first done"); });
    await new Promise((r) => setTimeout(r, 5));
    const second = prisma.$transaction(async (tx) => { await lockProduct(tx as unknown as Prisma.TransactionClient, "B01"); order.push("second locked"); });
    const third = prisma.$transaction(async (tx) => { await lockProduct(tx as unknown as Prisma.TransactionClient, "B01"); order.push("third locked"); });
    await new Promise((r) => setTimeout(r, 5));
    expect(order).toEqual(["first locked"]);
    release();
    await Promise.all([first, second, third]);
    expect(order).toEqual(["first locked", "first done", "second locked", "third locked"]);
  });

  it("duplicate (productId, position) and (productId, hash) throw P2002 with meta.target containing 'position' / 'hash'", async () => {
    const { prisma } = seed();
    const position = await prisma.productImage.create({ data: img("x1", 0, "other") }).catch((e: unknown) => e);
    expect(position).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((position as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
    expect(String((position as Prisma.PrismaClientKnownRequestError).meta?.target)).toContain("position");
    const hash = await prisma.productImage.create({ data: img("x2", 5, "i0") }).catch((e: unknown) => e);
    expect(String((hash as Prisma.PrismaClientKnownRequestError).meta?.target)).toContain("hash");
  });

  it("a throwing transaction leaves rows, links and audit as before", async () => {
    const { prisma, state } = seed();
    await prisma.variant.update({ where: { sku: "B01-2M-BLK" }, data: { imageId: "i1" } });
    const before = JSON.stringify(state);
    await prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: "i1" } });
      await tx.productImage.create({ data: img("i9", 9) });
      await tx.auditRecord.create({ data: { code: "PRODUCT_IMAGE_REMOVED", object: "B01", before: null, after: {} } });
      throw new Error("boom");
    }).catch(() => undefined);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("variant link to a missing photo throws P2003, and the injection switch forces one", async () => {
    const { prisma, inject } = seed();
    const missing = await prisma.variant.update({ where: { sku: "B01-2M-BLK" }, data: { imageId: "nope" } }).catch((e: unknown) => e);
    expect((missing as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");
    inject.p2003OnVariantUpdate = true;
    const forced = await prisma.variant.update({ where: { sku: "B01-2M-BLK" }, data: { imageId: "i1" } }).catch((e: unknown) => e);
    expect((forced as Prisma.PrismaClientKnownRequestError).code).toBe("P2003");
    await expect(prisma.variant.update({ where: { sku: "B01-2M-BLK" }, data: { imageId: "i1" } })).resolves.toMatchObject({ imageId: "i1" });
  });
});
