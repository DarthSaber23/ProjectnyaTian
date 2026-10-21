# SECURITY_CHECKLIST — prototype status and production requirements

Status legend: **Done (proto)** = implemented in the prototype UI/mock; **Agent 02** = must be built server-side; **Gate** = enforced by `npm run build:client`.

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| G-1 | Client build refuses demo tools | Gate | `vite.config.ts` clientReleaseGate (verified: build fails) |
| G-2 | Client build refuses mock services (in-browser auth, demo credentials) | Gate | Same; demo credentials are in the mock bundle, so the mock must never ship |
| A-1 | Passwords hashed (Argon2id/bcrypt), never logged | Agent 02 | — |
| A-2 | Sign-in lockout 5 failures / 15 min; generic error message | Done (proto) · Agent 02 | `domain/auth.ts`, tests |
| A-3 | Session cookies HttpOnly, Secure, SameSite; rotation on sign-in | Agent 02 | — |
| A-4 | CSRF protection on all mutations | Agent 02 | — |
| A-5 | Staff TOTP required; no self-service admin reset (C9) | Proto UI only | AdminLogin requires 6 digits (simulated) |
| A-6 | Open-redirect protection on sign-in `next` | Done (proto) | `safeNext()` in SignIn.tsx |
| A-7 | Google OAuth with state + PKCE, server-side token verification | Agent 02 | — |
| A-8 | Rate limiting on auth, vouchers, search | Agent 02 | — |
| Z-1 | Access matrix enforced server-side, least privilege | Proto UI only · Agent 02 | `domain/rbac.ts`, admin tests (403 cases) |
| Z-2 | Customer can only read own orders (404 otherwise) | Done (proto) · Agent 02 | `OrderDetailPage` guard |
| Z-3 | Contact masking + reasoned, time-limited, logged reveal (C2) | Done (proto) · Agent 02 | admin tests, e2e |
| P-1 | Payment status only from signed webhook | Agent 02 | Prototype uses a labelled simulator |
| P-2 | Webhook idempotency and replay protection | Agent 02 | — |
| P-3 | Gateway secrets in server env vars only (C10) | Agent 02 | No secrets in repo |
| P-4 | Server recomputes totals at order creation; client totals never trusted | Agent 02 | `backend.create` recomputes (pattern) |
| P-5 | Idempotency-Key on order creation | Agent 02 | API_CONTRACTS |
| D-1 | No PII in analytics events | Done (proto) · Agent 02 | No analytics SDK in prototype |
| D-2 | Consent stored as append-only events with time and source | Done (proto) · Agent 02 | consent tests |
| D-3 | PII encryption at rest for phone/address; retention policy | Agent 02 + owner | DATA_MODEL |
| D-4 | Audit log write-once; no edit/delete API | Done (proto) · Agent 02 | AdminAudit has no mutations |
| D-5 | No browser storage of personal data | Done (proto) | No local/session storage used |
| D-6 | Fonts self-hosted (no third-party IP disclosure) | Open (owner) | Google Fonts in prototype |
| W-1 | Content Security Policy, HSTS, X-Content-Type-Options, frame-ancestors | Agent 02 | — |
| W-2 | No `dangerouslySetInnerHTML` / user HTML rendering | Done (proto) | grep: none in `src/` |
| W-3 | Dependency audit and pinned versions | Done (proto) | `package.json` exact versions; run `npm audit` in CI |
| W-4 | Input validation server-side (addresses, tracking numbers, amounts) | Agent 02 | Client validation exists for UX only |

**Flag:** the prototype is not a security boundary. Every "Done (proto)" control must be re-implemented and tested on the server.
