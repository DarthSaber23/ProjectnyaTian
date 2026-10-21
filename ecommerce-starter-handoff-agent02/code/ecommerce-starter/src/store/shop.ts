/**
 * Client state (Zustand). Kept in memory only — no browser storage (P1), so a page
 * reload starts a fresh demo. Business rules live in src/domain, not here.
 */
import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { BRANDS, DEFAULT_BRAND } from "../config/brands";
import { maxAddable } from "../domain/stock";
import { voucherKind } from "../domain/pricing";
import { mergeCarts } from "../domain/cart";
import { canAddToCompare } from "../domain/compare";
import type { Session } from "../services/contracts";
import type { BrandId, CartLine, PaymentMethod } from "../domain/types";
import { backend } from "../services/mock/backend";
import { resetMocks } from "../services/mock";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
  action?: { label: string; to: string };
}

interface ShopState {
  brand: BrandId;
  cart: CartLine[];
  orderVoucher?: string;
  shippingVoucher?: string;
  voucherMessage?: { text: string; tone: "info" | "error" };
  addressId: string;
  courierId: string;
  paymentMethod: PaymentMethod;
  toast?: Toast;
  session: Session | null;
  compare: string[];
  compareMessage?: string;
  recentSearches: string[];

  signedIn(session: Session): { merged: number; capped: number };
  signOut(): void;
  toggleCompare(productId: string): void;
  clearCompare(): void;
  addRecentSearch(q: string): void;
  clearRecentSearches(): void;
  setBrand(b: BrandId): void;
  addToCart(sku: string, qty: number): { added: number };
  setQty(sku: string, qty: number): void;
  remove(sku: string): void;
  applyVoucher(code: string): void;
  removeVoucher(kind: "order" | "shipping"): void;
  setAddress(id: string): void;
  setCourier(id: string): void;
  setPaymentMethod(m: PaymentMethod): void;
  clearCheckout(): void;
  restoreCart(lines: CartLine[]): void;
  notify(text: string, tone?: Toast["tone"], action?: Toast["action"]): void;
  dismissToast(): void;
  resetAll(): void;
}

const initial = {
  cart: [] as CartLine[],
  orderVoucher: undefined,
  shippingVoucher: undefined,
  voucherMessage: undefined,
  addressId: "rumah",
  courierId: "kurir-a",
  paymentMethod: "qris" as PaymentMethod,
  toast: undefined,
  session: null as Session | null,
  compare: [] as string[],
  compareMessage: undefined,
  recentSearches: ["charger gan", "hdmi"],
};

let toastSeq = 0;

export const useShop = create<ShopState>((set, get) => ({
  brand: DEFAULT_BRAND,
  ...initial,

  setBrand: (brand) => set({ brand, ...initial, session: get().session }),

  /** D7: merge the guest cart into the account cart on sign-in. */
  signedIn: (session) => {
    const { brand, cart } = get();
    const saved = backend.savedCart(session.customerId, brand);
    const res = mergeCarts(backend.getCatalog(brand), saved, cart, BRANDS[brand].maxQtyPerLine);
    set({ session, cart: res.lines });
    return { merged: saved.length, capped: res.capped.length };
  },

  signOut: () => {
    const { session, brand, cart } = get();
    if (session) backend.saveCart(session.customerId, brand, cart);
    set({ session: null, cart: [], orderVoucher: undefined, shippingVoucher: undefined, voucherMessage: undefined, compare: [] });
  },

  toggleCompare: (productId) => {
    const { compare, brand } = get();
    if (compare.includes(productId)) { set({ compare: compare.filter((x) => x !== productId), compareMessage: undefined }); return; }
    const products = backend.getCatalog(brand).products;
    const current = compare.map((id) => products.find((p) => p.id === id)!).filter(Boolean);
    const cand = products.find((p) => p.id === productId);
    if (!cand) return;
    const check = canAddToCompare(current, cand);
    set(check.ok ? { compare: [...compare, productId], compareMessage: undefined } : { compareMessage: check.message });
  },
  clearCompare: () => set({ compare: [], compareMessage: undefined }),

  addRecentSearch: (q) => {
    const t = q.trim().toLowerCase();
    if (!t) return;
    set({ recentSearches: [t, ...get().recentSearches.filter((x) => x !== t)].slice(0, 5) });
  },
  clearRecentSearches: () => set({ recentSearches: [] }),

  addToCart: (sku, qty) => {
    const { brand, cart } = get();
    const room = maxAddable(backend.getCatalog(brand), sku, cart, BRANDS[brand].maxQtyPerLine);
    const added = Math.max(0, Math.min(qty, room));
    if (added === 0) return { added };
    const exists = cart.some((l) => l.sku === sku);
    set({ cart: exists ? cart.map((l) => (l.sku === sku ? { ...l, qty: l.qty + added } : l)) : [...cart, { sku, qty: added }] });
    return { added };
  },

  setQty: (sku, qty) => {
    const { brand, cart } = get();
    const others = cart.filter((l) => l.sku !== sku);
    const cap = maxAddable(backend.getCatalog(brand), sku, others, BRANDS[brand].maxQtyPerLine);
    const q = Math.max(1, Math.min(Math.floor(qty), cap));
    set({ cart: cart.map((l) => (l.sku === sku ? { ...l, qty: q } : l)) });
  },

  remove: (sku) => set({ cart: get().cart.filter((l) => l.sku !== sku) }),

  applyVoucher: (raw) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    const kind = voucherKind(backend.getPromotions(get().brand), code);
    if (!kind) {
      set({ voucherMessage: { text: `Kode ${code} tidak ditemukan atau sudah berakhir.`, tone: "error" } });
      return;
    }
    if (kind === "order") {
      const prev = get().orderVoucher;
      set({
        orderVoucher: code,
        voucherMessage: { text: prev && prev !== code ? `${code} menggantikan ${prev} (hanya 1 voucher pesanan).` : `${code} dipasang.`, tone: "info" },
      });
    } else {
      set({ shippingVoucher: code, voucherMessage: { text: `${code} dipasang.`, tone: "info" } });
    }
  },

  removeVoucher: (kind) =>
    set(kind === "order" ? { orderVoucher: undefined, voucherMessage: undefined } : { shippingVoucher: undefined, voucherMessage: undefined }),

  setAddress: (addressId) => set({ addressId }),
  setCourier: (courierId) => set({ courierId }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  clearCheckout: () => set({ cart: [], orderVoucher: undefined, shippingVoucher: undefined, voucherMessage: undefined }),
  restoreCart: (lines) => set({ cart: lines, orderVoucher: undefined, shippingVoucher: undefined, voucherMessage: undefined }),

  notify: (text, tone = "info", action) => set({ toast: { id: ++toastSeq, text, tone, action } }),
  dismissToast: () => set({ toast: undefined }),

  resetAll: () => {
    resetMocks();
    set({ ...initial });
  },
}));

/** Re-render when the mock backend changes (stock, orders). */
export function useBackendVersion(): number {
  return useSyncExternalStore(
    (cb) => backend.subscribe(cb),
    () => backend.version,
  );
}
