/**
 * Service seams. The storefront and admin only talk to these interfaces.
 * M7 ships mock implementations (src/services/mock). Agent 02 replaces them with
 * HTTP clients for the NestJS backend, payment gateway (Midtrans/Duitku) and
 * shipping aggregator (Biteship/RajaOngkir/KiriminAja) without touching UI code.
 */
import type { Catalog } from "../domain/catalog";
import type { Address, BrandId, CartLine, Order, PaymentMethod, Promotion, ShippingQuote } from "../domain/types";

export interface CatalogService {
  getCatalog(brand: BrandId): Catalog;
  getPromotions(brand: BrandId): Promotion[];
}

export interface ShippingService {
  /** Quotes for a destination. Simulated quotes ignore the address (P4). */
  quote(brand: BrandId, address: Address, lines: CartLine[]): Promise<ShippingQuote[]>;
}

export interface CreateOrderInput {
  brand: BrandId;
  customerId: string;
  lines: CartLine[];
  addressId: string;
  courierId: string;
  paymentMethod: PaymentMethod;
  orderVoucherCode?: string;
  shippingVoucherCode?: string;
}

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "stock"; details: { sku: string; requested: number; available: number }[] }
  | { ok: false; reason: "courier" | "empty" | "price_changed"; message: string };

export interface OrderService {
  /** I4: re-checks stock and price, reserves stock, creates the order. */
  create(input: CreateOrderInput): Promise<CreateOrderResult>;
  get(number: string): Order | undefined;
  list(customerId: string): Order[];
}

/** Payment gateway events. In production these arrive by signed webhook, never from the browser. */
export interface PaymentGateway {
  simulate(number: string, outcome: "paid" | "failed" | "expired"): Promise<Order>;
}

export interface Clock {
  now(): string;
}

export interface Session {
  customerId: string;
  name: string;
  email: string;
  method: "password" | "google";
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "invalid"; remaining: number }
  | { ok: false; reason: "locked"; until: string };

export interface AuthService {
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Simulated Google OAuth: production uses the provider redirect + server-side token check. */
  signInWithGoogle(): Promise<SignInResult>;
}

export interface AccountService {
  savedCart(customerId: string, brand: BrandId): CartLine[];
  saveCart(customerId: string, brand: BrandId, lines: CartLine[]): void;
  wishlist(customerId: string, brand: BrandId): string[];
  toggleWishlist(customerId: string, brand: BrandId, productId: string): boolean;
  consents(customerId: string): Record<string, { granted: boolean; changedAt: string; source: string }>;
  updateConsents(customerId: string, changes: Record<string, boolean>): void;
}

/** Admin view of a product photo (server media.types.ts): the public shape plus order, source and licence fields. */
export type AdminImage = import("../domain/types").ProductImage & {
  position: number;
  source: "upload" | "sample";
  creator: string | null;
  licence: string | null;
  licenceUrl: string | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
  licenceCheck: string | null;
  createdAt: string;
  createdBy: string;
};

export interface AdminProduct {
  id: string;
  brand: import("../domain/types").BrandId;
  slug: string;
  name: string;
  art: import("../domain/types").Product["art"];
  variants: { sku: string; label: string; imageId: string | null }[];
  images: AdminImage[];
}

/* ---- Articles and SEO (item 2), mirroring server/src/content/content.types.ts ---- */

export type Lang = "id" | "en";
export type ArticleStatus = "draft" | "published" | "unpublished";

export interface ArticleTextInput {
  slug: string;
  title: string;
  seoTitle?: string | null;
  metaDescription: string;
  summary: string;
  body: string;
  noindex: boolean;
  canonicalUrl?: string | null;
}

export interface ArticleView {
  id: string;
  store: import("../domain/types").BrandId;
  status: ArticleStatus;
  publishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  version: number;
  authorId: string;
  authorName: string;
  cover: (import("../domain/types").ProductImage & { alt: string }) | null;
  tags: string[];
  sample: boolean;
  texts: Partial<Record<Lang, ArticleTextInput>>;
  productIds: string[];
  live: boolean;
}

export interface PublicArticleCard {
  id: string;
  lang: Lang;
  slug: string;
  title: string;
  summary: string;
  cover: import("../domain/types").ProductImage | null;
  /** Without a cover: the first linked product still for sale, so the card's frame shows its photo or drawing. */
  coverProduct: { name: string; art: import("../domain/types").Product["art"]; image: import("../domain/types").ProductImage | null } | null;
  readingMinutes: number;
  publishedAt: string;
}

export interface PublicArticle extends PublicArticleCard {
  seoTitle: string;
  metaDescription: string;
  html: string;
  plain: string;
  noindex: boolean;
  canonicalUrl: string | null;
  updatedAt: string;
  authorName: string;
  otherLang: { lang: Lang; slug: string } | null;
  products: import("../domain/types").Product[];
}

export type SeoKind = "product" | "category";
export interface SeoRow {
  key: string;
  name: string;
  /** The shop page, e.g. "/produk/kabel-usb-c". */
  path: string;
  auto: { title: string; description: string };
  override: { seoTitle: string | null; metaDescription: string | null } | null;
}

