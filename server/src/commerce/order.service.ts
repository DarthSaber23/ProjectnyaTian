import { HttpException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { assertPaymentTransition, orderNumber, paymentExpiry } from "../domain/orders";
import { computeTotals } from "../domain/pricing";
import { applyStock, physicalDemand, shortages } from "../domain/stock";
import { toWibIso, yymmdd } from "../domain/time";
import type { BrandId, CartLine, Order, PaymentMethod } from "../domain/types";
import { shippingQuotes } from "../data/fixtures";
import { PrismaService } from "../prisma.service";
import { CatalogService } from "./catalog.service";
import { maySend } from "./notify";

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
    const skus = [...physicalDemand(this.catalog.snapshot(brand), preview.lines.map((l) => ({ sku: l.sku, qty: l.qty }))).keys()];

    const order = await this.prisma.$transaction(async (tx) => {
      const prior = await tx.idempotencyRecord.findUnique({ where: { key } });
      if (prior) return this.readOrder(tx, prior.orderNumber);

      const catalog = structuredClone(this.catalog.snapshot(brand));
      for (const sku of skus) {
        const locked = await tx.$queryRaw<Array<{ onHand: number; reserved: number }>>`
          SELECT "onHand", reserved FROM "Variant" WHERE sku = ${sku} FOR UPDATE`;
        const hit = catalog.bySku.get(sku);
        if (hit && locked[0]) {
          hit.variant.onHand = locked[0].onHand;
          hit.variant.reserved = locked[0].reserved;
        }
      }
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
      const short = shortages(catalog, totals.lines.map((l) => ({ sku: l.sku, qty: l.qty })));
      if (short.length) {
        throw new HttpException({ code: "STOCK_SHORTAGE", message: "Stok tidak cukup.", details: short }, 409);
      }
      applyStock(catalog, totals.lines.map((l) => ({ sku: l.sku, qty: l.qty })), "reserve");
      for (const sku of skus) {
        const hit = catalog.bySku.get(sku);
        if (!hit) continue;
        await tx.variant.update({ where: { sku }, data: { onHand: hit.variant.onHand, reserved: hit.variant.reserved } });
      }
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
    });
    await this.catalog.reload();
    return order;
  }

  async applyPayment(number: string, outcome: "paid" | "failed" | "expired"): Promise<Order> {
    const row = await this.prisma.orderRecord.findUnique({ where: { number } });
    if (!row) throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
    const brand = row.storeId as BrandId;
    const existing = row.payload as unknown as Order;
    const skus = [...new Set(existing.totals.lines.map((line) => line.sku))];
    const updated = await this.prisma.$transaction(async (tx) => {
      const catalog = structuredClone(this.catalog.snapshot(brand));
      for (const sku of skus) {
        const locked = await tx.$queryRaw<Array<{ onHand: number; reserved: number }>>`
          SELECT "onHand", reserved FROM "Variant" WHERE sku = ${sku} FOR UPDATE`;
        const hit = catalog.bySku.get(sku);
        if (hit && locked[0]) {
          hit.variant.onHand = locked[0].onHand;
          hit.variant.reserved = locked[0].reserved;
        }
      }
      try {
        assertPaymentTransition(existing.payment.status, outcome);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transisi pembayaran tidak diizinkan.";
        throw new HttpException({ code: "CONFLICT", message }, 409);
      }
      const at = toWibIso(new Date());
      existing.payment.status = outcome;
      const lines = existing.totals.lines.map((line) => ({ sku: line.sku, qty: line.qty }));
      if (outcome === "paid") {
        existing.payment.paidAt = at;
        existing.payment.reference = `SIM-PAY-${number}`;
        existing.fulfilment = "to_process";
        applyStock(catalog, lines, "commit");
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
        applyStock(catalog, lines, "release");
        existing.history.unshift({ at, status: "Kedaluwarsa · stok dikembalikan", actor: "Sistem" });
      } else {
        existing.history.unshift({ at, status: "Pembayaran gagal", actor: "Event gateway (simulasi)" });
      }
      for (const sku of skus) {
        const hit = catalog.bySku.get(sku);
        if (!hit) continue;
        await tx.variant.update({ where: { sku }, data: { onHand: hit.variant.onHand, reserved: hit.variant.reserved } });
      }
      await tx.orderRecord.update({ where: { number }, data: { payload: existing as unknown as Prisma.InputJsonValue } });
      return existing;
    });
    await this.catalog.reload();
    return updated;
  }

  async getForCustomer(customerId: string, number: string): Promise<Order> {
    const row = await this.prisma.orderRecord.findUnique({ where: { number } });
    if (!row || row.customerId !== customerId) {
      throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
    }
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
