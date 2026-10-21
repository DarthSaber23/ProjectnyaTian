/** D2: compare up to 4 products from the same category. */
import type { Product } from "./types";

export const COMPARE_MAX = 4;
export const NOT_LISTED = "Tidak dicantumkan";

export type CompareCheck = { ok: true } | { ok: false; reason: "max" | "category" | "duplicate"; message: string };

export function canAddToCompare(current: Product[], candidate: Product): CompareCheck {
  if (current.some((p) => p.id === candidate.id)) return { ok: false, reason: "duplicate", message: "Produk sudah ada di perbandingan." };
  if (current.length >= COMPARE_MAX) return { ok: false, reason: "max", message: `Maksimal ${COMPARE_MAX} produk dalam perbandingan (D2).` };
  if (current.length > 0 && current[0]!.categoryId !== candidate.categoryId) {
    return { ok: false, reason: "category", message: "Hanya produk dalam kategori yang sama yang bisa dibandingkan (D2). Kosongkan dulu untuk ganti kategori." };
  }
  return { ok: true };
}

export interface CompareRow {
  key: string;
  values: string[];
  differs: boolean;
}

/** Builds attribute rows; attributes a seller did not fill show "Tidak dicantumkan" (never guessed). */
export function compareRows(products: Product[], extra: Record<string, (p: Product) => string>): CompareRow[] {
  const keys: string[] = [];
  for (const p of products) for (const k of Object.keys(p.specs ?? {})) if (!keys.includes(k)) keys.push(k);
  const rows: CompareRow[] = keys.map((k) => {
    const values = products.map((p) => p.specs?.[k] ?? NOT_LISTED);
    return { key: k, values, differs: new Set(values).size > 1 };
  });
  for (const [k, fn] of Object.entries(extra)) {
    const values = products.map(fn);
    rows.push({ key: k, values, differs: new Set(values).size > 1 });
  }
  return rows;
}
