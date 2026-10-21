# COMPONENT_INVENTORY (M3, awaiting approval)

Shown on canvas board M3-4 (switch theme with the board's Tweaks → brand A/B). Names match planned React components.

| # | Component | Variants | States | Accessibility | Brand extension points |
|---|---|---|---|---|---|
| 01 | Button | primary, secondary, tertiary, danger; sm/md | default, hover, focus, active, disabled, loading | native `<button>`, aria-busy when loading | radius.control, fonts |
| 02 | IconButton | outline, ghost | as Button | required aria-label | shape (circle A / square B) |
| 03 | TextField | text, number, textarea | default, focus, error + message, disabled, read-only | `<label>` + aria-describedby for help/error | radius, border-strong |
| 04 | Select | native, searchable (regions) | as TextField | native select on mobile | — |
| 05 | SearchField | header, page | empty, typing, clear | role="combobox" with listbox | pill (A) / square (B) |
| 06 | Checkbox | — | on, off, indeterminate, disabled | 44 px row, label click | radius.sm |
| 07 | Radio | — | on, off, disabled | radiogroup, arrow keys | — |
| 08 | Tabs | underline | active, inactive, focus | tablist / tab / tabpanel | — |
| 09 | Badge | accent, soft, neutral, warning, danger | — | text always present | pill (A) / rect (B) |
| 10 | Price | regular, from, strikethrough, flash, total | — | "harga sebelumnya" announced for strikethrough | accent colour on flash (A) |
| 11 | StatusChip | 8 order statuses | — | text + colour | colours via tokens |
| 12 | VariantSelector | chips, swatches (future) | selected, available, unavailable | radiogroup; unavailable keeps reason | control radius |
| 13 | QuantitySelector | — | min, normal, max + message | buttons with labels "Kurangi" / "Tambah", live region for max | mono digits (B) |
| 14 | ShippingOptionCard | — | selected, available, unavailable, loading | radio card | — |
| 15 | PaymentMethodCard | QRIS, VA (bank list), e-wallet, future | selected, available, unavailable | radio card | — |
| 16 | ProductCard | editorial, compact | default, sale, sold out, loading | link wraps title; actions are separate buttons | default variant per brand config |
| 17 | Skeleton | card, line, block | — | aria-busy on container; static with reduced motion | — |
| 18 | Alert | info, warning, danger, success | — | role="status" or "alert" by severity | — |
| 19 | Toast | success, error, info | enter, exit | role="status", 5 s, pausable | — |
| 20 | Dialog | confirm, form | open | focus trap, Esc, return focus | radius.lg |
| 21 | Drawer | right panel, bottom sheet | open | as Dialog | — |
| 22 | Breadcrumb | — | — | nav + aria-current | — |
| 23 | Pagination | numbered, load-more | current, disabled | nav, aria-current | shape |
| 24 | StepIndicator | checkout 3 steps | done, current, upcoming | ordered list, aria-current="step" | — |
| 25 | EmptyState | cart, wishlist, search, orders | — | heading + action | illustration slot |

Customisation rule: a client fork may replace any component; shared commerce logic (pricing, stock, status) lives in hooks/services, not inside these components.
