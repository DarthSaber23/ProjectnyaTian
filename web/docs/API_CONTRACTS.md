# API_CONTRACTS — proposed REST API (v1, draft for Agent 02)

Derived from `src/services/contracts.ts`. JSON over HTTPS. Money = integer Rupiah. Times = ISO 8601 with `+07:00`. Errors use one shape:

```json
{ "error": { "code": "STOCK_SHORTAGE", "message": "Stok tidak cukup …", "details": [] } }
```

Auth: customer = session cookie (HttpOnly, Secure, SameSite=Lax) + CSRF token header `X-CSRF-Token` on mutations. Staff = separate session, TOTP at sign-in, permission checked per endpoint (`src/domain/rbac.ts`).

## 1. Storefront (public)

| Method & path | Purpose | Contract source | Notes |
|---|---|---|---|
| `GET /v1/catalog?category=&q=&inStock=&sort=&page=` | Products with variants, availability, best price | `CatalogService.getCatalog`, `domain/search.ts` | 24 per page (D9); `available = onHand − reserved` computed server-side |
| `GET /v1/products/{slug}` | Product detail | `ProductPage` | 404 for unknown slug |
| `GET /v1/promotions/active` | Active price/gift promotions (no voucher codes listed) | `getPromotions` | Do not expose unlisted voucher codes |
| `POST /v1/cart/price` | Price a cart: lines, vouchers, courier | `domain/pricing.computeTotals` | Body `{lines:[{sku,qty}], orderVoucher?, shippingVoucher?, courierId?}` → `Totals` incl. voucher status messages |
| `POST /v1/shipping/quotes` | Courier quotes | `ShippingService.quote` | Body `{addressId, lines}` → `[{courierId, service, etaText, cost|null}]` |

## 2. Customer (session required)

| Method & path | Purpose | Contract source | Errors |
|---|---|---|---|
| `POST /v1/auth/sign-in` | Email + password | `AuthService.signIn` | `401 INVALID_CREDENTIALS {remaining}` · `423 LOCKED {until}` (P7). Same message for wrong email or password. |
| `GET /v1/auth/google/start` · `GET /v1/auth/google/callback` | OAuth | `signInWithGoogle` | state + PKCE |
| `POST /v1/auth/sign-out` | End session | `signOut` | — |
| `GET/PUT /v1/me/cart` | Saved cart; `POST /v1/me/cart/merge` with guest lines | `AccountService.savedCart`, `domain/cart.mergeCarts` | Merge response lists `capped` lines |
| `GET /v1/me/wishlist` · `PUT/DELETE /v1/me/wishlist/{productId}` | Wishlist (I6) | `toggleWishlist` | — |
| `GET /v1/me/addresses` · `POST/PATCH/DELETE …/{id}` | Address book (D13) | `demoCustomer.addresses` | Validation per D13 |
| `GET /v1/me/consents` · `PATCH /v1/me/consents` | Consent records | `updateConsents` | Server stores `{granted, changedAt, source, ip?}` as an append-only history |
| `POST /v1/orders` | Create order (I4) | `OrderService.create` | `409 STOCK_SHORTAGE {details}` · `409 PRICE_CHANGED {totals}` · `422 COURIER_UNAVAILABLE`. Requires `Idempotency-Key` header. |
| `GET /v1/me/orders` · `GET /v1/me/orders/{number}` | Orders and tracking (I7) | `OrderService.list/get` | 404 (not 403) for another customer's order |
| `POST /v1/orders/{number}/payment` | Start or retry payment for a pending order | `PaymentPage` | 409 if expired/paid |

## 3. Webhooks (server-to-server)

| Path | Source | Rules |
|---|---|---|
| `POST /v1/webhooks/payment/{provider}` | Midtrans / Duitku | Verify signature; idempotent by provider transaction id; transitions per `domain/orders.ts` (`pending → paid/failed/expired`); on paid commit stock; on expired release stock |
| `POST /v1/webhooks/shipping/{provider}` | Shipping aggregator | Verify signature; `shipped → in_transit → delivered` only from these events; store event time for the 72 h overdue rule |

## 4. Admin (staff session + permission)

| Method & path | Permission | Contract source | Audit code |
|---|---|---|---|
| `POST /v1/admin/auth/sign-in` (email, password, TOTP) | — | `AdminLogin` | `STAFF_SIGN_IN` |
| `GET /v1/admin/metrics?from=&to=` | `dashboard.view` | `domain/analytics.computeMetrics` | — |
| `GET /v1/admin/orders?status=` · `GET …/{number}` | `orders.view` | `MockAdmin.orders` | — |
| `POST /v1/admin/orders/{number}/process` | `orders.fulfil` | `MockAdmin.process` | `ORDER_STATUS` |
| `POST /v1/admin/orders/{number}/ship` `{trackingNumber}` | `orders.fulfil` | `MockAdmin.ship` (P11 format) | `ORDER_SHIPPED` |
| `POST /v1/admin/orders/{number}/refunds` `{amount, reason, restock}` | `orders.refund` | `MockAdmin.refund` | `REFUND_RECORDED` |
| `GET /v1/admin/customers/{id}/contact` | `customers.contact.full` → full; else masked | `MockAdmin.contact` | — |
| `POST /v1/admin/customers/{id}/contact-reveals` `{reason, orderNumber}` | `customers.contact.reveal` | `MockAdmin.reveal` → `{until}` | `CONTACT_REVEAL` |
| `GET/PATCH /v1/admin/promotions/{code}` · `POST …/{code}/schedule` | `promotions.edit` | `MockAdmin.updateDraft/schedule` | `PROMO_SCHEDULED` |
| `GET /v1/admin/promotions/{code}/conflicts` | `promotions.view` | `domain/pricing.bestUnitPrice` per day | — |
| `GET /v1/admin/audit-log?from=&to=&actor=` | `audit.view` | `MockAdmin.auditLog` | — (read-only; no PUT/DELETE exists) |
| `GET /v1/admin/reports/{type}.csv` | `reports.export` | X12 / A16 | `EXPORT` |

## 5. Contract tests to write first
Reference checkout (Rp587.250) · HEMAT50 rejection message (Rp182.000 short) · stock shortage on create · expiry releases stock including gift units · refund over remaining → 422 · CS cannot ship → 403 · Operasional refund → 403 · reveal without reason → 422 · audit entry written for every admin mutation · metrics on W00 seed = Rp2.097.000 / 8 / Rp262.125 / 88,9%.
