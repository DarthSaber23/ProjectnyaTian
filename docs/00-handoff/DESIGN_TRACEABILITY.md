# A0 — Design-to-requirement map

| Field | Value |
|---|---|
| Milestone | A0 |
| Status | Proposed |
| Date | 21 Oct 2026 |

This is the intake map from `Prompt.md` §4 to the approved Agent 01 decisions, boards, and prototype. Coverage means what exists today:

- **Simulated** — behaviour runs in the prototype on mock services and is covered by unit or e2e checks.
- **Designed** — specified on an approved board or in an approved document, and not wired as a working route.
- **Partial** — a slice runs; the rest is design-only or a known simplification.
- **Missing** — required by the product prompt or by a flow, and not designed.

Requirement IDs (FR-…) are reserved for A1. This file does not assign P0/P1/P2.

## 1. Product shape

| Requirement | Approved source | Design | Prototype | Coverage |
|---|---|---|---|---|
| Reusable starter, one deployment per client, not multi-tenant | PROJECT_BRIEF §1; working assumption 2 | Store settings are per brand tokens, not a tenant switcher | `src/config/brands.ts` switches Halimun and Sambung in one demo build | Simulated as two brands in one prototype. Production is one fork per client |
| Indonesia, Bahasa Indonesia, IDR, Asia/Jakarta | D4, D5, D14, I1 | All hi-fi boards | `domain/money.ts`, `domain/time.ts`, admin and storefront copy | Simulated |
| B2C checkout; B2B only via inquiry | DESIGN_SCOPE; J7 | S32, H17 | No `/grosir` route | Designed |
| Guests browse and cart; sign-in required before checkout; cart preserved | Working assumption 1; D7; I3 | Journeys, H06, P02 | `domain/cart.ts`, `Checkout.tsx`, `SignIn.tsx` | Simulated |
| No numeric KPI or SLO targets | PROJECT_BRIEF §2; D12 | X11 states formulas only | `domain/analytics.ts` computes definitions | Simulated definitions. Targets intentionally absent |
| Preserve the approved UI when the backend arrives | HANDOFF §1; R1 | H01–H21, X01–X12 | `services/contracts.ts` is the only UI seam | Seam exists. HTTP clients do not |

## 2. Catalogue, search, comparison

| Requirement | Approved source | Design | Prototype | Coverage |
|---|---|---|---|---|
| Categories, variants, badges, sort, availability, pagination 24 per page | D9, L4 | W03, H03, H11 | `pages/Catalog.tsx`. Demo has 8 products, so page size is unexercised | Partial |
| Configurable filter layout | L4 | W12 | Token `composition.filterLayout`: Halimun top bar, Sambung sidebar | Simulated |
| PDP variants, stock, quantity, content blocks, shipping estimate, reviews display | D8 | W04, H04, H05 | `pages/ProductPage.tsx`. Reviews are display-only. Submission is Future | Partial |
| Comparison, max 4, same top-level category | D2, L3 | W12, H10, P03 | `domain/compare.ts`, `pages/ComparePage.tsx` | Simulated |
| Autocomplete, synonyms, typo tolerance, facets | P8 for the prototype; USER_FLOWS discovery pipeline for the intended behaviour | H09, P03 | `domain/search.ts`: normalised substring, USB-C synonym family, length token. No edit-distance, no rank order | Partial. See OD-09 |
| Recommendations and curated collections | DESIGN_SCOPE essential (PDP recommendations, S37) | H04, H05, H18 | PDP strips use fixture data. No recommendation module. `/koleksi` and `/promo` are not routed | Designed |
| Dynamic attributes and reusable content blocks | DESIGN_SCOPE | H04 specs, H05 concern blocks, X09 | `Product.specs`, `tags`, `attrs` on variants. CMS blocks are not a runtime model | Partial |

## 3. Promotions and pricing

| Requirement | Approved source | Design | Prototype | Coverage |
|---|---|---|---|---|
| Integer Rupiah, floor per unit, display format | D4 | W00, DS-Tokens | `domain/money.ts` | Simulated |
| Prices include PPN, no tax line | D5 | H04–H07 | Summary copy | Simulated. No configurable tax rate |
| Strikethrough, percent off, fixed promo price, flash sale | D3 | H06–H07, X07–X08 | `PricePromotion` in `domain/pricing.ts` | Simulated |
| Order voucher and shipping voucher, stacking, flash-sale exclusion | D3 | P01, P06 | `computeTotals`. Reference total Rp587.250. HEMAT50 rejection | Simulated |
| Equal-price tie keeps the already-active promotion | P12, owner-reversible | P06 | `bestUnitPrice` | Simulated default. See OD-12 |
| Bundles and buy-X-get-Y | D3 kinds; P6; R6 | P02 | `GiftPromotion` (B2G1-SERUM) and bundle components sharing A04 stock | Simulated for these two shapes, not a general rule editor |
| Coupon usage limits, per-customer limits, exclusivity beyond D3 | Not decided | — | Not in the promotion type | Missing. A1 must ask before adding them |
| Refund allocation of discounts | Not specified | X03 records a refund amount | Refund is an integer amount, not a per-line allocation | Missing. See OD-03 |

## 4. Cart, checkout, inventory, orders

| Requirement | Approved source | Design | Prototype | Coverage |
|---|---|---|---|---|
| Cart drawer and cart page, stock and price warnings | — | W05, H06 | `pages/CartPage.tsx`, `store/shop.ts` | Simulated |
| Three checkout steps; order created only on "Buat pesanan" after re-check | I3, I4, L1 | Flow-Checkout, H06–H07, P01 | `pages/Checkout.tsx`, mock `create` | Simulated in the browser |
| Reserve at creation, including gifts; release on expiry; commit on payment | D6, R6 | States board, H07 | `domain/stock.ts`, `domain/orders.ts` | Simulated. No row locks, no concurrent test. Concurrency is an A3/A6 topic |
| Payment windows 15 min / 24 h | D6, P2 | H07 | `paymentExpiry` | Simulated |
| Separate payment and fulfilment states | States board (USER_FLOWS) | Board 17, X03 | `PaymentStatus` and `FulfilmentStatus` in `domain/types.ts` | Simulated |
| Customer cancel, failed payment stays pending until expiry | USER_FLOWS checkout errors | H07, H20 | Failed payment can return to pending (`PAYMENT_NEXT`) | Partial. No payment status named "cancelled" |
| Delivery exception "Gagal kirim" | USER_FLOWS status model | Board 17 | No fulfilment value for it. Overdue is a 72 h display flag (`isCourierOverdue`) | Designed as a side state, not encoded. See OD-10 |
| Returns and refund after shipment | P10 | Not designed | Refund blocked once shipped in the mock admin | Out of scope until the owner approves a flow |
| Refund by Owner/Admin, amount ≤ remaining | I8 | X03, P05 | Mock admin | Simulated |
| Order number format | I9 | W00 | `orderNumber` | Simulated |
| Low-stock threshold 10 | MOCK_DATA_CONTRACT | W10, X06 | Display rule in fixtures | Partial. No alert pipeline |
| One stock location | Working assumption 2 | X06 | `onHand` and `reserved` on the variant | Simulated. Multi-warehouse is Future |
| Idempotency-Key on create | API_CONTRACTS draft | — | Not enforced in the mock | Specified only |

## 5. Shipping and payment

| Requirement | Approved source | Design | Prototype | Coverage |
|---|---|---|---|---|
| Destination, courier options, fee, ETA, unavailable service | D13 for the address; P4 simplifies rates | W06, H06 | `ShippingService.quote`. Same rates for every address. Kurir D returns no service | Partial |
| Quote invalidated by address, items, or quantity; quote expiry 30 min | USER_FLOWS shipment model | W06 | Not a stored quote with expiry | Designed |
| Tracking inside the account; 72 h overdue flag | I7 | H13, P04 | `pages/Account.tsx` | Simulated |
| Provider-neutral shipping. Candidates named, none selected | HANDOFF step 5; X12 A19 | A19 labelled simulasi | Fictional Kurir A–D | Missing integration. Provider choice is A4 |
| Simulated QRIS, VA, e-wallet; pending, paid, failed, expired | D6 | H07, P01 | `PaymentGateway.simulate` | Simulated. Labelled as a prototype panel |
| Authoritative status only from a verified webhook | SECURITY_CHECKLIST P-1; HANDOFF rule 5 | X12 A20 | Browser simulator is the only source | Missing. Required before any real payment |
| Provider choice Midtrans and/or Duitku | Not decided | A20 names both as future | No SDK, no secrets in the repo (C10) | Missing. A4 |
| Cards, refunds via the provider API | Not in the prototype method list | "future" disabled option on W08 | Refunds are admin records (I8), not provider refunds | Missing. Do not assume provider support |

## 6. Identity, profile, consent, admin access

| Requirement | Approved source | Design | Prototype | Coverage |
|---|---|---|---|---|
| Email and password sign-in, generic error, 5 failures / 15 min | P7, mirrors C9 | H08, P02 | `domain/auth.ts` | Simulated. Passwords are not hashed (A-1) |
| Google sign-in for customers | DESIGN_SCOPE | H08 | `signInWithGoogle()` returns a demo session. No state, no PKCE | Designed. Mock only |
| Account recovery | S13, S14 | H15 | No route | Designed |
| Registration | S12 | H08 | No route | Designed |
| Open-redirect guard | R4, A-6 | — | `safeNext` | Simulated |
| Profile: name, email, WhatsApp, date of birth | Prompt §4.10. D16 is format-only for WhatsApp. Date of birth is not in D13 or `types.ts` | H14 | Account pages for addresses, wishlist, preferences. Profile edit is not a route | Partial. Date of birth was not approved as a required field. A1 treats it as optional until the owner says otherwise |
| Address book | D13 | H14, W06 | `Address` type lacks province, district, kelurahan, and note. Address form is not interactive (K-4) | Designed. Schema gap OD-08 |
| Consent, customer-owned, CS read-only | C4, C11 | H14, X10, X12 A21 | Mock consent records | Simulated in memory |
| Staff roles Owner, Admin, Operasional, Marketing, CS | D10, C8 | X12 matrix | `domain/rbac.ts` | Partial. See §8 |
| Staff TOTP, no Google, no self-service reset | C9, R10 | X12 A23 | Any 6-digit code is accepted | UI only |
| Contact masking and 60 s reveal | C2 | X10, P05 | Mock admin. Reasons: konfirmasi pengiriman, tindak lanjut tiket, verifikasi refund | Simulated |
| Append-only audit | HANDOFF rule 9 | X12 A22 | `AdminAudit` has no mutation | Simulated in memory |
| Least privilege on every future endpoint | C8, Z-1 | X12 | UI hides actions the role cannot perform | Prototype only |

Prompt §14 suggested Super Admin, Store Manager, Content Editor, and Customer Service. Those names are not used. The approved set is the one in the table above (OD-02).

## 7. CMS, SEO, analytics

| Requirement | Approved source | Design | Prototype | Coverage |
|---|---|---|---|---|
| Structured block editor, draft / scheduled / published | USER_FLOWS CMS | Board 16, X09 | No content route, no block schema in `src/domain` | Designed |
| Blog, campaign, collection, FAQ, policies | DESIGN_SCOPE supporting | H16–H19 | Copy exists on boards. No routes. Legal text is `[isi oleh pemilik]` | Designed |
| Metadata, canonical, sitemap, robots, structured data, Open Graph, slugs | SITEMAP technical note; I1, I2 | A12 SEO panel on X05 and X09 | Flat `/produk/{slug}` in the SPA. Hash URLs. No sitemap generator | Designed. SEO rendering is an A2 decision |
| Unsafe HTML from CMS | SECURITY_CHECKLIST W-2 | — | No `dangerouslySetInnerHTML` in `src/` | Constraint recorded. CMS storage format is A3 |
| Metrics M1–M8 | D12, C6, C7, ANALYTICS_METRICS | X01, X11 | `computeMetrics`. Unit test expects the W00 figures | Simulated on seed data. Sessions are the constant 1.240, not GA4 |
| Campaign attribution, last touch ≤ 7 days | D12, M8 | X11 | Not implemented beyond the written rule | Specified only |
| No personal data in analytics | Working assumption 7, D-1 | X11 badge "Sesi = angka mock" | No analytics SDK | Constraint recorded |

## 8. Access matrix: board versus code

Board X12, frame A17, caption "Matriks akses (usulan, turunan D10)". C8 says this matrix is the rule. Letters: U = change, L = view, Samar = masked contact, — = no access.

| Module on X12 | Owner | Admin | Operasional | Marketing | CS | Encoded in `rbac.ts` |
|---|---|---|---|---|---|---|
| Dasbor & analitik | L | L | L | L | — | Yes (`dashboard.view`, `analytics.view`) |
| Pesanan | U | U | U | — | L | Yes (`orders.view`, `orders.fulfil`). CS has view only |
| Refund | U | U | — | — | — | Yes (`orders.refund`) |
| Kontak pelanggan | Penuh | Penuh | Samar | — | Samar | Yes (`customers.contact.full` / `.reveal`) |
| Produk & inventaris | U | U | U | L | L | No permission names |
| Promosi & konten | U | U | — | U | — | Promotions yes. Content has no permission |
| Laporan / ekspor | U | U | — | — | — | Yes (`reports.export`) |
| Pengaturan | U | U | Pengiriman only | — | — | No settings permissions |
| Pengguna & log audit | U | L (log) | — | — | — | Yes (`users.manage` on Owner only, `audit.view` on Owner and Admin) |

A1 will add the missing permission names so the catalogue matches the board. The prototype only ships screens for dashboard, orders, promotions, and audit, which is why the code matrix is smaller. That is a gap, not a decision to drop product, inventory, or CMS rights (OD-07).

Path labels that disagree, to be settled in A1 by preferring the sitemap unless a later board is more specific:

| Screen | SITEMAP.md | X12 header |
|---|---|---|
| Users and roles | `/admin/settings/users` | `/admin/users` |
| Payments | `/admin/settings/payments` | `/admin/settings/payment` |

## 9. W00 numeric anchors

These numbers are the contract for later tests. They are demonstration data, not performance claims.

| Check | Value | Where it is defined |
|---|---|---|
| Reference checkout | Rp587.250 | MOCK_DATA_CONTRACT, ORD-261020-0010 |
| M1 net revenue, 14–20 Oct | Rp2.097.000 | ANALYTICS_METRICS, `admin.test.ts` |
| M2 paid orders | 8 | Same |
| M3 AOV | Rp262.125 | 2.097.000 ÷ 8, floored |
| M4 conversion | 0,65% | 8 ÷ 1.240 mock sessions |
| M5 refunds | Rp237.000 | ORD-261019-0008 on 19 Oct |
| M6 payment completion | 88,9% | 8 ÷ 9 (paid + expired) |
| M7 repeat buyers | 2 of 6 | C-0002 and C-0003, all-time (C7) |
| Dashboard after the admin e2e refunds 0007 | Rp1.880.000 | `e2e/admin.mjs`. Seed net minus Rp217.000. Not a second formula |

## 10. Known issues that remain requirements

| ID | Effect on this map |
|---|---|
| K-1 | React Router 6 moderate advisory. R13 asks for v7. A2 decides the upgrade, not a redesign |
| K-2 | Dev-server advisories in Vite 5, Vitest 2, PostCSS. Not in the client bundle. A6 puts the upgrade in the toolchain tasks |
| K-3 | Access control in the browser. Every "Simulated" security row above must be re-specified as a server rule |
| K-4 | Designed screens listed in the audit §4 have no route. They stay in scope as Designed |
| K-5 | Manual screen-reader pass not done. WCAG 2.2 AA remains a requirement. Axe on 19 screens reported 0 serious/critical in the M8 log |
| K-6 | Board pixels were not verified by Agent 01 and were not re-rendered in this audit |
| K-7 | Google Fonts in the prototype. Self-hosting is an open owner choice (OD-14) |
| K-8 | No Core Web Vitals measurement. Bundle noted as 315 kB JS (96 kB gzip) without code splitting. A5 may propose a target and a way to measure it |
| K-9 | Admin seed omits ORD-261020-0010 until the storefront creates it (R8). Expected |
