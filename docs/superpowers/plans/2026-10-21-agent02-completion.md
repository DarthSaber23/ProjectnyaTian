# Agent 02 completion implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the testable Agent 02 gaps on the existing NestJS API and deploy that image to the dev server without committing secrets.

**Architecture:** Pure rule functions in `server/src/commerce` decide addresses, consent, provider readiness, and contact visibility. Nest controllers persist the results in Postgres. Missing provider keys throw. The dev payment simulator stays behind `PAYMENT_SIMULATOR_TOKEN`.

**Tech Stack:** NestJS 10, Prisma 5, PostgreSQL, Vitest, Docker Compose on the dev server.

## Global Constraints

- Money is integer Rupiah. The reference cart remains Rp587.250.
- W00 metrics remain net Rp2.097.000, 8 paid orders, AOV Rp262.125, payment completion 88.9%.
- Payment status still changes only through the simulator token or a future verified webhook, never from an ordinary browser success page.
- WhatsApp marketing is never sent. Transactional email is always allowed. Transactional WhatsApp requires `waOrderInfo`. Marketing email requires `emailPromo`.
- Do not commit `.env` or `server/.env`.
- Do not invent live provider credentials.
- Customer and admin copy stays Bahasa Indonesia. Code and `/v1` paths stay English.
- Tests run inside the API image (`npm test` during `docker compose build`).

---

### Task 1: Ignore secrets

**Files:**
- Create: `.gitignore`

**Acceptance:** `git check-ignore -v .env` and `git check-ignore -v server/.env` both match. `server/.env.example` is not ignored.

- [ ] Add root ignore rules for `.env`, `**/.env`, `node_modules`, `dist`, and `*.tsbuildinfo`, with exceptions for `**/.env.example`.

### Task 2: Address, consent, provider, and reveal rules

**Files:**
- Create: `server/src/commerce/address.ts`
- Create: `server/src/commerce/address.test.ts`
- Create: `server/src/commerce/notify.ts`
- Create: `server/src/commerce/notify.test.ts`
- Create: `server/src/commerce/providers.ts`
- Create: `server/src/commerce/providers.test.ts`
- Create: `server/src/commerce/privacy.ts`
- Create: `server/src/commerce/privacy.test.ts`

**Interfaces:**
- Produces: `validateAddress`, `maySend`, `assertProviderConfigured`, `visibleContact`

**Acceptance:**
- A valid D13 address passes. Missing province fails. Phone `0812-0000-1234` passes. Phone `123` fails.
- `maySend("whatsapp", "marketing", ...)` is false even when both consents are true.
- `maySend("email", "transactional", ...)` is true when both consents are false.
- `assertProviderConfigured("midtrans", {})` throws mentioning `MIDTRANS_SERVER_KEY`.
- Owner sees full contact. CS sees a mask. CS with a future `until` sees full contact. CS with a past `until` sees a mask.

- [ ] Write the tests, then the functions, and keep them free of I/O.

### Task 3: Persist the new rules and fix reveal

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/commerce/admin.service.ts`
- Modify: `server/src/commerce/commerce.controller.ts`
- Modify: `server/src/commerce/commerce.module.ts`
- Modify: `server/src/main.ts`
- Create: `server/src/security.interceptor.ts`

**Interfaces:**
- Consumes: Task 2 functions
- Produces: `POST /v1/me/cart/merge`, `GET/PUT /v1/me/wishlist/:productId`, `POST /v1/me/addresses`, `POST /v1/notifications`, `GET /v1/admin/audit-log`

**Acceptance:**
- Cart merge uses `mergeCarts` and returns capped lines.
- Address create rejects an invalid body with HTTP 422.
- Notification create writes an outbox row only when `maySend` allows it, and records `provider: "none"`.
- After reveal, `contact` for that staff member returns `full: true` until `until`.
- Audit log requires `audit.view`.
- Responses set `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.

- [ ] Add Prisma models `WishlistItem`, `AddressRecord`, `ConsentState`, `NotificationOutbox`, `RevealGrant`.
- [ ] Wire endpoints and the security interceptor.
- [ ] Store reveal grants and honour them in `contact`.

### Task 4: Review, commit, deploy

**Acceptance:**
- Image build runs the unit tests, including the new ones.
- `GET /health` on the dev server returns `databaseUser` `tian_app` and `storage` `minio`.
- `GET /v1/admin/metrics` for 14–20 Oct 2026 still returns net revenue 2097000.
- The git commit does not contain `.env` or `server/.env`.
