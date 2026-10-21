/**
 * D7: on sign-in the guest cart merges into the account cart.
 * Same SKU → quantities add up, capped by stock and the per-line limit. Nothing is silently dropped:
 * every cap is reported so the UI can tell the customer.
 */
import type { Catalog } from "./catalog";
import { maxAddable } from "./stock";
import type { CartLine } from "./types";

export interface MergeResult {
  lines: CartLine[];
  capped: { sku: string; wanted: number; kept: number }[];
}

export function mergeCarts(catalog: Catalog, account: CartLine[], guest: CartLine[], perLineCap: number): MergeResult {
  const lines: CartLine[] = [];
  const capped: MergeResult["capped"] = [];
  const wanted = new Map<string, number>();
  for (const l of [...account, ...guest]) wanted.set(l.sku, (wanted.get(l.sku) ?? 0) + l.qty);
  for (const [sku, qty] of wanted) {
    if (!catalog.bySku.has(sku)) continue; // SKU from another store/brand: ignore safely
    const room = maxAddable(catalog, sku, lines, perLineCap);
    const kept = Math.min(qty, room);
    if (kept > 0) lines.push({ sku, qty: kept });
    if (kept < qty) capped.push({ sku, wanted: qty, kept });
  }
  return { lines, capped };
}
