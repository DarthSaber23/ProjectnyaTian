import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildCatalog } from "../domain/catalog";
import type { Order, Totals } from "../domain/types";
import { products } from "../data/fixtures";
import type { PrismaService } from "../prisma.service";
import { fakeDb } from "../test/fake-db";
import type { CatalogService } from "./catalog.service";
import { OrderService, noteLatePayment } from "./order.service";

const sambung = buildCatalog(products.filter((p) => p.brand === "sambung"));
const catalog = { snapshot: () => sambung, promotionsFor: () => [], refreshAfterWrite: async () => undefined } as unknown as CatalogService;

function order(status: Order["payment"]["status"], fulfilment: Order["fulfilment"]): Order {
  return {
    number: "ORD-261027-0001",
    customerId: "C-0001",
    createdAt: "2026-10-27T10:00:00+07:00",
    totals: { lines: [{ sku: "B07", qty: 1 }], total: 69000 } as unknown as Totals,
    addressId: "rumah",
    courier: {} as Order["courier"],
    payment: { method: "qris", status, expiresAt: "2026-10-27T10:15:00+07:00" },
    fulfilment,
    refunded: 0,
    history: [],
  };
}

describe("payment events", () => {
  it("commits stock once when the gateway sends the same paid event twice at the same moment", async () => {
    const db = fakeDb(order("pending", "awaiting_payment"), { B07: { onHand: 5, reserved: 1 } });
    const service = new OrderService(db.prisma as unknown as PrismaService, catalog);
    const results = await Promise.allSettled([service.applyPayment("ORD-261027-0001", "paid"), service.applyPayment("ORD-261027-0001", "paid")]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(db.state.stock.B07).toEqual({ onHand: 4, reserved: 0 });
    expect(db.state.outbox).toBe(1);
  });

  it("does not expire an order that a payment just settled", async () => {
    const db = fakeDb(order("pending", "awaiting_payment"), { B07: { onHand: 5, reserved: 1 } });
    const service = new OrderService(db.prisma as unknown as PrismaService, catalog);
    await Promise.allSettled([service.applyPayment("ORD-261027-0001", "paid"), service.applyPayment("ORD-261027-0001", "expired")]);
    expect(db.state.payload.payment.status).toBe("paid");
    expect(db.state.stock.B07).toEqual({ onHand: 4, reserved: 0 });
  });

  it("keeps a record of money that arrives after the order expired, and still refuses it", async () => {
    const db = fakeDb(order("expired", "cancelled"), { B07: { onHand: 5, reserved: 0 } });
    const service = new OrderService(db.prisma as unknown as PrismaService, catalog);
    await expect(service.applyPayment("ORD-261027-0001", "paid")).rejects.toBeInstanceOf(HttpException);
    expect(db.state.payload.history[0]?.status).toBe("Pembayaran masuk setelah kedaluwarsa · perlu refund manual");
    expect(db.state.audit.map((a) => a.code)).toEqual(["LATE_PAYMENT"]);
    expect(db.state.stock.B07).toEqual({ onHand: 5, reserved: 0 });
  });
});

describe("locked transactions", () => {
  it("give lock waits room before giving up", async () => {
    const db = fakeDb(order("pending", "awaiting_payment"), { B07: { onHand: 5, reserved: 1 } });
    const seen: unknown[] = [];
    const run = db.prisma.$transaction;
    const prisma = { ...db.prisma, $transaction: (fn: Parameters<typeof run>[0], options?: unknown) => { seen.push(options); return run(fn); } };
    await new OrderService(prisma as unknown as PrismaService, catalog).applyPayment("ORD-261027-0001", "paid");
    expect(seen).toEqual([{ maxWait: 10_000, timeout: 15_000 }]);
  });
});

describe("checkout idempotency", () => {
  const body = { brand: "sambung" as const, lines: [{ sku: "B07", qty: 1 }], courierId: "kurir-a", paymentMethod: "qris" as const };
  const unique = () => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5.22.0" });

  it("returns the first order when a double-click loses the race for the same key", async () => {
    const first = order("pending", "awaiting_payment");
    const prisma = {
      $transaction: async () => { throw unique(); },
      idempotencyRecord: { findUnique: async () => ({ key: "k", orderNumber: first.number }) },
      orderRecord: { findUnique: async () => ({ number: first.number, storeId: "sambung", customerId: "C-0001", payload: first }) },
    } as unknown as PrismaService;
    const result = await new OrderService(prisma, catalog).create("C-0001", "k", body);
    expect(result.number).toBe(first.number);
  });

  it("does not hide a unique failure that is not a repeated key", async () => {
    const prisma = {
      $transaction: async () => { throw unique(); },
      idempotencyRecord: { findUnique: async () => null },
    } as unknown as PrismaService;
    await expect(new OrderService(prisma, catalog).create("C-0001", "k", body)).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});

describe("noteLatePayment", () => {
  it("adds the note once however often the gateway retries", () => {
    const expired = order("expired", "cancelled");
    expect(noteLatePayment(expired, "2026-10-27T10:30:00+07:00")).toBe(true);
    expect(noteLatePayment(expired, "2026-10-27T10:31:00+07:00")).toBe(false);
    expect(expired.history).toHaveLength(1);
  });

  it("ignores any other refused transition", () => {
    expect(noteLatePayment(order("paid", "to_process"), "2026-10-27T10:30:00+07:00")).toBe(false);
  });
});
