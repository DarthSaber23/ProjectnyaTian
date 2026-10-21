# DESIGN_SYSTEM (M3, awaiting approval)

Source: canvas page "M3 — Visual Direction & Design System". Token files: `tokens/brand-a.json`, `tokens/brand-b.json` (identical keys).

## Principles
1. Components read **semantic tokens only**; brand values live in token files.
2. Brand difference comes from tokens **and** composition config (card variant, filter layout, grid density, homepage sections), not colour alone.
3. Every text/background pair ≥ 4.5:1; control borders and focus rings ≥ 3:1 (WCAG 2.2 AA).
4. State is never shown by colour or motion alone.

## Brand directions
| | Brand A — Halimun (working name) | Brand B — Sambung (working name) |
|---|---|---|
| Feeling | Calm, editorial, warm | Precise, technical, fast |
| Ground / text | Linen #F7F4EF / Bark #23201D | White / Ink #0E1726 |
| Primary | Sage #4F6B57 | Signal Blue #1F5AE0 |
| Promo accent | Terracotta #8C3B2E (text or fill) | Amber #F5A524 (fill only, dark text) |
| Display / body | Newsreader / Figtree | Space Grotesk / IBM Plex Sans (+ JetBrains Mono for specs) |
| Shape | Pill controls, 16 px cards, soft shadow | 6 px controls and cards, hairline borders |
| Composition | 3-col editorial grid, top filter bar, editorial card | 4-col dense grid, sidebar filters, compact card with specs |

All typefaces: SIL Open Font Licence.

## Foundations
- **Colour roles:** bg, surface, surface-alt, text, text-muted, text-disabled, border, border-strong, primary, on-primary, primary-soft, primary-ink, accent, on-accent, success(-soft), warning(-soft), danger(-soft), focus, disabled-bg.
- **Type scale (px, desktop / mobile):** display.xl 48/56 · 34/40 · display.l 36/44 · 28/34 · heading.1 28/36 · 24/32 · heading.2 22/30 · 20/28 · heading.3 18/26 · body.l 18/28 · body 16/24 · body.s 14/20 · caption 12/16.
- **Spacing:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- **Radius:** sm / md / lg / control (see token files).
- **Elevation:** none, card, overlay.
- **Motion:** fast 120 ms, base 200 ms, slow 280 ms, ease cubic-bezier(0.2, 0, 0, 1); reduced motion → opacity only.
- **Focus:** 2 px outline, 2 px offset, :focus-visible.
- **Targets:** ≥ 44 × 44 px.

## Measured contrast (selected)
A text/bg 14.8 · A muted/bg 5.4 · A primary/bg 5.4 · A on-primary 5.9 · A accent/bg 6.9 · A border-strong/surface 3.8 · B text/bg 18.0 · B muted 7.5 · B primary 5.8 · B on-accent 8.8 · B border-strong 3.6 · all soft status pairs 4.7–8.3. Disabled text (2.6–3.1) is exempt and always paired with a reason.
