import { useMemo } from "react";
import { formatIDR } from "../domain/money";
import { BRANDS } from "../config/brands";
import { available } from "../domain/stock";
import { bestUnitPrice, computeTotals } from "../domain/pricing";
import type { Product, Totals } from "../domain/types";
import { shippingQuotes } from "../mocks/fixtures";
import { backend } from "../services/mock/backend";
import { useBackendVersion, useShop } from "./shop";

export function useBrand() {
  return BRANDS[useShop((s) => s.brand)];
}

export function useCatalog() {
  const brand = useShop((s) => s.brand);
  const v = useBackendVersion();
  return useMemo(() => {
    void v;
    const catalog = backend.getCatalog(brand);
    return { catalog, promotions: backend.getPromotions(brand), products: catalog.products };
  }, [brand, v]);
}

/** Totals for the current cart. `withShipping` adds the selected courier's cost. */
export function useTotals(withShipping: boolean): Totals {
  const { catalog, promotions } = useCatalog();
  const { cart, orderVoucher, shippingVoucher, courierId } = useShop();
  return useMemo(() => {
    const quote = shippingQuotes.find((q) => q.courierId === courierId);
    return computeTotals({
      catalog, promotions, now: backend.now(), lines: cart, orderVoucherCode: orderVoucher, shippingVoucherCode: shippingVoucher,
      shippingCost: withShipping ? quote?.cost ?? null : undefined,
    });
  }, [catalog, promotions, cart, orderVoucher, shippingVoucher, courierId, withShipping]);
}

export interface ProductView {
  product: Product;
  fromPrice: number;
  wasPrice?: number;
  badge?: { text: string; tone: "flash" | "strike" | "promo" };
  totalAvailable: number;
  inStockVariants: number;
}

export function useProductView(product: Product): ProductView {
  const { catalog, promotions } = useCatalog();
  const prices = product.variants.map((v) => ({ v, best: bestUnitPrice(catalog, promotions, v.sku, backend.now()) }));
  const cheapest = prices.reduce((a, b) => (b.best.unit < a.best.unit ? b : a));
  const was = cheapest.best.code ? cheapest.best.regular : cheapest.v.compareAt;
  const avail = product.variants.map((v) => available(catalog, v.sku));
  const flash = prices.some((p) => p.best.isFlashSale);
  const gift = promotions.find((p) => p.kind === "gift" && p.triggerSku === product.variants[0]?.sku);
  return {
    product,
    fromPrice: cheapest.best.unit,
    wasPrice: was,
    badge: flash ? { text: "FLASH SALE", tone: "flash" } : gift ? { text: "Beli 2 gratis 1", tone: "promo" } : was ? { text: product.components ? `Hemat ${formatIDR(was - cheapest.best.unit)}` : "HARGA CORET", tone: "strike" } : undefined,
    totalAvailable: avail.reduce((a, b) => a + b, 0),
    inStockVariants: avail.filter((a) => a > 0).length,
  };
}

