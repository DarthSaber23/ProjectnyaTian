# E-Commerce Starter — Handoff Package for Agent 02

| Field | Value |
|---|---|
| Project | Reusable Indonesian B2C e-commerce starter (Bahasa Indonesia · IDR · Asia/Jakarta) |
| From → To | Agent 01 (UI/UX + React prototype) → Agent 02 (backend, integrations, deployment) |
| Status | Milestones M0–M8 approved by the owner (M0–M7 on 20 Oct 2026, M8 on 21 Oct 2026) |
| Package date | 21 Oct 2026 |
| Data | All people, addresses, couriers, banks, credentials and orders are fictional (W00 mock dataset) |

## 1. Read in this order

| # | File | Why |
|---|---|---|
| 1 | `AGENT02_PROMPT.md` | Master prompt for Agent 02: scope, rules, milestones B0–B9 |
| 2 | `docs/HANDOFF_AGENT02.md` | Architecture, path to production, open owner decisions |
| 3 | `docs/API_CONTRACTS.md` · `docs/DATA_MODEL.md` | What to build |
| 4 | `docs/SECURITY_CHECKLIST.md` · `docs/QA_REPORT.md` | What is done vs. owed; known issues |
| 5 | `docs/ASSUMPTIONS_AND_DECISIONS.md` · `docs/MOCK_DATA_CONTRACT.md` | Approved rules and reference data |
| 6 | `docs/TRACEABILITY.md` | Decision → design → code → test |

## 2. Contents

| Folder | Contents |
|---|---|
| `code/ecommerce-starter/` | React prototype source (no `node_modules`, no build output). Same `docs/` inside for the repository. |
| `docs/` | 20 documents (brief, scope, IA, flows, screens, wireframe spec, design system, components, responsive rules, analytics, prototype guide, usability plan, handoff, API, data model, security, traceability, QA, decisions, mock data) |
| `design/claude-design-canvas/` | 76 design boards (`.dc.html`) + `canvas.json` from the Claude Design canvas, pages M0–M6. Open the live canvas for rendering: https://claude.ai/artifact/Y5sZPpUGrBHZ4LjZwgaEGD (the owner must share access). |
| `design/tokens/` | Brand tokens: `brand-a.json` (Halimun), `brand-b.json` (Sambung) |
| `evidence/` | `final-test-log.txt` (21 Oct 2026 run) and 8 screenshots from the automated tests |
| `MANIFEST.sha256` | SHA-256 checksum of every file (integrity check: `sha256sum -c MANIFEST.sha256`) |

## 3. Run the prototype

```bash
cd code/ecommerce-starter
npm ci
cp .env.example .env
npm run dev            # http://localhost:5173  (admin: /#/admin)
npm test               # 46 unit tests
npm run e2e            # storefront 69 + admin 75 + QA 72 checks (Playwright + axe)
npm run build:client   # release gate — FAILS by design until mock services are replaced
```

Demo accounts (fictional, mock backend only): customer `rina@example.com` / `demo-rina-2026`; staff Andi S. (Owner), Dewi O. (Operasional), Rina M. (Marketing), Akun CS demo — password `demo-staff-2026`, any 6-digit code.

## 4. Final verification (21 Oct 2026)

| Check | Result |
|---|---|
| TypeScript strict | Clean |
| Unit tests | 46 / 46 |
| E2E storefront / admin / QA | 69 / 69 · 75 / 75 · 72 / 72 |
| axe (WCAG 2.2 A/AA tags), 19 screens | 0 serious / critical |
| Release gate | Blocks client build while mock services are present |
| `npm audit` (production deps) | 2 moderate (React Router 6; fixed only in v7 — QA_REPORT K-1) |

## 5. Warnings

- The prototype is **not** a security boundary: access control, validation and payment status are simulated in the browser.
- Do not deploy the prototype build to a public domain. Use `npm run build:client` only after Agent 02 replaces the mock services.
- Brand names are unscreened working names; legal texts and business details are placeholders for the owner.
