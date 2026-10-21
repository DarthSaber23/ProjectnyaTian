# Functional requirements

| Field | Value |
|---|---|
| Milestone | A1 |
| Status | Proposed |
| Date | 21 Oct 2026 |

Each requirement is testable. **Priority:** P0 viable commerce, P1 full-stack release, P2 later. **Stage:** Simulated (Agent 01 prototype), Implement (Agent 03, server is the authority), Integrate (live provider or channel, after the server contract exists).

Business rules are in [BUSINESS_RULES.md](BUSINESS_RULES.md). Use cases are in [USE_CASES.md](USE_CASES.md).

## Catalogue and discovery

| ID | Title | Priority | Stage | Statement |
|---|---|---|---|---|
| FR-CAT-01 | Category listing | P0 | Simulated → Implement | A visitor can open a category and see products with price, availability, and badges, 24 per page, with sort and filters. An empty filter result is a designed empty state |
| FR-CAT-02 | Product detail | P0 | Simulated → Implement | A visitor can open `/produk/{slug}`, choose a variant, see stock and the current unit price, and add a quantity up to available stock. An unknown slug is a not-found page |
| FR-CAT-03 | Brand composition | P1 | Simulated → Implement | Homepage sections, card density, and filter layout (sidebar or top bar) come from brand configuration. Halimun and Sambung are the reference configurations. Names are configuration, not hard-coded business rules |
| FR-CAT-04 | Comparison | P1 | Simulated → Implement | A visitor can compare up to four products from the same top-level category, hide identical rows, and on a small screen keep the first column pinned |
| FR-SCH-01 | Find a product | P0 | Simulated → Implement | A visitor can search by name, including the W00 USB-C synonyms and a length token such as "2m", and get a no-results state |
| FR-SCH-02 | Search quality | P1 | Implement | Search also matches attributes, tolerates typos per BR-C6, suggests corrections, and ranks name above synonym, category, and attribute. Autocomplete waits for two characters and returns at most six products and three categories |
| FR-SCH-03 | Recommendations | P2 | Designed | Product pages may show a curated or same-category strip. The rule that selected the products is explainable. No learning system is required |

## Cart, checkout, orders

| ID | Title | Priority | Stage | Statement |
|---|---|---|---|---|
| FR-CRT-01 | Guest cart | P0 | Simulated → Implement | A visitor without an account can add, change, and remove lines. Quantity above available stock is refused with the limit |
| FR-CRT-02 | Cart merge | P0 | Simulated → Implement | After sign-in, the guest cart merges into the saved cart per BR-O5, and the customer sees any capped lines |
| FR-CHK-01 | Auth gate | P0 | Simulated → Implement | Choosing checkout while signed out opens sign-in and returns the customer to checkout with the cart intact |
| FR-CHK-02 | Shipping step | P0 | Partial → Implement | The customer chooses a saved address or enters one, then chooses a courier quote. An unavailable service stays visible with the reason. Fixture quotes reproduce Kurir A–D for the W00 lane |
| FR-CHK-03 | Quote invalidation | P1 | Designed → Implement | Changing address, lines, or quantities requires a new quote before the order can be created |
| FR-CHK-04 | Review and voucher | P0 | Simulated → Implement | The customer sees lines, the named promotion, voucher acceptance or the rejection reason, shipping, and the integer total, with the PPN note |
| FR-CHK-05 | Create order | P0 | Simulated → Implement | "Buat pesanan" re-checks stock and price, reserves stock including gifts, and creates `ORD-YYMMDD-NNNN` only if both checks pass. The same idempotency key does not create a second order |
| FR-ORD-01 | Payment window | P0 | Simulated → Implement | The customer can reopen `/pembayaran/{number}` until the order is paid or expired, and can retry a failed attempt inside the window |
| FR-ORD-02 | Order list and tracking | P0 | Simulated → Implement | The signed-in customer sees only their orders, the fulfilment timeline, and the 72-hour overdue flag when it applies |
| FR-ORD-03 | Staff fulfilment | P0 | Simulated → Implement | Operasional, Admin, or Owner can move a paid order to processing and register a tracking number. CS can view and cannot ship. Marketing cannot open orders |
| FR-ORD-04 | Refund record | P1 | Simulated → Implement | Owner or Admin can record a refund up to the remainder, with a reason, before shipment. The payment label becomes refunded or partially refunded. Stock can be returned only when the staff member chooses restock |
| FR-WISH-01 | Wishlist | P1 | Simulated → Implement | A signed-in customer can save and remove a product. A guest is sent to sign-in first |

## Pricing and inventory

| ID | Title | Priority | Stage | Statement |
|---|---|---|---|---|
| FR-PRC-01 | Server price | P0 | Simulated → Implement | The server computes the total from BR-M1, BR-M2, and BR-P1 through BR-P7. The client total is never the one that is stored |
| FR-PRC-02 | Reference checkout | P0 | Simulated → Implement | On the W00 catalogue and clock, the reference cart totals Rp587.250 and HEMAT50 is rejected |
| FR-INV-01 | Reservation lifecycle | P0 | Simulated → Implement | Create reserves, expiry and cancellation release, payment commits, including gift units. Two concurrent checkouts of the last unit produce one success and one shortage |
| FR-INV-02 | Inventory admin | P1 | Designed → Implement | Owner, Admin, and Operasional can adjust on-hand stock with a reason. The adjustment is an append-only movement. Marketing and CS can view |
| FR-INV-03 | Low stock | P1 | Designed → Implement | The dashboard lists SKUs at or below the low-stock threshold |

## Payment and shipping integrations

| ID | Title | Priority | Stage | Statement |
|---|---|---|---|---|
| FR-PAY-01 | Simulated authority | P0 | Implement | A server component, not the browser, moves payment status. The storefront can start a payment and can display status. It cannot mark an order paid |
| FR-PAY-02 | Sandbox gateway | P1 | Integrate | The same payment port can create a charge, read status, and accept a signed webhook from one sandbox provider chosen in A4. Duplicate webhooks do not commit stock twice. The amount on the webhook must match the order |
| FR-PAY-03 | Production gateway | P2 | Integrate | Production keys and go-live are a separate owner decision after sandbox acceptance |
| FR-SHP-01 | Fixture quotes | P0 | Simulated → Implement | The server returns courier, service, estimate text, and integer cost, or an explicit unavailable result |
| FR-SHP-02 | Sandbox aggregator | P1 | Integrate | The same port can quote, create a shipment, and accept tracking webhooks from one provider chosen in A4. "Diterima" still comes only from a courier event |
| FR-SHP-03 | Production aggregator | P2 | Integrate | Production go-live is a separate owner decision |

## Identity, profile, consent

| ID | Title | Priority | Stage | Statement |
|---|---|---|---|---|
| FR-IDN-01 | Password sign-in | P0 | Simulated → Implement | Email and password sign-in follows BR-A1 and BR-A2. Passwords are stored only as a slow hash |
| FR-IDN-02 | Staff sign-in | P0 | Partial → Implement | Staff sign-in follows BR-A3. A six-digit placeholder is not sufficient on the server |
| FR-IDN-03 | Registration | P1 | Designed → Implement | A visitor can create an account with email and password, then continue to the saved redirect. The email is unique |
| FR-IDN-04 | Recovery | P1 | Designed → Implement | A customer can request a reset link and set a new password. Expired links fail. Staff see the Owner-reset message instead of a self-service form |
| FR-IDN-05 | Google sign-in | P1 | Designed → Integrate | A customer can sign in with Google. The server verifies the provider response. Staff cannot |
| FR-CUS-01 | Addresses | P1 | Designed → Implement | The customer can create, edit, delete, and choose a primary address with the D13 fields |
| FR-CUS-02 | Profile | P1 | Designed → Implement | The customer can maintain name, email, and WhatsApp number. Date of birth is not collected |
| FR-CUS-03 | Consent | P1 | Simulated → Implement | The customer can change `emailPromo`, `waOrderInfo`, and personalised recommendations. Each change appends a record with time and source. CS can read and cannot edit |
| FR-CUS-04 | Deletion and export | P1 | Designed → Implement | Owner or Admin can export a customer's personal data and can anonymise it while retaining orders and payments |

## Admin, content, analytics

| ID | Title | Priority | Stage | Statement |
|---|---|---|---|---|
| FR-ADM-01 | Access matrix | P0 | Partial → Implement | Every admin operation checks BR-A4. A missing permission is denied. The P0 slice covers orders, refunds, and sign-in. Remaining modules are P1 and use the same matrix |
| FR-ADM-02 | Catalogue admin | P1 | Designed → Implement | Owner, Admin, and Operasional can create and edit products, variants, categories, and prices. Marketing and CS can view |
| FR-ADM-03 | Promotion admin | P1 | Simulated → Implement | Marketing, Admin, or Owner can draft and schedule a promotion. A schedule in the past is rejected. Overlapping price promotions show a per-day conflict and require an explicit confirmation before scheduling |
| FR-ADM-04 | Customers | P1 | Designed → Implement | Staff with contact rights see the mask or the full record per BR-A6. Reveal without a reason is rejected |
| FR-ADM-05 | Audit | P1 | Simulated → Implement | The audit log can be filtered by time and actor. Owner and Admin can read it. Nobody can edit it |
| FR-ADM-06 | Users and settings | P1 | Designed → Implement | Owner manages staff accounts. Owner and Admin edit store settings. Operasional edits shipping settings only. Gateway secrets are environment configuration and are never returned to the browser |
| FR-CMS-01 | Block editor | P1 | Designed → Implement | Marketing, Admin, or Owner can compose a page from structured blocks, preview it, and move it through draft, scheduled, and published. Publishing stores data that the storefront renders without executing author-supplied HTML |
| FR-CMS-02 | Supporting pages | P1 | Designed → Implement | About, contact, FAQ, blog, campaign, collection, shipping info, and the bulk-inquiry form are manageable pages. Legal pages render owner-supplied text or the placeholder |
| FR-SEO-01 | Crawlable catalogue | P1 | Implement | Product and category URLs are real paths, with a title, description, canonical URL, and structured data. A sitemap lists indexable URLs. Search results, cart, checkout, and account pages are not indexable |
| FR-ANL-01 | Metric report | P1 | Simulated → Implement | The dashboard and analytics screen show BR-N1 through BR-N8 for a WIB range. On the W00 seed and the session fixture they show Rp2.097.000, 8, Rp262.125, 0,65%, and 88,9% payment completion |
| FR-ANL-02 | Report export | P1 | Designed → Implement | Owner and Admin can export a report. The export is audited. It contains no customer contact fields unless the export type is the personal-data export in FR-CUS-04 |
| FR-NTF-01 | Consent at send | P1 | Designed → Implement | Outbound email and WhatsApp follow BR-A7. A queued message is checked again at send time. The provider is replaceable. The vendor is not chosen in this milestone |
| FR-ANL-03 | Session source | P2 | Integrate | Conversion uses real sessions from GA4 or an equivalent, still without personal data. Until that exists, the report labels the denominator as a fixture |

## Explicitly not required

| ID | Title | Priority | Statement |
|---|---|---|---|
| FR-OUT-01 | Returns after shipment | P2 | Not built. Refund after handoff stays blocked |
| FR-OUT-02 | Date of birth | — | Not collected |
| FR-OUT-03 | Promotion usage caps | P2 | Not built beyond BR-P8 |
| FR-OUT-04 | Guest checkout, B2B pricing, multi-warehouse, review submission, public tracking | — | Out of scope per the PRD |
