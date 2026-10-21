# MOCK_DATA_CONTRACT (draft, M2)

One deterministic dataset feeds every wireframe, mockup and the React prototype. Snapshot: **20 Okt 2026, 10:16 WIB**, just after ORD-261020-0010 was created. All people, addresses, couriers, banks and references are fictional.

## Rules
- Money: integer Rupiah. Percentage discounts per unit, `floor` to Rp1 (D4).
- Stock: `available = on_hand − reserved`; low-stock threshold 10.
- Time: ISO 8601 with explicit `+07:00` (Asia/Jakarta).
- Identifiers: `ORD-YYMMDD-NNNN`, customers `C-NNNN`, SKUs as below. No names, emails, phones or addresses in analytics events.

## Brand B products (store used for orders and dashboard)
| SKU | Product / variant | Price | Was | Promo | On hand | Reserved | Available |
|---|---|---|---|---|---|---|---|
| B01-1M-BLK | Kabel USB-C ke USB-C 100W Braided · 1 m · Hitam | 129000 | 149000 | Strikethrough | 42 | 0 | 42 |
| B01-2M-BLK | … · 2 m · Hitam | 159000 | — | — | 9 | 2 | 7 |
| B01-2M-WHT | … · 2 m · Putih | 159000 | — | — | 0 | 0 | 0 |
| B01-3M-BLK | … · 3 m · Hitam | 189000 | — | — | 15 | 0 | 15 |
| B02 | Adaptor USB-C ke HDMI 4K60 | 219000 | — | — | 23 | 0 | 23 |
| B03 | Charger GaN 65W 3 Port | 299250 | 399000 | FS-WEEKEND −25% | 12 | 1 | 11 |
| B04 | Hub USB-C 7-in-1 | 549000 | — | — | 4 | 0 | 4 |
| B05 | Kabel USB-C ke Lightning · 1 m | 149000 | — | — | 30 | 0 | 30 |
| B06 | Kabel HDMI 2.1 8K · 2 m | 179000 | — | — | 0 | 0 | 0 |
| B07 | Kabel USB-A ke USB-C · 1 m | 69000 | — | — | 120 | 0 | 120 |
| B08 | Kabel DisplayPort 1.4 · 2 m | 199000 | — | — | 18 | 0 | 18 |

## Brand A products
A01-100 Cleanser 100 ml 119000 · A01-200 200 ml 189000 · A02 Moisturizer 169000 · A03 Serum 149000 (was 179000) · A04 Sunscreen Gel 139000 (9 available) · A05 Travel Cleanser 45000 · BND-PAGI bundle 379000 (was 427000).

## Promotions
| Code | Rule |
|---|---|
| FS-WEEKEND | 25% on B03, 20 Okt 00:00 – 22 Okt 23:59 WIB; excluded from order vouchers |
| KABEL10 | 10% on category Kabel, max 30000 |
| HEMAT50 | 50000 off, min 500000 excluding flash-sale items |
| GRATISONGKIR | Shipping voucher up to 20000, min 300000 |
| BND-PAGI | Bundle A01-100 + A02 + A04 |
| B2G1-SERUM | Buy 2 A03, get 1 A05 |

## Shipping quotes (simulated, 1 kg, Jakarta Barat → Kota Bandung)
Kurir A Reguler 18000 (2–3 hari) · Kurir B Hemat 15000 (3–5) · Kurir C Kilat 27000 (1) · Kurir D Same Day: no service.

## Reference checkout — ORD-261020-0010 (C-0001)
B01-2M-BLK ×2 = 318000 · B03 ×1 = 299250 · subtotal 617250 · KABEL10 −30000 (31800 capped) · shipping 18000 · GRATISONGKIR −18000 · **total 587250** · QRIS, expires 10:30 WIB. HEMAT50 rejected (eligible subtotal 318000 < 500000).

## Orders 14–20 Okt 2026
| Order | Total | Status | Payment |
|---|---|---|---|
| ORD-261014-0001 | 147000 | Diterima | QRIS paid |
| ORD-261014-0002 | 417000 | Diterima | VA paid |
| ORD-261014-0003 | 386000 | Dalam Perjalanan | VA paid |
| ORD-261016-0004 | 87000 | Diterima | E-wallet paid |
| ORD-261017-0005 | 567000 | Diproses | VA paid |
| ORD-261018-0006 | 237000 | Dibatalkan | QRIS expired |
| ORD-261019-0007 | 217000 | Dibayar | QRIS paid |
| ORD-261019-0008 | 237000 | Dibatalkan | E-wallet paid, full refund 19 Okt |
| ORD-261020-0009 | 276000 | Dibayar (→ Diproses 10:20 in W11) | VA paid |
| ORD-261020-0010 | 587250 | Menunggu Pembayaran | QRIS pending |

## Customer C-0001 extras (added in M4 batch 2)
- Wishlist: B04 Hub USB-C 7-in-1 (4 available), B06 Kabel HDMI 2.1 (sold out).
- Recently viewed (device): B01, B03. Recent searches (device): "charger gan", "hdmi".
- Preferences: email promo off (changed 20 Okt), WhatsApp order info on, personal recommendations on.
- Orders: ORD-261014-0003 (Dalam Perjalanan, courier update overdue), ORD-261020-0010 (Dibayar at 10:21 WIB in the account views).
- Search synonym map (demo): "usb c", "usbc", "type c" → "USB Type-C"; length tokens "1m/2m/3m" → length filter.

## Derived metrics (D12)
Paid orders 8 · gross paid 2334000 · refunds 237000 · **revenue 2097000** · AOV 262125 · sessions 1240 (mock) · conversion 0,65% · daily revenue 14: 950000, 15: 0, 16: 87000, 17: 567000, 18: 0, 19: 217000, 20: 276000 · top product B01 (3 units, 387000).

Final typed interfaces are specified at M7.

## Customer directory (added M5 batch 2, X10)
Derived from orders 0001–0010. "Net" = paid − refunds (D12). Contacts other than C-0001 and all consent values other than C-0001 are **demo data** for filter testing.

| ID | Name | Masked email | Masked phone | Paid orders | Net (Rp) | Email promo / WhatsApp order info | Segment |
|---|---|---|---|---|---|---|---|
| C-0001 | Rina Pratama | r***@example.com | 0812-****-1234 | 1 (0003); 0010 pending | 386.000 | No / Yes | Pending payment |
| C-0002 | Budi H. | b***@example.com | 0813-****-2201 | 2 (0001, 0007) | 364.000 | Yes / No | Repeat buyer |
| C-0003 | Citra W. | c***@example.com | 0812-****-3356 | 2 (0002, 0009) | 693.000 | Yes / Yes | Repeat buyer |
| C-0004 | Dimas A. | d***@example.com | 0817-****-4403 | 1 (0004) | 87.000 | No / No | — |
| C-0005 | Eka P. | e***@example.com | 0819-****-5504 | 1 (0005) | 567.000 | Yes / No | — |
| C-0006 | Fajar N. | f***@example.com | 0821-****-6605 | 0 (0006 expired) | 0 | No / No | Never paid |
| C-0007 | Gita L. | g***@example.com | 0822-****-7706 | 1 (0008, fully refunded) | 0 | No / Yes | Has refund |
| **Total** | | | | **8** | **2.097.000** (= X01 revenue) | | |

## Brand A concern tags (added M6 batch 2, P02)
Assigned to reproduce the approved concern counts (Sensitif 3 · Kering 2 · Kusam 1 · Perlindungan 1). **Demo tagging, not product claims**; owner to confirm per real product.

| Concern | Products |
|---|---|
| Kulit sensitif | A01 Cleanser, A02 Moisturizer, A05 Travel Cleanser |
| Kulit kering | A01 Cleanser, A02 Moisturizer |
| Tampak kusam | A03 Niacinamide Serum |
| Perlindungan harian | A04 Daily Sunscreen Gel |

Stock: A04 has 9 available and BND-PAGI consumes one A04 per bundle, so sunscreen + bundle share the same 9 units. Other Brand A stock is not defined in W00; prototype caps quantity at 10 per line (prototype limit, not a business rule).

## Admin prototype orders (added M6 batch 3, P05)
Aligned with W11 (0009) and derived from totals (0007). Revealed contacts and the 0007 address are fictional demo values.

| Order | Customer | Items | Ship | Total | Payment | Address |
|---|---|---|---|---|---|---|
| ORD-261020-0009 | C-0003 Citra W. · citra@example.com · 0812-0000-3356 | B01-1M-BLK ×2 = 258000 | Kurir A 18000 | 276000 | VA Bank B, paid 20 Okt 08:47, ref SIM-PAY-20261020-0009 | Jl. Anggrek No. 3, Kec. Tebet, Kota Jakarta Selatan 12810 |
| ORD-261019-0007 | C-0002 Budi H. · budi@example.com · 0813-0000-2201 | B08 ×1 = 199000 | Kurir A 18000 | 217000 | QRIS, created 19 Okt 13:58, paid 14:05, ref SIM-PAY-20261019-0007 | Jl. Cempaka No. 21, Kec. Lowokwaru, Kota Malang 65141 |

Simulated clock in P05: each admin action advances 2 minutes from 10:20 WIB (0009 → Diproses 10:20 matches W11).
Sample tracking number: SIM-KA-88213010 (format 8–30 chars, A–Z 0–9 and hyphen).

## Account seeds (added M7 batch 2)
| Item | Value |
|---|---|
| Demo sign-in | rina@example.com / demo-rina-2026 (fictional, mock backend only) |
| Consent records | Email promo: off · 20 Okt 2026 08:02 WIB (time assumed; H14 states the date only) · WhatsApp order info: on · 14 Okt 09:10 · Personal recommendations: on · 14 Okt 09:10 |
| Wishlist | Sambung: B04, B06 · Halimun: empty |
| Seed order | ORD-261014-0003 as in H13 (B02 + B05, Rp386.000, resi SIM-KA-88213004, last courier event 15 Okt 18:22 → overdue) |
| Halimun order numbers | Start at ORD-261020-0001 (W00 has no Halimun orders) |

## Admin seed data (added M7 batch 3)
Items derived from totals (all Kurir A Rp18.000) and the X01 top-products list. Times marked * are demo values not shown on earlier boards.

| Order | Customer | Items | Created | Paid | Outcome |
|---|---|---|---|---|---|
| ORD-261014-0001 | C-0002 | B01-1M-BLK ×1 | 14 Okt 08:30* | 08:34* QRIS | Delivered, SIM-KA-88213001 |
| ORD-261014-0002 | C-0003 | B03 ×1 (Rp399.000, before flash sale) | 14 Okt 09:02* | 09:15* VA | Delivered, SIM-KA-88213002 |
| ORD-261014-0003 | C-0001 | B02 ×1, B05 ×1 | 14 Okt 09:12 | 09:20 VA | In transit (H13) |
| ORD-261016-0004 | C-0004 | B07 ×1 | 16 Okt 19:40* | 19:42* e-wallet | Delivered, SIM-KA-88213005 |
| ORD-261017-0005 | C-0005 | B04 ×1 | 17 Okt 14:10* | 15:02* VA | Diproses 18 Okt 09:10 (Dewi O.) |
| ORD-261018-0006 | C-0006 | B02 ×1 | 18 Okt 11:20* | — QRIS | Expired |
| ORD-261019-0007 | C-0002 | B08 ×1 | 19 Okt 13:58 | 14:05 QRIS | To process |
| ORD-261019-0008 | C-0007 | B02 ×1 | 19 Okt 15:30* | 15:33* e-wallet | Refunded 19 Okt 16:40 by Andi S. |
| ORD-261020-0009 | C-0003 | B01-1M-BLK ×2 | 20 Okt 08:41 | 08:47 VA | To process |

Customer addresses for C-0004 to C-0007 and full demo contacts are fictional (admin reveal tests). Staff: Andi S. (Owner), Dewi O. (Operasional), Rina M. (Marketing), Akun CS demo; password demo-staff-2026.
Check: paid gross 2.334.000 − refund 237.000 = 2.097.000; AOV 262.125; conversion 8 ÷ 1.240 = 0,65%; payment completion 8 ÷ 9 = 88,9%; repeat buyers 2 of 6.
