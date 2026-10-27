# Business rules

| Field | Value |
|---|---|
| Milestone | A1 |
| Status | Proposed |
| Date | 21 Oct 2026 |

Rules marked **Approved** come from `ASSUMPTIONS_AND_DECISIONS.md` or from the A0 defaults the owner accepted on 21 Oct 2026. Rules marked **Baseline** use an owner-reversible default from [OPEN_DECISIONS.md](../00-handoff/OPEN_DECISIONS.md) §3. Changing an Approved rule needs a new owner decision.

The server is the authority for price, stock, payment status, and permissions. The browser may display a preview. It may not commit one.

## 1. Money and tax

| ID | Status | Rule |
|---|---|---|
| BR-M1 | Approved D4 | Amounts are integer Rupiah. A percentage discount is applied per unit and floored to the nearest Rupiah. A line total is unit price times quantity. Display uses a thousands separator, as in `Rp1.250.000` |
| BR-M2 | Approved D5 | Shelf prices include PPN. Checkout shows no tax line. The customer-facing note is "Harga sudah termasuk PPN" |
| BR-M3 | Approved D4 | Order totals, refunds, and report figures are integer Rupiah. Average order value is floored |

No PPN rate is stored. "Included" is a display and pricing rule, not a tax-invoice engine. Retention of financial records is an open legal question (OD-31) and is not given a number here.

## 2. Promotions

| ID | Status | Rule |
|---|---|---|
| BR-P1 | Approved D3 | Each line has at most one price promotion (strikethrough, flash sale, bundle price, or other unit-price change). If several qualify, the lowest unit price wins and that promotion is named |
| BR-P2 | Baseline P12 | If two price promotions produce the same unit price, the one that is already active is kept |
| BR-P3 | Approved D3 | An order has at most one order voucher and one shipping voucher |
| BR-P4 | Approved D3 | Order vouchers do not apply to flash-sale units unless that voucher sets `allowFlashSaleItems` |
| BR-P5 | Approved D3 | Application order is product promotion, then order voucher, then shipping voucher |
| BR-P6 | Approved D3 | A voucher outside its window, under its minimum, or of unknown code is rejected with a reason. It is not silently ignored |
| BR-P7 | Approved | Gift units (buy X get Y) are lines with a zero price. They consume stock |
| BR-P8 | Baseline | There is no redemption cap and no per-customer usage cap beyond BR-P1 through BR-P5. Adding one is a new decision |
| BR-P9 | Approved I8 | A refund is an amount in Rupiah against the order, not a recomputed promotion. It cannot exceed the amount still refundable. How a discount would split across lines is undefined and must not be invented |

Reference: two B01-2M-BLK and one B03, with KABEL10 and GRATISONGKIR and Kurir A, total Rp587.250. HEMAT50 does not apply because the eligible subtotal is Rp318.000 against a Rp500.000 minimum. The shortfall shown to the customer is Rp182.000.

## 3. Stock

| ID | Status | Rule |
|---|---|---|
| BR-S1 | Approved | Available quantity is on hand minus reserved |
| BR-S2 | Approved D6, R6 | Stock is reserved when the order is created, including gift units, and only after a fresh stock and price check |
| BR-S3 | Approved D6 | Reservation length follows the payment method: QRIS 15 minutes, e-wallet 15 minutes, virtual account 24 hours |
| BR-S4 | Approved D6 | Expiry, payment failure that ends the order, and cancellation release the reservation. Successful payment commits it: on hand and reserved both decrease by the reserved quantity |
| BR-S5 | Approved | A line cannot be sold beyond available stock. The customer sees which SKU is short and by how many |
| BR-S6 | Approved P6 | A bundle consumes component stock. Halimun sunscreen and the morning bundle share the A04 pool |
| BR-S7 | Approved assumption | One stock location and one shipping origin per deployment |
| BR-S8 | Prototype only | The cap of 10 units per Halimun line in the prototype is a demo limit, not a business rule |
| BR-S9 | Approved by owner 27 Oct 2026 | When no gateway "expire" event arrives, the server expires an unpaid or failed order itself, 5 minutes after the BR-S3 window ends (grace for a late webhook), and releases its reservation. This is the one payment-status change that does not come from a verified webhook; it never comes from the browser |
| BR-S10 | Approved by owner 27 Oct 2026 | A payment that arrives after the order expired does not revive it (its stock may be sold). The order history and audit log record "Pembayaran masuk setelah kedaluwarsa · perlu refund manual" for Ops to refund |
| BR-S11 | Approved by owner 27 Oct 2026 | Order and stock changes run in one locked transaction: the order row first, then stock rows in SKU order. A repeated or racing webhook, refund, or courier event sees the latest state, so stock and refunds are never applied twice |
| BR-S9 | Approved | Low stock means available quantity at or below 10. The number 10 is the W00 display threshold |

Concurrent purchases of the last unit must not both succeed. The mechanism (row lock or conditional update) is specified in A3. The invariant is specified now: the sum of active reservations and committed sales for a SKU cannot exceed the received stock plus adjustments.

## 4. Checkout and orders

| ID | Status | Rule |
|---|---|---|
| BR-O1 | Approved assumption | There is no guest checkout. Guests may hold a cart |
| BR-O2 | Approved I3, L1 | Checkout is three steps: Pengiriman, Ringkasan, Pembayaran |
| BR-O3 | Approved I4 | The order is created only when the customer confirms "Buat pesanan", after stock and price are re-checked. A price change returns the customer to the cart with the new total. A stock shortage names the SKU |
| BR-O4 | Approved I9 | Order numbers are `ORD-YYMMDD-NNNN`. The date is the creation date in Asia/Jakarta. The sequence is per store, per calendar day, from 0001 to 9999 |
| BR-O5 | Approved D7, R5 | On sign-in, the guest cart merges into the account cart. Same SKUs add. The result is capped by available stock. The customer is told which lines were capped |
| BR-O6 | Approved I6 | Wishlist requires a signed-in customer |
| BR-O7 | Approved I7 | Tracking is visible only inside the owning customer's account. Another customer's order number returns the same response as an unknown number |
| BR-O8 | Approved | Payment status and fulfilment status are separate. "Diterima" is set from a courier event, not from a staff click and not from the payment page |
| BR-O9 | Approved | A shipment with no courier event for more than 72 hours is flagged "update terlambat". The flag is not a new status (OD-10) |
| BR-O10 | Baseline P10 | After the order is handed to the courier, a refund cannot be recorded until a returns flow exists |
| BR-O11 | Approved I8 | Before shipment, Owner and Admin may record a refund with a reason, for an amount no greater than the remainder. Operasional and CS cannot |
| BR-O12 | Approved | Creating an order requires an idempotency key. Repeating the same key returns the original order and does not reserve stock twice |
| BR-O13 | Approved | A shipping quote is an estimate. It is not a guaranteed delivery date. Changing address, lines, or quantities invalidates the quote. The prototype's flat rates are fixtures, not a tariff |

Payment states the customer can see: menunggu pembayaran, dibayar, pembayaran gagal, kedaluwarsa, direfund, direfund sebagian. A failed attempt may be retried until the window expires. Expiry cancels the fulfilment and releases stock.

Fulfilment states: menunggu pembayaran, perlu diproses, diproses, dikirim, dalam perjalanan, diterima, dibatalkan. Staff move a paid order into processing and then register shipment handoff with a tracking number of 8–30 characters from A–Z, 0–9, and hyphen (P11, until a courier's own format replaces it).

## 5. Identity and access

| ID | Status | Rule |
|---|---|---|
| BR-A1 | Approved P7, C9 | Five failed customer or staff sign-ins lock the account for 15 minutes. The message does not say whether the email or the password was wrong |
| BR-A2 | Approved R4 | The post-login redirect is an internal path only |
| BR-A3 | Approved C9 | Staff sign-in requires a TOTP code. Staff cannot use Google. Staff cannot reset their own password. The Owner resets it |
| BR-A4 | Approved D10, C8 | Roles are Owner, Admin, Operasional, Marketing, and CS. Anything not granted below is denied |
| BR-A5 | Approved C1 | CS cannot search customers by email or phone |
| BR-A6 | Approved C2 | Full contact is visible to Owner and Admin. Operasional and CS see a mask. Revealing it requires one of the three reasons, lasts 60 seconds, and is logged. Marketing has no contact access |
| BR-A7 | Approved C4, C11 | Only the customer changes consent. Transactional email is always sent. Transactional WhatsApp is sent only when `waOrderInfo` is granted. Marketing email is sent only when `emailPromo` is granted. WhatsApp is never used for marketing. The check happens at send time |
| BR-A8 | Approved D16 | A WhatsApp number is checked as 08 or +62 with 10–13 digits. There is no SMS or WhatsApp OTP |
| BR-A9 | Approved C3 | Export of customer personal data, and a deletion request, are Owner and Admin actions. Deletion anonymises personal fields and keeps the financial record |

### Access matrix (board X12)

U = change, L = view, Samar = masked contact with timed reveal, — = no access.

| Module | Owner | Admin | Operasional | Marketing | CS |
|---|---|---|---|---|---|
| Dashboard and analytics | L | L | L | L | — |
| Orders | U | U | U | — | L |
| Refunds | U | U | — | — | — |
| Customer contact | Penuh | Penuh | Samar | — | Samar |
| Products and inventory | U | U | U | L | L |
| Promotions and content | U | U | — | U | — |
| Reports and export | U | U | — | — | — |
| Settings | U | U | Shipping only | — | — |
| Users and audit log | U | L (log only) | — | — | — |

Admin paths follow the sitemap: `/admin/settings/users` and `/admin/settings/payments`.

## 6. Addresses

| ID | Status | Rule |
|---|---|---|
| BR-D1 | Approved D13 | Required: recipient, phone, province, city or regency, district, postal code, street detail |
| BR-D2 | Approved D13 | Optional: kelurahan, label, note |
| BR-D3 | Approved | The order stores a snapshot of the address and of the prices. Later edits to the address book or the catalogue do not rewrite the order |

## 7. Catalogue presentation

| ID | Status | Rule |
|---|---|---|
| BR-C1 | Approved D2, L3 | Comparison holds at most four products, and only from the same top-level category. Desktop shows up to four columns. Mobile shows two, with the first column pinned |
| BR-C2 | Approved D9 | Category listings use numbered pages of 24 products. Mobile may offer "Muat lebih banyak" against the same page URLs. Filtered URLs canonicalise to the unfiltered category URL |
| BR-C3 | Approved I1, I2 | Public slugs are Indonesian. Admin paths are English. Product URLs are `/produk/{slug}` |
| BR-C4 | Approved L4 | Filter chrome is configuration: sidebar or top bar. Both brands share one filter logic and one mobile sheet |
| BR-C5 | Approved D8 | Reviews are display-only and may be labelled verified purchase. Customers cannot submit a review in this release |
| BR-C6 | Baseline OD-09 | Production search accepts a query of at least two characters, applies the synonym map, tolerates one edit at four letters and two edits at eight, and ranks name, then synonym, then category, then attribute. Autocomplete returns at most six products and three categories. The prototype's substring match remains the regression baseline for the W00 synonym and length cases |

## 8. Analytics

Days are 00:00:00–23:59:59 Asia/Jakarta. Paid amounts bucket by payment time. Refunds bucket by the refund record time. A range with no data shows an empty state, not fabricated zeros.

| ID | Metric | Formula |
|---|---|---|
| BR-N1 | Net revenue | Sum of totals of orders that reached paid, minus refunds recorded in the range. Totals include shipping after vouchers |
| BR-N2 | Paid orders | Count of orders that reached paid, including orders later refunded. Pending and expired orders are excluded |
| BR-N3 | Average order value | BR-N1 divided by BR-N2, floored. Zero orders yields zero |
| BR-N4 | Conversion | Paid orders in the range divided by sessions in the range. Sessions are a visitor measure. They are not derived from the order table. The W00 denominator 1.240 is a fixture until a real session source exists |
| BR-N5 | Refunds | Sum of refund amounts recorded in the range |
| BR-N6 | Payment completion | Paid divided by (paid + expired) in the range. Orders still pending are outside the denominator |
| BR-N7 | Repeat buyers | Customers with at least two paid orders, divided by customers with at least one, all-time (C7), not clipped to the report range |
| BR-N8 | Promotion usage | Count of orders that used a code, by payment status. Pending use is not campaign performance. Attribution, when a campaign source exists, is the last touch within 7 days |

Analytics events and exports contain no name, email, phone, or address. CS cannot open analytics.

## 9. Audit and time

| ID | Status | Rule |
|---|---|---|
| BR-U1 | Approved | Every admin mutation appends an audit record: actor, time, action, object, previous value, new value. No API updates or deletes an audit record |
| BR-U2 | Approved | Stored timestamps are absolute. Displayed timestamps are Asia/Jakarta |
| BR-U3 | Approved D14 | Admin and storefront copy is Bahasa Indonesia. Status labels map to stable English codes in the API |

## 10. Worked example the rules must keep

W00 snapshot 20 Oct 2026, 10:16 WIB, fictional data only.

Net revenue Rp2.097.000 = gross paid Rp2.334.000 − refund Rp237.000. Eight paid orders. AOV Rp262.125. Payment completion 88,9% because ORD-261018-0006 expired. Conversion 0,65% only while the session fixture is 1.240. Repeat buyers are C-0002 and C-0003, 2 of 6 customers who have ever paid.
