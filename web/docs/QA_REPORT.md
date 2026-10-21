# QA_REPORT — M8 final quality report

| Field | Value |
|---|---|
| Date | 20 Oct 2026 (WIB) |
| Build | `ecommerce-starter` v0.8.0, commit = delivered zip `ecommerce-starter-m8.zip` |
| Environment | Node 22, Chromium (Playwright 1.56), axe-core 4.10; web fonts blocked in the test sandbox (fallback fonts in screenshots) |
| Data | W00 mock dataset only; no real personal data |

## 1. Results

| Suite | Scope | Result |
|---|---|---|
| Unit (Vitest) | Money, pricing, vouchers, promotions, stock, orders, search, cart merge, lockout, open-redirect guard, compare, analytics, access matrix, admin actions | **46 / 46 pass** |
| E2E storefront (`e2e/smoke.mjs`) | 390 px + 1440 px: T1–T7, I6, D7, P7, search, compare, account, consent, Halimun B2G1 | **69 / 69 pass** |
| E2E admin (`e2e/admin.mjs`) | 1440 px + 390 px: login + TOTP, dashboard figures, process/ship, resi validation, contact reveal, refund rules, D12, audit, promotions, CS/Marketing restrictions | **75 / 75 pass** |
| QA (`e2e/qa.mjs`) | No horizontal scroll at 360/768/1280 px on 21 routes; dialog focus trap, Escape, focus return; keyboard add-to-cart | **72 / 72 pass** |
| Accessibility (axe, WCAG 2.0/2.1/2.2 A+AA tags) | 19 screens across suites (11 storefront, 7 admin, 1 admin after dialog) | **0 serious / critical** |
| Release gate | `npm run build:client` with demo tools on / with mock services | **Fails as designed** |
| Type check | `tsc --strict` | Clean |

## 2. Defects found and fixed in M8

| ID | Defect | Severity | Fix |
|---|---|---|---|
| Q-1 | Account pages scrolled sideways at 360–1280 px (grid items without `min-width: 0`) | Major (WCAG 1.4.10 reflow) | Grid tracks `minmax(0,1fr)`, `min-w-0` |
| Q-2 | Admin dashboard/promotions/order detail overflowed at 360–768 px (fieldset `min-inline-size`, grid tracks) | Major | Global `fieldset{min-inline-size:0}`; grid tracks fixed |
| Q-3 | Dialogs did not trap focus or return focus | Major (WCAG 2.4.3) | Shared `components/Dialog.tsx` |
| Q-4 | Sign-in redirect accepted `/\host` (backslash open redirect) | High (security) | `safeNext` rejects backslash and control characters; unit test |
| Q-5 | `react-router-dom` 6.28.0 had a high-severity advisory (open redirect XSS) | High | Upgraded to 6.30.6 |
| Q-6 | Admin reveal expired immediately (clock advanced past expiry) | Major | Clock now shows the latest action time (R9) |
| Q-7 | Free gift units were not reserved | Minor | Fixed in M7 batch 2 (R6) |

## 3. Known issues and residual risks

| ID | Issue | Severity | Owner / next step |
|---|---|---|---|
| K-1 | `react-router` 6.x moderate advisories (backslash open redirect in `<Link>`/`useNavigate`; SSR hydration) — fix only in v7 | Moderate | Agent 02: migrate to React Router 7; app never passes user input to `navigate` except via `safeNext` |
| K-2 | Dev-only tool advisories (Vite 5 / esbuild dev server, Vitest 2, PostCSS selector parser) — not in the shipped bundle | Moderate–critical (dev machines) | Agent 02: upgrade to current Vite/Vitest in CI; never expose the dev server |
| K-3 | All access control and validation run in the browser (mock) | Critical if deployed | Release gate blocks; server enforcement per SECURITY_CHECKLIST |
| K-4 | Address form, registration, password recovery, product/inventory/content/customer admin, settings are static designs only | Medium | Build against H08, H14–H15, X04–X06, X09–X10, X12 |
| K-5 | Manual screen-reader testing (NVDA/VoiceOver) not performed; axe covers ~30–40% of WCAG checks | Medium | Run before launch with real assistive technology |
| K-6 | Visual rendering of Claude Design boards (M2–M6) never screenshot-verified by Agent 01 | Low | Owner review on canvas |
| K-7 | Google Fonts transfer visitor IPs to a third party | Medium (UU PDP / GDPR) | Self-host fonts in client forks |
| K-8 | Performance not measured (Lighthouse/Web Vitals); bundle 315 kB JS (96 kB gzip) without code splitting | Low | Agent 02: route-level code splitting, image pipeline |
| K-9 | Mock order 0010 absent in admin until created in storefront (R8) | Info | Expected |

## 4. Acceptance against the master prompt

| Requirement | Status |
|---|---|
| Milestones M0–M8 with stop-and-approve gates | Met |
| Two distinct showcase brands (skincare, computer accessories) | Met |
| Bahasa Indonesia, IDR, Asia/Jakarta | Met |
| Deterministic, consistent mock data; no fabricated KPIs | Met (W00 reconciles across X01, X10, X11, M7 dashboard) |
| Simulated payment and shipping clearly labelled | Met |
| Least privilege, PII masking, audit | Met in prototype; server enforcement = Agent 02 |
| WCAG 2.2 AA | Automated checks met; manual AT testing open (K-5) |
| Clear seams for backend integration | Met (`services/contracts.ts`, API_CONTRACTS.md, release gate) |
