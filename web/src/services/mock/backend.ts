/**
 * In-memory mock backend. Deterministic: same actions → same numbers as W00.
 * State lives in memory only (P1); "Atur ulang" calls reset().
 */
import { evaluateAttempt, type AttemptState } from "../../domain/auth";
import { buildCatalog, type Catalog } from "../../domain/catalog";
import { assertPaymentTransition, orderNumber, paymentExpiry } from "../../domain/orders";
import { addMinutes } from "../../domain/time";
import { computeTotals } from "../../domain/pricing";
import { applyStock, shortages } from "../../domain/stock";
import type { BrandId, CartLine, FulfilmentStatus, Order, PricedLine, Product } from "../../domain/types";
import {
  DEMO_LOGIN, DEMO_PAID_AT, NEXT_ORDER_SEQ, ORDER_CREATED_AT, demoCustomer, products, promotions, seedConsents, seedOrder0003,
  seedWishlist, shippingQuotes, seedOrders, type ConsentKey, type ConsentRecord,
} from "../../mocks/fixtures";
import type {
  AccountService, AuthService, CatalogService, Clock, CreateOrderInput, CreateOrderResult, OrderService, PaymentGateway, Session,
  ShippingService, SignInResult,
} from "../contracts";

type Listener = () => void;
const physical = (lines: PricedLine[]): CartLine[] => lines.map((l) => ({ sku: l.sku, qty: l.qty })); // gifts included: they leave the warehouse too

export class MockBackend implements CatalogService, ShippingService, OrderService, PaymentGateway, Clock, AuthService, AccountService {
  private catalogs!: Record<BrandId, Catalog>;
  private orders!: Map<string, Order>;
  private orderBrand!: Map<string, BrandId>;
  private seq!: Record<BrandId, number>;
  private attempts!: Map<string, AttemptState>;
  private carts!: Map<string, CartLine[]>;
  private wishlists!: Map<string, string[]>;
  private consentStore!: Record<ConsentKey, ConsentRecord>;
  private listeners = new Set<Listener>();
  /** Bumped on every mutation so React can re-render (see store/useBackendVersion). */
  version = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    const clone = (brand: BrandId) => buildCatalog(structuredClone(products.filter((p) => p.brand === brand)) as Product[]);
    this.catalogs = { sambung: clone("sambung"), halimun: clone("halimun") };
    this.orders = new Map();
    this.orderBrand = new Map();
    this.seq = { sambung: NEXT_ORDER_SEQ, halimun: 1 };
    this.attempts = new Map();
    this.carts = new Map();
    this.wishlists = new Map((["sambung", "halimun"] as const).map((b) => [`${demoCustomer.id}:${b}`, [...seedWishlist[b]]]));
    this.consentStore = structuredClone(seedConsents);
    this.seedHistory();
    this.emit();
  }

  private seedHistory(): void {
    const s = seedOrder0003;
    const courier = shippingQuotes.find((q) => q.courierId === s.courierId)!;
    const totals = computeTotals({ catalog: this.catalogs.sambung, promotions: [], now: s.createdAt, lines: s.lines, shippingCost: courier.cost });
    this.orders.set(s.number, {
      number: s.number, customerId: demoCustomer.id, createdAt: s.createdAt, totals, addressId: "rumah", courier,
      payment: { method: s.method, status: "paid", expiresAt: paymentExpiry(s.createdAt, s.method), paidAt: s.paidAt, reference: s.reference },
      fulfilment: "in_transit", trackingNumber: s.tracking, refunded: 0, history: s.history,
    });
    this.orderBrand.set(s.number, "sambung");
    // W00 orders 0001–0009 (stock in fixtures already reflects them, so no stock movement here).
    for (const so of seedOrders) {
      const totals = computeTotals({ catalog: this.catalogs.sambung, promotions: [], now: so.createdAt, lines: so.lines, shippingCost: courier.cost });
      const history: Order["history"] = [{ at: so.createdAt, status: "Pesanan dibuat", actor: "Pelanggan" }];
      if (so.paidAt) history.unshift({ at: so.paidAt, status: "Dibayar", actor: "Event gateway (simulasi)" });
      const fulfilment: FulfilmentStatus = { delivered: "delivered", in_transit: "in_transit", processing: "processing", to_process: "to_process", expired: "cancelled", refunded: "cancelled" }[so.outcome] as FulfilmentStatus;
      if (so.outcome === "processing") history.unshift({ at: "2026-10-18T09:10:00+07:00", status: "Diproses", actor: "Dewi O. (Operasional)" });
      if (so.outcome === "delivered") history.unshift({ at: addMinutes(so.createdAt, 2 * 24 * 60), status: `Diterima · resi ${so.tracking}`, actor: "Event kurir (simulasi)" });
      if (so.outcome === "expired") history.unshift({ at: paymentExpiry(so.createdAt, so.method), status: "Kedaluwarsa · stok dikembalikan", actor: "Sistem" });
      if (so.refund) history.unshift({ at: so.refund.at, status: `Dibatalkan · refund penuh Rp237.000`, actor: so.refund.actor });
      this.orders.set(so.number, {
        number: so.number, customerId: so.customerId, createdAt: so.createdAt, totals, addressId: "utama", courier,
        payment: { method: so.method, status: so.outcome === "expired" ? "expired" : so.outcome === "refunded" ? "refunded" : "paid", expiresAt: paymentExpiry(so.createdAt, so.method), paidAt: so.paidAt, reference: so.paidAt ? `SIM-PAY-${so.number.slice(4)}` : undefined },
        fulfilment, trackingNumber: so.tracking, refunded: so.refund?.amount ?? 0, refunds: so.refund ? [so.refund] : undefined, history,
      });
      this.orderBrand.set(so.number, "sambung");
    }
  }

  /** Lets companion mock services (admin) signal a change to subscribers. */
  touch(): void {
    this.emit();
  }

  /** All orders (admin). Newest first. */
  allOrders(): Order[] {
    return [...this.orders.values()].sort((a, b) => b.number.localeCompare(a.number));
  }

  /** Used by the mock admin service after a validated mutation. */
  replaceOrder(o: Order): void {
    this.orders.set(o.number, o);
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  now(): string {
    return ORDER_CREATED_AT;
  }

  /* ---------------- catalog & shipping ---------------- */

  getCatalog(brand: BrandId): Catalog {
    return this.catalogs[brand];
  }

  getPromotions(brand: BrandId) {
    return promotions[brand];
  }

  async quote() {
    return shippingQuotes;
  }

  /* ---------------- orders & payment ---------------- */

  async create(input: CreateOrderInput): Promise<CreateOrderResult> {
    const catalog = this.catalogs[input.brand];
    if (input.lines.length === 0) return { ok: false, reason: "empty", message: "Keranjang kosong." };
    const courier = shippingQuotes.find((q) => q.courierId === input.courierId);
    if (!courier || courier.cost === null) return { ok: false, reason: "courier", message: "Kurir tidak tersedia untuk alamat ini." };
    const createdAt = this.now();
    const totals = computeTotals({
      catalog, promotions: promotions[input.brand], now: createdAt, lines: input.lines,
      orderVoucherCode: input.orderVoucherCode, shippingVoucherCode: input.shippingVoucherCode, shippingCost: courier.cost,
    });
    const short = shortages(catalog, physical(totals.lines));
    if (short.length) return { ok: false, reason: "stock", details: short };
    const number = orderNumber(createdAt, this.seq[input.brand]++);
    applyStock(catalog, physical(totals.lines), "reserve");
    const order: Order = {
      number, customerId: input.customerId, createdAt, totals, addressId: input.addressId, courier,
      payment: { method: input.paymentMethod, status: "pending", expiresAt: paymentExpiry(createdAt, input.paymentMethod) },
      fulfilment: "awaiting_payment", refunded: 0,
      history: [{ at: createdAt, status: "Pesanan dibuat", actor: "Pelanggan" }],
    };
    this.orders.set(number, order);
    this.orderBrand.set(number, input.brand);
    this.emit();
    return { ok: true, order };
  }

  get(number: string): Order | undefined {
    return this.orders.get(number);
  }

  list(customerId: string, brand?: BrandId): Order[] {
    return [...this.orders.values()]
      .filter((o) => o.customerId === customerId && (!brand || this.orderBrand.get(o.number) === brand))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.number.localeCompare(a.number)));
  }

  brandOfOrder(number: string): BrandId | undefined {
    return this.orderBrand.get(number);
  }

  async simulate(number: string, outcome: "paid" | "failed" | "expired"): Promise<Order> {
    const order = this.orders.get(number);
    if (!order) throw new Error(`Unknown order ${number}`);
    assertPaymentTransition(order.payment.status, outcome);
    const catalog = this.catalogs[this.orderBrand.get(number) ?? "sambung"];
    const next: Order = { ...order, payment: { ...order.payment, status: outcome }, history: [...order.history] };
    if (outcome === "paid") {
      next.payment.paidAt = DEMO_PAID_AT;
      next.payment.reference = `SIM-PAY-${number.slice(4)}`;
      next.fulfilment = "to_process";
      applyStock(catalog, physical(order.totals.lines), "commit");
      next.history.unshift({ at: DEMO_PAID_AT, status: "Dibayar", actor: "Event gateway (simulasi)" });
    } else if (outcome === "expired") {
      next.fulfilment = "cancelled";
      applyStock(catalog, physical(order.totals.lines), "release");
      next.history.unshift({ at: order.payment.expiresAt, status: "Kedaluwarsa · stok dikembalikan", actor: "Sistem" });
    } else {
      next.history.unshift({ at: this.now(), status: "Pembayaran gagal", actor: "Event gateway (simulasi)" });
    }
    this.orders.set(number, next);
    this.emit();
    return next;
  }

  /* ---------------- auth ---------------- */

  private session(method: Session["method"]): Session {
    return { customerId: demoCustomer.id, name: demoCustomer.name, email: demoCustomer.email, method };
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const key = email.trim().toLowerCase();
    const valid = key === DEMO_LOGIN.email && password === DEMO_LOGIN.password;
    const outcome = evaluateAttempt(this.attempts.get(key) ?? { failures: 0 }, valid, this.now());
    this.attempts.set(key, outcome.state);
    this.emit();
    if (outcome.ok) return { ok: true, session: this.session("password") };
    return outcome.reason === "locked" ? { ok: false, reason: "locked", until: outcome.until } : { ok: false, reason: "invalid", remaining: outcome.remaining };
  }

  async signInWithGoogle(): Promise<SignInResult> {
    return { ok: true, session: this.session("google") };
  }

  /* ---------------- account ---------------- */

  savedCart(customerId: string, brand: BrandId): CartLine[] {
    return this.carts.get(`${customerId}:${brand}`) ?? [];
  }

  saveCart(customerId: string, brand: BrandId, lines: CartLine[]): void {
    this.carts.set(`${customerId}:${brand}`, lines.map((l) => ({ ...l })));
  }

  wishlist(customerId: string, brand: BrandId): string[] {
    return this.wishlists.get(`${customerId}:${brand}`) ?? [];
  }

  toggleWishlist(customerId: string, brand: BrandId, productId: string): boolean {
    const key = `${customerId}:${brand}`;
    const cur = this.wishlists.get(key) ?? [];
    const has = cur.includes(productId);
    this.wishlists.set(key, has ? cur.filter((x) => x !== productId) : [...cur, productId]);
    this.emit();
    return !has;
  }

  consents(): Record<ConsentKey, ConsentRecord> {
    return this.consentStore;
  }

  /** Every change is stored with its time and source (consent evidence, UU PDP / GDPR). */
  updateConsents(_customerId: string, changes: Partial<Record<ConsentKey, boolean>>): void {
    const next = { ...this.consentStore };
    for (const [k, v] of Object.entries(changes) as [ConsentKey, boolean][]) {
      if (next[k].granted !== v) next[k] = { granted: v, changedAt: "2026-10-20T10:16:00+07:00", source: "Pelanggan · halaman preferensi" };
    }
    this.consentStore = next;
    this.emit();
  }

  customer() {
    return demoCustomer;
  }
}

export const backend = new MockBackend();
