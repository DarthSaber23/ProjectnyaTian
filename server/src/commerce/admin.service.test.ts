import { describe, expect, it } from "vitest";
import { buildCatalog } from "../domain/catalog";
import type { Order, Totals } from "../domain/types";
import { products } from "../data/fixtures";
import type { PrismaService } from "../prisma.service";
import { fakeDb } from "../test/fake-db";
import { AdminService } from "./admin.service";
import type { AuthService } from "./auth.service";
import type { CatalogService } from "./catalog.service";

const sambung = buildCatalog(products.filter((p) => p.brand === "sambung"));
const catalog = { snapshot: () => sambung, refreshAfterWrite: async () => undefined } as unknown as CatalogService;
const auth = { staff: async () => ({ id: "U-01", name: "Andi S.", role: "owner", email: "andi@toko.example" }) } as unknown as AuthService;

const paidOrder: Order = {
  number: "ORD-261027-0002",
  customerId: "C-0001",
  createdAt: "2026-10-27T10:00:00+07:00",
  totals: { lines: [{ sku: "B07", qty: 1 }], total: 69000 } as unknown as Totals,
  addressId: "rumah",
  courier: {} as Order["courier"],
  payment: { method: "qris", status: "paid", expiresAt: "2026-10-27T10:15:00+07:00" },
  fulfilment: "to_process",
  refunded: 0,
  history: [],
};

describe("refunds", () => {
  it("never refunds more than was paid when two staff refund at the same moment", async () => {
    const db = fakeDb(paidOrder, { B07: { onHand: 4, reserved: 0 } });
    const admin = new AdminService(db.prisma as unknown as PrismaService, auth, catalog);
    const refund = () => admin.refund("Bearer t", paidOrder.number, 69000, "Permintaan pelanggan", false);
    const results = await Promise.allSettled([refund(), refund()]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(db.state.payload.refunded).toBe(69000);
    expect(db.state.audit.map((a) => a.code)).toEqual(["REFUND_RECORDED"]);
  });

  it("puts a cancelled order's goods back on the shelf once, from the locked stock", async () => {
    const db = fakeDb(paidOrder, { B07: { onHand: 4, reserved: 2 } });
    const admin = new AdminService(db.prisma as unknown as PrismaService, auth, catalog);
    await admin.refund("Bearer t", paidOrder.number, 69000, "Permintaan pelanggan", true);
    expect(db.state.stock.B07).toEqual({ onHand: 5, reserved: 2 });
  });

  it("rolls the refund back when the restock fails, so money and stock never disagree", async () => {
    const db = fakeDb(paidOrder, {});
    const admin = new AdminService(db.prisma as unknown as PrismaService, auth, catalog);
    db.prisma.variant.update = async () => { throw new Error("stock row missing"); };
    await expect(admin.refund("Bearer t", paidOrder.number, 69000, "Permintaan pelanggan", true)).rejects.toThrow();
    expect(db.state.payload.refunded).toBe(0);
    expect(db.state.audit).toEqual([]);
  });
});
