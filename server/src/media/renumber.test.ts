import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { fakeMediaDb, type FakeImage } from "../test/fake-media-db";
import { renumber } from "./renumber";

const img = (id: string, position: number): FakeImage => ({
  id, productId: "B01", position, alt: id, hash: id, width: 1600, height: 1600, sizes: [480, 960, 1600], source: "upload", createdAt: "t", createdBy: "x",
});

const positions = (state: { images: FakeImage[] }) => Object.fromEntries(state.images.map((i) => [i.id, i.position]));

describe("renumber", () => {
  it("moves to +100 first, then writes 0..n-1 in the wanted order without a unique-key error", async () => {
    const { prisma, state } = fakeMediaDb({ products: [{ id: "B01", name: "Kabel" }], images: [0, 1, 2, 3, 4, 5].map((p) => img(`i${p}`, p)) });
    const reversed = ["i5", "i4", "i3", "i2", "i1", "i0"];
    await prisma.$transaction((tx) => renumber(tx as unknown as Prisma.TransactionClient, "B01", reversed));
    expect(positions(state)).toEqual({ i5: 0, i4: 1, i3: 2, i2: 3, i1: 4, i0: 5 });
    expect(Math.max(...state.images.map((i) => i.position))).toBe(5);
  });

  it("renumbering after deleting the middle of four leaves 0,1,2 in the old order", async () => {
    const { prisma, state } = fakeMediaDb({ products: [{ id: "B01", name: "Kabel" }], images: [0, 1, 2, 3].map((p) => img(`i${p}`, p)) });
    await prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: "i1" } });
      await renumber(tx as unknown as Prisma.TransactionClient, "B01", ["i0", "i2", "i3"]);
    });
    expect(positions(state)).toEqual({ i0: 0, i2: 1, i3: 2 });
  });
});
