# Product requirements — modular e-commerce starter

| Field | Value |
|---|---|
| Milestone | A1 Requirements engineering |
| Status | Proposed. Waiting for APPROVE, REVISE, or HOLD |
| Date | 21 Oct 2026 |
| Sources | Approved Agent 01 package (M0–M8), A0 audit approved 21 Oct 2026 |
| Builds on | [../00-handoff/AGENT_01_INPUT_AUDIT.md](../00-handoff/AGENT_01_INPUT_AUDIT.md), [../00-handoff/OPEN_DECISIONS.md](../00-handoff/OPEN_DECISIONS.md) |

## 1. Product

A reusable business-to-consumer storefront for physical goods, cloned once per client and deployed on that client's own server. The first market is Indonesia: Bahasa Indonesia, Indonesian Rupiah, domestic shipping, timezone Asia/Jakarta.

Each client may change branding, homepage composition, navigation, catalogue presentation, content blocks, and selected business settings. The commerce rules in [BUSINESS_RULES.md](BUSINESS_RULES.md) stay intact unless the owner approves a change. Two showcase configurations ship with the template: Halimun (cosmetics, editorial) and Sambung (computer accessories, dense catalogue). Those names are unscreened working names and must stay configurable.

This is not a multi-tenant product. There is no shared customer database, no tenant identifier on domain records, and no central store-management service.

## 2. Users

| User | Need |
|---|---|
| Guest | Browse, search, compare, and fill a cart without an account |
| Customer | Sign in, check out, pay, track an order, manage addresses, wishlist, and communication choices |
| Owner | Full store control, including refunds, staff accounts, and data export |
| Admin | Day-to-day commerce and content, without staff-account administration |
| Operasional | Process and ship orders, adjust stock, see masked customer contact when a reason is given |
| Marketing | Promotions, content, and analytics. No order operations and no customer contact |
| CS | Look up an order and reveal a masked contact for a stated reason. No refunds, no shipping handoff, no customer search by email or phone |

B2B buyers do not get a price list or a quote workflow. They submit an inquiry form that staff handle outside the checkout.

## 3. Outcomes

1. A customer can discover a product, see a deterministic price in Rupiah, and place an order without the store selling stock it does not have.
2. Payment and delivery status shown to the customer match the server record. A browser success page is not proof of payment.
3. Staff can run the store within the access matrix from board X12. Every admin change is attributable.
4. The same codebase can be skinned as Halimun or Sambung, then forked for a later client, without a second architecture.
5. Agent 03 can implement from the requirement IDs in [FUNCTIONAL_REQUIREMENTS.md](FUNCTIONAL_REQUIREMENTS.md) and the acceptance column in [REQUIREMENTS_TRACEABILITY.md](REQUIREMENTS_TRACEABILITY.md) without reinterpreting the prototype.

## 4. Scope by priority

Priority is how necessary the capability is, not how much of it the prototype already fakes.

| Priority | Meaning | Included |
|---|---|---|
| P0 | A viable commerce loop on the server | Catalogue, product page, search good enough to find W00 products, cart, sign-in at checkout, cart merge, priced checkout, order creation with reservation, server-side payment simulation, customer order view, staff order processing, the approved pricing and stock rules |
| P1 | The planned full-stack release | Addresses as specified in D13, wishlist, compare, registration and recovery, Google sign-in, full admin (catalogue, inventory, promotions, customers, CMS, analytics, reports, settings, users), audit, consent-aware notifications, production-shaped search, SEO metadata and crawlable URLs, shipping-quote port with a fixture provider, sandbox payment and shipping adapters |
| P2 | Later, or blocked on an owner decision | Production provider go-live, GA4, self-hosted fonts as a launch task, returns after shipment, redemption caps beyond D3, date of birth, multi-warehouse, review submission, loyalty, public tracking by order number |

P0 includes a **server-side payment simulator** that follows the same states as a future webhook. A live Midtrans or Duitku account is P1 for sandbox and P2 for production go-live. Checkout must already work on fixture shipping rates (the W00 couriers) before a live aggregator is connected.

## 5. What the prototype already demonstrates

The React prototype simulates the P0 loop and parts of P1 in the browser. Those behaviours are the acceptance baseline, not the security boundary. Screens that are designed but not routed (registration, recovery, legal and content pages, admin catalogue, inventory, CMS, customers, settings) remain in scope at the priority in the functional requirements. The gap list is QA_REPORT K-4 and the A0 traceability map.

Numeric baselines the server must reproduce on the W00 seed:

| Check | Value |
|---|---|
| Reference checkout ORD-261020-0010 | Rp587.250 |
| Net revenue 14–20 Oct 2026 (M1) | Rp2.097.000 |
| Paid orders (M2) | 8 |
| Average order value (M3) | Rp262.125 |
| Conversion (M4) | 0,65% on 1.240 mock sessions |
| Payment completion (M6) | 88,9% (8 / 9) |

M4 and M6 stay separate. 88,9% is not conversion.

## 6. Out of scope

- Multi-tenant SaaS and marketplace sync.
- Guest checkout.
- B2B price lists and quotations.
- Refunds after the shipment has been handed to a courier, until a returns flow is approved (P10).
- Collecting date of birth.
- Machine-learning recommendations, loyalty, gift cards, subscriptions, multiple languages or currencies, phone OTP, offline PWA, and public tracking by order number.
- Binding KPI targets or binding latency SLOs. Definitions and proposed measurement methods only.
- Legal text. Policy pages keep the placeholder `[isi oleh pemilik]`.
- Choosing a payment or shipping vendor. That choice is milestone A4.

## 7. Assumptions still reversible

Accepted with A0 and used as the baseline here. A REVISE on this milestone can reopen any of them.

| Topic | Baseline used in these requirements |
|---|---|
| Equal-price promotion tie (P12) | Keep the promotion that is already active |
| Repeat buyers (C7) | All-time, not the selected report period |
| Lockout (C9, P7) | 5 failures, 15 minutes, generic error. Staff need TOTP. Owner resets staff passwords. No Google sign-in for staff |
| Returns (P10) | Not in this release |
| Contact reveal (C2) | Reason required, visible 60 seconds, written to the audit |
| Brand names (D15) | Configurable working names |
| Fonts | Proposed self-hosting is an A5 control, not a copy change |

## 8. Success for this milestone

A1 is complete when the owner accepts the priority split, the business rules, and the traceability matrix, including the items that stay out of scope. Architecture, tables, and API schemas are the next milestones.
