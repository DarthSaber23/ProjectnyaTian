import { HttpException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { computeMetrics } from "../domain/analytics";
import { formatIDR } from "../domain/money";
import { assertFulfilmentTransition, assertPaymentTransition } from "../domain/orders";
import { can, REVEAL_REASONS, REVEAL_SECONDS, ROLE_LABEL } from "../domain/rbac";
import { applyStock } from "../domain/stock";
import { addMinutes, toWibIso } from "../domain/time";
import type { Order, StaffRole } from "../domain/types";
import { customers } from "../data/fixtures";
import { visibleContact } from "./privacy";
import { PrismaService } from "../prisma.service";
import { AuthService } from "./auth.service";
import { CatalogService } from "./catalog.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly catalog: CatalogService,
  ) {}

  async metrics(authorization: string | undefined, from: string, to: string, sessions: number) {
    const user = await this.auth.staff(authorization);
    this.require(user.role, "dashboard.view");
    const orders = await this.allOrders();
    return { ...computeMetrics(orders, from, to, sessions), sessionsLabel: "fixture-or-query" };
  }

  async process(authorization: string | undefined, number: string): Promise<Order> {
    const user = await this.auth.staff(authorization);
    this.require(user.role, "orders.fulfil");
    return this.mutate(user, number, "ORDER_STATUS", (order, at) => {
      assertFulfilmentTransition(order.fulfilment, "processing");
      order.fulfilment = "processing";
      order.history.unshift({ at, status: "Diproses", actor: this.actor(user) });
      return "Status Perlu diproses → Diproses";
    });
  }

  async ship(authorization: string | undefined, number: string, tracking: string): Promise<Order> {
    const user = await this.auth.staff(authorization);
    this.require(user.role, "orders.fulfil");
    const resi = tracking.trim().toUpperCase();
    if (!/^[A-Z0-9-]{8,30}$/.test(resi)) {
      throw new HttpException({ code: "VALIDATION", message: "Format resi tidak valid: 8–30 huruf/angka/tanda hubung." }, 422);
    }
    return this.mutate(user, number, "ORDER_SHIPPED", (order, at) => {
      assertFulfilmentTransition(order.fulfilment, "shipped");
      order.fulfilment = "shipped";
      order.trackingNumber = resi;
      order.history.unshift({ at, status: `Dikirim · resi ${resi}`, actor: this.actor(user) });
      return `Status Diproses → Dikirim · resi ${resi}`;
    });
  }

  async refund(authorization: string | undefined, number: string, amount: number, reason: string, restock: boolean): Promise<Order> {
    const user = await this.auth.staff(authorization);
    this.require(user.role, "orders.refund");
    if (!reason) throw new HttpException({ code: "VALIDATION", message: "Pilih alasan refund." }, 422);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpException({ code: "VALIDATION", message: "Isi jumlah refund lebih dari Rp0 (bilangan bulat Rupiah)." }, 422);
    }
    const current = await this.read(number);
    const remaining = current.totals.total - current.refunded;
    if (amount > remaining) {
      throw new HttpException({ code: "VALIDATION", message: `Jumlah melebihi sisa yang bisa direfund (${formatIDR(remaining)}).` }, 422);
    }
    if (current.fulfilment === "shipped" || current.fulfilment === "in_transit" || current.fulfilment === "delivered") {
      throw new HttpException({ code: "VALIDATION", message: "Refund setelah dikirim memerlukan alur retur (di luar cakupan, P10)." }, 422);
    }
    const order = await this.mutate(user, number, "REFUND_RECORDED", (current, at) => {
      const total = current.refunded + amount;
      const full = total >= current.totals.total;
      assertPaymentTransition(current.payment.status, full ? "refunded" : "partially_refunded");
      current.payment.status = full ? "refunded" : "partially_refunded";
      current.refunded = total;
      current.refunds = [...(current.refunds ?? []), { at, amount, reason, actor: this.actor(user) }];
      if (full) {
        assertFulfilmentTransition(current.fulfilment, "cancelled");
        current.fulfilment = "cancelled";
      }
      current.history.unshift({ at, status: `${full ? "Dibatalkan · refund penuh" : "Refund sebagian"} ${formatIDR(amount)}`, actor: this.actor(user) });
      return `Refund ${full ? "penuh" : "sebagian"} ${formatIDR(amount)} · ${reason}`;
    });
    if (restock && order.fulfilment === "cancelled") await this.restock(order);
    return order;
  }

  async reveal(authorization: string | undefined, customerId: string, reason: string, orderNumber: string) {
    const user = await this.auth.staff(authorization);
    this.require(user.role, "customers.contact.reveal");
    if (!(REVEAL_REASONS as readonly string[]).includes(reason)) {
      throw new HttpException({ code: "VALIDATION", message: "Pilih alasan sebelum menampilkan kontak." }, 422);
    }
    if (!orderNumber.trim()) throw new HttpException({ code: "VALIDATION", message: "Nomor pesanan wajib diisi." }, 422);
    const order = await this.read(orderNumber);
    if (order.customerId !== customerId) {
      throw new HttpException({ code: "VALIDATION", message: "Pesanan tidak milik pelanggan ini." }, 422);
    }
    const at = toWibIso(new Date());
    const until = addMinutes(at, REVEAL_SECONDS / 60);
    await this.prisma.$transaction([
      this.prisma.revealGrant.create({ data: { staffId: user.id, customerId, orderNumber, until, reason, at } }),
      this.prisma.auditRecord.create({
        data: {
          at,
          actor: this.actor(user),
          code: "CONTACT_REVEAL",
          action: `Kontak pelanggan dibuka · ${reason}`,
          object: `${customerId} (${orderNumber})`,
          after: { until, reason, orderNumber } as Prisma.InputJsonValue,
        },
      }),
    ]);
    return { until };
  }

  async contact(authorization: string | undefined, customerId: string) {
    const user = await this.auth.staff(authorization);
    const customer = customers.find((row) => row.id === customerId);
    if (!customer) throw new HttpException({ code: "NOT_FOUND", message: "Pelanggan tidak ditemukan." }, 404);
    if (!can(user.role, "customers.contact.full") && !can(user.role, "customers.contact.reveal")) {
      throw new HttpException({ code: "FORBIDDEN", message: `Peran ${ROLE_LABEL[user.role]} tidak punya izin untuk aksi ini.` }, 403);
    }
    const grant = can(user.role, "customers.contact.reveal")
      ? await this.prisma.revealGrant.findFirst({ where: { staffId: user.id, customerId }, orderBy: { until: "desc" } })
      : null;
    return visibleContact(user.role, customer, grant?.until, toWibIso(new Date()));
  }

  async auditLog(authorization: string | undefined) {
    const user = await this.auth.staff(authorization);
    this.require(user.role, "audit.view");
    return this.prisma.auditRecord.findMany({ orderBy: { at: "desc" }, take: 100 });
  }

  private require(role: StaffRole, permission: Parameters<typeof can>[1]): void {
    if (!can(role, permission)) {
      throw new HttpException({ code: "FORBIDDEN", message: `Peran ${ROLE_LABEL[role]} tidak punya izin untuk aksi ini.` }, 403);
    }
  }

  private actor(user: { name: string; role: StaffRole }): string {
    return `${user.name} (${ROLE_LABEL[user.role]})`;
  }

  private async read(number: string): Promise<Order> {
    const row = await this.prisma.orderRecord.findUnique({ where: { number } });
    if (!row) throw new HttpException({ code: "NOT_FOUND", message: "Pesanan tidak ditemukan." }, 404);
    return row.payload as unknown as Order;
  }

  private async allOrders(): Promise<Order[]> {
    const rows = await this.prisma.orderRecord.findMany();
    return rows.map((row) => row.payload as unknown as Order);
  }

  private async restock(order: Order): Promise<void> {
    const catalog = structuredClone(this.catalog.snapshot("sambung"));
    const lines = order.totals.lines.map((line) => ({ sku: line.sku, qty: line.qty }));
    applyStock(catalog, lines, "restock");
    for (const line of lines) {
      const hit = catalog.bySku.get(line.sku);
      if (!hit) continue;
      await this.prisma.variant.update({ where: { sku: line.sku }, data: { onHand: hit.variant.onHand, reserved: hit.variant.reserved } });
    }
    await this.catalog.reload();
  }

  private async mutate(
    user: { id: string; name: string; role: StaffRole },
    number: string,
    code: string,
    change: (order: Order, at: string) => string,
  ): Promise<Order> {
    const at = toWibIso(new Date());
    const current = await this.read(number);
    const before = current.fulfilment;
    let action = "";
    try {
      action = change(current, at);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transisi tidak diizinkan.";
      throw new HttpException({ code: "CONFLICT", message }, 409);
    }
    await this.prisma.orderRecord.update({
      where: { number },
      data: { payload: current as unknown as Prisma.InputJsonValue },
    });
    await this.prisma.auditRecord.create({
      data: { at, actor: this.actor(user), code, action, object: number, before: { fulfilment: before }, after: { fulfilment: current.fulfilment } },
    });
    return current;
  }
}
