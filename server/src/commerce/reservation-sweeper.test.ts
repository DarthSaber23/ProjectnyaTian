import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { Order, PaymentStatus } from "../domain/types";
import type { PrismaService } from "../prisma.service";
import type { CatalogService } from "./catalog.service";
import type { OrderService } from "./order.service";
import { ReservationSweeper, dueForExpiry } from "./reservation-sweeper";

const window = "2026-10-27T10:00:00+07:00";
const withPayment = (status: PaymentStatus, expiresAt = window) => ({ payment: { method: "qris", status, expiresAt } }) as Order;

describe("dueForExpiry", () => {
  it("waits out the five-minute grace after the payment window", () => {
    expect(dueForExpiry(withPayment("pending"), "2026-10-27T10:04:59+07:00")).toBe(false);
    expect(dueForExpiry(withPayment("pending"), "2026-10-27T10:05:00+07:00")).toBe(true);
  });

  it("expires a failed payment once its window has passed", () => {
    expect(dueForExpiry(withPayment("failed"), "2026-10-27T11:00:00+07:00")).toBe(true);
  });

  it("never touches paid, expired or refunded orders", () => {
    for (const status of ["paid", "expired", "refunded", "partially_refunded"] as const) {
      expect(dueForExpiry(withPayment(status), "2026-10-28T00:00:00+07:00")).toBe(false);
    }
  });
});

describe("ReservationSweeper", () => {
  const now = "2026-10-27T12:00:00+07:00";

  it("expires only due orders and keeps going past one another process already expired", async () => {
    const rows = [
      { number: "A", payload: withPayment("pending") },
      { number: "B", payload: withPayment("pending", "2026-10-27T11:58:00+07:00") },
      { number: "C", payload: withPayment("failed") },
    ];
    const applied: unknown[][] = [];
    let refreshes = 0;
    const prisma = { orderRecord: { findMany: async () => rows } } as unknown as PrismaService;
    const orders = {
      applyPayment: async (...args: unknown[]) => {
        applied.push(args);
        if (args[0] === "A") throw new HttpException({ code: "CONFLICT" }, 409);
        return {} as Order;
      },
    } as unknown as OrderService;
    const catalog = { refreshAfterWrite: async () => { refreshes += 1; } } as unknown as CatalogService;
    expect(await new ReservationSweeper(prisma, orders, catalog).sweep(now)).toEqual(["C"]);
    expect(applied).toEqual([["A", "expired", { refreshCatalog: false }], ["C", "expired", { refreshCatalog: false }]]);
    expect(refreshes).toBe(1);
  });

  it("skips a run while the previous one is still going", async () => {
    let release!: () => void;
    let queries = 0;
    const prisma = {
      orderRecord: { findMany: () => { queries += 1; return new Promise((resolve) => { release = () => resolve([]); }); } },
    } as unknown as PrismaService;
    const sweeper = new ReservationSweeper(prisma, {} as OrderService, {} as CatalogService);
    const first = sweeper.sweep(now);
    expect(await sweeper.sweep(now)).toEqual([]);
    release();
    await first;
    expect(queries).toBe(1);
  });
});
