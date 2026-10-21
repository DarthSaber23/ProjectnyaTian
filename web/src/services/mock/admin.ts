/**
 * Mock admin service (M5 / P05 / P06 behaviour). Every mutation checks the permission matrix
 * and writes an append-only audit entry with actor, time, old → new (ALCOA+).
 * Production: enforce on the server and store the audit log in write-once storage (Agent 02).
 */
import { formatIDR } from "../../domain/money";
import { assertFulfilmentTransition, assertPaymentTransition } from "../../domain/orders";
import { can, maskEmail, maskPhone, REVEAL_SECONDS, ROLE_LABEL, type Permission } from "../../domain/rbac";
import { applyStock } from "../../domain/stock";
import { addMinutes } from "../../domain/time";
import type { Order, PricePromotion } from "../../domain/types";
import { customers, draftCharger15, seedAudit, staff, type AuditEntry, type Staff } from "../../mocks/fixtures";
import type { MockBackend } from "./backend";

export class PermissionError extends Error {}

/** P9: each admin action advances the simulated clock by 2 minutes from 10:20 WIB. */
const ADMIN_CLOCK_START = "2026-10-20T10:20:00+07:00";

export interface DraftPromo { percentOff: number; start: string; allowVoucher: boolean; status: "draft" | "scheduled"; reviewed: boolean }

export class MockAdmin {
  private audit: AuditEntry[] = [];
  private ticks = 0;
  private reveals = new Map<string, { until: string; reason: string }>(); // key: staffId:customerId
  draft!: DraftPromo;

  constructor(private readonly backend: MockBackend) {
    this.reset();
  }

  reset(): void {
    this.audit = [...seedAudit];
    this.ticks = 0;
    this.reveals.clear();
    this.draft = { percentOff: 15, start: "2026-10-21T00:00:00+07:00", allowVoucher: true, status: "draft", reviewed: false };
  }

  staffList(): Staff[] {
    return staff;
  }

  /** Time of the latest admin action (10:16 snapshot before any action). */
  clock(): string {
    return this.ticks === 0 ? "2026-10-20T10:16:00+07:00" : addMinutes(ADMIN_CLOCK_START, (this.ticks - 1) * 2);
  }

  private tick(): string {
    this.ticks++;
    return this.clock();
  }

  private require(user: Staff, p: Permission): void {
    if (!can(user.role, p)) throw new PermissionError(`Peran ${ROLE_LABEL[user.role]} tidak punya izin untuk aksi ini.`);
  }

  private actor(user: Staff): string {
    return `${user.name} (${ROLE_LABEL[user.role]})`;
  }

  private log(user: Staff, at: string, code: string, action: string, object: string): void {
    this.audit.unshift({ at, actor: this.actor(user), code, action, object });
    this.backend.touch();
  }

  auditLog(user: Staff): AuditEntry[] {
    this.require(user, "audit.view");
    return [...this.audit];
  }

  /** Session-visible slice for roles without audit.view: only their own actions. */
  myActions(user: Staff): AuditEntry[] {
    return this.audit.filter((a) => a.actor === this.actor(user));
  }

  orders(user: Staff): Order[] {
    this.require(user, "orders.view");
    return this.backend.allOrders();
  }

  private mutate(number: string, fn: (o: Order) => Order): Order {
    const o = this.backend.get(number);
    if (!o) throw new Error(`Pesanan ${number} tidak ditemukan`);
    const next = fn(structuredClone(o));
    this.backend.replaceOrder(next);
    return next;
  }

  process(user: Staff, number: string): Order {
    this.require(user, "orders.fulfil");
    const at = this.tick();
    return this.mutate(number, (o) => {
      assertFulfilmentTransition(o.fulfilment, "processing");
      o.fulfilment = "processing";
      o.history.unshift({ at, status: "Diproses", actor: this.actor(user) });
      this.log(user, at, "ORDER_STATUS", "Status Perlu diproses → Diproses", number);
      return o;
    });
  }

  /** Tracking number: 8–30 characters, A–Z 0–9 and hyphen (P11). */
  static validateTracking(raw: string): string | null {
    const r = raw.trim().toUpperCase();
    if (!r) return "Nomor resi wajib diisi.";
    if (!/^[A-Z0-9-]{8,30}$/.test(r)) return "Format resi tidak valid: 8–30 huruf/angka/tanda hubung.";
    return null;
  }

  ship(user: Staff, number: string, tracking: string): Order {
    this.require(user, "orders.fulfil");
    const err = MockAdmin.validateTracking(tracking);
    if (err) throw new Error(err);
    const r = tracking.trim().toUpperCase();
    const at = this.tick();
    return this.mutate(number, (o) => {
      assertFulfilmentTransition(o.fulfilment, "shipped");
      o.fulfilment = "shipped";
      o.trackingNumber = r;
      o.history.unshift({ at, status: `Dikirim · resi ${r}`, actor: this.actor(user) });
      this.log(user, at, "ORDER_SHIPPED", `Status Diproses → Dikirim · resi ${r}`, number);
      return o;
    });
  }

  refund(user: Staff, number: string, amount: number, reason: string, restock: boolean): Order {
    this.require(user, "orders.refund");
    const o0 = this.backend.get(number);
    if (!o0) throw new Error(`Pesanan ${number} tidak ditemukan`);
    if (!reason) throw new Error("Pilih alasan refund.");
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Isi jumlah refund lebih dari Rp0 (bilangan bulat Rupiah).");
    const remaining = o0.totals.total - o0.refunded;
    if (amount > remaining) throw new Error(`Jumlah melebihi sisa yang bisa direfund (${formatIDR(remaining)}).`);
    if (o0.fulfilment === "shipped" || o0.fulfilment === "in_transit" || o0.fulfilment === "delivered") {
      throw new Error("Refund setelah dikirim memerlukan alur retur (di luar prototipe, P10).");
    }
    const at = this.tick();
    return this.mutate(number, (o) => {
      const total = o.refunded + amount;
      const full = total >= o.totals.total;
      assertPaymentTransition(o.payment.status, full ? "refunded" : "partially_refunded");
      o.payment.status = full ? "refunded" : "partially_refunded";
      o.refunded = total;
      o.refunds = [...(o.refunds ?? []), { at, amount, reason, actor: this.actor(user) }];
      if (full) {
        assertFulfilmentTransition(o.fulfilment, "cancelled");
        o.fulfilment = "cancelled";
        if (restock) applyStock(this.backend.getCatalog(this.backend.brandOfOrder(number) ?? "sambung"), o.totals.lines.map((l) => ({ sku: l.sku, qty: l.qty })), "restock");
      }
      o.history.unshift({ at, status: `${full ? "Dibatalkan · refund penuh" : "Refund sebagian"} ${formatIDR(amount)}`, actor: this.actor(user) });
      this.log(user, at, "REFUND_RECORDED", `Refund ${full ? "penuh" : "sebagian"} ${formatIDR(amount)} · ${reason}${full && restock ? " · stok dikembalikan" : ""}`, number);
      return o;
    });
  }

  /** Contact shown to this user: full for Owner/Admin, masked otherwise unless an active reveal exists. */
  contact(user: Staff, customerId: string, at = this.clock()): { email: string; phone: string; address: string; name: string; revealedUntil?: string; full: boolean } {
    const c = customers.find((x) => x.id === customerId);
    if (!c) throw new Error("Pelanggan tidak ditemukan");
    if (can(user.role, "customers.contact.full")) return { ...c, full: true };
    const r = this.reveals.get(`${user.id}:${customerId}`);
    if (r && Date.parse(at) < Date.parse(r.until)) return { ...c, revealedUntil: r.until, full: true };
    return { name: c.name, email: maskEmail(c.email), phone: maskPhone(c.phone), address: c.address.replace(/^[^,]+,\s*/, "Jalan disamarkan, "), full: false };
  }

  reveal(user: Staff, customerId: string, reason: string, orderNumber: string): string {
    this.require(user, "customers.contact.reveal");
    if (!reason) throw new Error("Pilih alasan sebelum menampilkan kontak.");
    const at = this.tick();
    const until = addMinutes(at, REVEAL_SECONDS / 60);
    this.reveals.set(`${user.id}:${customerId}`, { until, reason });
    this.log(user, at, "CONTACT_REVEAL", `Kontak pelanggan dibuka · ${reason}`, `${customerId} (${orderNumber})`);
    return until;
  }

  remask(user: Staff, customerId: string): void {
    this.reveals.delete(`${user.id}:${customerId}`);
    this.backend.touch();
  }

  /* -------- promotions (P06 / P12) -------- */

  draftPromotion(): PricePromotion {
    return { ...draftCharger15, percentOff: this.draft.percentOff, window: { start: this.draft.start, end: draftCharger15.window.end } };
  }

  updateDraft(user: Staff, patch: Partial<Omit<DraftPromo, "status">>): void {
    this.require(user, "promotions.edit");
    const changesRule = patch.percentOff !== undefined || patch.start !== undefined || patch.allowVoucher !== undefined;
    this.draft = { ...this.draft, ...patch, ...(changesRule ? { reviewed: patch.reviewed ?? false, status: "draft" as const } : {}) };
    this.backend.touch();
  }

  schedule(user: Staff): void {
    this.require(user, "promotions.edit");
    if (!this.draft.reviewed) throw new Error("Centang konfirmasi peninjauan konflik sebelum menjadwalkan.");
    if (Date.parse(this.draft.start) < Date.parse(this.clock())) throw new Error("Tanggal mulai sudah lewat. Pilih tanggal setelah hari ini.");
    const at = this.tick();
    this.draft = { ...this.draft, status: "scheduled" };
    this.log(user, at, "PROMO_SCHEDULED", `CHARGER15 dijadwalkan · −${this.draft.percentOff}% · voucher pesanan ${this.draft.allowVoucher ? "boleh" : "tidak"}`, "CHARGER15");
  }
}
