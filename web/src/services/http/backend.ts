import { buildCatalog, type Catalog } from "../../domain/catalog";
import { toWibIso } from "../../domain/time";
import type { BrandId, CartLine, Order, PaymentMethod, Promotion } from "../../domain/types";
import type { CreateOrderResult, Session, SignInResult } from "../contracts";
import { ApiError, api, setCustomerToken } from "./client";

type Listener = () => void;

class HttpBackend {
  version = 0;
  loading = true;
  private listeners = new Set<Listener>();
  private catalogs: Partial<Record<BrandId, Catalog>> = {};
  private promotions: Partial<Record<BrandId, Promotion[]>> = {};
  private orders: Order[] = [];
  private wishIds = new Map<string, string[]>();
  private carts = new Map<string, CartLine[]>();
  private consentCache: { emailPromo: { granted: boolean; changedAt: string; source: string }; waOrderInfo: { granted: boolean; changedAt: string; source: string }; personalised: { granted: boolean; changedAt: string; source: string } } = {
    emailPromo: { granted: false, changedAt: "", source: "" },
    waOrderInfo: { granted: false, changedAt: "", source: "" },
    personalised: { granted: false, changedAt: "", source: "" },
  };
  metrics: { netRevenue: number; paidOrders: number; aov: number; conversionPct: number } | null = null;

  private bump(): void {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  now(): string {
    return toWibIso(new Date());
  }

  async ready(): Promise<void> {
    try {
      for (const brand of ["sambung", "halimun"] as const) {
        const catalog = await api<{ products: Parameters<typeof buildCatalog>[0] }>(`/v1/catalog?brand=${brand}`);
        this.catalogs[brand] = buildCatalog(catalog.products);
        this.promotions[brand] = await api<Promotion[]>(`/v1/promotions/active?brand=${brand}`);
      }
    } finally {
      this.loading = false;
      this.bump();
    }
  }

  getCatalog(brand: BrandId): Catalog {
    return this.catalogs[brand] ?? buildCatalog([]);
  }

  getPromotions(brand: BrandId): Promotion[] {
    return this.promotions[brand] ?? [];
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const result = await api<{ token: string; customerId: string; name: string; email: string }>("/v1/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setCustomerToken(result.token);
      await this.loadCustomer(result.customerId);
      return { ok: true, session: { customerId: result.customerId, name: result.name, email: result.email, method: "password" } };
    } catch (error) {
      if (error instanceof ApiError && error.code === "LOCKED") {
        const until = (error.details[0] as { until?: string } | undefined)?.until ?? this.now();
        return { ok: false, reason: "locked", until };
      }
      const remaining = (error instanceof ApiError ? (error.details[0] as { remaining?: number } | undefined)?.remaining : undefined) ?? 0;
      return { ok: false, reason: "invalid", remaining };
    }
  }

  async signInWithGoogle(): Promise<SignInResult> {
    await api("/v1/auth/google/start");
    return { ok: false, reason: "invalid", remaining: 0 };
  }

  private async loadCustomer(customerId: string): Promise<void> {
    this.orders = await api<Order[]>("/v1/me/orders");
    const wish = await api<{ productId: string }[]>("/v1/me/wishlist");
    this.wishIds.set(`${customerId}:sambung`, wish.map((item) => item.productId));
    const cart = await api<{ lines: CartLine[] }>("/v1/me/cart?brand=sambung");
    this.carts.set(`${customerId}:sambung`, cart.lines);
    this.consentCache = { ...this.consentCache, ...(await api<Partial<typeof this.consentCache>>("/v1/me/consents")) };
    this.bump();
  }

  savedCart(customerId: string, brand: BrandId): CartLine[] {
    return this.carts.get(`${customerId}:${brand}`) ?? [];
  }

  saveCart(customerId: string, brand: BrandId, lines: CartLine[]): void {
    this.carts.set(`${customerId}:${brand}`, lines);
    void api("/v1/me/cart", { method: "PUT", body: JSON.stringify({ brand, lines }) });
  }

  async mergeRemote(brand: BrandId, account: CartLine[], guest: CartLine[]): Promise<{ lines: CartLine[]; capped: { sku: string }[] }> {
    return api("/v1/me/cart/merge", { method: "POST", body: JSON.stringify({ brand, account, guest }) });
  }

  wishlist(customerId: string, brand: BrandId): string[] {
    return this.wishIds.get(`${customerId}:${brand}`) ?? [];
  }

  toggleWishlist(customerId: string, brand: BrandId, productId: string): boolean {
    const key = `${customerId}:${brand}`;
    const current = this.wishIds.get(key) ?? [];
    const has = current.includes(productId);
    this.wishIds.set(key, has ? current.filter((id) => id !== productId) : [...current, productId]);
    void (has
      ? api(`/v1/me/wishlist/${productId}`, { method: "DELETE" })
      : api(`/v1/me/wishlist/${productId}`, { method: "PUT" }));
    this.bump();
    return !has;
  }

  consents() {
    return this.consentCache;
  }

  updateConsents(_customerId: string, changes: Record<string, boolean>): void {
    void api("/v1/me/consents", { method: "PATCH", body: JSON.stringify(changes) }).then((next) => {
      this.consentCache = next as typeof this.consentCache;
      this.bump();
    });
  }

  list(customerId: string, _brand?: BrandId): Order[] {
    return this.orders.filter((order) => order.customerId === customerId);
  }

  get(number: string): Order | undefined {
    return this.orders.find((order) => order.number === number);
  }

  allOrders(): Order[] {
    return this.orders;
  }

  async refreshOrder(number: string): Promise<void> {
    const order = await api<Order>(`/v1/me/orders/${encodeURIComponent(number)}`);
    this.orders = [order, ...this.orders.filter((item) => item.number !== order.number)];
    this.bump();
  }

  async create(input: {
    brand: BrandId;
    customerId?: string;
    lines: CartLine[];
    addressId: string;
    courierId: string;
    paymentMethod: PaymentMethod;
    orderVoucherCode?: string;
    shippingVoucherCode?: string;
  }): Promise<CreateOrderResult> {
    try {
      const order = await api<Order>("/v1/orders", {
        method: "POST",
        idempotencyKey: `web-${Date.now()}`,
        body: JSON.stringify({
          brand: input.brand,
          lines: input.lines,
          addressId: input.addressId,
          courierId: input.courierId,
          paymentMethod: input.paymentMethod,
          orderVoucher: input.orderVoucherCode,
          shippingVoucher: input.shippingVoucherCode,
        }),
      });
      this.orders = [order, ...this.orders.filter((item) => item.number !== order.number)];
      this.bump();
      return { ok: true, order };
    } catch (error) {
      if (error instanceof ApiError && error.code === "STOCK_SHORTAGE") {
        return { ok: false, reason: "stock", details: error.details as { sku: string; requested: number; available: number }[] };
      }
      if (error instanceof ApiError && error.code === "COURIER_UNAVAILABLE") return { ok: false, reason: "courier", message: error.message };
      if (error instanceof ApiError && error.code === "PRICE_CHANGED") return { ok: false, reason: "price_changed", message: error.message };
      if (error instanceof ApiError) return { ok: false, reason: "empty", message: error.message };
      throw error;
    }
  }

  async simulate(number: string, outcome: "paid" | "failed" | "expired"): Promise<Order> {
    const order = await api<Order>(`/v1/orders/${number}/payment-events`, {
      method: "POST",
      headers: { "x-simulator-token": import.meta.env.VITE_PAYMENT_SIMULATOR_TOKEN ?? "" },
      body: JSON.stringify({ outcome }),
    });
    this.orders = this.orders.map((item) => (item.number === order.number ? order : item));
    this.bump();
    return order;
  }

  async loadStaff(): Promise<void> {
    this.orders = await api<Order[]>("/v1/admin/orders", { auth: "staff" });
    this.metrics = await api("/v1/admin/metrics?from=2026-10-14&to=2026-10-20&sessions=1240", { auth: "staff" });
    this.bump();
  }

  reset(): void {
    this.bump();
  }
}

export const backend = new HttpBackend();
export type { Session };
