# HANDOFF_AGENT02 — from prototype to production backend

| Field | Value |
|---|---|
| From | Agent 01 (UI/UX + React prototype, M0–M8) |
| To | Agent 02 (backend, integrations, deployment) |
| Code | `ecommerce-starter/` (Vite 5 · React 18 · TypeScript strict · Tailwind 3 · React Router 6 · Zustand 4) |
| Design source | Claude Design canvas "Agent 01 — E-Commerce Starter" (pages M0–M6) |
| Status | Prototype only. All data fictional. No production security guarantees. |

Companion documents: API_CONTRACTS.md · DATA_MODEL.md · SECURITY_CHECKLIST.md · TRACEABILITY.md · QA_REPORT.md · MOCK_DATA_CONTRACT.md · ANALYTICS_METRICS.md · ASSUMPTIONS_AND_DECISIONS.md.

## 1. Architecture

| Layer | Folder | Rule |
|---|---|---|
| Domain (pure TypeScript, no React, no I/O) | `src/domain` | Business rules. **Port to the backend unchanged or reimplement with the same tests.** The server is the source of truth for prices, stock, orders, permissions. |
| Service contracts | `src/services/contracts.ts` | The only seam the UI uses. Replace implementations, not screens. |
| Mock services | `src/services/mock` | In-browser fakes. **Must not ship**: `npm run build:client` fails while they are imported. |
| Client state | `src/store` | Cart, checkout choices, sessions (memory only). |
| UI | `src/pages`, `src/admin`, `src/components` | Bahasa Indonesia, brand tokens from `src/config/brands.ts`. |

## 2. Steps to production (in order)

| # | Task | Done when |
|---|---|---|
| 1 | Implement the REST API in API_CONTRACTS.md (NestJS) with the data model in DATA_MODEL.md | Contract tests pass |
| 2 | Port `src/domain` rules server-side; run `src/domain/*.test.ts` cases against the server (same inputs → same Rupiah) | Reference checkout = Rp587.250; metrics = Rp2.097.000 on W00 seed |
| 3 | Write HTTP clients implementing `services/contracts.ts`; delete `src/services/mock` imports | `npm run build:client` passes |
| 4 | Payment gateway (Midtrans/Duitku): create charge server-side; status **only** from signed webhook; idempotent handlers | SECURITY_CHECKLIST items P-1…P-5 |
| 5 | Shipping aggregator (Biteship/RajaOngkir/KiriminAja): quotes by origin/destination/weight; tracking webhooks set Dikirim/Diterima | Courier-overdue rule (72 h) uses real events |
| 6 | Auth: customer sessions (HttpOnly, Secure, SameSite cookies), Google OAuth, staff SSO or password + TOTP; rate limiting/lockout (P7, C9) | SECURITY_CHECKLIST A-1…A-8 |
| 7 | Enforce the access matrix server-side (`src/domain/rbac.ts` is the reference) and write-once audit storage | Audit cannot be edited or deleted through any API |
| 8 | Notifications: email always for transactional; WhatsApp transactional only with `waOrderInfo` consent; marketing email only with `emailPromo` consent (C11) | Consent checked at send time, not at queue time |
| 9 | Analytics: GA4 (or equivalent) sessions replace the mock 1.240; no PII in events | M4 conversion uses real sessions |
| 10 | Deployment: switch `HashRouter` → `BrowserRouter` with server rewrites; self-host fonts; set `VITE_DEMO_TOOLS=false`; CSP headers | Lighthouse/axe re-run on the deployed build |

## 3. Rules the backend must keep (do not change without owner approval)

| ID | Rule |
|---|---|
| D3 | One price promotion per item (lowest wins; tie keeps the already-active one, P12); one order voucher + one shipping voucher per order; order vouchers skip flash-sale items unless allowed |
| D4 | Integer Rupiah, percentage discounts floored per unit; display `Rp1.250.000` |
| D5 | Prices include PPN |
| D6 | Reserve stock at order creation (including gift units); QRIS/e-wallet 15 min, VA 24 h; release on expiry; commit on payment |
| D7 | Guest cart merges into the account cart on sign-in, capped by stock, caps reported |
| D12 | Revenue = paid − refunds; paid counts on payment day, refunds on refund day (WIB) |
| I4 | Order created at "Buat pesanan" after stock and price re-check |
| I8 | Refunds recorded by Owner/Admin only; amount ≤ remaining |
| I9 | Order number `ORD-YYMMDD-NNNN`, date in WIB, sequence per store per day |
| C2 | Contact reveal: reason required, visible 60 s, logged |
| P10 | Refund after shipment needs a returns flow (not designed) |

## 4. Open owner decisions (blocking for production, not for handoff)

| ID | Decision needed | Default used in prototype |
|---|---|---|
| D15 | Trademark screening of brand names | "Sambung", "Halimun" working names |
| C7 | Repeat-buyer metric period | All-time |
| C9 / P7 | Lockout policy, admin TOTP, admin password reset | 5 tries / 15 min; TOTP required; reset by Owner |
| P10 | Returns / refund after shipment | Blocked |
| P12 | Equal-price tie rule | Keep already-active promotion |
| C2 | Reveal duration and reason list (DPO review) | 60 s; 3 reasons |
| Legal | Policy texts, business entity, CS hours, WhatsApp CS number | Placeholders `[isi oleh pemilik]` |
| Fonts | Self-host vs Google Fonts (UU PDP/GDPR) | Google Fonts in prototype |
| Usability | Test thresholds (USABILITY_TEST_PLAN.md) | None set |
