/**
 * Pricing engine — implements D3 (stacking), D4 (integer Rupiah, floor per unit), D5 (PPN included).
 *
 *  1. Per item: at most ONE price promotion; the lowest resulting unit price wins.
 *     On a tie the promotion listed first (the already-active one) is kept (P12).
 *  2. Gift promotions add free lines (Rp0).
 *  3. Per order: at most ONE order voucher + ONE shipping voucher.
 *     Order vouchers skip flash-sale items unless the voucher allows them.
 *  4. total = subtotal − order voucher + shipping − shipping voucher (never below 0).
 */
import { lookup, type Catalog } from "./catalog";
import { discountedUnit, formatIDR, percentOfUnit } from "./money";
import { isWithin } from "./time";
import type {
  CartLine, GiftPromotion, OrderVoucher, PricePromotion, PricedLine, Promotion, Rupiah, ShippingVoucher, Totals, VoucherStatus,
} from "./types";

export interface PriceInput {
  catalog: Catalog;
  promotions: Promotion[];
  now: string;
  lines: CartLine[];
  orderVoucherCode?: string;
  shippingVoucherCode?: string;
  shippingCost?: Rupiah | null;
}

export function bestUnitPrice(
  catalog: Catalog, promotions: Promotion[], sku: string, now: string,
): { unit: Rupiah; regular: Rupiah; code?: string; isFlashSale: boolean } {
  const { product, variant } = lookup(catalog, sku);
  let best = { unit: variant.price, regular: variant.price, code: undefined as string | undefined, isFlashSale: false };
  for (const p of promotions) {
    if (p.kind !== "price" || !isWithin(now, p.window) || !appliesToItem(p, sku, product.categoryId)) continue;
    const candidate = p.fixedPrice?.[sku] ?? (p.percentOff !== undefined ? discountedUnit(variant.price, p.percentOff) : variant.price);
    if (candidate < best.unit) best = { unit: candidate, regular: variant.price, code: p.code, isFlashSale: p.isFlashSale };
  }
  return best;
}

function appliesToItem(p: PricePromotion, sku: string, categoryId: string): boolean {
  return Boolean(p.appliesTo.skus?.includes(sku) || p.appliesTo.categoryIds?.includes(categoryId));
}

export function priceLines(catalog: Catalog, promotions: Promotion[], lines: CartLine[], now: string): PricedLine[] {
  const priced: PricedLine[] = lines.map((l) => {
    if (!Number.isInteger(l.qty) || l.qty < 1) throw new RangeError(`Invalid quantity for ${l.sku}: ${l.qty}`);
    const { product, variant } = lookup(catalog, l.sku);
    const best = bestUnitPrice(catalog, promotions, l.sku, now);
    return {
      sku: l.sku, productId: product.id, name: product.name, variantLabel: variant.label, qty: l.qty,
      regularUnit: best.regular, unitPrice: best.unit, lineTotal: best.unit * l.qty, appliedPriceCode: best.code,
      isFlashSale: best.isFlashSale, isGift: false, categoryId: product.categoryId,
    };
  });
  for (const g of promotions.filter((p): p is GiftPromotion => p.kind === "gift" && isWithin(now, p.window))) {
    const trigger = lines.filter((l) => l.sku === g.triggerSku).reduce((s, l) => s + l.qty, 0);
    const giftQty = Math.floor(trigger / g.triggerQty) * g.giftQty;
    if (giftQty > 0) {
      const { product, variant } = lookup(catalog, g.giftSku);
      priced.push({
        sku: g.giftSku, productId: product.id, name: product.name, variantLabel: variant.label, qty: giftQty,
        regularUnit: variant.price, unitPrice: 0, lineTotal: 0, appliedPriceCode: g.code, isFlashSale: false, isGift: true, categoryId: product.categoryId,
      });
    }
  }
  return priced;
}

function notFound(code: string): VoucherStatus {
  return { ok: false, discount: 0, message: `Kode ${code} tidak ditemukan atau sudah berakhir.` };
}

export function evaluateOrderVoucher(v: OrderVoucher | undefined, code: string, lines: PricedLine[], now: string): VoucherStatus {
  if (!v || !isWithin(now, v.window)) return notFound(code);
  const eligible = lines.filter(
    (l) => !l.isGift && (!l.isFlashSale || v.allowFlashSaleItems) && (!v.appliesTo?.categoryIds || v.appliesTo.categoryIds.includes(l.categoryId)),
  );
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.lineTotal, 0);
  if (eligible.length === 0) {
    return { ok: false, discount: 0, message: `Tidak berlaku: tidak ada barang yang memenuhi syarat ${code}.` };
  }
  if (v.minEligibleSubtotal !== undefined && eligibleSubtotal < v.minEligibleSubtotal) {
    return {
      ok: false, discount: 0,
      message: `Belum memenuhi: min. ${formatIDR(v.minEligibleSubtotal)} di luar barang flash sale (saat ini ${formatIDR(eligibleSubtotal)}, kurang ${formatIDR(v.minEligibleSubtotal - eligibleSubtotal)}).`,
    };
  }
  let raw = 0;
  if (v.percentOff !== undefined) raw = eligible.reduce((s, l) => s + percentOfUnit(l.unitPrice, v.percentOff!) * l.qty, 0);
  if (v.amountOff !== undefined) raw = Math.min(v.amountOff, eligibleSubtotal);
  const discount = v.maxDiscount !== undefined ? Math.min(raw, v.maxDiscount) : raw;
  const capped = v.maxDiscount !== undefined && raw > v.maxDiscount;
  return { ok: true, discount, message: `${v.label}${capped ? ` (${formatIDR(raw)}, dibatasi maks ${formatIDR(v.maxDiscount!)})` : ""} · −${formatIDR(discount)}` };
}

export function evaluateShippingVoucher(
  v: ShippingVoucher | undefined, code: string, subtotal: Rupiah, shippingCost: Rupiah | null | undefined, now: string,
): VoucherStatus {
  if (!v || !isWithin(now, v.window)) return notFound(code);
  if (subtotal < v.minSubtotal) {
    return { ok: false, discount: 0, message: `Belum memenuhi: min. belanja ${formatIDR(v.minSubtotal)} (kurang ${formatIDR(v.minSubtotal - subtotal)}).` };
  }
  if (shippingCost === undefined || shippingCost === null) {
    return { ok: true, discount: 0, message: `${v.label} maks ${formatIDR(v.maxDiscount)} · dihitung setelah pilih kurir` };
  }
  const discount = Math.min(shippingCost, v.maxDiscount);
  return { ok: true, discount, message: `${v.label} maks ${formatIDR(v.maxDiscount)} · −${formatIDR(discount)}` };
}

export function computeTotals(input: PriceInput): Totals {
  const lines = priceLines(input.catalog, input.promotions, input.lines, input.now);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = input.lines.reduce((s, l) => s + l.qty, 0);
  const totals: Totals = { lines, itemCount, subtotal, total: subtotal };

  let orderDiscount = 0;
  if (input.orderVoucherCode) {
    const v = input.promotions.find((p): p is OrderVoucher => p.kind === "order" && p.code === input.orderVoucherCode);
    const status = evaluateOrderVoucher(v, input.orderVoucherCode, lines, input.now);
    totals.orderVoucher = { code: input.orderVoucherCode, status };
    orderDiscount = status.discount;
  }
  let shipDiscount = 0;
  if (input.shippingVoucherCode) {
    const v = input.promotions.find((p): p is ShippingVoucher => p.kind === "shipping" && p.code === input.shippingVoucherCode);
    const status = evaluateShippingVoucher(v, input.shippingVoucherCode, subtotal, input.shippingCost, input.now);
    totals.shippingVoucher = { code: input.shippingVoucherCode, status };
    shipDiscount = status.discount;
  }
  const shipping = typeof input.shippingCost === "number" ? input.shippingCost : 0;
  if (typeof input.shippingCost === "number") totals.shipping = input.shippingCost;
  totals.total = Math.max(0, subtotal - orderDiscount + shipping - shipDiscount);
  return totals;
}

/** Which kind a code is, so the UI can enforce "1 order voucher + 1 shipping voucher" (D3). */
export function voucherKind(promotions: Promotion[], code: string): "order" | "shipping" | null {
  const p = promotions.find((x) => (x.kind === "order" || x.kind === "shipping") && x.code === code.trim().toUpperCase());
  return p ? (p.kind as "order" | "shipping") : null;
}
