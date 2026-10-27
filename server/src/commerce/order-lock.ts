/**
 * The one locked path for changing an order or stock (no overselling, no double settlement).
 * Inside a transaction: lock the order row first, then the stock rows of the physical SKUs in sorted
 * order, read the locked values, change them, and write them back. Every caller locks in that order,
 * so two transactions never wait on each other in a cycle.
 */
import { HttpException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { Catalog } from "../domain/catalog";
import { applyStock, physicalDemand, type StockOp } from "../domain/stock";
import type { BrandId, CartLine, Order } from "../domain/types";

/**
 * Options for every locked transaction. Prisma's defaults (2 s to get a connection, 5 s in total) turn a
 * checkout burst into errors; these let queued buyers wait their turn. Past them the filter answers 503 BUSY.
 */
export const LOCKED_TX = { maxWait: 10_000, timeout: 15_000 } as const;

/** Physical SKUs (bundles expanded to components), sorted so every transaction locks them in the same order. */
export function stockLockOrder(catalog: Catalog, lines: CartLine[]): string[] {
  return [...physicalDemand(catalog, lines).keys()].sort();
}

/** Reads the order with FOR UPDATE, so status checks see the latest committed state and other writers wait. */
export async function lockOrder(tx: Prisma.TransactionClient, number: string): Promise<{ order: Order; brand: BrandId }> {
  const rows = await tx.$queryRaw<Array<{ payload: Order; storeId: string }>>`
    SELECT payload, "storeId" FROM "OrderRecord" WHERE number = ${number} FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
  return { order: row.payload, brand: row.storeId === "halimun" ? "halimun" : "sambung" };
}

/** Locks the lines' stock rows and returns a private copy of the catalogue holding their locked values. */
export async function lockStock(tx: Prisma.TransactionClient, catalog: Catalog, lines: CartLine[]): Promise<Catalog> {
  const fresh = structuredClone(catalog);
  const skus = stockLockOrder(fresh, lines);
  if (!skus.length) return fresh;
  const rows = await tx.$queryRaw<Array<{ sku: string; onHand: number; reserved: number }>>`
    SELECT sku, "onHand", reserved FROM "Variant" WHERE sku = ANY(${skus}) ORDER BY sku FOR UPDATE`;
  for (const row of rows) {
    const hit = fresh.bySku.get(row.sku);
    if (!hit) continue;
    hit.variant.onHand = row.onHand;
    hit.variant.reserved = row.reserved;
  }
  return fresh;
}

/** Writes back the stock of the lines' physical SKUs. Call only with a catalogue returned by lockStock. */
export async function writeStock(tx: Prisma.TransactionClient, locked: Catalog, lines: CartLine[]): Promise<void> {
  for (const sku of stockLockOrder(locked, lines)) {
    const hit = locked.bySku.get(sku);
    if (!hit) continue;
    await tx.variant.update({ where: { sku }, data: { onHand: hit.variant.onHand, reserved: hit.variant.reserved } });
  }
}

/** Lock, apply one stock operation to the locked values, write back. */
export async function changeStock(tx: Prisma.TransactionClient, catalog: Catalog, lines: CartLine[], op: StockOp): Promise<void> {
  const locked = await lockStock(tx, catalog, lines);
  applyStock(locked, lines, op);
  await writeStock(tx, locked, lines);
}
