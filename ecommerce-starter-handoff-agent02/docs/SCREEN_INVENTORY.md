# SCREEN_INVENTORY

66 screens: 43 storefront, 23 admin. Each is designed at 390 px (mobile) and 1440 px (desktop); key screens are checked at 360, 768 and 1280 px. Priority: E = essential, S = supporting. Brand: A = cosmetics, B = accessories, Shared = one design re-skinned by tokens. "W" = wireframe board in M2.

## Storefront
| ID | Screen | Pri | Brand | Required states | M2 board |
|---|---|---|---|---|---|
| S01 | Homepage | E | A + B | Loading sections, promo bar, empty campaign slot | W01, W02 |
| S02 | Catalog listing | E | A + B | Loading, filtered, no results, error, sold-out badges | W03 |
| S03 | Filter & sort sheet | E | A + B | Active filters, clear all, live count | W03 |
| S04 | Search autocomplete | E | Shared | Recent, popular, suggestions, typo correction | — |
| S05 | Search results | E | A + B | Synonym notice, did-you-mean, no results, failure | — |
| S06 | PDP cosmetics | E | A | Variant, low stock, sold out, discount | — |
| S07 | PDP accessories | E | B | Variant unavailable, qty exceeds stock | W04 |
| S08 | Comparison | E | B (+A) | Empty, 1 item, max, missing attribute, differences only | W12 (L3) |
| S09 | Cart drawer | E | Shared | Added, updating, error, empty | W05 |
| S10 | Cart page | E | Shared | Empty, stock/price changed, invalid qty | W05 |
| S11 | Login + Google (mock) | E | Shared | Wrong credentials, checkout notice | — |
| S12 | Register | E | Shared | Validation, email used, consent | — |
| S13 | Forgot / reset password | E | Shared | Sent, expired link, success | — |
| S14 | Account recovery | E | Shared | Steps, CS fallback | — |
| S15 | Checkout address | E | Shared | Saved, new, validation | W06 |
| S16 | Checkout shipping | E | Shared | Loading, unavailable, provider error, invalidated | W06 |
| S17 | Checkout voucher | E | Shared | Applied, invalid, expired, ineligible, conflict | W07 |
| S18 | Checkout review | E | Shared | Breakdown, re-check failure | W07 |
| S19 | Payment method | E | Shared | Method unavailable | W08 |
| S20 | Payment pending | E | Shared | QR, VA copy, countdown | W08 |
| S21 | Payment result | E | Shared | Paid, failed, expired, cancelled | W08 |
| S22 | Order confirmation | E | Shared | Paid | — |
| S23 | Account dashboard | E | Shared | New, returning | — |
| S24 | Profile | E | Shared | Saved, validation | — |
| S25 | Address book | E | Shared | Empty, default, delete confirm | W06 (form) |
| S26 | Order history | E | Shared | Empty, filters, pending highlight | — |
| S27 | Order detail + tracking | E | Shared | Each status, delay, exception, no ref | W09 |
| S28 | Wishlist | E | Shared | Empty, sold out, move to cart | — |
| S29 | Communication preferences | E | Shared | Opt-in/out, saved | — |
| S30–S43 | Supporting pages (about, contact, bulk inquiry, FAQ, blog, article, campaign, collection, shipping info, privacy, terms, returns, 404, error) | S | mixed | See canvas board 03 | — |

## Admin
| ID | Screen | Pri | M2 board |
|---|---|---|---|
| A01 | Dashboard | E | W10 |
| A02–A04 | Products, product edit, categories | E | — |
| A05 | Inventory | E | — |
| A06 | Order list | E | — |
| A07 | Order detail | E | W11 |
| A08–A09 | Promotions, promotion edit | E | — |
| A10 | Content list | E | — |
| A11 | Block editor | E | Board 16 (wireframe) |
| A12 | SEO panel | E | — |
| A13–A14 | Customers, customer profile | E | — |
| A15 | Analytics | E | — |
| A16–A23 | Reports, users & roles, settings ×4, audit log, admin sign-in | S | — |

Screens marked "—" are wireframed as part of M4/M5 high-fidelity work, using the patterns already approved in M2.
