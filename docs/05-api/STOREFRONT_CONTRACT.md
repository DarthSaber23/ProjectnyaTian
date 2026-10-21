# Storefront API ready for the UI

The frontend should call only these routes. Money is integer Rupiah. Errors are `{ "error": { "code", "message", "details" } }`. Customer and staff calls send `Authorization: Bearer <token>`.

Dummy data loaded on startup for customer `C-0001` (`rina@example.com` / `demo-rina-2026`):

| Data | Value |
|---|---|
| Addresses | `rumah` (Coblong 40132), `kantor` (Sumur Bandung 40111). Phone and street are encrypted at rest |
| Wishlist | `B04`, `B06` |
| Saved cart | one `B01-2M-BLK` on Sambung |
| Consent | email promo off, WhatsApp order info on, personalised on |
| Pages | `/v1/pages/tentang`, `/v1/pages/faq`, `/v1/pages/kebijakan-privasi` |
| Catalogue | W00 Halimun and Sambung products |
| Orders | W00 `ORD-261014-0001` through `ORD-261020-0009` |
| Staff | `andi@toko.example` / `demo-staff-2026` plus the server TOTP secret |

## Public

| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/v1/catalog?brand=&q=` |
| GET | `/v1/products/{slug}` |
| GET | `/v1/promotions/active?brand=` |
| POST | `/v1/cart/price` |
| POST | `/v1/shipping/quotes` |
| GET | `/v1/pages` |
| GET | `/v1/pages/{slug}` |
| POST | `/v1/auth/sign-in` |
| POST | `/v1/auth/register` |
| POST | `/v1/auth/forgot-password` |
| POST | `/v1/auth/sign-out` |
| GET | `/v1/auth/google/start` returns `501 NOT_CONFIGURED` until `GOOGLE_CLIENT_ID` is set |

## Customer session

| Method | Path |
|---|---|
| GET, PUT | `/v1/me/cart?brand=` |
| POST | `/v1/me/cart/merge` |
| GET, PUT, DELETE | `/v1/me/wishlist` and `/v1/me/wishlist/{productId}` |
| GET, POST | `/v1/me/addresses` |
| PATCH, DELETE | `/v1/me/addresses/{id}` |
| GET, PATCH | `/v1/me/consents` |
| POST | `/v1/orders` with `Idempotency-Key` |
| GET | `/v1/me/orders` and `/v1/me/orders/{number}` |
| POST | `/v1/orders/{number}/payment` | Midtrans Core API charge JSON (`status_code`, `gross_amount` as `\"87000.00\"`, `payment_type`) |
| POST | `/v1/webhooks/payment/midtrans` | Midtrans notification. Signature is `SHA512(order_id + status_code + gross_amount + server_key)`. Paid only when `status_code` is `200`, `fraud_status` is `accept`, and `transaction_status` is `settlement` or `capture`. |
| POST | `/v1/shipping/kiriminaja/shipping_price` | KiriminAja `shipping_price` body: `origin`, `destination`, `weight` grams, `item_value`. `results[].cost` is a string. |
| POST | `/v1/webhooks/shipping/kiriminaja` | KiriminAja callback. Header `Authorization: Bearer <api key>`. `method` is `processed_packages`, `shipped_packages`, or `finished_packages`. |

Until `MIDTRANS_SERVER_KEY` and `KIRIMINAJA_API_KEY` are set, the simulator uses `SB-Midtrans-dummy` and `KA-dummy`. Setting the real sandbox keys switches verification without changing the handlers.

## Staff session

| Method | Path |
|---|---|
| POST | `/v1/admin/auth/sign-in` |
| GET | `/v1/admin/metrics` |
| GET | `/v1/admin/orders?status=` |
| POST | `/v1/admin/orders/{number}/process` |
| POST | `/v1/admin/orders/{number}/ship` |
| POST | `/v1/admin/orders/{number}/refunds` |
| GET | `/v1/admin/customers` |
| GET | `/v1/admin/customers/{id}/contact` |
| POST | `/v1/admin/customers/{id}/contact-reveals` |
| GET | `/v1/admin/promotions/{code}` |
| GET | `/v1/admin/audit-log` |

Live Midtrans, Duitku, and courier calls stay refused until their server keys exist. Google sign-in stays `NOT_CONFIGURED`. The UI can be built against this list.
