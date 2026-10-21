# DESIGN_SCOPE

Source: canvas page "M0 — Scope & Brief", board 01. Approved 20 Oct 2026.

## Classification
- **Essential** — designed in high fidelity and working end to end in the React prototype.
- **Supporting** — templated high-fidelity pages, or admin wireframes.
- **Future** — not built; shown only as a clearly labelled preview where a seam is needed.

## Essential
**Storefront**
- Homepage from configurable sections (two brand compositions)
- Catalog: categories, grid, card variants, filters, sort, availability, badges, counts, pagination
- Search: autocomplete, recent/popular, typo tolerance, synonyms, no-results
- PDP (product detail page): variants, stock, quantity, wishlist, shipping estimate, reviews display, recommendations, content block library
- Product comparison (max 4, same category — D2)
- Cart drawer and cart page
- Authentication: email/password, Google sign-in (mock), forgot password, recovery, logout, checkout redirect, guest-cart merge (D7)
- Checkout: Pengiriman → Ringkasan → Pembayaran (I3)
- Payment simulation: QRIS (Indonesian standard QR payment), VA (virtual account), e-wallet; pending / paid / failed / expired / cancelled
- Account: dashboard, profile, addresses, orders, order detail + tracking, wishlist, communication preferences

**Admin (high fidelity)**
Dashboard · products & categories · inventory · orders · promotions · CMS (content management system) block editor & SEO (search engine optimisation) · customers · analytics

**Foundations**
Design tokens, core components, two showcase brands, all critical UI states, WCAG 2.2 AA (Web Content Accessibility Guidelines) target.

## Supporting
About, contact, bulk-purchase inquiry, FAQ, blog index/article, campaign and collection landing pages, shipping info, legal placeholders (labelled for legal review), 404 and error pages, recently viewed. Admin wireframes: advanced reports, users & roles, store, shipping, payment, notification settings, audit log, admin sign-in.

## Future
B2B pricing/quotation · real gateways and shipping providers · real OAuth · machine-learning recommendations · review submission & moderation · self-service returns · loyalty, gift cards, subscriptions · multi-language/currency · live chat / WhatsApp Business API · multi-warehouse · PWA (progressive web app) offline and push · OTP (one-time password) phone verification · public order tracking by number.
