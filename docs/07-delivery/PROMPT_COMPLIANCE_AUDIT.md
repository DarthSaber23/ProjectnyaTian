# Prompt.md compliance audit

Date: 21 Oct 2026. Evidence: local checkout (server 73 tests, web 51 tests, `build:client` gate), the dev server `43.159.54.222` (API probe 24/24, Playwright `api-smoke` pass), and a code read. Status words: **Done** (verified), **Partial**, **Not done**, **Blocked** (needs the owner or an external credential).

## 0. Two prompts in one file

`Prompt.md` holds two different Agent 02 briefs.

| Part | Role | Rule that conflicts |
|---|---|---|
| Lines 1–1787 | Requirements and architecture milestones A0–A7, with an approval stop after each | "Do not start implementation." "Do not start production coding." |
| Lines 1789–1873 | Backend and integrations milestones B0–B9 | Asks for production code |

The repo follows the second brief (a NestJS API exists and is deployed). The first brief's document package is mostly missing (section 5). The owner needs to confirm that the B-brief supersedes the A-brief for implementation, and whether the A-brief documents are still wanted. Until then neither can be called finished without breaking the other.

## 1. Non-negotiable rules (B-brief §3)

| # | Rule | Status | Evidence / gap |
|---|---|---|---|
| 1 | Integer Rupiah, floor per unit, PPN included | Done | Domain port tests pass; reference cart Rp587.250 verified live |
| 2 | Promotion stacking per D3 | Done | `pricing.test.ts`; KABEL10 + GRATISONGKIR in the live smoke test |
| 3 | Stock reserved at create, released on expiry, committed on payment, no overselling | **Partial** | Row lock (`FOR UPDATE`) on reserve and apply. **No timer expires unpaid orders**: expiry runs only when a simulator or webhook event says `expired`, so an abandoned order holds stock indefinitely. **No concurrency test** exists |
| 4 | `ORD-YYMMDD-NNNN`, Idempotency-Key required | Done | Sequence row is locked; missing header returns 422 |
| 5 | Payment status only from a verified webhook | Done (simulated) | Bad signature returns 401; simulator route returns 401 without token; client bundle has no simulator token. Midtrans-shaped webhook only; no real gateway |
| 6 | Revenue = paid − refunds; refund limits; no refund after shipment | Done | Metrics verified live; refund code enforces ≤ remaining and the P10 rule. Refund UI path not covered by an automated test |
| 7 | RBAC on every endpoint | Partial | Staff endpoints verified (CS gets 403 on audit and metrics). No test walks every route |
| 8 | Contact masked, reveal needs a reason, 60 s, logged | Partial | Verified live. **Customer contact comes from the fixture list, not the database**, so customers who register will not appear in the staff view |
| 9 | Append-only audit | Partial | No route edits or deletes audit rows. Nothing at the database level forbids it |
| 10 | Consent events, checked at send time | Partial | Events are append-only and `maySend` is enforced. **Nothing is actually sent**: the outbox is written and no email or WhatsApp adapter exists |
| 11 | 5 failures lock 15 min; staff TOTP; `safeNext` | Done | Lock logic unit-tested; TOTP verified live (wrong code returns 401) |
| 12 | Rp587.250 and W00 Rp2.097.000 / 8 / Rp262.125 / 88,9% | Done | Verified live |
| 13 | Bahasa Indonesia copy, English code | Partial | Spot-checked only; no full copy review |
| 14 | Brand names configurable | Done | `web/src/config/brands.ts` |

## 2. Engineering standards (B-brief §4)

| Standard | Status | Evidence / gap |
|---|---|---|
| Encrypt phone and address at rest | Partial | AES-256-GCM on address `phone` and `detail`. Customer account phone and email are not covered |
| No PII in logs or analytics | Not checked | No log review done |
| UTC storage, WIB display | **Partial** | Timestamps are stored as WIB ISO strings (`toWibIso`), not UTC |
| HttpOnly/Secure/SameSite cookies, CSRF | **Not done** | Sessions are bearer tokens held in browser memory. No cookies, so no CSRF surface, but this departs from the brief |
| Rate limiting | Partial | Sign-in lock only. No general limiter |
| CSP and security headers | Partial | API sends `nosniff`, `DENY`, a strict CSP and HSTS. nginx for the storefront sends none of them. No TLS is installed, so HSTS over http does nothing |
| Dependency pinning | Partial | Exact versions in `package.json`. `server/package-lock.json` did not exist; generated 21 Oct but the Dockerfile still runs `npm install` |
| `npm audit` clean for production | **Not met** | Server: 30 findings (1 critical `fast-xml-parser`, 4 high including `multer` and `path-to-regexp`). Web: 2 moderate, both React Router 6 (fixed in 7) |
| Server-side input validation | Partial | Hand-written checks (address, order). No class-validator or zod DTOs |
| Provider timeouts, backoff, circuit breaker | Not done | No real provider is called yet |
| Tests: ported domain, contract, webhook, concurrency | Partial | Domain, webhook signature, address, notify, providers pass. **No contract tests and no concurrency test** |
| Playwright suites green against the real API | Partial | `api-smoke` passes. `smoke.mjs`, `admin.mjs`, `qa.mjs` target the mock build and were not run against the API |
| Release gate | Done | `build:client` fails with demo tools on, passes with them off; no mock import in storefront or admin |
| No fabricated credentials | Done | Providers throw when keys are missing |

## 3. Milestones B0–B9

| Milestone | Status | Main gaps |
|---|---|---|
| B0 Intake | Done | Owner approval of defaults not recorded in the repo |
| B1 Architecture and OpenAPI | **Not done** | No `openapi.yaml`, no sequence diagrams, no error catalogue. Only `docs/05-api/STOREFRONT_CONTRACT.md` |
| B2 Data model | Partial | Prisma schema and a W00 seed exist. Uses `db push`, so no reversible migrations; no retention jobs |
| B3 Domain port | Done | 73 tests pass; reference numbers match |
| B4 Identity, access, audit | Partial | Password sign-in, staff TOTP, RBAC, audit, reveal done. **Google OAuth returns 501** (no client ID). Password reset exists in the schema; delivery needs an email adapter |
| B5 Commerce core | Partial | Catalog, cart pricing, merge, wishlist, addresses, consents, idempotent orders done. **No expiry job; no concurrency test** |
| B6 Payments | Partial | Midtrans-shaped charge and signed webhook against a simulator. **No sandbox call** (no keys). No reconciliation report |
| B7 Shipping, notifications, analytics | Partial | KiriminAja-shaped quote and webhook; 72 h rule exists as a constant only. **No email or WhatsApp adapter, no GA4** |
| B8 Frontend integration | Partial | HTTP client, mocks removed, BrowserRouter plus nginx rewrites done. **React Router still v6; fonts still load from Google Fonts**; admin product, inventory, content, customers, settings, users and reports screens are still static |
| B9 Security, QA, deployment | Not done | No threat model, scans, load test, backup drill, runbook or CI (`.github/` absent). Sign-off for staging is the owner's |

## 4. Plan criteria still open

1. `POST /v1/notifications` with a `provider: "none"` outbox row (agent02-completion Task 3). Needs a decision on who may call it.
2. Commit and push the deployed state (agent02-completion Task 4, storefront Task 7).
3. Automated coverage for process, ship, refund and the `FORBIDDEN` message in the admin UI (storefront Task 3).

## 5. A-brief document package (§26)

| Folder | Present | Missing |
|---|---|---|
| `00-handoff` | 3 of 3 | none |
| `01-requirements` | `PRD`, `FUNCTIONAL_REQUIREMENTS`, `BUSINESS_RULES` | `NON_FUNCTIONAL_REQUIREMENTS`, `USE_CASES`, `REQUIREMENTS_TRACEABILITY` |
| `02-architecture` | none | all 7 files |
| `03-adrs` | none | all ADRs (13 topics listed in §24) |
| `04-data` | none | ERD, data dictionary, inventory reservation, order state machine, retention |
| `05-api` | `STOREFRONT_CONTRACT` | `openapi.yaml`, conventions, auth, payment, shipping contracts |
| `06-quality` | none | all 5 files |
| `07-delivery` | this file | roadmap, work breakdown, release plan, Agent 03 handoff, acceptance checklist |

`docs/README.md` records A0 as approved and A1 as waiting for the owner's APPROVE, REVISE or HOLD. The prompt forbids moving on without that approval, and no ADR may be marked Accepted without it.

## 6. What only the owner can unblock

| Item | Needed |
|---|---|
| Which brief governs (section 0) | Owner decision |
| A1 approval, then A2–A7 | APPROVE / REVISE / HOLD per milestone |
| Midtrans or Duitku sandbox | Server key and client key |
| Biteship, RajaOngkir/Komerce or KiriminAja sandbox | API key and webhook secret |
| Google Sign-In | OAuth client ID and secret |
| Email and WhatsApp adapters | Provider choice and credentials |
| GA4 | Measurement ID |
| TLS, DNS | Domain name and certificate approach |
| Production go-live | Separate owner decision |
| Legal text, retention periods | `[isi oleh pemilik]` |

## 7. Work that needs no outside input

Ordered by risk reduced:

1. Expiry job that releases stock for unpaid orders, plus a concurrency test for the last unit.
2. Fix the audit gaps in section 2: dependency upgrades (NestJS 10.4.x to a patched line, React Router 7), server lockfile in the Dockerfile, nginx security headers, self-hosted fonts.
3. Staff customer view from the database instead of fixtures.
4. UTC storage for timestamps.
5. `openapi.yaml` and a contract test per endpoint.
6. CI workflow running tests, `build:client` and `npm audit`.
7. Wire the remaining admin screens to the API.
