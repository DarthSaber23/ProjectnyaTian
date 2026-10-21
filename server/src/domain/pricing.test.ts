import { describe, expect, it } from "vitest";
import { buildCatalog } from "./catalog";
import { discountedUnit, formatIDR, percentOfUnit } from "./money";
import { computeTotals } from "./pricing";
import { products, promotions, SNAPSHOT_AT } from "../data/fixtures";

const catalog = () => buildCatalog(products);
const NOW = SNAPSHOT_AT;
const REF_CART = [
  { sku: "B01-2M-BLK", qty: 2 },
  { sku: "B03", qty: 1 },
];

describe("money (D4)", () => {
  it("formats Rupiah and floors a percentage per unit", () => {
    expect(formatIDR(1250000)).toBe("Rp1.250.000");
    expect(percentOfUnit(159000, 10)).toBe(15900);
    expect(discountedUnit(399000, 25)).toBe(299250);
  });
});

describe("reference checkout", () => {
  it("totals Rp587.250 on the W00 cart", () => {
    const t = computeTotals({
      catalog: catalog(),
      promotions: promotions.sambung,
      now: NOW,
      lines: REF_CART,
      orderVoucherCode: "KABEL10",
      shippingVoucherCode: "GRATISONGKIR",
      shippingCost: 18000,
    });
    expect(t.subtotal).toBe(617250);
    expect(t.orderVoucher?.status.discount).toBe(30000);
    expect(t.shippingVoucher?.status.discount).toBe(18000);
    expect(t.total).toBe(587250);
    expect(t.lines.find((l) => l.sku === "B03")?.appliedPriceCode).toBe("FS-WEEKEND");
  });

  it("rejects HEMAT50 and names the Rp182.000 shortfall", () => {
    const t = computeTotals({
      catalog: catalog(),
      promotions: promotions.sambung,
      now: NOW,
      lines: REF_CART,
      orderVoucherCode: "HEMAT50",
    });
    expect(t.orderVoucher?.status.ok).toBe(false);
    expect(t.orderVoucher?.status.message).toContain("Rp182.000");
    expect(t.total).toBe(617250);
  });
});
