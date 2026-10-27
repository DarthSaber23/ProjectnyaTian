import { HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { assertFulfilmentTransition, assertPaymentTransition, orderNumber, paymentExpiry } from "../domain/orders";
import { computeTotals } from "../domain/pricing";
import { applyStock, shortages } from "../domain/stock";
import { toWibIso, yymmdd } from "../domain/time";
import type { BrandId, CartLine, Order, PaymentMethod } from "../domain/types";
import { shippingQuotes } from "../data/fixtures";
import { PrismaService } from "../prisma.service";
import { CatalogService } from "./catalog.service";
import { fulfilmentFor, kiriminAjaApiKey, type CourierEvent } from "./kiriminaja";
import { chargeResponse, midtransServerKey, notificationFor, verifyNotification, type MidtransNotification } from "./midtrans";
import { maySend } from "./notify";
import { LOCKED_TX, changeStock, lockOrder, lockStock, writeStock } from "./order-lock";

export const LATE_PAYMENT_NOTE = "Pembayaran masuk setelah kedaluwarsa · perlu refund manual";

/**
 * Money arriving for an order that already expired cannot revive it (its stock may be sold), so it is
 * refused but noted for a manual refund. Returns true when the note was added (once per order).
 */
export function noteLatePayment(order: Order, at: string): boolean {
  if (order.payment.status !== "expired") return false;
  if (order.history.some((entry) => entry.status === LATE_PAYMENT_NOTE)) return false;
  order.history.unshift({ at, status: LATE_PAYMENT_NOTE, actor: "Event gateway" });
  return true;
}

export interface CreateOrderBody {
  brand?: BrandId;
  lines?: CartLine[];
  addressId?: string;
  courierId?: string;
  paymentMethod?: PaymentMethod;
  orderVoucher?: string;
  shippingVoucher?: string;
  expectedTotal?: number;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  async create(customerId: string, idempotencyKey: string | undefined, body: CreateOrderBody): Promise<Order> {
    if (!idempotencyKey?.trim()) {
      throw new HttpException({ code: "VALIDATION", message: "Header Idempotency-Key wajib." }, 422);
    }
    const key = idempotencyKey.trim();
    const brand: BrandId = body.brand === "halimun" ? "halimun" : "sambung";
    const lines = body.lines ?? [];
    if (lines.length === 0) throw new HttpException({ code: "VALIDATION", message: "Keranjang kosong." }, 422);
    const method = body.paymentMethod;
    if (method !== "qris" && method !== "ewallet" && method !== "va") {
      throw new HttpException({ code: "VALIDATION", message: "Metode pembayaran tidak dikenal." }, 422);
    }
    const courier = shippingQuotes.find((q) => q.courierId === body.courierId);
    if (!courier || courier.cost === null) {
      throw new HttpException({ code: "COURIER_UNAVAILABLE", message: "Kurir tidak tersedia untuk alamat ini." }, 422);
    }
    const createdAt = toWibIso(new Date());
    const preview = computeTotals({
      catalog: this.catalog.snapshot(brand),
      promotions: this.catalog.promotionsFor(brand),
      now: createdAt,
      lines,
      orderVoucherCode: body.orderVoucher,
      shippingVoucherCode: body.shippingVoucher,
      shippingCost: courier.cost,
    });
    const order = await this.prisma.$transaction(async (tx) => {
      const prior = await tx.idempotencyRecord.findUnique({ where: { key } });
      if (prior) return this.readOrder(tx, prior.orderNumber);

      const catalog = await lockStock(tx, this.catalog.snapshot(brand), preview.lines.map((l) => ({ sku: l.sku, qty: l.qty })));
      const totals = computeTotals({
        catalog,
        promotions: this.catalog.promotionsFor(brand),
        now: createdAt,
        lines,
        orderVoucherCode: body.orderVoucher,
        shippingVoucherCode: body.shippingVoucher,
        shippingCost: courier.cost,
      });
      if (body.expectedTotal !== undefined && body.expectedTotal !== totals.total) {
        throw new HttpException({ code: "PRICE_CHANGED", message: "Harga berubah. Periksa lagi keranjang.", details: [totals] }, 409);
      }
      const stockLines = totals.lines.map((l) => ({ sku: l.sku, qty: l.qty }));
      const short = shortages(catalog, stockLines);
      if (short.length) {
        throw new HttpException({ code: "STOCK_SHORTAGE", message: "Stok tidak cukup.", details: short }, 409);
      }
      applyStock(catalog, stockLines, "reserve");
      await writeStock(tx, catalog, stockLines);
      const seqId = `${brand}:${yymmdd(createdAt)}`;
      await tx.$executeRaw`
        INSERT INTO "OrderSequence" ("id", "last") VALUES (${seqId}, 0)
        ON CONFLICT ("id") DO NOTHING`;
      const seqRows = await tx.$queryRaw<Array<{ last: number }>>`
        SELECT "last" FROM "OrderSequence" WHERE "id" = ${seqId} FOR UPDATE`;
      const next = (seqRows[0]?.last ?? 0) + 1;
      await tx.orderSequence.update({ where: { id: seqId }, data: { last: next } });
      const number = orderNumber(createdAt, next);
      const created: Order = {
        number,
        customerId,
        createdAt,
        totals,
        addressId: body.addressId ?? "utama",
        courier,
        payment: { method, status: "pending", expiresAt: paymentExpiry(createdAt, method) },
        fulfilment: "awaiting_payment",
        refunded: 0,
        history: [{ at: createdAt, status: "Pesanan dibuat", actor: "Pelanggan" }],
      };
      await tx.orderRecord.create({
        data: { number, storeId: brand, customerId, payload: created as unknown as Prisma.InputJsonValue },
      });
      await tx.idempotencyRecord.create({ data: { key, orderNumber: number } });
      return created;
    }, LOCKED_TX).catch(async (error: unknown) => {
      // A double-click with the same key that lost the race: hand back the order the first request placed.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const prior = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
      if (!prior) throw error;
      return this.getByNumber(prior.orderNumber);
    });
    await this.catalog.refreshAfterWrite();
    return order;
  }

  /**
   * The order row is locked and its status checked inside the transaction, so a duplicate or racing
   * gateway event sees the settled state and is refused (409) instead of settling stock twice.
   */
  async applyPayment(number: string, outcome: "paid" | "failed" | "expired", options: { refreshCatalog?: boolean } = {}): Promise<Order> {
    const result = await this.prisma.$transaction(async (tx) => {
      const { order: existing, brand } = await lockOrder(tx, number);
      const at = toWibIso(new Date());
      try {
        assertPaymentTransition(existing.payment.status, outcome);
      } catch (error) {
        // Returned, not thrown: the late-payment note must commit.
        if (outcome === "paid" && noteLatePayment(existing, at)) {
          await tx.orderRecord.update({ where: { number }, data: { payload: existing as unknown as Prisma.InputJsonValue } });
          await tx.auditRecord.create({ data: { at, actor: "Event gateway", code: "LATE_PAYMENT", action: LATE_PAYMENT_NOTE, object: number } });
        }
        return { order: existing, refused: error instanceof Error ? error.message : "Transisi pembayaran tidak diizinkan." };
      }
      existing.payment.status = outcome;
      const lines = existing.totals.lines.map((line) => ({ sku: line.sku, qty: line.qty }));
      const catalog = this.catalog.snapshot(brand);
      if (outcome === "paid") {
        existing.payment.paidAt = at;
        existing.payment.reference = `SIM-PAY-${number}`;
        existing.fulfilment = "to_process";
        await changeStock(tx, catalog, lines, "commit");
        existing.history.unshift({ at, status: "Dibayar", actor: "Event gateway (simulasi)" });
        if (maySend("email", "transactional", { emailPromo: false, waOrderInfo: false })) {
          await tx.notificationOutbox.create({
            data: {
              customerId: existing.customerId,
              channel: "email",
              purpose: "transactional",
              body: `Pesanan ${number} dibayar`.slice(0, 500),
              status: "queued",
              createdAt: at,
            },
          });
        }
      } else if (outcome === "expired") {
        existing.fulfilment = "cancelled";
        await changeStock(tx, catalog, lines, "release");
        existing.history.unshift({ at, status: "Kedaluwarsa · stok dikembalikan", actor: "Sistem" });
      } else {
        existing.history.unshift({ at, status: "Pembayaran gagal", actor: "Event gateway (simulasi)" });
      }
      await tx.orderRecord.update({ where: { number }, data: { payload: existing as unknown as Prisma.InputJsonValue } });
      return { order: existing, refused: undefined };
    }, LOCKED_TX);
    if (result.refused) throw new HttpException({ code: "CONFLICT", message: result.refused }, 409);
    if (options.refreshCatalog !== false) await this.catalog.refreshAfterWrite();
    return result.order;
  }

  async paymentCharge(customerId: string, number: string): Promise<Record<string, unknown>> {
    const order = await this.getForCustomer(customerId, number);
    if (order.payment.status === "paid" || order.payment.status === "expired") {
      throw new HttpException({ code: "CONFLICT", message: "Pembayaran tidak bisa dimulai lagi." }, 409);
    }
    return chargeResponse(order.number, order.totals.total, order.payment.method, order.payment.expiresAt);
  }

  async handleMidtrans(body: MidtransNotification): Promise<{ ok: true }> {
    const row = await this.prisma.orderRecord.findUnique({ where: { number: body.order_id } });
    if (!row) throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
    const order = row.payload as unknown as Order;
    let mapped: ReturnType<typeof verifyNotification>;
    try {
      mapped = verifyNotification(body, order.totals.total, midtransServerKey());
    } catch (error) {
      const message = error instanceof Error && error.message === "AMOUNT_MISMATCH" ? "Nominal tidak sesuai." : "Tanda tangan webhook tidak valid.";
      throw new HttpException({ code: "UNAUTHORIZED", message }, 401);
    }
    if (mapped === "paid" || mapped === "failed" || mapped === "expired") {
      try {
        await this.applyPayment(body.order_id, mapped);
      } catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() !== 409) throw error;
      }
    }
    return { ok: true };
  }

  async handleKiriminAja(authorization: string | undefined, body: { method?: CourierEvent; data?: { order_id?: string; awb?: string }[] }): Promise<{ ok: true }> {
    const token = authorization?.replace(/^Bearer\s+/i, "").trim();
    if (token !== kiriminAjaApiKey()) throw new HttpException({ code: "UNAUTHORIZED", message: "Webhook kurir ditolak." }, 401);
    const event = body.method;
    if (!event) throw new HttpException({ code: "VALIDATION", message: "method webhook wajib." }, 422);
    for (const item of body.data ?? []) {
      if (!item.order_id) continue;
      await this.applyCourier(item.order_id, event, item.awb);
    }
    return { ok: true };
  }

  private async applyCourier(number: string, event: CourierEvent, awb?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await lockOrder(tx, number).catch((error: unknown) => {
        if (error instanceof HttpException && error.getStatus() === 404) return undefined; // not our order: ignore
        throw error;
      });
      if (!locked) return;
      const order = locked.order;
      const next = fulfilmentFor(event, order.fulfilment);
      if (!next) return;
      try {
        assertFulfilmentTransition(order.fulfilment, next);
      } catch {
        return;
      }
      order.fulfilment = next;
      if (awb) order.trackingNumber = awb;
      order.history.unshift({ at: toWibIso(new Date()), status: next, actor: "KiriminAja" });
      await tx.orderRecord.update({ where: { number }, data: { payload: order as unknown as Prisma.InputJsonValue } });
    }, LOCKED_TX);
  }

  async getForCustomer(customerId: string, number: string): Promise<Order> {
    const row = await this.prisma.orderRecord.findUnique({ where: { number } });
    if (!row || row.customerId !== customerId) {
      throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
    }
    return row.payload as unknown as Order;
  }

  async getByNumber(number: string): Promise<Order> {
    const row = await this.prisma.orderRecord.findUnique({ where: { number } });
    if (!row) throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
    return row.payload as unknown as Order;
  }

  async listForCustomer(customerId: string): Promise<Order[]> {
    const rows = await this.prisma.orderRecord.findMany({ where: { customerId } });
    return rows.map((row) => row.payload as unknown as Order).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  private async readOrder(tx: Prisma.TransactionClient, number: string): Promise<Order> {
    const row = await tx.orderRecord.findUnique({ where: { number } });
    if (!row) throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
    return row.payload as unknown as Order;
  }
}
