# DATA_MODEL — entities for the production database (draft for Agent 02)

Types mirror `src/domain/types.ts`. Money columns are `BIGINT` Rupiah (never float). Timestamps `TIMESTAMPTZ`, displayed in Asia/Jakarta. PII columns marked **PII**; encrypt at rest where marked **ENC**.

| Entity | Key fields | Notes |
|---|---|---|
| `store` | id, brand_id, name, timezone (Asia/Jakarta), currency (IDR), prices_include_ppn (true) | One per fork |
| `category` | id, store_id, name, slug | Flat URLs (I2) |
| `product` | id, store_id, slug, name, category_id, spec, tags[] | Tags = skin concerns etc. (demo tags not claims) |
| `product_spec` | product_id, key, value | Missing spec → UI shows "Tidak dicantumkan" |
| `variant` | sku (PK), product_id, label, price, compare_at, attrs JSONB | |
| `bundle_component` | bundle_sku, component_sku, qty | Bundle stock derived (P6) |
| `stock_level` | sku, on_hand, reserved, updated_at | `available = on_hand − reserved`; row-level locking on reserve |
| `stock_movement` | id, sku, qty, type (reserve/release/commit/restock/adjust), order_number?, actor, at, reason | Append-only; adjustments (X06) need a reason |
| `promotion` | code, kind (price/gift/order/shipping), rule JSONB, window_start/end, status (draft/scheduled/active/ended), allow_flash_items | Rules per D3 |
| `customer` | id, name **PII**, email **PII**, phone **PII ENC**, password_hash, google_sub, created_at | Argon2id/bcrypt for passwords |
| `address` | id, customer_id, label, recipient **PII**, phone **PII ENC**, line **PII**, city, postal_code, is_primary | D13 |
| `consent_event` | id, customer_id, key (emailPromo/waOrderInfo/personalised), granted, at, source | Append-only; current state = latest event |
| `cart` / `cart_line` | customer_id, brand_id / sku, qty | Guest carts in client until sign-in (D7) |
| `wishlist_item` | customer_id, product_id, added_at | |
| `order` | number (PK `ORD-YYMMDD-NNNN`), customer_id, store_id, created_at, address snapshot JSONB **PII**, courier snapshot, totals snapshot JSONB, fulfilment_status, tracking_number | Snapshot prices and address at creation |
| `order_line` | order_number, sku, name, variant_label, qty, regular_unit, unit_price, line_total, applied_code, is_flash_sale, is_gift | |
| `payment` | id, order_number, method, status, expires_at, paid_at, provider_ref, amount | Status only via webhook |
| `refund` | id, order_number, amount, reason, restock, actor_staff_id, at | Sum ≤ paid amount (I8) |
| `order_event` | id, order_number, status, actor, at, source (customer/staff/gateway/courier/system) | Customer-visible history |
| `staff` | id, name, email, role (owner/admin/operations/marketing/cs), totp_secret **ENC**, active | |
| `contact_reveal` | id, staff_id, customer_id, reason, order_number, at, expires_at | C2 |
| `audit_log` | id, at, actor, code, action, object, before JSONB, after JSONB | Write-once storage (no UPDATE/DELETE grants) |
| `content_page` | id, slug, blocks JSONB, status (draft/published/changes), seo JSONB, updated_by, updated_at | X09 |
| `analytics_daily` | date, store_id, sessions | Sessions from GA4; no PII |

## Retention and privacy (to confirm with the owner / DPO)
| Data | Proposal |
|---|---|
| Orders, payments, refunds | Keep per tax/accounting law (owner to confirm period) |
| Audit log, contact reveals | Keep at least as long as orders |
| Consent events | Keep for the life of the account + legal period |
| Guest carts | Client only; never stored server-side before sign-in |
| Customer deletion request | Anonymise PII on orders, keep financial records (UU PDP) |
