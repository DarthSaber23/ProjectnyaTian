# Graphify Architecture Tracking

**Purpose:** Track major architectural changes, module dependencies, and milestones for ProjectnyaTian (Agent 02 backend).

**Updated:** 2026-10-30

---

## What is Graphify?

Graphify is a visual codebase analysis tool that captures:
- **Module dependencies** (what calls what)
- **File organization** (architecture integrity)
- **Constraint tracking** (business rules, concurrency safety)
- **Change history** (what changed and why)
- **Milestone progress** (B0–B9 status)

This file tracks **intentional architectural changes**. The generated `report.json` captures a snapshot after each change.

---

## Architectural Decisions Tracked

### Module Structure (B1)
- ✅ **Frontend:** `web/src/` (Agent 01, read-only, mock services)
- ✅ **Backend API:** `server/src/` (Agent 02, NestJS + Prisma)
- ✅ **Commerce rules:** `server/src/commerce/` (pure logic, ported from web/src/domain)
- ✅ **Database:** `server/prisma/schema.prisma` (Postgres source of truth)
- ⏳ **Authentication:** `server/src/auth/` (password + OAuth + TOTP, pending B4)
- ⏳ **Payment adapter:** `server/src/integrations/payment/` (Midtrans/Duitku, pending B6)
- ⏳ **Shipping adapter:** `server/src/integrations/shipping/` (Biteship/RajaOngkir/KiriminAja, pending B7)
- ⏳ **Notifications:** `server/src/integrations/notifications/` (email/WhatsApp, pending B7)
- ⏳ **Analytics:** `server/src/analytics/` (GA4, pending B7)

### Constraints Preserved (B0)
- ✅ **Money:** Integer Rupiah (reference: Rp587.250, W00 net: Rp2.097.000)
- ✅ **Stock:** Reserved at create, expires per D6, concurrency-safe
- ✅ **Payment:** Webhook-driven only, never browser-authoritative
- ✅ **Consent:** Append-only events, WhatsApp marketing blocked
- ✅ **Audit:** Every admin mutation logged, immutable
- ✅ **PII:** Masked by default, reveal grants timed
- ✅ **RBAC:** Least privilege on every endpoint
- ✅ **Copy:** Bahasa Indonesia (UX), English (code/paths)

### Critical Dependencies
```
Frontend (web/) → API (server/)
  ├── services/contracts.ts → server/src/commerce/
  ├── domain/*.ts (reference) → server/src/commerce/ (port)
  └── mock services → replaced by HTTP clients (B8)

Database (server/prisma/schema.prisma)
  ├── Order state machine
  ├── Payment events (idempotent)
  ├── Shipping tracking
  ├── Stock reservations (atomic)
  ├── Audit log (append-only)
  ├── Consent state
  └── Notification outbox

Payment Flow
  1. Order created (stock reserved)
  2. Payment initiated (simulator token or gateway)
  3. Webhook received (verified, idempotent)
  4. Stock committed
  5. Fulfillment eligible

Shipping Flow
  1. Cart + destination
  2. Provider quote (expires)
  3. Order created + shipped
  4. Tracking webhook (72h overdue alert)
  5. Delivery confirmed
```

---

## Change Log

### 2026-10-30 · Blog articles and the SEO role (item 2)
**What:** Articles per store (`/blog/{slug}`, optional English at `/en/blog/{slug}`) linked both ways with products, written and published directly by the new `seo` role and the Owner. New modules `server/src/content` (ArticleService with version checks, scheduled publishing, slug redirects, Markdown subset shared with web via test vectors, SEO overrides, public reads, seed CLIs) and `server/src/seo` (server-filled `index.html` for crawlers and first load, sitemap, robots). Storefront blog list, article page, "Artikel terkait" and "Dari blog"; admin Blog editor and SEO screen.
**Why:** Owner item 2 (29 Oct). Spec `docs/superpowers/specs/2026-10-29-seo-articles-design.md`, plan `docs/superpowers/plans/2026-10-29-seo-articles.md`.
**Changes:**
- Schema: `Article`, `ArticleText`, `ArticleProduct`, `SlugRedirect`, `SeoOverride` (additive)
- RBAC: role `seo` with `articles.manage`, `seo.edit`, `products.media`; Owner gains both new permissions (server and web)
- nginx: renderer locations with fallback to `index.html`; `/media/articles/`; `sitemap.xml`, `robots.txt`
- `server/.env`: `PUBLIC_BASE_URL`, `SITE_BRAND`, optional `GOOGLE_SITE_VERIFICATION`
- `npm run content:seed` / `content:remove-samples` with `server/seed/content/articles.json`

**Open:** dev deploy and checks (Task 13).

---

### 2026-10-29 · Product photos in MinIO (item 1)
**What:** Real product photos. New module `server/src/media` (upload checks, sharp WebP copies at 480/960/1600 on the shorter side, product lock before every photo read or write, two-phase delete, audit with `actorId`, admin routes behind a guard that runs before Multer, seed and remove CLIs) and `server/seed/media` (three credit-free demo photos with licence records). Storefront `ProductPhoto`/`ProductGallery` replace the drawing inside the same square frame; new admin Produk screens.
**Why:** Owner item 1 (27 Oct). Spec `docs/superpowers/specs/2026-10-27-product-images-design.md`, plan `docs/superpowers/plans/2026-10-28-product-images.md`.
**Changes:**
- Schema: `ProductImage`, `Variant.imageId` (SetNull); catalogue payload gains `images` and `imageId`
- `ObjectStorage` seam with bucket policy `s3:GetObject` on `media/*` only, read back and compared; storage failure never blocks checkout (`/health` reports `degraded`)
- nginx becomes a template (`MINIO_BUCKET`, `MEDIA_UPSTREAM`), `/media/` allowlist, 11 MB body on the upload path only; `api` gets `mem_limit: 1536m`
- RBAC: `products.media` for owner, admin, marketing (server and web)

**Verified:** server 339 tests, web 127 tests, typecheck clean; lock mutation check (each `lockProduct` removed in turn fails the concurrency suite).

**Open:** dev deploy checks (nginx -t on the template, headers, memory peak) in Task 14; orphan-file cleanup deferred (built from the error log); articles (item 2) next.

---

### 2026-10-27 · HTTP caching and compression
**What:** gzip and cache headers for the storefront and API. The in-memory catalogue in the API stays the server-side cache (no Redis on one VPS).
**Why:** Owner question 4. Dev sent nothing compressed and no Cache-Control at all, so browsers could keep a stale index.html after a deploy (blank page) and store personal and admin responses.
**Changes:**
- `web/nginx.conf`: gzip (incl. proxied JSON); `/assets/*` `public, max-age=31536000, immutable`; `index.html` and page URLs `no-cache`
- New `server/src/cache-policy.ts`: catalogue, products, promotions `public, max-age=15, stale-while-revalidate=45`; content pages `public, max-age=300`; everything else `private, no-store`
- `security.interceptor.ts` applies it per request; `api-exception.filter.ts` forces `no-store` on every error

**Verified:** server 131 tests; `nginx -t` on the compose network before restart; live on dev the app script went 300 KB → 92 KB with `immutable`, `index.html` and the catalogue return 304 on repeat, account, admin, error and health responses are `private, no-store`; sign-in check 12/12 and concurrency check 12/12 after deploy.

**Open:** Pages served by nginx carry no security headers (X-Frame-Options etc.). The web build does not run `nginx -t`. New public routes (articles, images) must be added to `cache-policy.ts`. Review gzip of personal JSON (BREACH) when TLS is enabled.

---

### 2026-10-27 · Stock safety: locked order path, expiry sweeper (B5 groundwork)
**What:** Every order and stock change now runs in one locked transaction (order row first, then stock rows in SKU order). Unpaid orders expire on the server and release their reservation.
**Why:** Owner question 5 (concurrent checkout). Reading the code showed duplicate or racing payment webhooks could settle stock twice or cancel a paid order, opposite-order carts could deadlock, unpaid orders held stock forever, bundle payments never touched component stock, and two simultaneous refunds could both pass "≤ remaining".
**Changes:**
- New `server/src/commerce/order-lock.ts`: `lockOrder` (`FOR UPDATE`), `lockStock` / `writeStock` / `changeStock` (bundles expanded, `ORDER BY sku FOR UPDATE`), `LOCKED_TX` (10 s wait, 15 s timeout)
- New `server/src/commerce/reservation-sweeper.ts`: every 60 s expires pending or failed orders 5 min after the D6 window (BR-S9), one catalogue refresh per run
- `order.service.ts`: checkout, payment and courier through the locked path; repeated Idempotency-Key returns the first order; late payment noted for manual refund (BR-S10)
- `admin.service.ts`: refund, process, ship lock the order; "≤ remaining" checked on the locked copy; audit and restock in the same transaction
- `catalog.service.ts`: out-of-order refreshes cannot overwrite newer stock; `refreshAfterWrite` never fails a committed write
- `api-exception.filter.ts`: Prisma P2028/P2034 answer 503 `BUSY`
- `server/scripts/check-concurrency.mjs`: duplicate webhook, last-units race, opposite-order carts against a running API
- `docs/01-requirements/BUSINESS_RULES.md`: BR-S9 to BR-S11

**Verified:** server 121 tests (unit tests reproduce each race with a fake database whose transactions queue and roll back); on dev, first sweep released the 21 Oct test reservations to seed values, `check-concurrency.mjs` 12/12, two simultaneous refunds gave one 201 and one 422 with one audit entry and one restock, sign-in check 12/12.

**Open:** Payment status and expiry still live inside the order JSON; promote them to indexed columns in B2. Lock SQL is exercised only against a real database on dev, not in unit tests. Load testing belongs to B9.

---

### 2026-10-27 · Cookie sessions and staff sign-in fix (B4 groundwork)
**What:** Customer and staff sessions moved from page memory to HttpOnly cookies set by the API. Staff TOTP secret rotated off the public example value.
**Why:** The owner could not sign in on dev. Customers were signed out by every reload or typed URL, staff needed a real authenticator code with no way to get one, and Marketing and CS failed sign-in because the admin loaded data their roles may not see.
**Changes:**
- New `server/src/commerce/session-cookie.ts`: cookie strings (`tian_session` 7 days at `/v1`; `tian_staff` browser-session at `/v1/admin`), cookie-to-bearer mapping, cross-site write check, token stripped from browser responses
- `server/src/main.ts`: middleware rejects cross-site writes (403) and maps the route's cookie to `Authorization`; CORS off unless `CORS_ORIGINS` is set
- `commerce.controller.ts`: sign-in, register and staff sign-in set the cookie; new `GET /v1/auth/session`, `GET /v1/admin/auth/session`, `POST /v1/admin/auth/sign-out`
- `auth.service.ts`: `customerSession` / `staffSession` (null for no session, errors still thrown)
- `security.interceptor.ts` reuses `isHttps`
- `server/scripts/totp-setup.mjs` (`npm run totp:setup`, `-- --rotate`)
- Web: no tokens in page memory (`client.ts` sends `credentials: "include"`); session restore at boot and in the admin shell; guarded routes wait for the check; role-aware `loadStaff`; honest sign-in error; cart saved before sign-out
- E2E `api-smoke.mjs`: reload checks for customer and Owner, CS sign-in, no public TOTP fallback

**Verified:** server 95 tests, web 66 tests, typecheck and builds clean; on dev 43.159.54.222, 12/12 sign-in steps pass (Owner, CS, Marketing, reload, cookie flags), cross-site sign-in 403, old secret 401.

**Open:** Full `api-smoke` fails only because the seeded flash sale ended 22 Oct (reference Rp587.250 needs it). Per-staff TOTP enrolment, staff server-side session length, and revoking an earlier token on re-sign-in belong to B4.

---

### 2026-10-21 · Graphify Init (Agent 02 B0 Complete)
**What:** Initialized Graphify tracking for Agent 02 backend architecture + automated session governance.
**Why:** Need visibility into module dependencies, constraint preservation, milestone progress, and prevent secret commits.
**Changes:**
- Created `.graphify/config.json` (11 modules, 10 milestones, 10 constraints)
- Created `.graphify/GRAPHIFY.md` (change tracking, this file)
- Created `.graphify/report.json` (initial snapshot: 248 source files, 4 modules with tests)
- Created `scripts/graphify-sync.js` (generate architecture snapshots)
- Created `scripts/graphify-check.js` (verify health before sessions)
- Created `GRAPHIFY_SETUP.md` (configuration guide)
- Created `CLAUDE.md` (session context for Agent 02)
- Created `.claude/settings.json` (Claude Code project config)
- Created `.claude/memory/` (project context + work patterns for multi-session continuity)
- Created root `package.json` (npm scripts for graphify, dev, test, build)
- Verified `.gitignore` properly ignores `.env` files

**Architecture Snapshot:**
- 11 modules: frontend, backend-api, commerce-rules, database, auth, payment-adapter, shipping-adapter, notifications, analytics, documentation, deployment
- 248 source files (mostly from Agent 01 prototype in ecommerce-starter/)
- 4 modules with tests (36.4% coverage)
- B0 done, B1–B3 in progress, B4–B9 pending
- 10 constraints tracked and verified

**Impact:** 
- Team can check graphify health at session start (`npm run graphify:check`)
- No secrets can accidentally be committed (graphify warns)
- Every code change is traceable (GRAPHIFY.md + report.json)
- Architecture decisions documented before implementation
- Milestones transparent (who owns what, what's blocked)

**Session Protocol Ready:**
1. `npm run graphify:check` (verify health, warn if stale/secrets)
2. Read `CLAUDE.md` (this session's context)
3. Read active milestone plan
4. Code
5. `npm run graphify:sync` after commit

**Blocks:** None. B0 complete. B1–B3 in progress. First graphify snapshot captured and committed.

---

## Next Milestones (With Graphify Tracking)

### B1 — Architecture & API Spec
**Track:** OpenAPI 3.1 endpoint count, error schema definitions, provider contract scope.

### B2 — Data Model
**Track:** Prisma table count, foreign key relationships, index strategy, constraint coverage.
**Key:** Verify `W00` seed reproduces Rp2.097.000 / 8 / Rp262.125 / 88.9%.

### B3 — Domain Port
**Track:** Commerce rule functions (from web/ → server/), unit test coverage, reference number validation.
**Key:** Verify reference checkout = Rp587.250.

### B4 — Identity, Access, Audit
**Track:** Auth provider implementations, RBAC endpoint coverage, audit log table mutations.
**New modules:** `auth/`, security interceptor.

### B5 — Commerce Core
**Track:** Cart merge logic, wishlist endpoints, address validation, order creation flow.

### B6 — Payments
**Track:** Payment gateway adapter, webhook signature verification, reconciliation report.
**New modules:** `integrations/payment/`.

### B7 — Shipping, Notifications, Analytics
**Track:** Courier quote logic, tracking webhook parsing, consent-aware send, GA4 event schema.
**New modules:** `integrations/shipping/`, `integrations/notifications/`, `analytics/`.

### B8 — Frontend Integration
**Track:** HTTP client call count (replacing mocks), React Router v7 readiness.
**Key:** `npm run build:client` must pass (no mocks, no demo tools).

### B9 — Security, QA & Deployment
**Track:** Threat model coverage, security test count, load test results, VPS deployment recipe.

---

## How to Update Graphify

### Before Each Commit
```bash
# Generate snapshot of current state
npm run graphify:sync

# Review changes
git diff .graphify/report.json

# Document your change (append to CHANGE LOG section above)
# Format: Date · Milestone · What · Why · Changes · Impact · Blocks
```

### When Architecture Changes
1. **Update config.json** if modules/files added or responsibility changed
2. **Run `npm run graphify:sync`** to capture snapshot
3. **Add entry to CHANGE LOG** with: what (changed), why (motivation), changes (list), impact (who affected), blocks (what's now needed)
4. **Verify constraint preservation** (money, stock, payment, consent, RBAC, audit, PII, copy)

### When Milestones Complete
1. Update milestone status in `config.json`
2. Note completion date
3. Summarize deliverables in CHANGE LOG

---

## Verification Commands

```bash
# Check if graphify is outdated (before session)
npm run graphify:check

# Generate current snapshot
npm run graphify:sync

# View last change
git log --oneline .graphify/

# Diff current state vs last commit
git diff .graphify/report.json

# Review full architecture
cat .graphify/config.json | jq .modules

# List all constraints
cat .graphify/config.json | jq .constraints
```

---

## Integration with Claude Code

### Session Start Hook
```bash
npm run graphify:check
# Warns if graphify is stale (> 7 days old or before major milestone)
```

### Commit Hook
```bash
npm run graphify:sync
# Syncs report.json if architecture files changed
```

### Major Milestone Completion
```bash
git tag -a B3-complete -m "Domain rules ported, reference numbers validated"
npm run graphify:sync
```

---

## References

- **Config:** `.graphify/config.json` (module definitions, constraints, milestones)
- **Report:** `.graphify/report.json` (generated snapshot, do not edit)
- **Change log:** `.graphify/GRAPHIFY.md` (this file, manual updates)
- **Architecture:** `Prompt.md` (non-negotiable rules), `CLAUDE.md` (this session's context)

---

**Last Synced:** 2026-10-21  
**Status:** B0 complete, B1–B3 in progress  
**Next Check:** Before B4 (Identity & access)
