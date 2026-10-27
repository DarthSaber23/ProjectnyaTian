# E-Commerce Starter (Indonesia, B2C) — React prototype

Prototype from Agent 01, milestone M7. Mock services only: **no real payments, shipping, accounts, or personal data.**

| Item | Value |
|---|---|
| Stack | Vite 5 · React 18 · TypeScript 5 (strict) · Tailwind CSS 3 · React Router 6 · Zustand 4 · Vitest 2 · Playwright + axe-core (e2e) |
| Market | Indonesia · Bahasa Indonesia UI · IDR (integer Rupiah) · Asia/Jakarta (WIB) |
| Brands | `sambung` (computer accessories) and `halimun` (skincare). Working names, not trademark-screened. |
| Status | M0–M8 approved 21 Oct 2026 · handed off to Agent 02 (start with docs/HANDOFF_AGENT02.md) |

## Run

```bash
npm ci
cp .env.example .env          # choose VITE_BRAND; set VITE_DEMO_TOOLS=false for a client deployment
npm run dev                   # http://localhost:5173
npm test                      # domain unit tests (Vitest)
npm run build                 # prototype build → dist/ (still contains mock services)
npm run build:client          # release gate: FAILS until demo tools are off and mock services are replaced
npm run e2e                   # single-file build + storefront, admin and QA (responsive, keyboard, axe) checks
```

## Structure

```
src/
  domain/        Pure business rules, no React: money, pricing (D3/D4), stock (D6), orders (I9, state machine), search, time (WIB)
  mocks/         Deterministic W00 dataset (fixtures.ts) — fictional people, addresses, couriers, banks
  services/      contracts.ts = seams for Agent 02; mock/backend.ts = in-memory implementation
  store/         Zustand client state (cart, vouchers, checkout choices) + derived hooks
  config/        Brand tokens and feature flags (one brand per fork)
  components/    Layout, UI primitives, product card, order summary
  pages/         Route screens (Indonesian slugs, I1)
e2e/smoke.mjs    Playwright flow + axe scan (WCAG 2.0/2.1/2.2 A/AA tags)
```

## Rules implemented (traceable to docs/ASSUMPTIONS_AND_DECISIONS.md)

| Rule | Where | Test |
|---|---|---|
| D3 promotion stacking: one price promo (lowest wins), one order voucher, one shipping voucher, flash-sale items excluded from order vouchers | `domain/pricing.ts` | `domain.test.ts` › vouchers, price promotions |
| D4 integer Rupiah, floor per unit, `Rp1.250.000` format | `domain/money.ts` | money |
| D5 prices include PPN | display copy | — |
| D6 stock reserved at order creation; QRIS/e-wallet 15 min, VA 24 h | `domain/stock.ts`, `domain/orders.ts`, `services/mock/backend.ts` | stock, orders, e2e T6 |
| I3/I4 three-step checkout; order created at "Buat pesanan" with stock re-check | `pages/Checkout.tsx`, `backend.create` | e2e T1 |
| I9 `ORD-YYMMDD-NNNN` in WIB | `domain/orders.ts` | orders |
| P6 bundle shares component stock | `domain/stock.ts` | stock › P02-3 |
| P12 equal price keeps the already-active promotion | `domain/pricing.ts` | price promotions › tie |
| D2 compare max 4, same category; missing specs shown as "Tidak dicantumkan" | `domain/compare.ts` | batch2 › compare, e2e |
| D7 guest cart merges on sign-in, capped by stock and reported | `domain/cart.ts`, `store/shop.ts` | batch2 › cart merge, e2e |
| I6 wishlist requires sign-in; I7 tracking in account; no guest checkout | `pages/Account.tsx`, `pages/Checkout.tsx` | e2e |
| P7 5 failed sign-ins → 15 min lock; message does not reveal which field was wrong | `domain/auth.ts` | batch2 › throttling, e2e |
| P8 search synonyms + length tokens | `domain/search.ts` | domain › search, e2e |
| Consent changes stored with time and source | `services/mock/backend.ts` | batch2 › consent, e2e |
| B2G1 gift units are reserved with the order | `services/mock/backend.ts` | batch2 › gift reserved |

## Admin (`/admin`, English paths per I1, Indonesian UI per D14)

Demo staff (fictional): Andi S. (Owner), Dewi O. (Operasional), Rina M. (Marketing), Akun CS demo. Password `demo-staff-2026`. Against the real API the 6-digit code must come from an authenticator app: run `npm run totp:setup` in `server/` and add the printed key to Google Authenticator or Authy. "Any 6-digit code" only ever applied to the old in-browser mock.

Sessions are HttpOnly cookies set by the API (`tian_session` for customers, `tian_staff` for staff), so a page reload keeps you signed in for up to 7 days.

| Rule | Where | Test |
|---|---|---|
| C8 access matrix (least privilege; menu shows only permitted modules) | `domain/rbac.ts`, `admin/AdminShell.tsx` | admin.test › access matrix, e2e |
| C2 contact reveal: reason required, 60 s, logged; Owner/Admin see full contact | `services/mock/admin.ts` | admin.test › contact, e2e |
| I8 refunds by Owner/Admin; amount ≤ remaining; full refund cancels + optional restock; refund counts on its own date (D12) | `services/mock/admin.ts`, `domain/analytics.ts` | admin.test › refund, e2e |
| P10 refund after shipment blocked (returns out of scope) | `services/mock/admin.ts` | admin.test |
| P11 tracking number 8–30 A–Z/0–9/hyphen | `MockAdmin.validateTracking` | admin.test, e2e |
| P12 promotion scheduling needs review + future start; tie keeps active promo | `services/mock/admin.ts`, `domain/pricing.ts` | admin.test, e2e |
| M1–M7 metrics reconcile with W00 (Rp2.097.000 etc.) | `domain/analytics.ts` | admin.test › analytics |
| Append-only audit log with actor/time/action/object | `services/mock/admin.ts` | e2e |

## Security and privacy notes (prototype)

- **Release gate:** `npm run build:client` refuses demo tools and the in-browser mock backend (which contains demo credentials). See docs/SECURITY_CHECKLIST.md.
- React Router 6.30.6 still has moderate advisories fixed only in v7 (docs/QA_REPORT.md K-1); sign-in redirects go through `safeNext`.

- Demo tools (brand switch, reset, test panels, payment simulator) are controlled by `VITE_DEMO_TOOLS`. **Set it to `false` for any client deployment.**
- Payment status in production must come from a signed gateway webhook processed on the server — never from the browser (see `services/contracts.ts`).
- No browser storage is used; state resets on reload.
- Sign-in redirect targets are restricted to internal paths (no open redirect). Order pages return "not found" for orders of another customer.
- The demo credential (`rina@example.com` / `demo-rina-2026`) is fictional and only valid in the mock backend.
- Web fonts load from Google Fonts. For GDPR/UU PDP, client forks should self-host fonts.
- `HashRouter` is used so the prototype works on static hosting. Switch to `BrowserRouter` with server rewrites for SEO-friendly URLs.

## Not production-ready

No authentication, authorisation, CSRF/rate limiting, server-side validation, persistence, or audit storage. These belong to Agent 02's backend.
