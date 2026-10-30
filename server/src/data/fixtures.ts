/**
 * Deterministic mock dataset (W00 · snapshot 20 Okt 2026 10:16 WIB).
 * Source of truth: docs/MOCK_DATA_CONTRACT.md. Every person, address, courier, bank and
 * reference here is fictional. Do not add real personal data.
 */
import type { Address, BrandId, Category, Product, Promotion, ShippingQuote, StaffRole } from "../domain/types";
export type { StaffRole };

export const SNAPSHOT_AT = "2026-10-20T10:16:00+07:00";
/** Clock used when the demo customer presses "Buat pesanan" (P2). */
export const ORDER_CREATED_AT = "2026-10-20T10:15:00+07:00";
export const DEMO_PAID_AT = "2026-10-20T10:21:00+07:00";
/** Next order number sequence for 20 Okt (0009 exists; 0010 is the reference checkout). */
export const NEXT_ORDER_SEQ = 10;

/**
 * Stock not specified in W00 for Halimun lines A01/A02/A03/A05: placeholder 99 (P6).
 * The storefront also caps quantity per line (brand config maxQtyPerLine).
 */
const UNSPECIFIED_STOCK = 99;

export const categories: Category[] = [
  { id: "kabel", brand: "sambung", name: "Kabel", slug: "kabel" },
  { id: "charger", brand: "sambung", name: "Charger", slug: "charger" },
  { id: "adaptor", brand: "sambung", name: "Adaptor", slug: "adaptor" },
  { id: "hub", brand: "sambung", name: "Hub", slug: "hub" },
  { id: "pembersih", brand: "halimun", name: "Pembersih", slug: "pembersih" },
  { id: "serum", brand: "halimun", name: "Serum", slug: "serum" },
  { id: "pelembap", brand: "halimun", name: "Pelembap", slug: "pelembap" },
  { id: "perlindungan", brand: "halimun", name: "Perlindungan", slug: "perlindungan" },
  { id: "bundel", brand: "halimun", name: "Bundel", slug: "bundel" },
];

const TD = "Tidak dicantumkan";

export const products: Product[] = [
  {
    id: "B01", brand: "sambung", slug: "kabel-usb-c-100w-braided", name: "Kabel USB-C ke USB-C 100W Braided", categoryId: "kabel",
    spec: "USB-C ??USB-C · 100W · 1/2/3 m", art: { kind: "cable", bg: "#F2F4F7", accent: "#1F5AE0" },
    specs: { Konektor: "USB-C ??USB-C", "Daya maks.": "100W", "Kecepatan data": "USB 2.0 · 480 Mbps", "Output video": "Tidak", Material: "Nilon braided" },
    variants: [
      { sku: "B01-1M-BLK", label: "1 m · Hitam", price: 129000, compareAt: 149000, onHand: 42, reserved: 0, attrs: { lengthM: 1, colour: "Hitam" } },
      { sku: "B01-2M-BLK", label: "2 m · Hitam", price: 159000, onHand: 9, reserved: 2, attrs: { lengthM: 2, colour: "Hitam" } },
      { sku: "B01-2M-WHT", label: "2 m · Putih", price: 159000, onHand: 0, reserved: 0, attrs: { lengthM: 2, colour: "Putih" } },
      { sku: "B01-3M-BLK", label: "3 m · Hitam", price: 189000, onHand: 15, reserved: 0, attrs: { lengthM: 3, colour: "Hitam" } },
    ],
  },
  {
    id: "B02", brand: "sambung", slug: "adaptor-usb-c-hdmi-4k60", name: "Adaptor USB-C ke HDMI 4K60", categoryId: "adaptor",
    spec: "USB-C ??HDMI · 4K 60Hz", art: { kind: "adapter", bg: "#F2F4F7", accent: "#1F5AE0" },
    variants: [{ sku: "B02", label: "", price: 219000, onHand: 23, reserved: 0 }],
  },
  {
    id: "B03", brand: "sambung", slug: "charger-gan-65w-3-port", name: "Charger GaN 65W 3 Port", categoryId: "charger",
    spec: "2× USB-C + 1× USB-A · 65W total", art: { kind: "charger", bg: "#FDF1DC", accent: "#F5A524" },
    variants: [{ sku: "B03", label: "", price: 399000, onHand: 12, reserved: 1 }],
  },
  {
    id: "B04", brand: "sambung", slug: "hub-usb-c-7-in-1", name: "Hub USB-C 7-in-1", categoryId: "hub",
    spec: "HDMI · 3× USB-A · SD · microSD · PD", art: { kind: "hub", bg: "#F2F4F7", accent: "#1F5AE0" },
    variants: [{ sku: "B04", label: "", price: 549000, onHand: 4, reserved: 0 }],
  },
  {
    id: "B05", brand: "sambung", slug: "kabel-usb-c-lightning-1m", name: "Kabel USB-C ke Lightning · 1 m", categoryId: "kabel",
    spec: "USB-C ??Lightning · 1 m", art: { kind: "cable", bg: "#F2F4F7", accent: "#4A5568" },
    specs: { Konektor: "USB-C ??Lightning", "Daya maks.": TD, "Kecepatan data": TD, "Output video": TD, Material: TD },
    variants: [{ sku: "B05", label: "", price: 149000, onHand: 30, reserved: 0, attrs: { lengthM: 1 } }],
  },
  {
    id: "B06", brand: "sambung", slug: "kabel-hdmi-2-1-8k-2m", name: "Kabel HDMI 2.1 8K · 2 m", categoryId: "kabel",
    spec: "HDMI 2.1 · 8K60 / 4K120 · 2 m", art: { kind: "cable", bg: "#F2F4F7", accent: "#C0262D" },
    specs: { Konektor: "HDMI ??HDMI", "Daya maks.": TD, "Kecepatan data": TD, "Output video": "8K60 / 4K120", Material: TD },
    variants: [{ sku: "B06", label: "", price: 179000, onHand: 0, reserved: 0, attrs: { lengthM: 2 } }],
  },
  {
    id: "B07", brand: "sambung", slug: "kabel-usb-a-usb-c-1m", name: "Kabel USB-A ke USB-C · 1 m", categoryId: "kabel",
    spec: "USB-A ??USB-C · 3A · 1 m", art: { kind: "cable", bg: "#F2F4F7", accent: "#7D8796" },
    specs: { Konektor: "USB-A ??USB-C", "Daya maks.": TD, "Kecepatan data": TD, "Output video": TD, Material: TD },
    variants: [{ sku: "B07", label: "", price: 69000, onHand: 120, reserved: 0, attrs: { lengthM: 1 } }],
  },
  {
    id: "B08", brand: "sambung", slug: "kabel-displayport-1-4-2m", name: "Kabel DisplayPort 1.4 · 2 m", categoryId: "kabel",
    spec: "DP 1.4 · 8K60 · 2 m", art: { kind: "cable", bg: "#F2F4F7", accent: "#4A5568" },
    specs: { Konektor: "DisplayPort ??DisplayPort", "Daya maks.": TD, "Kecepatan data": TD, "Output video": "8K60", Material: TD },
    variants: [{ sku: "B08", label: "", price: 199000, onHand: 18, reserved: 0, attrs: { lengthM: 2 } }],
  },
  // ---------------- Halimun (Brand A) ----------------
  {
    id: "A01", brand: "halimun", slug: "gentle-low-ph-cleanser", name: "Gentle Low-pH Cleanser", categoryId: "pembersih",
    tags: ["sensitif", "kering"], art: { kind: "bottle", bg: "#EFE6DC", accent: "#4F6B57" },
    variants: [
      { sku: "A01-100", label: "100 ml", price: 119000, onHand: UNSPECIFIED_STOCK, reserved: 0 },
      { sku: "A01-200", label: "200 ml", price: 189000, onHand: UNSPECIFIED_STOCK, reserved: 0 },
    ],
  },
  {
    id: "A02", brand: "halimun", slug: "barrier-repair-moisturizer", name: "Barrier Repair Moisturizer", categoryId: "pelembap",
    spec: "50 ml", tags: ["sensitif", "kering"], art: { kind: "jar", bg: "#DCE3DA", accent: "#4F6B57" },
    variants: [{ sku: "A02", label: "", price: 169000, onHand: UNSPECIFIED_STOCK, reserved: 0 }],
  },
  {
    id: "A03", brand: "halimun", slug: "niacinamide-serum", name: "Niacinamide Serum", categoryId: "serum",
    spec: "30 ml", tags: ["kusam"], art: { kind: "dropper", bg: "#EADBD3", accent: "#8C3B2E" },
    variants: [{ sku: "A03", label: "", price: 149000, compareAt: 179000, onHand: UNSPECIFIED_STOCK, reserved: 0 }],
  },
  {
    id: "A04", brand: "halimun", slug: "daily-sunscreen-gel", name: "Daily Sunscreen Gel", categoryId: "perlindungan",
    spec: "50 ml", tags: ["perlindungan"], art: { kind: "tube", bg: "#E6E0D2", accent: "#23201D" },
    variants: [{ sku: "A04", label: "", price: 139000, onHand: 9, reserved: 0 }],
  },
  {
    id: "A05", brand: "halimun", slug: "travel-cleanser", name: "Travel Cleanser", categoryId: "pembersih",
    spec: "30 ml", tags: ["sensitif"], art: { kind: "bottle", bg: "#EFE6DC", accent: "#8C8279" },
    variants: [{ sku: "A05", label: "", price: 45000, onHand: UNSPECIFIED_STOCK, reserved: 0 }],
  },
  {
    id: "BND-PAGI", brand: "halimun", slug: "bundel-rutinitas-pagi", name: "Bundel Rutinitas Pagi", categoryId: "bundel",
    spec: "Cleanser 100 ml + Moisturizer + Sunscreen", art: { kind: "jar", bg: "#E4DACE", accent: "#4F6B57" },
    components: { "A01-100": 1, A02: 1, A04: 1 },
    // Bundle has no own stock: availability is derived from components (see domain/stock.ts).
    variants: [{ sku: "BND-PAGI", label: "", price: 379000, compareAt: 427000, onHand: 0, reserved: 0 }],
  },
];

export const promotions: Record<BrandId, Promotion[]> = {
  sambung: [
    {
      kind: "price", code: "FS-WEEKEND", label: "Flash sale akhir pekan", percentOff: 25, appliesTo: { skus: ["B03"] }, isFlashSale: true,
      window: { start: "2026-10-20T00:00:00+07:00", end: "2026-10-22T23:59:59+07:00" },
    },
    {
      kind: "order", code: "KABEL10", label: "10% kategori Kabel", percentOff: 10, maxDiscount: 30000, appliesTo: { categoryIds: ["kabel"] },
      window: { start: "2026-10-01T00:00:00+07:00", end: "2026-10-31T23:59:59+07:00" },
    },
    { kind: "order", code: "HEMAT50", label: "Potongan Rp50.000", amountOff: 50000, minEligibleSubtotal: 500000 },
    { kind: "shipping", code: "GRATISONGKIR", label: "Gratis ongkir", maxDiscount: 20000, minSubtotal: 300000 },
  ],
  halimun: [
    { kind: "gift", code: "B2G1-SERUM", label: "Beli 2 serum gratis 1 Travel Cleanser", triggerSku: "A03", triggerQty: 2, giftSku: "A05", giftQty: 1 },
  ],
};

/** Simulated quotes (1 kg, Jakarta Barat ??Kota Bandung). Same for every demo address (P4). */
export const shippingQuotes: ShippingQuote[] = [
  { courierId: "kurir-a", service: "Kurir A · Reguler", etaText: "Estimasi 2?? hari", cost: 18000 },
  { courierId: "kurir-b", service: "Kurir B · Hemat", etaText: "Estimasi 3?? hari", cost: 15000 },
  { courierId: "kurir-c", service: "Kurir C · Kilat", etaText: "Estimasi 1 hari", cost: 27000 },
  { courierId: "kurir-d", service: "Kurir D · Same Day", etaText: "Tidak tersedia untuk alamat ini", cost: null },
];

export const demoCustomer = {
  id: "C-0001",
  name: "Rina Pratama",
  email: "rina@example.com",
  phone: "0812-0000-1234",
  addresses: [
    { id: "rumah", label: "Rumah", recipient: "Rina Pratama", phone: "0812-0000-1234", line: "Jl. Melati No. 12, RT 03/RW 05, Kec. Coblong", city: "Kota Bandung, Jawa Barat", postalCode: "40132", isPrimary: true },
    { id: "kantor", label: "Kantor", recipient: "Rina Pratama", phone: "0812-0000-1234", line: "Jl. Kenanga No. 8, Kec. Sumur Bandung", city: "Kota Bandung, Jawa Barat", postalCode: "40111" },
  ] satisfies Address[],
};

/**
 * Demo sign-in credential for the fictional account C-0001. Prototype only: shown in the demo panel,
 * never reused anywhere real. Production auth (hashing, rate limiting, sessions) = Agent 02.
 */
export const DEMO_LOGIN = { email: "rina@example.com", password: "demo-rina-2026" };

export const seedWishlist: Record<BrandId, string[]> = { sambung: ["B04", "B06"], halimun: [] };

export type ConsentKey = "emailPromo" | "waOrderInfo" | "personalised";
export interface ConsentRecord { granted: boolean; changedAt: string; source: string }
export const seedConsents: Record<ConsentKey, ConsentRecord> = {
  emailPromo: { granted: false, changedAt: "2026-10-20T08:02:00+07:00", source: "Pelanggan · halaman preferensi" },
  waOrderInfo: { granted: true, changedAt: "2026-10-14T09:10:00+07:00", source: "Pelanggan · saat daftar" },
  personalised: { granted: true, changedAt: "2026-10-14T09:10:00+07:00", source: "Pelanggan · saat daftar" },
};

/** Historic order shown in the account (H13): ORD-261014-0003, courier update overdue. */
export const seedOrder0003 = {
  number: "ORD-261014-0003",
  createdAt: "2026-10-14T09:12:00+07:00",
  lines: [{ sku: "B02", qty: 1 }, { sku: "B05", qty: 1 }],
  courierId: "kurir-a",
  method: "va" as const,
  paidAt: "2026-10-14T09:20:00+07:00",
  reference: "SIM-PAY-20261014-0003",
  tracking: "SIM-KA-88213004",
  history: [
    { at: "2026-10-15T18:22:00+07:00", status: "Dalam perjalanan · Hub Jakarta (simulasi)", actor: "Event kurir (simulasi)" },
    { at: "2026-10-15T10:40:00+07:00", status: "Dikirim · resi dibuat", actor: "Operasional" },
    { at: "2026-10-14T13:05:00+07:00", status: "Diproses", actor: "Operasional" },
    { at: "2026-10-14T09:20:00+07:00", status: "Dibayar · Virtual Account", actor: "Event gateway (simulasi)" },
    { at: "2026-10-14T09:12:00+07:00", status: "Pesanan dibuat", actor: "Pelanggan" },
  ],
};

/* ======================= Admin (M5 / P05 data) ======================= */

export interface Staff { id: string; name: string; role: StaffRole; email: string }
/** Fictional staff. "Admin" role has no named person in W00; CS is a demo account (gap noted in M5). */
export const staff: Staff[] = [
  { id: "U-01", name: "Andi S.", role: "owner", email: "andi@toko.example" },
  { id: "U-02", name: "Dewi O.", role: "operations", email: "dewi@toko.example" },
  { id: "U-03", name: "Rina M.", role: "marketing", email: "rina.m@toko.example" },
  { id: "U-04", name: "Akun CS demo", role: "cs", email: "cs@toko.example" },
  { id: "U-05", name: "Sinta P.", role: "seo", email: "sinta@toko.example" },
];

export interface CustomerRecord { id: string; name: string; email: string; phone: string; address: string }
/** C-0001 matches the storefront account. Others: fictional demo values (MOCK_DATA_CONTRACT, X10). */
export const customers: CustomerRecord[] = [
  { id: "C-0001", name: "Rina Pratama", email: "rina@example.com", phone: "0812-0000-1234", address: "Jl. Melati No. 12, Kec. Coblong, Kota Bandung 40132" },
  { id: "C-0002", name: "Budi H.", email: "budi@example.com", phone: "0813-0000-2201", address: "Jl. Cempaka No. 21, Kec. Lowokwaru, Kota Malang 65141" },
  { id: "C-0003", name: "Citra W.", email: "citra@example.com", phone: "0812-0000-3356", address: "Jl. Anggrek No. 3, Kec. Tebet, Kota Jakarta Selatan 12810" },
  { id: "C-0004", name: "Dimas A.", email: "dimas@example.com", phone: "0817-0000-4403", address: "Jl. Mawar No. 5, Kec. Banyumanik, Kota Semarang 50263" },
  { id: "C-0005", name: "Eka P.", email: "eka@example.com", phone: "0819-0000-5504", address: "Jl. Dahlia No. 9, Kec. Denpasar Barat, Kota Denpasar 80119" },
  { id: "C-0006", name: "Fajar N.", email: "fajar@example.com", phone: "0821-0000-6605", address: "Jl. Teratai No. 2, Kec. Medan Baru, Kota Medan 20153" },
  { id: "C-0007", name: "Gita L.", email: "gita@example.com", phone: "0822-0000-7706", address: "Jl. Kamboja No. 7, Kec. Gubeng, Kota Surabaya 60281" },
];

export interface SeedOrder {
  number: string; customerId: string; createdAt: string; lines: { sku: string; qty: number }[]; method: "qris" | "ewallet" | "va";
  paidAt?: string; outcome: "delivered" | "in_transit" | "processing" | "to_process" | "expired" | "refunded";
  tracking?: string; refund?: { at: string; amount: number; reason: string; actor: string };
}
/**
 * W00 orders 14??0 Okt (Kurir A Rp18.000 each). Items are derived from the order totals and the X01 top-products list;
 * times not shown on earlier boards are demo values (documented in MOCK_DATA_CONTRACT).
 */
export const seedOrders: SeedOrder[] = [
  { number: "ORD-261014-0001", customerId: "C-0002", createdAt: "2026-10-14T08:30:00+07:00", paidAt: "2026-10-14T08:34:00+07:00", lines: [{ sku: "B01-1M-BLK", qty: 1 }], method: "qris", outcome: "delivered", tracking: "SIM-KA-88213001" },
  { number: "ORD-261014-0002", customerId: "C-0003", createdAt: "2026-10-14T09:02:00+07:00", paidAt: "2026-10-14T09:15:00+07:00", lines: [{ sku: "B03", qty: 1 }], method: "va", outcome: "delivered", tracking: "SIM-KA-88213002" },
  // 0003 is seeded separately (seedOrder0003) because the customer account shows its full history.
  { number: "ORD-261016-0004", customerId: "C-0004", createdAt: "2026-10-16T19:40:00+07:00", paidAt: "2026-10-16T19:42:00+07:00", lines: [{ sku: "B07", qty: 1 }], method: "ewallet", outcome: "delivered", tracking: "SIM-KA-88213005" },
  { number: "ORD-261017-0005", customerId: "C-0005", createdAt: "2026-10-17T14:10:00+07:00", paidAt: "2026-10-17T15:02:00+07:00", lines: [{ sku: "B04", qty: 1 }], method: "va", outcome: "processing" },
  { number: "ORD-261018-0006", customerId: "C-0006", createdAt: "2026-10-18T11:20:00+07:00", lines: [{ sku: "B02", qty: 1 }], method: "qris", outcome: "expired" },
  { number: "ORD-261019-0007", customerId: "C-0002", createdAt: "2026-10-19T13:58:00+07:00", paidAt: "2026-10-19T14:05:00+07:00", lines: [{ sku: "B08", qty: 1 }], method: "qris", outcome: "to_process" },
  { number: "ORD-261019-0008", customerId: "C-0007", createdAt: "2026-10-19T15:30:00+07:00", paidAt: "2026-10-19T15:33:00+07:00", lines: [{ sku: "B02", qty: 1 }], method: "ewallet", outcome: "refunded",
    refund: { at: "2026-10-19T16:40:00+07:00", amount: 237000, reason: "Pelanggan membatalkan", actor: "Andi S. (Owner)" } },
  { number: "ORD-261020-0009", customerId: "C-0003", createdAt: "2026-10-20T08:41:00+07:00", paidAt: "2026-10-20T08:47:00+07:00", lines: [{ sku: "B01-1M-BLK", qty: 2 }], method: "va", outcome: "to_process" },
];

export const MOCK_SESSIONS_14_20_OKT = 1240; // mock, not GA4

export interface AuditEntry { at: string; actor: string; code: string; action: string; object: string }
/** Seed audit log (X12 / A22): only events shown on earlier boards. */
export const seedAudit: AuditEntry[] = [
  { at: "2026-10-20T10:12:00+07:00", actor: "Rina M. (Marketing)", code: "CONTENT_DRAFT_SAVED", action: "Draf konten disimpan", object: "Halaman \"Flash sale akhir pekan\"" },
  { at: "2026-10-19T16:40:00+07:00", actor: "Andi S. (Owner)", code: "REFUND_RECORDED", action: "Refund penuh dicatat Rp237.000 · Pelanggan membatalkan", object: "ORD-261019-0008" },
  { at: "2026-10-19T16:40:00+07:00", actor: "Andi S. (Owner)", code: "ORDER_CANCELLED", action: "Pesanan dibatalkan · alasan: pelanggan membatalkan", object: "ORD-261019-0008" },
  { at: "2026-10-18T15:02:00+07:00", actor: "Dewi O. (Operasional)", code: "PRODUCT_UPDATED", action: "Produk diubah", object: "B01 Kabel USB-C 100W" },
  { at: "2026-10-18T09:10:00+07:00", actor: "Dewi O. (Operasional)", code: "ORDER_STATUS", action: "Status ??Diproses", object: "ORD-261017-0005" },
];

/** Draft promotion used by the conflict check (X08 / P06). */
export const draftCharger15 = {
  kind: "price" as const, code: "CHARGER15", label: "Diskon Charger", percentOff: 15, appliesTo: { categoryIds: ["charger"] }, isFlashSale: false,
  window: { start: "2026-10-21T00:00:00+07:00", end: "2026-10-31T23:59:59+07:00" },
};
