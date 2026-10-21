# ANALYTICS_METRICS — Admin analytics definitions (A15)

| Field | Value |
|---|---|
| Version | 1.0 draft (M5 batch 3, 20 Oct 2026) — pending M5 approval |
| Board | X11-Analytics (Claude Design canvas, page m5) |
| Data | W00 mock dataset, 14–20 Okt 2026, snapshot 20 Okt 10:16 WIB |
| Status of numbers | **Mock / demonstration only.** Not performance claims. No KPI (key performance indicator) targets are set (PROJECT_BRIEF §2). |

## 1. Time rules
1. Timezone: Asia/Jakarta (WIB, UTC+7) for all bucketing and display.
2. A day is 00:00:00–23:59:59 WIB.
3. Paid orders are bucketed by **payment time**; refunds by **refund record date** (D12).
4. Presets: Hari ini (today, up to "now"), Kemarin (yesterday), 7 hari terakhir (last 7 days incl. today), 30 hari terakhir, Bulan ini (month to date), Rentang khusus (custom).
5. Ranges outside the available data show an **empty state**, never fabricated zeros.
6. Period comparison is disabled in the demo (only 7 days of data exist).

## 2. Metric definitions
| ID | Metric (UI label) | Formula | Source | Rules / notes |
|---|---|---|---|---|
| M1 | Net revenue (Pendapatan bersih) | Σ total of paid orders − Σ refunds | Orders | Totals include PPN/VAT (D5) and shipping after vouchers. Integer Rupiah (D4). |
| M2 | Paid orders (Pesanan dibayar) | count(orders that reached Paid) | Orders | Later-refunded orders still count. Pending and expired do not. |
| M3 | Average order value (Rata-rata nilai pesanan) | M1 ÷ M2 | Derived | Floored to whole Rupiah. |
| M4 | Conversion (Konversi) | M2 ÷ sessions | Sessions: **mock** | Production source: GA4 (Google Analytics 4), wired by Agent 02. |
| M5 | Refunds | Σ refund amounts recorded | Orders | Refunds recorded manually by admin (I8). |
| M6 | Payment completion (Tingkat pembayaran) | paid ÷ (paid + expired) | Orders | Still-pending orders excluded from the denominator. |
| M7 | Repeat buyers (Pembeli berulang) | customers with ≥2 paid orders ÷ customers with ≥1 paid order | Customers (X10) | All-time, not per period — **owner decision needed**. |
| M8 | Promotion usage (Pemakaian promosi) | count(orders using code) by status | Promotions | Pending usage is not campaign performance until paid. Attribution: last campaign touch ≤ 7 days. |

## 3. Reconciliation with W00 (14–20 Okt)
| Date | Paid orders | Gross paid (Rp) | Refund (Rp) | Net (Rp) | Orders |
|---|---|---|---|---|---|
| 14 Okt | 3 | 950.000 | 0 | 950.000 | 0001, 0002, 0003 |
| 15 Okt | 0 | 0 | 0 | 0 | — |
| 16 Okt | 1 | 87.000 | 0 | 87.000 | 0004 |
| 17 Okt | 1 | 567.000 | 0 | 567.000 | 0005 |
| 18 Okt | 0 | 0 | 0 | 0 | 0006 expired |
| 19 Okt | 2 | 454.000 | 237.000 | 217.000 | 0007, 0008 (refund 16:40) |
| 20 Okt | 1 | 276.000 | 0 | 276.000 | 0009; 0010 pending |
| **Total** | **8** | **2.334.000** | **237.000** | **2.097.000** | |

| Metric | Value | Check |
|---|---|---|
| M1 | Rp2.097.000 | = X01 dashboard = X10 customer total |
| M2 | 8 | |
| M3 | Rp262.125 | 2.097.000 ÷ 8 |
| M4 | 0,65% | 8 ÷ 1.240 mock sessions = 0,645% |
| M5 | Rp237.000 | 1 order (0008) |
| M6 | 88,9% | 8 ÷ 9 |
| M7 | 2 of 6 (33,3%) | C-0002, C-0003 ÷ C-0001/2/3/4/5/7 |

## 4. Controls and risks
| Risk | Control |
|---|---|
| Mock numbers mistaken for real performance | "Sesi = angka mock" badge on X11; this document's status line |
| Metric drift between screens | Single definition table; X01, X10, X11 reconcile to M1 |
| Timezone errors at day boundaries | WIB bucketing rule §1; test cases at 23:59/00:00 in M8 QA |
| Refund on a different day than payment | Refund-date rule (D12) shown on 19 Okt row |
| Access | Analytics: view-only for Owner/Admin/Operations/Marketing; none for CS (proposed A17 matrix) |
