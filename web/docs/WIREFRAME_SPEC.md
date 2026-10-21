# WIREFRAME_SPEC (M2)

Canvas page "M2 — Wireframes". Low fidelity: greyscale, placeholder images, no brand styling. Every board shows desktop 1440 px and mobile 390 px. All numbers come from W00 (MOCK_DATA_CONTRACT.md).

| Board | Screens | Key structure |
|---|---|---|
| W00 | — | Single mock dataset snapshot (20 Okt 2026, 10:16 WIB) |
| W01 | S01 Brand B | Promo bar · header with always-visible search · type mega-menu + "Cari per Konektor" · split hero · connector tiles · flash-sale band with countdown · best-sellers grid with compare checkbox · guide + bulk-inquiry bands · trust strip · footer. Mobile: search under header, connector chips, 2-col grid, accordion footer |
| W02 | S01 Brand A | Centred logo, editorial nav · full-bleed hero with story card · skin-concern tiles · bundle feature · "Pilihan Kami" (editorial) · ingredient education · verified reviews (demo data) · journal · footer. Mobile: search behind icon, concern tiles first |
| W03 | S02, S03 | Breadcrumb, count, sort · active filter chips · sidebar facets with counts, zero-count options disabled · 3-col grid · pagination · compare tray (2/4). Mobile: Filter/Sort bar, filter sheet with "Terapkan (n produk)" |
| W04 | S07 | Thumbnails + gallery · variant chips (sold-out disabled) · low-stock text · qty + add-to-cart with line total · shipping estimate (simulated) · tabs: specs, compatibility, comparison, FAQ, reviews · complementary products. Mobile: accordions + sticky purchase bar |
| W05 | S09, S10 | Drawer with confirmation, lines, subtotal, checkout. Mobile cart page with savings line. States: qty over stock, price changed, variant sold out, empty |
| W06 | S15, S16 | Checkout header with stepper · signed-in identity · address cards · shipping service cards (one unavailable) · order summary. Mobile: progress bar, new-address form with validation |
| W07 | S17, S18 | Address/courier summary with "Ubah" · line items · voucher input with rejection reason · applied voucher chips · price breakdown, total savings, PPN note |
| W08 | S19–S21 | Payment methods (QRIS, VA, e-wallet, future option disabled) · "Buat Pesanan" · result states. Mobile pending page: countdown, QR, how-to, check status, change method, cancel, labelled prototype event panel |
| W09 | S27 | Account sidebar · status headline · overdue-update notice · timeline · items, payment, address. Mobile: progress segments, timeline |
| W10 | A01 | Sidebar nav with counts · date range + timezone · 4 KPI cards with formulas · daily revenue bars · action list · low stock · top products · recent transactions · campaign row |
| W11 | A07 | Payment vs fulfilment badges · lines · status history with actor · masked customer contact with logged reveal · ship dialog. Mobile: pinned actions |
| W12 | — | Alternatives L1–L4 with trade-offs and decisions |
| Board 16 | A11 | CMS editor: block list, live preview, properties/SEO/schedule panel, validation list |

## Layout rules established
1. Primary action: dark filled button; secondary: outlined; tertiary: underlined text.
2. Mobile primary actions sit in a bottom bar on PDP, cart and checkout.
3. Prices always show the final price; strikethrough only with a real "was" price from the dataset.
4. Simulated data (shipping rates, payment, courier events) is labelled "simulasi".
5. Disabled options stay visible with the reason (e.g. "Habis", "Tidak tersedia untuk alamat ini").
6. Personal data in admin is masked by default.
