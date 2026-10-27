import type { Prisma } from "@prisma/client";
import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { buildCatalog } from "../domain/catalog";
import { products } from "../data/fixtures";
import { changeStock, lockOrder, stockLockOrder } from "./order-lock";

const halimun = buildCatalog(products.filter((p) => p.brand === "halimun"));

function fakeTx(rows: unknown[]) {
  const locked: unknown[] = [];
  const writes: { sku: string; onHand: number; reserved: number }[] = [];
  const tx = {
    $queryRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => { locked.push(values[0]); return rows; },
    variant: { update: async ({ where, data }: { where: { sku: string }; data: { onHand: number; reserved: number } }) => { writes.push({ sku: where.sku, ...data }); } },
  } as unknown as Prisma.TransactionClient;
  return { tx, locked, writes };
}

describe("stockLockOrder", () => {
  it("locks a bundle's components, sorted and once each", () => {
    expect(stockLockOrder(halimun, [{ sku: "BND-PAGI", qty: 1 }, { sku: "A02", qty: 2 }])).toEqual(["A01-100", "A02", "A04"]);
  });

  it("locks in the same order whatever order the cart lists items", () => {
    expect(stockLockOrder(halimun, [{ sku: "A04", qty: 1 }, { sku: "A02", qty: 1 }])).toEqual(["A02", "A04"]);
  });
});

describe("changeStock", () => {
  it("settles a paid bundle on its components, from the locked stock rather than the bundle row", async () => {
    const { tx, locked, writes } = fakeTx([
      { sku: "A01-100", onHand: 10, reserved: 2 },
      { sku: "A02", onHand: 8, reserved: 1 },
      { sku: "A04", onHand: 5, reserved: 1 },
    ]);
    await changeStock(tx, halimun, [{ sku: "BND-PAGI", qty: 1 }], "commit");
    expect(locked).toEqual([["A01-100", "A02", "A04"]]);
    expect(writes).toEqual([
      { sku: "A01-100", onHand: 9, reserved: 1 },
      { sku: "A02", onHand: 7, reserved: 0 },
      { sku: "A04", onHand: 4, reserved: 0 },
    ]);
  });

  it("leaves the shared catalogue snapshot untouched", async () => {
    const before = halimun.bySku.get("A02")!.variant.onHand;
    const { tx } = fakeTx([{ sku: "A02", onHand: 1, reserved: 1 }]);
    await changeStock(tx, halimun, [{ sku: "A02", qty: 1 }], "commit");
    expect(halimun.bySku.get("A02")!.variant.onHand).toBe(before);
  });
});

describe("lockOrder", () => {
  it("reports a missing order as not found", async () => {
    const { tx } = fakeTx([]);
    await expect(lockOrder(tx, "ORD-000000-0000")).rejects.toBeInstanceOf(HttpException);
  });
});
