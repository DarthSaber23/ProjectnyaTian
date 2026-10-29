import { describe, expect, it } from "vitest";
import type { PrismaService } from "../prisma.service";
import { CatalogService } from "./catalog.service";

const productRow = (reserved: number) => ({
  id: "B07", storeId: "sambung", slug: "kabel", name: "Kabel", categoryId: "kabel", spec: null, tags: [], art: {}, specs: null, components: null,
  images: [] as unknown[],
  variants: [{ sku: "B07", label: "", price: 69000, compareAt: null, onHand: 10, reserved, attrs: null, imageId: null as string | null }],
});

const imageRow = (id: string, position: number) => ({
  id, productId: "B07", position, alt: `Foto ${id}`, hash: `${id}`.padEnd(64, "0"), width: 1600, height: 1600, sizes: [480, 960, 1600], source: "upload",
});

describe("CatalogService images", () => {
  it("asks for images ordered by position and returns them in that order with variant imageId", async () => {
    let query: unknown;
    const row = { ...productRow(0), images: [imageRow("i1", 0), imageRow("i2", 1)], variants: [{ ...productRow(0).variants[0]!, imageId: "i2" }, { ...productRow(0).variants[0]!, sku: "B07-W", imageId: null }] };
    const prisma = {
      product: { findMany: async (q: unknown) => { query = q; return [row]; } },
      promotion: { findMany: async () => [] },
    } as unknown as PrismaService;
    const catalog = new CatalogService(prisma);
    await catalog.reload();
    expect(query).toMatchObject({ include: { variants: true, images: { orderBy: { position: "asc" } } } });
    const product = catalog.list("sambung").products[0]!;
    expect(product.images!.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(product.variants[0]!.imageId).toBe("i2");
    expect("imageId" in product.variants[1]!).toBe(false);
  });

  it("bySlug carries images", async () => {
    const prisma = {
      product: { findMany: async () => [{ ...productRow(0), images: [imageRow("i1", 0)] }] },
      promotion: { findMany: async () => [] },
    } as unknown as PrismaService;
    const catalog = new CatalogService(prisma);
    await catalog.reload();
    expect(catalog.bySlug("kabel")!.product.images![0]!.src.startsWith("/media/products/")).toBe(true);
  });
});

describe("CatalogService refresh", () => {
  it("keeps the newest stock when two refreshes finish out of order", async () => {
    const answers: Array<(rows: unknown[]) => void> = [];
    const prisma = {
      product: { findMany: () => new Promise((resolve) => answers.push(resolve)) },
      promotion: { findMany: async () => [] },
    } as unknown as PrismaService;
    const catalog = new CatalogService(prisma);
    const older = catalog.reload();
    const newer = catalog.reload();
    answers[1]!([productRow(5)]);
    await newer;
    answers[0]!([productRow(2)]);
    await older;
    expect(catalog.snapshot("sambung").bySku.get("B07")!.variant.reserved).toBe(5);
  });

  it("does not fail a committed write when the refresh after it fails", async () => {
    const prisma = {
      product: { findMany: async () => { throw new Error("connection reset"); } },
      promotion: { findMany: async () => [] },
    } as unknown as PrismaService;
    await expect(new CatalogService(prisma).refreshAfterWrite()).resolves.toBeUndefined();
  });
});
