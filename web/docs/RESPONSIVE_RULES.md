# RESPONSIVE_RULES (M3, awaiting approval)

Mobile-first min-width breakpoints: base 0 · sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1440. Grid: 4 cols (gutter 16) → 8 cols at md (gutter 24) → 12 cols at lg+. Content max width 1280 px. Validation widths: 360, 390, 768, 1280, 1440.

| Pattern | < 768 | 768–1023 | 1024–1279 | ≥ 1280 |
|---|---|---|---|---|
| Header | Logo, icons, menu sheet; B search always visible | Same, wider search | Full nav (A centred logo, B mega-menu) | Same |
| Search | Full-screen overlay | Overlay | Dropdown 480 px | Dropdown 640 px |
| Product grid | A 2 · B 2 | A 2 · B 3 | A 3 · B 3 | A 3 · B 4 |
| Filters | Bottom sheet, live count | Bottom sheet | A top bar · B sidebar 240 | A top bar · B sidebar 260 |
| Comparison | 2 cols, first pinned, swipe | 3 cols | 4 cols | 4 cols |
| PDP | Swipe gallery, accordions | Stacked, 2-col specs | Gallery 60 / info 40 | Thumbs + gallery + info |
| Purchase action | Sticky bottom bar | Sticky bottom bar | Inline, sticky info column | Same |
| Cart | Full page; drawer as bottom sheet | Drawer 420 | Drawer 420 | Drawer 440 |
| Checkout | One column, collapsed summary, bottom bar | One column | Form + 360 summary | Form + 420 summary |
| Dialogs | Bottom sheet | Centred 560 | Centred 560 | Centred 560 |
| Admin nav | Drawer | Icon rail 72 | Sidebar 220 | Sidebar 220 |
| Admin tables | Stacked cards | Scroll box, first column pinned | Full table | Full table |
| Footer | Accordions | 2 cols | 4 cols | 4 cols |

Rules: no horizontal page scroll; sticky elements ≤ 25% of viewport height; body text ≥ 14 px; at 360 px titles wrap to 2 lines then truncate (full title kept in the accessible name).
