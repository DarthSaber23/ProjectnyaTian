/**
 * Domain types shared by storefront, admin and mock services.
 * Money is always an integer number of Rupiah (D4). Prices include PPN (D5).
 * Times are ISO 8601 strings with an explicit +07:00 offset (Asia/Jakarta).
 */

export type Rupiah = number;
export type BrandId = "halimun" | "sambung";
export type StaffRole = "owner" | "admin" | "operations" | "marketing" | "cs" | "seo";

export interface Variant {
  sku: string;
  label: string; // e.g. "2 m · Hitam"; empty for single-variant products
  price: Rupiah; // regular selling price (before product promotions)
  compareAt?: Rupiah; // strikethrough "was" price, display only
  onHand: number;
  reserved: number;
  /** Optional attributes used by filters/compare, e.g. { lengthM: 2, colour: "Hitam" }. */
  attrs?: Record<string, string | number>;
  /** Linked product photo (ProductImage.id); absent when the variant has none. */
  imageId?: string;
}

export interface Product {
  id: string;
  brand: BrandId;
  slug: string;
  name: string;
  categoryId: string;
  spec?: string;
  tags?: string[]; // e.g. skin concerns for Halimun
  art: { kind: ArtKind; bg: string; accent: string };
  variants: Variant[];
  /** Products whose stock is consumed by this product (bundles). sku -> qty per unit. */
  components?: Record<string, number>;
  specs?: Record<string, string>;
  /** Product photos in gallery order; position 0 is the main photo. Absent or empty: the drawing is shown. */
  images?: ProductImage[];
}

/** Public catalogue photo (spec section 1). srcset descriptors are shorter-side targets. */
export interface ProductImage {
  id: string;
  alt: string;
  width: number;
  height: number;
  src: string;
  srcset: string;
  sample?: true;
}

export type ArtKind = "bottle" | "jar" | "tube" | "dropper" | "cable" | "charger" | "adapter" | "hub";

export interface Category {
  id: string;
  brand: BrandId;
  name: string;
  slug: string;
}

/* ---------- Promotions (D3) ---------- */

export interface Window {
  start: string; // ISO with +07:00
  end: string;
}

/** A price promotion changes the unit price of eligible items. Lowest price wins per item. */
export interface PricePromotion {
  kind: "price";
  code: string;
  label: string;
  /** Percentage off the regular price, or a fixed promotional price for listed SKUs. */
  percentOff?: number;
  fixedPrice?: Record<string, Rupiah>;
  appliesTo: { skus?: string[]; categoryIds?: string[] };
  window?: Window;
  /** Flash-sale items are excluded from order vouchers unless a voucher explicitly allows them. */
  isFlashSale: boolean;
}

/** Gift with purchase, e.g. B2G1-SERUM: buy N of trigger SKU, get M of gift SKU free. */
export interface GiftPromotion {
  kind: "gift";
  code: string;
  label: string;
  triggerSku: string;
  triggerQty: number;
  giftSku: string;
  giftQty: number;
  window?: Window;
}

export interface OrderVoucher {
  kind: "order";
  code: string;
  label: string;
  percentOff?: number;
  amountOff?: Rupiah;
  maxDiscount?: Rupiah;
  minEligibleSubtotal?: Rupiah;
  appliesTo?: { categoryIds?: string[] }; // undefined = all items
  allowFlashSaleItems?: boolean;
  window?: Window;
}

export interface ShippingVoucher {
  kind: "shipping";
  code: string;
  label: string;
  maxDiscount: Rupiah;
  minSubtotal: Rupiah;
  window?: Window;
}

export type Promotion = PricePromotion | GiftPromotion | OrderVoucher | ShippingVoucher;

/* ---------- Cart & checkout ---------- */

export interface CartLine {
  sku: string;
  qty: number;
}

export interface PricedLine {
  sku: string;
  productId: string;
  name: string;
  variantLabel: string;
  qty: number;
  regularUnit: Rupiah;
  unitPrice: Rupiah; // after the winning price promotion
  lineTotal: Rupiah;
  appliedPriceCode?: string;
  isFlashSale: boolean;
  isGift: boolean;
  categoryId: string;
}

export type VoucherStatus =
  | { ok: true; discount: Rupiah; message: string }
  | { ok: false; discount: 0; message: string };

export interface ShippingQuote {
  courierId: string;
  service: string;
  etaText: string;
  cost: Rupiah | null; // null = not available for this destination
}

export interface Totals {
  lines: PricedLine[];
  itemCount: number;
  subtotal: Rupiah;
  orderVoucher?: { code: string; status: VoucherStatus };
  shipping?: Rupiah;
  shippingVoucher?: { code: string; status: VoucherStatus };
  total: Rupiah;
}

/* ---------- Orders (M1 state model) ---------- */

export type PaymentMethod = "qris" | "ewallet" | "va";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "refunded" | "partially_refunded";
export type FulfilmentStatus = "awaiting_payment" | "to_process" | "processing" | "shipped" | "in_transit" | "delivered" | "cancelled";

export interface Address {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  line: string;
  city: string;
  postalCode: string;
  isPrimary?: boolean;
}

export interface Order {
  number: string; // ORD-YYMMDD-NNNN (I9)
  customerId: string;
  createdAt: string;
  totals: Totals;
  addressId: string;
  courier: ShippingQuote;
  payment: { method: PaymentMethod; status: PaymentStatus; expiresAt: string; paidAt?: string; reference?: string };
  fulfilment: FulfilmentStatus;
  trackingNumber?: string;
  refunded: Rupiah;
  refunds?: { at: string; amount: Rupiah; reason: string; actor: string }[];
  history: { at: string; status: string; actor: string }[];
}
