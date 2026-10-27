import { describe, expect, it } from "vitest";
import type { PrismaService } from "../prisma.service";
import { CatalogService } from "./catalog.service";

const productRow = (reserved: number) => ({
  id: "B07", storeId: "sambung", slug: "kabel", name: "Kabel", categoryId: "kabel", spec: null, tags: [], art: {}, specs: null, components: null,
  variants: [{ sku: "B07", label: "", price: 69000, compareAt: null, onHand: 10, reserved, attrs: null }],
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
