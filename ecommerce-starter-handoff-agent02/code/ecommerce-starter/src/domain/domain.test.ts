/**
 * Acceptance tests for the business rules. IDs refer to the M6 test scenarios (M6-Overview board)
 * and decisions in docs/ASSUMPTIONS_AND_DECISIONS.md.
 */
import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import { discountedUnit, formatIDR, percentOfUnit } from "./money";
import { assertFulfilmentTransition, assertPaymentTransition, orderNumber, paymentExpiry } from "./orders";
import { bestUnitPrice, computeTotals } from "./pricing";
import { search } from "./search";
import { applyStock, available, maxAddable, shortages } from "./stock";
import { formatWib } from "./time";
import { products, promotions, ORDER_CREATED_AT, SNAPSHOT_AT } from "../mocks/fixtures";
import type { PricePromotion, Product } from "./types";

const fresh = () => buildCatalog(structuredClone(products) as Product[]);
const NOW = SNAPSHOT_AT;
const REF_CART = [{ sku: "B01-2M-BLK", qty: 2 }, { sku: "B03", qty: 1 }];
const S = promotions.sambung;

describe("money (D4)", () => {
  it("formats Rupiah with dots", () => {
    expect(formatIDR(1250000)).toBe("Rp1.250.000");
    expect(formatIDR(0)).toBe("Rp0");
    expect(formatIDR(-30000)).toBe("−Rp30.000");
  });
  it("rejects non-integer money", () => expect(() => formatIDR(10.5)).toThrow());
  it("floors per unit without float drift", () => {
    expect(percentOfUnit(159000, 10)).toBe(15900);
    expect(discountedUnit(399000, 25)).toBe(299250);
    expect(discountedUnit(399000, 15)).toBe(339150);
    expect(discountedUnit(399000, 30)).toBe(279300);
  });
});

describe("reference checkout ORD-261020-0010 (T1)", () => {
  it("matches W00 exactly", () => {
    const t = computeTotals({ catalog: fresh(), promotions: S, now: NOW, lines: REF_CART, orderVoucherCode: "KABEL10", shippingVoucherCode: "GRATISONGKIR", shippingCost: 18000 });
    expect(t.subtotal).toBe(617250);
    expect(t.orderVoucher?.status.discount).toBe(30000);
    expect(t.orderVoucher?.status.message).toContain("Rp31.800");
    expect(t.shipping).toBe(18000);
    expect(t.shippingVoucher?.status.discount).toBe(18000);
    expect(t.total).toBe(587250);
    expect(t.lines.find((l) => l.sku === "B03")?.appliedPriceCode).toBe("FS-WEEKEND");
  });
});

describe("vouchers (D3)", () => {
  it("T2: HEMAT50 rejected — flash sale items excluded, short Rp182.000", () => {
    const t = computeTotals({ catalog: fresh(), promotions: S, now: NOW, lines: REF_CART, orderVoucherCode: "HEMAT50" });
    expect(t.orderVoucher?.status.ok).toBe(false);
    expect(t.orderVoucher?.status.message).toContain("Rp182.000");
    expect(t.total).toBe(617250);
  });
  it("T4: Kurir C — shipping voucher capped at Rp20.000", () => {
    const t = computeTotals({ catalog: fresh(), promotions: S, now: NOW, lines: REF_CART, orderVoucherCode: "KABEL10", shippingVoucherCode: "GRATISONGKIR", shippingCost: 27000 });
    expect(t.total).toBe(594250);
  });
  it("shipping voucher needs Rp300.000 subtotal", () => {
    const t = computeTotals({ catalog: fresh(), promotions: S, now: NOW, lines: [{ sku: "B01-2M-BLK", qty: 1 }], shippingVoucherCode: "GRATISONGKIR", shippingCost: 18000 });
    expect(t.shippingVoucher?.status.ok).toBe(false);
    expect(t.shippingVoucher?.status.message).toContain("Rp141.000");
  });
  it("unknown code is reported, not silently ignored", () => {
    const t = computeTotals({ catalog: fresh(), promotions: S, now: NOW, lines: REF_CART, orderVoucherCode: "DISKON99" });
    expect(t.orderVoucher?.status.message).toMatch(/tidak ditemukan/);
  });
  it("expired voucher window is rejected", () => {
    const t = computeTotals({ catalog: fresh(), promotions: S, now: "2026-11-01T09:00:00+07:00", lines: REF_CART, orderVoucherCode: "KABEL10" });
    expect(t.orderVoucher?.status.ok).toBe(false);
  });
});

describe("price promotions (D3, P06, P12)", () => {
  const charger = (pct: number): PricePromotion => ({
    kind: "price", code: "CHARGER15", label: "x", percentOff: pct, appliesTo: { categoryIds: ["charger"] }, isFlashSale: false,
    window: { start: "2026-10-21T00:00:00+07:00", end: "2026-10-31T23:59:59+07:00" },
  });
  it("P06-1: flash sale wins 21–22 Okt, CHARGER15 from 23 Okt", () => {
    const promos = [...S, charger(15)];
    expect(bestUnitPrice(fresh(), promos, "B03", "2026-10-21T12:00:00+07:00").unit).toBe(299250);
    expect(bestUnitPrice(fresh(), promos, "B03", "2026-10-23T12:00:00+07:00").unit).toBe(339150);
  });
  it("P06-2: deeper discount beats flash sale and makes vouchers eligible", () => {
    const r = bestUnitPrice(fresh(), [...S, charger(30)], "B03", "2026-10-21T12:00:00+07:00");
    expect(r).toMatchObject({ unit: 279300, code: "CHARGER15", isFlashSale: false });
  });
  it("tie keeps the promotion listed first (already active)", () => {
    expect(bestUnitPrice(fresh(), [...S, charger(25)], "B03", "2026-10-21T12:00:00+07:00").code).toBe("FS-WEEKEND");
  });
  it("flash sale ends after 22 Okt 23:59", () => {
    expect(bestUnitPrice(fresh(), S, "B03", "2026-10-23T00:00:00+07:00").unit).toBe(399000);
  });
});

describe("gift promotion B2G1-SERUM", () => {
  it("adds one free Travel Cleanser per two serums", () => {
    const H = promotions.halimun;
    expect(computeTotals({ catalog: fresh(), promotions: H, now: NOW, lines: [{ sku: "A03", qty: 1 }] }).lines).toHaveLength(1);
    const t = computeTotals({ catalog: fresh(), promotions: H, now: NOW, lines: [{ sku: "A03", qty: 5 }] });
    const gift = t.lines.find((l) => l.isGift);
    expect(gift).toMatchObject({ sku: "A05", qty: 2, lineTotal: 0 });
    expect(t.subtotal).toBe(745000);
  });
});

describe("stock (D6, P6)", () => {
  it("available = onHand − reserved", () => {
    const c = fresh();
    expect(available(c, "B01-2M-BLK")).toBe(7);
    expect(available(c, "B03")).toBe(11);
    expect(available(c, "B01-2M-WHT")).toBe(0);
  });
  it("T5: cannot add more than available", () => {
    expect(maxAddable(fresh(), "B01-2M-BLK", [{ sku: "B01-2M-BLK", qty: 5 }])).toBe(2);
  });
  it("P02-3: bundle and sunscreen share 9 units", () => {
    const c = fresh();
    expect(available(c, "BND-PAGI")).toBe(9);
    expect(maxAddable(c, "A04", [{ sku: "BND-PAGI", qty: 1 }])).toBe(8);
    expect(shortages(c, [{ sku: "BND-PAGI", qty: 5 }, { sku: "A04", qty: 5 }])).toEqual([{ sku: "A04", requested: 10, available: 9 }]);
  });
  it("per-line cap applies", () => expect(maxAddable(fresh(), "A02", [], 10)).toBe(10));
  it("T6: reserve then release returns stock; commit deducts on hand", () => {
    const c = fresh();
    applyStock(c, REF_CART, "reserve");
    expect(available(c, "B01-2M-BLK")).toBe(5);
    applyStock(c, REF_CART, "release");
    expect(available(c, "B01-2M-BLK")).toBe(7);
    applyStock(c, REF_CART, "reserve");
    applyStock(c, REF_CART, "commit");
    expect(available(c, "B01-2M-BLK")).toBe(5);
    expect(c.bySku.get("B01-2M-BLK")?.variant.onHand).toBe(7);
  });
});

describe("orders (I9, D6, state model)", () => {
  it("numbers orders ORD-YYMMDD-NNNN in WIB", () => {
    expect(orderNumber(ORDER_CREATED_AT, 10)).toBe("ORD-261020-0010");
    expect(orderNumber("2026-10-20T23:30:00+07:00", 11)).toBe("ORD-261020-0011");
    expect(orderNumber("2026-10-20T17:30:00Z", 1)).toBe("ORD-261021-0001"); // 00:30 WIB next day
  });
  it("payment windows: QRIS 10:30, VA next day 10:15", () => {
    expect(formatWib(paymentExpiry(ORDER_CREATED_AT, "qris"), { withDate: false })).toBe("10:30 WIB");
    expect(formatWib(paymentExpiry(ORDER_CREATED_AT, "va"))).toBe("21 Okt 2026, 10:15 WIB");
  });
  it("rejects illegal transitions", () => {
    expect(() => assertPaymentTransition("expired", "paid")).toThrow();
    expect(() => assertFulfilmentTransition("to_process", "delivered")).toThrow();
    expect(() => assertFulfilmentTransition("processing", "shipped")).not.toThrow();
  });
});

describe("search (P8)", () => {
  const sam = products.filter((p) => p.brand === "sambung");
  it("P03-1: 'type c 2m' finds only the 2 m USB-C cable", () => {
    const r = search(sam, "type c 2m");
    expect(r.products.map((p) => p.id)).toEqual(["B01"]);
    expect(r).toMatchObject({ lengthM: 2, synonymApplied: true });
  });
  it("finds the GaN charger and HDMI items", () => {
    expect(search(sam, "charger gan").products.map((p) => p.id)).toEqual(["B03"]);
    expect(search(sam, "hdmi").products.map((p) => p.id).sort()).toEqual(["B02", "B04", "B06"]);
  });
  it("P03-4: zero results", () => expect(search(sam, "mouse wireless").products).toHaveLength(0));
});
