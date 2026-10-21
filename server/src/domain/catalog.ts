import type { Product, Variant } from "./types";

export interface Catalog {
  products: Product[];
  bySku: Map<string, { product: Product; variant: Variant }>;
}

export function buildCatalog(products: Product[]): Catalog {
  const bySku = new Map<string, { product: Product; variant: Variant }>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (bySku.has(variant.sku)) throw new Error(`Duplicate SKU ${variant.sku}`);
      bySku.set(variant.sku, { product, variant });
    }
  }
  return { products, bySku };
}

export function lookup(catalog: Catalog, sku: string): { product: Product; variant: Variant } {
  const hit = catalog.bySku.get(sku);
  if (!hit) throw new Error(`Unknown SKU ${sku}`);
  return hit;
}
