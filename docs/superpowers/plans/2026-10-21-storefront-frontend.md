# Storefront frontend implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Serve Agent 01's approved Bahasa Indonesia storefront and admin UI from the NestJS API on the dev server, without redesigning screens.

**Architecture:** Copy the prototype from `ecommerce-starter-handoff-agent02/code/ecommerce-starter` into `web/`. Leave that handoff folder unchanged so the design record stays intact. Replace `src/services/mock` imports in the UI with an HTTP client that implements `src/services/contracts.ts`. Nginx serves the Vite build and proxies `/v1` and `/health` to the API container. Domain rules stay in `web/src/domain` for display helpers; prices, stock, and payment status come from the API.

**Tech Stack:** React 18, TypeScript, Tailwind 3, Vite 5, React Router 6 (BrowserRouter in the deployed build), Zustand, Playwright for the storefront smoke path, Docker Compose on the dev server.

## Global Constraints

- Do not redesign Agent 01 layouts, copy, or brand tokens. Halimun and Sambung stay configurable working names.
- Bahasa Indonesia for customer and admin copy. English for code and `/v1` paths.
- Money displayed as `Rp1.250.000`. The reference cart is still Rp587.250 when the flash-sale window applies.
- The browser must not mark an order paid. The payment page shows server status. A simulator control is allowed only when `VITE_DEMO_TOOLS` is not `false`, and it calls `POST /v1/orders/{number}/payment-events` with `X-Simulator-Token`.
- `npm run build:client` must keep failing if any `src/services/mock` import remains or `VITE_DEMO_TOOLS` is not `false`.
- Do not commit `.env` files. The API base URL is `VITE_API_URL` (empty string when nginx proxies `/v1` on the same origin).
- Screens the API cannot serve yet stay on their existing static designs and do not call invented endpoints. Those screens are registration, password recovery, profile edit, CMS, product admin, inventory admin, and Google sign-in.
- Customer demo sign-in remains `rina@example.com` / `demo-rina-2026`. Staff demo sign-in remains `andi@toko.example` / `demo-staff-2026` plus the dev authenticator secret already configured on the server.

## What the API can already do

| UI need | API |
|---|---|
| Catalogue, search query, active price promotions | `GET /v1/catalog`, `GET /v1/promotions/active` |
| Price a cart, courier quotes | `POST /v1/cart/price`, `POST /v1/shipping/quotes` |
| Sign in, merge guest cart, wishlist, addresses | `POST /v1/auth/sign-in`, `POST /v1/me/cart/merge`, wishlist and address routes |
| Create and read orders | `POST /v1/orders` with `Idempotency-Key`, `GET /v1/me/orders` |
| Staff sign-in, metrics, process, ship, refund, masked contact, reveal, audit | `/v1/admin/...` |
| Health | `GET /health` |

There is no `GET /v1/products/{slug}`. The client finds the product in the catalogue response until that route exists.

## File structure

- `web/` — copy of the prototype, then the only frontend we change.
- `web/src/services/http/client.ts` — `fetch` wrapper, bearer token in memory, error shape `{ error: { code, message, details } }`.
- `web/src/services/http/backend.ts` — implements the storefront methods the pages already call on the mock backend.
- `web/src/services/http/admin.ts` — implements the admin methods the admin pages call.
- `web/nginx.conf` and `web/Dockerfile` — static build plus reverse proxy.
- Root `docker-compose.yml` — `api` and `web` on one network. The web container is what port 80 (or 8081) publishes. The API stays on the internal network plus its current 8080 mapping until the proxy is proven.

---

### Task 1: Copy the prototype into `web/`

**Files:**
- Create: `web/` from `ecommerce-starter-handoff-agent02/code/ecommerce-starter`, excluding `node_modules`, `dist`, and `dist-preview`.

**Acceptance:** `web/src/pages/Home.tsx` and `web/src/config/brands.ts` exist. No file under the handoff folder changes. `web` is not the handoff path.

- [x] Copy the source, configs, `e2e/`, and `docs` that the app imports.
- [x] Add `VITE_API_URL` to `web/src/vite-env.d.ts`.

### Task 2: HTTP client and storefront adapter

**Files:**
- Create: `web/src/services/http/client.ts`
- Create: `web/src/services/http/backend.ts`
- Modify: every storefront file that imports `../services/mock` (`store/shop.ts`, `store/hooks.ts`, `pages/*.tsx`, `components/ProductCard.tsx`).
- Test: `web/src/services/http/client.test.ts`

**Interfaces:**
- Consumes: API error JSON and bearer tokens from `POST /v1/auth/sign-in`.
- Produces: an object with the same methods the pages currently use (`getCatalog`, `signIn`, `create` order, `list` orders, `quote`).

**Acceptance:**
- A unit test maps `{ error: { code: "STOCK_SHORTAGE", message, details } }` to a thrown error that still exposes `code` and `details`.
- A unit test sends `Authorization: Bearer` and `Idempotency-Key` on order create.
- With `VITE_API_URL` unset, requests go to a relative `/v1/...` path.
- No storefront page imports `services/mock`.

- [x] Write the failing client test, then the client.
- [x] Point the shop store and pages at the HTTP backend.
- [x] Guest cart merge calls `POST /v1/me/cart/merge` after sign-in instead of only the local `mergeCarts` helper.

### Task 3: Admin adapter

**Files:**
- Create: `web/src/services/http/admin.ts`
- Modify: `web/src/store/admin.ts`, `web/src/admin/AdminPages.tsx`, `web/src/admin/AdminShell.tsx`

**Acceptance:**
- Staff sign-in posts email, password, and the 6-digit code to `POST /v1/admin/auth/sign-in`.
- Dashboard metrics load from `GET /v1/admin/metrics`.
- Process, ship, refund, and contact reveal call the existing admin routes.
- A role error with code `FORBIDDEN` is shown as the API message, not a generic crash.
- Admin files do not import `services/mock`.

### Task 4: Payment page uses server status

**Files:**
- Modify: `web/src/pages/PaymentPage.tsx`

**Acceptance:**
- The page loads the order from `GET /v1/me/orders/{number}`.
- The paid, failed, and expired states render only after that response says so.
- The labelled simulator control is rendered only when `VITE_DEMO_TOOLS` is not `false`, and it sends `X-Simulator-Token` from `VITE_PAYMENT_SIMULATOR_TOKEN`.
- A client build with `VITE_DEMO_TOOLS=false` does not include that control.

### Task 5: Docker and nginx

**Files:**
- Create: `web/Dockerfile`, `web/nginx.conf`, `web/.env.example`
- Create: `docker-compose.yml` at the repo root that builds `server/` and `web/`

**Acceptance:**
- `docker compose build` produces a web image that contains no `services/mock` import (the client build mode is `client`, with `VITE_DEMO_TOOLS=false`).
- Nginx proxies `/v1/` and `/health` to the API service.
- The storefront is served with `BrowserRouter` and `try_files` so `/produk/{slug}` refreshes without a 404.
- Opening the published port shows the Sambung home page in Bahasa Indonesia.

### Task 6: Playwright smoke against the composed stack

**Files:**
- Create: `web/e2e/api-smoke.mjs`
- Modify: `web/package.json` script `e2e:api`

**Acceptance:** Playwright, against the nginx URL, does all of the following:
- Home page shows a product name from the API catalogue.
- Sign in as `rina@example.com` reaches the account area.
- The reference cart (two `B01-2M-BLK`, one `B03`, KABEL10, GRATISONGKIR, Kurir A) shows Rp587.250 while the flash-sale window is active.
- Checkout creates an order number matching `ORD-`.
- The payment page does not show a paid state before a simulator or webhook event.
- One admin sign-in shows net revenue Rp2.097.000 on the dashboard for the W00 range.
- axe on the home page reports 0 serious or critical violations.

The existing prototype `e2e/smoke.mjs` stays runnable against the mock preview build. It is not the release check.

### Task 7: Deploy

**Acceptance:**
- The compose stack is running on the dev server.
- The public web port passes the Playwright smoke in Task 6.
- `.env` files are not in the git commit.
