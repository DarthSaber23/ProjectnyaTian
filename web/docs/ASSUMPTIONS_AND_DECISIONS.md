# ASSUMPTIONS_AND_DECISIONS

All decisions below are **approved** by the product owner (20 Oct 2026) unless marked otherwise.

## M0 decisions
| ID | Decision | Approved rule |
|---|---|---|
| D1 | Design tool | Claude Design is the design tool of record (changed from Figma on approval). One canvas page per milestone; M6 = clickable Claude Design prototype; tokens exported as JSON at M3. |
| D2 | Comparison limit | Max 4 products, same top-level category. Desktop 4 columns; mobile 2 columns, first pinned, swipe; "differences only" toggle. |
| D3 | Promotion stacking | Per line: max one product-level promotion (strikethrough, flash sale, bundle, Buy X Get Y); if several qualify, lowest price wins and is named. Per order: max one order voucher + one shipping voucher. Vouchers exclude flash-sale items unless allowed. Order of application: product promo → order voucher → shipping. |
| D4 | Rounding & format | Integer Rupiah. Percentage discounts per unit, floored to Rp1. Line = unit × qty. Display `Rp1.250.000`. |
| D5 | Tax display | Prices include PPN (Pajak Pertambahan Nilai, value-added tax); no tax line; note "Harga sudah termasuk PPN". |
| D6 | Reservation & expiry | Reserve at order creation. Windows: QRIS 15 min, e-wallet 15 min, VA 24 h. Release on expired / failed / cancelled. |
| D7 | Guest cart merge | Merge on login, sum same variants, cap at available stock, show a notice. |
| D8 | Reviews | Display only, "verified purchase" label; submission is Future. |
| D9 | Catalog discovery | Numbered crawlable pagination (24/page); mobile "Muat lebih banyak" on the same URLs. |
| D10 | Admin roles | Owner, Admin, Operations, Marketing, Customer Service (masked contacts, logged reveal). |
| D11 | Prototype toolchain | Vite + React + TypeScript + Tailwind CSS + React Router + Zustand; typed mock services with latency/failure toggles. |
| D12 | Metrics | Revenue = paid − refunds (refund date); Orders = paid orders; AOV (average order value) = Revenue ÷ Orders; Conversion = purchase sessions ÷ sessions; attribution = last campaign touch ≤ 7 days. |
| D13 | Address fields | Required: recipient, phone, province, city/regency, district, postal code, detail. Optional: kelurahan, label, note. |
| D14 | Admin language | Bahasa Indonesia; fixed status labels mapped to English codes. |
| D15 | Brand names | Codenames until owner trademark screening of names proposed at M3. |
| D16 | WhatsApp number | Format check only (08 / +62, 10–13 digits); no OTP. |

## M1 decisions
| ID | Decision | Approved rule |
|---|---|---|
| I1 | URL language | Indonesian public slugs; English admin paths. |
| I2 | Product URLs | Flat `/produk/{slug}`; breadcrumb from primary category. |
| I3 | Checkout steps | 1 Pengiriman · 2 Ringkasan · 3 Pembayaran. |
| I4 | Order creation | On "Buat Pesanan" in step 3 after stock/price re-check. |
| I5 | Payment page | `/pembayaran/{nomor-pesanan}`, revisitable until paid/expired. |
| I6 | Wishlist | Requires login. |
| I7 | Tracking | Inside the account only. |
| I8 | Refunds | Recorded by Owner/Admin; payment shows refunded / partially refunded. |
| I9 | Order number | `ORD-YYMMDD-NNNN`. |

## M2 decisions (layout alternatives, board W12)
| ID | Topic | Chosen |
|---|---|---|
| L1 | Checkout structure | 3 grouped steps (not one-page accordion) |
| L2 | Mobile PDP purchase action | Sticky bottom bar |
| L3 | Mobile comparison | 2 columns, first pinned, swipe; accessible table + list-view toggle |
| L4 | Desktop catalog filters | Configurable: Brand B sidebar, Brand A top bar |

## Working assumptions (not business decisions)
1. No guest checkout.
2. One store, one stock location, one shipping origin per fork.
3. No KPI targets.
4. All demo people, addresses, couriers (Kurir A–D), banks (Bank A–C) and codes are fictional.
5. Imagery: placeholders or original illustration only.
6. Prototype may persist state in browser local storage, disclosed, with a reset control.
7. No PII (personally identifiable information) in analytics events.
8. "Delivered" only from a simulated courier event.
9. Validation widths 360 / 390 / 768 / 1280 / 1440 px.

## M5 decisions (approved with M5, 20 Oct 2026)
C7–C9 were approved as proposed without separate answers; they remain owner-reversible before M7.

| ID | Topic | Rule |
|---|---|---|
| C1 | CS search | No customer search by email/phone for CS role |
| C2 | Contact reveal | Reason required (fixed list), visible 60 s, logged as CONTACT_REVEAL |
| C3 | Customer data export | Owner/Admin only; personal-data deletion/export requests go to Owner |
| C4 | Consent | Changed only by the customer; CS read-only |
| C5 | Demo consent values | Customers other than C-0001 carry demo consent values (MOCK_DATA_CONTRACT) |
| C6 | Analytics time | WIB buckets; paid by payment time; refunds by refund date (D12) |
| C7 | Repeat-buyer metric | All-time, not per selected period |
| C8 | Access matrix | As drawn on X12 / A17 |
| C9 | Admin sign-in | TOTP required; 5 failures → 15 min lock; reset by Owner; no Google sign-in for admin |
| C10 | Gateway secrets | Server environment variables only; never shown in browser |
| C11 | Notifications | Transactional email always sent; transactional WhatsApp only with "Info pesanan via WhatsApp" consent; marketing by email only, with email-promo consent; no WhatsApp marketing (corrected M6 batch 2 to match H14) |

## M6 working rules (batch 1, pending M6 approval)
| ID | Topic | Rule |
|---|---|---|
| P1 | Prototype structure | One interactive artboard per flow, state held in the artboard (no browser storage) |
| P2 | Simulated clock | Order created 10:15 WIB, paid 10:21, QRIS/e-wallet expiry 10:30, VA 21 Okt 10:15 |
| P3 | Signed-in user | Demo customer C-0001 (no guest checkout) |
| P4 | Shipping rates | Same rates for both addresses (simplification) |
| P5 | Test controls | Dashed "PANEL UJI" / "PANEL SIMULASI GATEWAY" boxes are prototype-only |
| P6 | Brand A stock | Bundle and sunscreen share A04 stock (9); other Brand A items capped at 10 per line in prototype |
| P7 | Customer lockout | 5 wrong passwords → 15-min lock (mirrors C9; owner/Agent 02 to confirm) |
| P8 | Search | Demo synonym map + length tokens; matching is all-words substring (production search engine = Agent 02) |
| P9 | Admin clock | Each admin action advances 2 min from 10:20 WIB |
| P10 | Refund after shipment | Not modelled (returns flow out of scope); owner to decide |
| P11 | Tracking-number format | 8–30 chars, A–Z, 0–9, hyphen (prototype validation; courier-specific rules = Agent 02) |
| P12 | Promotion scheduling | Requires explicit "conflict reviewed" confirmation; start time cannot be in the past; equal prices keep the already-active promo |

## M7 build decisions (React prototype)
| ID | Topic | Rule |
|---|---|---|
| R1 | Routing | HashRouter in the code (works on static hosting); MemoryRouter in the hosted review preview; client deployments switch to BrowserRouter + server rewrites for SEO |
| R2 | Persistence | No browser storage; reload resets the demo (P1) |
| R3 | Halimun numerals | Figtree tabular figures instead of a monospace face |
| R4 | Sign-in | Demo credential only; 5 failures → 15-min lock (P7); redirect targets restricted to internal paths |
| R5 | Guest cart merge (D7) | Quantities add up per SKU, capped by stock/per-line limit; caps reported in the sign-in message |
| R6 | Gift stock | Gift units (B2G1) are reserved and committed with the order |
| R7 | Compare tray | Shown only on listing pages (home, category, search) so it never covers checkout or account content |
| R8 | Admin data | Admin shows the Sambung store. W00 orders 0001–0009 are seeded; ORD-261020-0010 exists only after the customer places it in the storefront, so "Menunggu pembayaran" starts at 0 in admin (X01 showed 1) |
| R9 | Admin clock | Header shows the time of the latest admin action (10:16 before any action; first action 10:20, +2 min each, P9) |
| R10 | Staff sign-in | Demo password + any 6-digit code (TOTP simulated, C9); production uses SSO or server auth with real TOTP |
| R11 | Seed order details | Items for 0001/0002/0004–0008 derived from order totals and X01 top products; times not on earlier boards are demo values (MOCK_DATA_CONTRACT) |

## M7 approval and M8 decisions
M7 recorded as approved on 20 Oct 2026: the owner replied "Continue" to the M7 approval request (interpreted as approval; flag if not intended).

| ID | Topic | Rule |
|---|---|---|
| R12 | Release gate | `npm run build:client` fails while VITE_DEMO_TOOLS ≠ false or any `services/mock` import remains |
| R13 | Router version | react-router-dom 6.30.6 (high advisory fixed); v7 migration recommended to Agent 02 (moderate advisories) |
| R14 | Dialogs | One shared accessible Dialog (focus trap, Escape, focus return) |
| R15 | Reflow | All layouts use `minmax(0,1fr)` grid tracks; verified no horizontal scroll at 360/768/1280 px |

M8 approved by the owner on 21 Oct 2026 (explicit "Approve"). Agent 01 scope closed; handoff package: ecommerce-starter-handoff-agent02.zip.
