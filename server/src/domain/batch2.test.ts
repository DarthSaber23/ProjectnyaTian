import { describe, expect, it } from "vitest";
import { evaluateAttempt, looksLikeEmail, safeNext } from "./auth";
import { mergeCarts } from "./cart";
import { buildCatalog } from "./catalog";
import { canAddToCompare, compareRows, NOT_LISTED } from "./compare";
import { isCourierOverdue } from "./orders";
import { available } from "./stock";
import { products, SNAPSHOT_AT } from "../mocks/fixtures";
import { MockBackend } from "../services/mock/backend";
import type { Product } from "./types";

const fresh = () => buildCatalog(structuredClone(products) as Product[]);
const P = (id: string) => products.find((p) => p.id === id)!;

describe("cart merge (D7)", () => {
  it("adds quantities of the same SKU and keeps others", () => {
    const r = mergeCarts(fresh(), [{ sku: "B07", qty: 1 }], [{ sku: "B07", qty: 2 }, { sku: "B02", qty: 1 }], 99);
    expect(r.lines).toEqual([{ sku: "B07", qty: 3 }, { sku: "B02", qty: 1 }]);
    expect(r.capped).toEqual([]);
  });
  it("caps by stock and reports it", () => {
    const r = mergeCarts(fresh(), [{ sku: "B01-2M-BLK", qty: 5 }], [{ sku: "B01-2M-BLK", qty: 4 }], 99);
    expect(r.lines).toEqual([{ sku: "B01-2M-BLK", qty: 7 }]);
    expect(r.capped).toEqual([{ sku: "B01-2M-BLK", wanted: 9, kept: 7 }]);
  });
  it("drops unknown SKUs safely", () => expect(mergeCarts(fresh(), [], [{ sku: "ZZZ", qty: 1 }], 99).lines).toEqual([]));
});

describe("sign-in throttling (P7)", () => {
  it("locks after 5 failures for 15 minutes, then allows again", () => {
    let st = { failures: 0 } as Parameters<typeof evaluateAttempt>[0];
    for (let i = 1; i <= 4; i++) {
      const r = evaluateAttempt(st, false, SNAPSHOT_AT);
      expect(r).toMatchObject({ ok: false, reason: "invalid", remaining: 5 - i });
      st = r.state;
    }
    const locked = evaluateAttempt(st, false, SNAPSHOT_AT);
    expect(locked).toMatchObject({ ok: false, reason: "locked", until: "2026-10-20T10:31:00+07:00" });
    expect(evaluateAttempt(locked.state, true, "2026-10-20T10:20:00+07:00")).toMatchObject({ ok: false, reason: "locked" });
    expect(evaluateAttempt(locked.state, true, "2026-10-20T10:31:01+07:00").ok).toBe(true);
  });
  it("email shape check", () => {
    expect(looksLikeEmail("rina@example.com")).toBe(true);
    expect(looksLikeEmail("rina@")).toBe(false);
  });
});

describe("compare (D2)", () => {
  it("max 4, same category, no duplicates", () => {
    const cables = ["B01", "B05", "B06", "B07"].map(P);
    expect(canAddToCompare(cables, P("B08"))).toMatchObject({ ok: false, reason: "max" });
    expect(canAddToCompare([P("B01")], P("B03"))).toMatchObject({ ok: false, reason: "category" });
    expect(canAddToCompare([P("B01")], P("B01"))).toMatchObject({ ok: false, reason: "duplicate" });
    expect(canAddToCompare([P("B01")], P("B08")).ok).toBe(true);
  });
  it("marks missing specs as not listed and flags differences", () => {
    const rows = compareRows([P("B06"), P("B08")], {});
    const video = rows.find((r) => r.key === "Output video")!;
    expect(video).toMatchObject({ values: ["8K60 / 4K120", "8K60"], differs: true });
    expect(rows.find((r) => r.key === "Material")!.values).toEqual([NOT_LISTED, NOT_LISTED]);
  });
});

describe("account & orders", () => {
  it("ORD-261014-0003 is flagged as courier overdue (>72 h since 15 Okt 18:22)", () => {
    const b = new MockBackend();
    const o = b.get("ORD-261014-0003")!;
    expect(o.totals.total).toBe(386000);
    expect(isCourierOverdue(o, b.now())).toBe(true);
  });
  it("gift items are reserved too (B2G1)", async () => {
    const b = new MockBackend();
    const before = available(b.getCatalog("halimun"), "A05");
    const r = await b.create({ brand: "halimun", customerId: "C-0001", lines: [{ sku: "A03", qty: 2 }], addressId: "rumah", courierId: "kurir-a", paymentMethod: "qris" });
    expect(r.ok).toBe(true);
    expect(available(b.getCatalog("halimun"), "A05")).toBe(before - 1);
    if (r.ok) expect(r.order.number).toBe("ORD-261020-0001");
  });
  it("consent change records time and source; unchanged keys keep their record", () => {
    const b = new MockBackend();
    b.updateConsents("C-0001", { personalised: false, emailPromo: false });
    const c = b.consents();
    expect(c.personalised).toMatchObject({ granted: false, changedAt: "2026-10-20T10:16:00+07:00" });
    expect(c.emailPromo.changedAt).toBe("2026-10-20T08:02:00+07:00");
  });
  it("wishlist seed and toggle", () => {
    const b = new MockBackend();
    expect(b.wishlist("C-0001", "sambung")).toEqual(["B04", "B06"]);
    expect(b.toggleWishlist("C-0001", "sambung", "B04")).toBe(false);
    expect(b.wishlist("C-0001", "sambung")).toEqual(["B06"]);
  });
});

describe("open-redirect protection (A-6)", () => {
  it("keeps internal paths, rejects external and tricky ones", () => {
    expect(safeNext("/checkout/pengiriman")).toBe("/checkout/pengiriman");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/\tevil", null, ""]) expect(safeNext(bad)).toBe("/akun");
  });
});
