# PROJECT_BRIEF — Modular E-Commerce Starter (Agent 01)

| Field | Value |
|---|---|
| Document version | 1.0 (M0 approved 20 Oct 2026) |
| Design tool of record | Claude Design canvas "Agent 01 — E-Commerce Starter" (decision D1) |
| Market | Indonesia only · Bahasa Indonesia · IDR · demo timezone Asia/Jakarta (UTC+7) |
| Audience | B2C (business-to-consumer); B2B (business-to-business) only via an inquiry form |

## 1. What we are building
A reusable e-commerce starter template. Each client gets an independent copy (fork) of the code, customises it freely, and deploys it to their own VPS (virtual private server). It is **not** a multi-tenant SaaS (software-as-a-service) product.

Agent 01 designs and validates the UI/UX (user interface / user experience) first, then builds an interactive React + TypeScript + Tailwind CSS prototype on mock services.

## 2. Product goals (from the master prompt)
1. Independent online brand identity
2. Less dependence on marketplaces
3. Direct B2C sales
4. Smooth discovery and checkout
5. Search engine visibility
6. Promotions and personalised offers
7. Privacy-aware customer data collection
8. Repeat purchases and retention
9. Admin tools for daily commerce operations
10. Clear seams for future backend integration

No quantitative KPI (key performance indicator) targets are set. Measurement definitions only (see ASSUMPTIONS_AND_DECISIONS.md, D12).

## 3. Showcase brands
| Codename | Industry | Character |
|---|---|---|
| Brand A | Healthy cosmetics / skincare | Editorial, concern-led, benefits and ingredients, bundles |
| Brand B | Computer accessories | Catalog-first, technical specs, connector shortcuts, comparison |

Real brand names are proposed at M3 and must be trademark-screened by the owner before use (D15).

## 4. Out of scope for Agent 01
Production backend (NestJS services, database schemas, migrations), real payment gateways (Midtrans, Duitku), real shipping providers (Biteship, RajaOngkir/Komerce, KiriminAja), real Google OAuth, production credentials and security guarantees, VPS provisioning, real GA4 (Google Analytics 4) integration, production stock-reservation algorithm (Agent 02).

## 5. Milestones
| ID | Milestone | Status |
|---|---|---|
| M0 | Scope & design brief | Approved 20 Oct 2026 |
| M1 | Information architecture | Approved 20 Oct 2026 (CMS flow and state models added with M2) |
| M2 | Wireframes | Approved 20 Oct 2026, conditional on gap fixes (delivered) |
| M3 | Visual direction & design system | Approved 20 Oct 2026 (T1–T6; working names unscreened) |
| M4 | High-fidelity storefront | Approved 20 Oct 2026 (H01–H21) |
| M5 | Admin & CMS | Approved 20 Oct 2026 (X01–X12; C1–C11 adopted as proposed, C7–C9 owner-reversible) |
| M6 | Clickable prototype (Claude Design) | Approved 20 Oct 2026 (P01–P06; P10 / P12 open for owner) |
| M7 | React prototype | Approved 20 Oct 2026 (reply "Continue") |
| M8 | QA & handoff | Approved 21 Oct 2026 — handed off to Agent 02 (46 unit + 216 e2e/a11y checks) |
