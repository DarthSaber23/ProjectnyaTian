# PROTOTYPE_GUIDE — M6 clickable prototype (Claude Design)

| Field | Value |
|---|---|
| Version | 1.0 draft (M6 batch 3, 20 Oct 2026), pending M6 approval |
| Location | Claude Design canvas "Agent 01 — E-Commerce Starter", page **M6 — Clickable Prototype** |
| How to run | Select a P-board and press **Play** (boards marked interactive). Play can run in place or full window. |
| Data | W00 mock dataset (MOCK_DATA_CONTRACT.md). All people, addresses, couriers, banks and references are fictional. |
| Status of results | Logic verified by script against W00; **visual rendering in Play not verified by Agent 01**. |

## 1. Boards
| Board | Size | Persona / role | Covers |
|---|---|---|---|
| P01 Purchase (Sambung) | 390×844 | Customer C-0001, signed in | Home → catalog → product → cart → vouchers → 3-step checkout → simulated payment (paid / failed / expired) |
| P02 Discovery (Halimun) | 390×844 | Guest → C-0001 | Concern filter, bundle (shared stock), B2G1-SERUM, wishlist sign-in gate, sign-in + lockout, guest cart merge, hand-off to P01 |
| P03 Search + Compare (Sambung) | 390×844 | Customer | Synonyms, length filter, recent searches, zero results, compare max 4 / same category, pinned column, list view, differences only |
| P04 Account (Sambung) | 390×844 | C-0001 | Orders, tracking with overdue courier, WhatsApp hand-off, wishlist, addresses, consent toggles with timestamps |
| P05 Admin orders | 1440×900 | Operasional / Owner / CS (switchable) | Process → ship with tracking number, refund (Owner only), contact reveal with reason, session audit log |
| P06 Promotion check | 1440×900 | Marketing / Operasional (switchable) | CHARGER15 vs FS-WEEKEND per-day conflict table, voucher eligibility, review confirmation, scheduling |

## 2. Prototype-only controls
| Control | Where | Purpose |
|---|---|---|
| PANEL UJI (dashed box) | P01, P02, P03, P05, P06 | Fill demo cart, sample searches, wrong password, switch role, reset |
| PANEL SIMULASI GATEWAY | P01 payment page | Simulate paid / failed / expired |
| "Simulasikan 60 detik berlalu" | P05 contact | Re-mask a revealed contact |
| "Isi resi contoh" | P05 ship dialog | Fill SIM-KA-88213010 |
| "Atur ulang" | all | Reset the board state |

These controls must not appear in the React build except behind a development flag (M7).

## 3. Fixed simulation rules
| ID | Rule |
|---|---|
| P1 | One interactive board per flow; state lives in the board only (no browser storage, nothing sent anywhere) |
| P2 | Storefront clock: order created 10:15, paid 10:21, QRIS/e-wallet expiry 10:30, VA 21 Okt 10:15 |
| P3 | Customer prototypes run as demo customer C-0001 |
| P4 | Shipping rates do not vary by address |
| P5 | Dashed panels are prototype-only |
| P6 | Halimun bundle and sunscreen share 9 units; other Halimun lines capped at 10 (prototype limit) |
| P7 | Customer sign-in locks 15 min after 5 wrong passwords (to confirm) |
| P8 | Search: demo synonym map, all-words substring match |
| P9 | Admin clock: each action advances 2 min from 10:20 WIB |
| P10 | Admin roles in prototypes: Operasional (Dewi O.), Owner (Andi S.), CS (demo account), Marketing (Rina M.) per A17 matrix |

## 4. Known limitations
| Limitation | Planned handling |
|---|---|
| Boards do not share state (cart in P02 is not the cart in P01) | Shared state arrives with M7 React stores |
| Phone-only storefront prototypes | Desktop behaviour built in M7 using M4 boards H01–H21 |
| Address form, register, password recovery, content pages not interactive | Static designs H08, H14–H17 remain the reference |
| Refund after shipment (returns) not modelled | Out of scope; flagged for owner |
| Real payment, shipping, WhatsApp, email | Simulated only; Agent 02 integrations |
