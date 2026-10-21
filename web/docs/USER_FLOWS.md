# USER_FLOWS

Source: canvas boards 13–17. Screen IDs refer to SITEMAP.md.

## Key journeys
| ID | Journey | Path | Must also handle |
|---|---|---|---|
| J1 | First purchase from a campaign (Brand A, mobile) | S36 → S06 → S09 → S10 → S12 → S15/S16 → S17/S18 → S19/S20 → S21/S22 | Voucher not eligible for flash-sale item; QRIS expiry → cancelled, stock released, "Pesan ulang" |
| J2 | Technical search, compare, buy (Brand B, desktop) | S04 → S05 (synonym) → S03 → S08 → S07 → S09 → S11 (Google mock) → S15–S19 → S20/S21 | Variant sold out; comparison limit; shipping provider error |
| J3 | Track a delayed order | S23 → S26 → S27 → CS link-out | Failed delivery; no tracking ref yet |
| J4 | Recover a failed/expired payment | S20 → S21 failed → S19 → S20 → S21 paid | Window expires during retry |
| J5 | Fulfil paid orders (Operations) | A01 → A06 → A07 Proses → Kirim → courier events → A05 | Delivery exception; paid cancellation → refund by Owner/Admin |
| J6 | Flash sale + landing page (Marketing) | A09 → A08 schedule → A10/A11 → A12 → preview → publish → A15 | Promotion conflict warning; validation error |
| J7 | Bulk inquiry | S07 → S32 → submitted | Validation; service unavailable |

## Checkout (board 15)
Cart → logged in? (no → S11–S14, cart merged, return to step 1) → Step 1 address → shipping service → Step 2 voucher & review → Step 3 payment method + "Buat Pesanan" → stock & price still valid? (no → back to cart with notice) → Menunggu Pembayaran (stock reserved) → mock gateway event → Paid → confirmation.

Error branches: address change invalidates shipping; courier unavailable / provider error; voucher invalid/expired/ineligible/conflict; payment failed or cancelled (order stays pending until expiry); expired (order cancelled, reservation released).

## Product discovery (board 14)
Entry (home, menu, search, campaign/blog, external, wishlist) → browse (category + filters, search results, collection, comparison, recommendation strips) → evaluate (PDP) → act (cart, wishlist, compare, bulk inquiry).

Search pipeline: ≥ 2 characters → 250 ms wait → normalise → synonym map → typo tolerance (1 edit ≥ 4 letters, 2 edits ≥ 8) → rank (name > synonym > category > attribute) → ≤ 6 products, ≤ 3 categories.

## CMS publishing (board 16)
Create page → add/reorder blocks → fill content → SEO → preview desktop/mobile → validate (errors block, warnings don't) → publish or schedule (Asia/Jakarta) → edit as draft revision or unpublish. States: Draf, Terjadwal, Terbit, Terbit · ada perubahan, Tidak terbit.

## Status models (board 17)
- **Order:** Menunggu Pembayaran → Dibayar → Diproses → Dikirim → Dalam Perjalanan → Diterima; side states Dibatalkan and Gagal Kirim. "Update terlambat" is a display flag (> 72 h without a courier event).
- **Payment attempt:** Pending → Dibayar / Gagal / Kedaluwarsa / Dibatalkan; Dibayar → Refund penuh / Refund sebagian. Only a gateway (mock) event sets Dibayar.
- **Shipment & quote:** requested → quoted / failed / no service; quoted → invalidated (address, items, qty) / expired (30 min) / selected; then created → in transit → delivered / exception → reattempt / returned.
- **Stock:** available = on hand − reserved. Reserve at order; on payment on hand −q and reserved −q; on expiry/cancel reserved −q.
