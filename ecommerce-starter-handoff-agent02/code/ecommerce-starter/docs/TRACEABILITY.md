# TRACEABILITY — decision → design → code → test

Design boards are on the Claude Design canvas. Code paths are relative to `ecommerce-starter/src`. Tests: `domain/*.test.ts` (Vitest) and `e2e/*.mjs` (Playwright + axe).

| Decision | Design boards | Code | Tests |
|---|---|---|---|
| D2 compare ≤ 4, same category | W12 (L3), H10, P03 | `domain/compare.ts`, `pages/ComparePage.tsx` | batch2 › compare · smoke D2, P03-3 · qa overflow |
| D3 promotion stacking | Decisions, H06–H07, X07–X08, P01, P06 | `domain/pricing.ts` | domain › vouchers, price promotions · smoke T1–T4 · admin P06 |
| D4 integer Rupiah, floor per unit | W00, DS-Tokens | `domain/money.ts` | domain › money |
| D5 prices include PPN | H04–H07 | Summary, product copy | visual (e2e text) |
| D6 reservation & payment windows | States, H07, P01 | `domain/stock.ts`, `domain/orders.ts`, `services/mock/backend.ts` | domain › stock, orders · smoke T6 |
| D7 guest cart merge | Journeys, P02 | `domain/cart.ts`, `store/shop.ts` | batch2 › cart merge · smoke D7 |
| D9 24 per page / load more | W03 | `pages/Catalog.tsx` | — (8 products in demo) |
| D10 / C8 roles and access | IA-Admin, X12 (A17) | `domain/rbac.ts`, `admin/AdminShell.tsx` | admin.test › access matrix · admin e2e (CS, Marketing, Operasional) |
| D12 revenue = paid − refunds by date | X01, X11, ANALYTICS_METRICS | `domain/analytics.ts` | admin.test › analytics, refund · admin e2e Rp1.880.000 |
| D13 address fields | H14 | `mocks/fixtures.ts` (data) | — (form not interactive, gap) |
| D14 admin in Bahasa Indonesia | X01–X12 | `admin/*` | e2e copy assertions |
| D15 working names | Brand-A/B | `config/brands.ts` | — (owner action) |
| I1 Indonesian public slugs, English admin paths | IA-Storefront/Admin | `App.tsx` | e2e routes |
| I3 / I4 three steps; order at "Buat pesanan" | Flow-Checkout, H06–H07, P01 | `pages/Checkout.tsx`, `backend.create` | smoke T1 |
| I6 wishlist requires sign-in | P02, H14 | `pages/ProductPage.tsx`, `pages/SignIn.tsx` | smoke I6 |
| I7 tracking in account | H12–H13, P04 | `pages/Account.tsx` | smoke P04-1 |
| I8 refunds by Owner/Admin | X03, P05 | `services/mock/admin.ts` | admin.test › refund · admin e2e |
| I9 order numbers | W00 | `domain/orders.ts` | domain › orders · smoke T1/T6 |
| C2 contact reveal | X10, P05 | `services/mock/admin.ts`, `admin/AdminPages.tsx` | admin.test › contact · admin e2e · qa focus trap |
| C4 / C11 consent | H14, X10, X12 (A21) | `services/mock/backend.ts`, `pages/Account.tsx` | batch2 › consent · smoke P04-2 |
| C9 / P7 lockout, TOTP | X12 (A23), P02 | `domain/auth.ts`, `admin/AdminShell.tsx` | batch2 › throttling · smoke P7 · admin TOTP |
| P6 bundle shares stock | P02 | `domain/stock.ts` | domain › P02-3 |
| P8 search | H09, P03 | `domain/search.ts`, `pages/SearchPage.tsx` | domain › search · smoke P03-1/-4 |
| P9 admin clock | P05 | `services/mock/admin.ts` | admin.test, admin e2e 10:20/10:22 |
| P10 no refund after shipment | P05 | `services/mock/admin.ts` | admin.test › P10 |
| P11 tracking format | P05 | `MockAdmin.validateTracking` | admin.test, admin e2e |
| P12 tie keeps active promo; review before schedule | P06 | `domain/pricing.ts`, `services/mock/admin.ts` | domain › tie · admin.test › scheduling |
| A-6 open-redirect guard | — (security) | `domain/auth.ts safeNext` | batch2 › open-redirect |
| G-1/G-2 release gate | — (security) | `vite.config.ts` | manual: `npm run build:client` fails as designed |
| WCAG 2.2 AA | DS-Components, H20–H21 | `components/Dialog.tsx`, focus styles, labels | axe in smoke/admin/qa · qa keyboard trap |
