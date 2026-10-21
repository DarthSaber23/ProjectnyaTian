import { describe, expect, it } from "vitest";
import { computeMetrics } from "./analytics";
import { can, maskEmail, maskPhone } from "./rbac";
import { MOCK_SESSIONS_14_20_OKT, staff } from "../mocks/fixtures";
import { MockBackend } from "../services/mock/backend";
import { MockAdmin } from "../services/mock/admin";
import { available } from "./stock";
import { bestUnitPrice } from "./pricing";

const setup = () => { const b = new MockBackend(); return { b, a: new MockAdmin(b) }; };
const [owner, ops, mkt, cs] = staff as [typeof staff[0], typeof staff[0], typeof staff[0], typeof staff[0]];

describe("analytics reconciles with W00 (X01, X10, X11)", () => {
  it("M1–M7 for 14–20 Okt", () => {
    const m = computeMetrics(new MockBackend().allOrders(), "2026-10-14", "2026-10-20", MOCK_SESSIONS_14_20_OKT);
    expect(m).toMatchObject({ netRevenue: 2097000, paidOrders: 8, aov: 262125, conversionPct: 0.65, refunds: 237000, paymentCompletionPct: 88.9, repeatBuyers: { repeat: 2, buyers: 6 } });
    expect(m.daily.map((d) => d.net)).toEqual([950000, 0, 87000, 567000, 0, 217000, 276000]);
    expect(m.daily.reduce((s, d) => s + d.gross, 0)).toBe(2334000);
  });
});

describe("access matrix (C8)", () => {
  it("least privilege", () => {
    expect(can("operations", "orders.refund")).toBe(false);
    expect(can("owner", "orders.refund")).toBe(true);
    expect(can("cs", "orders.fulfil")).toBe(false);
    expect(can("marketing", "orders.view")).toBe(false);
    expect(can("admin", "users.manage")).toBe(false);
    expect(can(undefined, "dashboard.view")).toBe(false);
  });
  it("masks contacts", () => {
    expect(maskEmail("citra@example.com")).toBe("c***@example.com");
    expect(maskPhone("0812-0000-3356")).toBe("0812-****-3356");
  });
});

describe("admin actions (P05)", () => {
  it("process then ship 0009 with validated tracking number; audit appended", () => {
    const { a } = setup();
    expect(() => a.process(cs, "ORD-261020-0009")).toThrow(/tidak punya izin/);
    expect(a.process(ops, "ORD-261020-0009").history[0]).toMatchObject({ status: "Diproses", at: "2026-10-20T10:20:00+07:00" });
    expect(() => a.ship(ops, "ORD-261020-0009", "abc")).toThrow(/Format resi/);
    const o = a.ship(ops, "ORD-261020-0009", "sim-ka-88213010");
    expect(o).toMatchObject({ fulfilment: "shipped", trackingNumber: "SIM-KA-88213010" });
    expect(a.auditLog(owner).slice(0, 2).map((e) => e.code)).toEqual(["ORDER_SHIPPED", "ORDER_STATUS"]);
  });
  it("refund 0007: Owner only, amount limits, full refund cancels and restocks", () => {
    const { a, b } = setup();
    expect(() => a.refund(ops, "ORD-261019-0007", 217000, "Pelanggan membatalkan", true)).toThrow(/tidak punya izin/);
    expect(() => a.refund(owner, "ORD-261019-0007", 300000, "Pelanggan membatalkan", true)).toThrow(/Rp217\.000/);
    expect(() => a.refund(owner, "ORD-261019-0007", 1000, "", true)).toThrow(/alasan/);
    const before = available(b.getCatalog("sambung"), "B08");
    const o = a.refund(owner, "ORD-261019-0007", 217000, "Pelanggan membatalkan", true);
    expect(o).toMatchObject({ fulfilment: "cancelled", refunded: 217000, payment: { status: "refunded" } });
    expect(available(b.getCatalog("sambung"), "B08")).toBe(before + 1);
    // D12: refund counts on 20 Okt
    const m = computeMetrics(b.allOrders(), "2026-10-14", "2026-10-20", 1240);
    expect(m.daily[m.daily.length - 1]!.net).toBe(276000 - 217000);
  });
  it("partial refund keeps the order open", () => {
    const { a } = setup();
    expect(a.refund(owner, "ORD-261019-0007", 18000, "Barang rusak", false)).toMatchObject({ payment: { status: "partially_refunded" }, fulfilment: "to_process" });
  });
  it("refund after shipping is blocked (P10)", () => {
    const { a } = setup();
    expect(() => a.refund(owner, "ORD-261014-0003", 1000, "Barang rusak", false)).toThrow(/retur/);
  });
  it("contact: masked for ops until a reasoned reveal, full for owner, logged", () => {
    const { a } = setup();
    expect(a.contact(ops, "C-0003")).toMatchObject({ email: "c***@example.com", phone: "0812-****-3356", full: false });
    expect(a.contact(owner, "C-0003")).toMatchObject({ email: "citra@example.com", full: true });
    expect(() => a.reveal(ops, "C-0003", "", "ORD-261020-0009")).toThrow(/alasan/);
    const until = a.reveal(ops, "C-0003", "Konfirmasi pengiriman pesanan", "ORD-261020-0009");
    expect(until).toBe("2026-10-20T10:21:00+07:00");
    expect(a.contact(ops, "C-0003", "2026-10-20T10:20:30+07:00").email).toBe("citra@example.com");
    expect(a.contact(ops, "C-0003", "2026-10-20T10:21:00+07:00").full).toBe(false);
    expect(a.auditLog(owner)[0]!.code).toBe("CONTACT_REVEAL");
    expect(() => a.reveal(mkt, "C-0003", "Verifikasi refund", "x")).toThrow(/tidak punya izin/);
  });
  it("promotion scheduling needs review and a future start (P12)", () => {
    const { a, b } = setup();
    expect(() => a.schedule(mkt)).toThrow(/Centang/);
    a.updateDraft(mkt, { reviewed: true });
    a.schedule(mkt);
    expect(a.draft.status).toBe("scheduled");
    a.updateDraft(mkt, { percentOff: 30 });
    expect(a.draft).toMatchObject({ status: "draft", reviewed: false });
    const promos = [...b.getPromotions("sambung"), a.draftPromotion()];
    expect(bestUnitPrice(b.getCatalog("sambung"), promos, "B03", "2026-10-21T12:00:00+07:00")).toMatchObject({ unit: 279300, code: "CHARGER15" });
    expect(() => a.updateDraft(ops, { percentOff: 10 })).toThrow(/tidak punya izin/);
  });
});
