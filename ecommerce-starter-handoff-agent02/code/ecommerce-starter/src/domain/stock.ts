/**
 * Stock rules (M1 state model, D6):
 *   available = onHand − reserved
 *   reserve at order creation; release on expiry/cancel; deduct on payment.
 * Bundles have no stock of their own; they consume their components (P6).
 * Production reservation algorithm (concurrency, locking) belongs to Agent 02.
 */
import { lookup, type Catalog } from "./catalog";
import type { CartLine } from "./types";

export function available(catalog: Catalog, sku: string): number {
  const { product, variant } = lookup(catalog, sku);
  if (product.components) {
    return Math.min(
      ...Object.entries(product.components).map(([c, q]) => Math.floor(available(catalog, c) / q)),
    );
  }
  return Math.max(0, variant.onHand - variant.reserved);
}

/** Expand cart lines into physical SKU quantities (bundles → components). */
export function physicalDemand(catalog: Catalog, lines: CartLine[]): Map<string, number> {
  const demand = new Map<string, number>();
  for (const line of lines) {
    const { product } = lookup(catalog, line.sku);
    const parts = product.components ?? { [line.sku]: 1 };
    for (const [sku, q] of Object.entries(parts)) demand.set(sku, (demand.get(sku) ?? 0) + q * line.qty);
  }
  return demand;
}

/**
 * How many more units of `sku` can be added given what is already in the cart.
 * Accounts for shared component stock (e.g. sunscreen + morning bundle).
 */
export function maxAddable(catalog: Catalog, sku: string, cart: CartLine[], perLineCap = Infinity): number {
  const demand = physicalDemand(catalog, cart);
  const { product } = lookup(catalog, sku);
  const parts = product.components ?? { [sku]: 1 };
  const byStock = Math.min(
    ...Object.entries(parts).map(([c, q]) => Math.floor((available(catalog, c) - (demand.get(c) ?? 0)) / q)),
  );
  const inCart = cart.filter((l) => l.sku === sku).reduce((s, l) => s + l.qty, 0);
  return Math.max(0, Math.min(byStock, perLineCap - inCart));
}

/** Returns the SKUs that would be over-committed by these lines (empty = OK). */
export function shortages(catalog: Catalog, lines: CartLine[]): { sku: string; requested: number; available: number }[] {
  const out: { sku: string; requested: number; available: number }[] = [];
  for (const [sku, requested] of physicalDemand(catalog, lines)) {
    const a = available(catalog, sku);
    if (requested > a) out.push({ sku, requested, available: a });
  }
  return out;
}

/** Mutates variant stock in place. Used only by the mock backend (single-threaded demo). */
export type StockOp = "reserve" | "release" | "commit" | "restock";
export function applyStock(catalog: Catalog, lines: CartLine[], op: StockOp): void {
  for (const [sku, qty] of physicalDemand(catalog, lines)) {
    const { variant } = lookup(catalog, sku);
    if (op === "reserve") variant.reserved += qty;
    if (op === "release") variant.reserved = Math.max(0, variant.reserved - qty);
    if (op === "restock") variant.onHand += qty;
    if (op === "commit") {
      variant.reserved = Math.max(0, variant.reserved - qty);
      variant.onHand = Math.max(0, variant.onHand - qty);
    }
  }
}
