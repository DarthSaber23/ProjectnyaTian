# Session handoff, 27 Oct 2026

Read this first when continuing. Everything below is also on disk; nothing depends on the previous chat.

## Resume here

Item 1 (real product images in MinIO) is mid-brainstorm (`superpowers:brainstorming`, architectural path). All five design sections are approved and the spec is written but **not yet reviewed by the owner and not committed**: `docs/superpowers/specs/2026-10-27-product-images-design.md`. Its Appendix A (the demo photo list) is still empty because the photo research had not finished.

Next, in order:

1. **Finish the photo research.** The first run was stopped at the owner's request during the search stage (the verify stage never ran), so no final results exist. Re-run the workflow: script `docs/superpowers/handoff/demo-photo-sourcing.workflow.js`, args = the JSON in `docs/superpowers/handoff/demo-photo-sourcing.args.json` (pass it as a JSON value, not a string). It is read-only: searches open collections with `.claude/skills/design-taste-frontend/scripts/assets.mjs`, then a skeptic per group re-checks licence, Wikimedia `{{Trademarked}}`/`{{Personality rights}}`, brands, people and fit. No downloads. Interim, unverified refs from the interrupted run: `2026-10-27-photo-research-interim.json` (useful as hints only).
2. **Fill Appendix A** in the spec: per product (and per B01 colour), the chosen photo with creator, licence, credit required yes/no, source page; products without a safe photo keep their drawing.
3. **Review the spec** with fresh eyes (placeholders, contradictions, ambiguity, scope) and, with ultracode on, a multi-angle review workflow (security and personal data, consistency with the code, testability, accessibility, CLAUDE.md rules, completeness). Fix inline.
4. **Ask the owner to review the spec and approve the Appendix A list.** Downloading the photos needs the owner's explicit OK.
5. Commit the spec only when the owner asks (CLAUDE.md pre-commit checklist).
6. Invoke `superpowers:writing-plans`, then the owner picks how to execute.
7. Implement with TDD; before any `web/` code run `design-taste-frontend`, `ui-ux-pro-max` and `frontend-design:frontend-design`; `/code-review` on the diff; deploy to dev; `docker compose exec api npm run media:seed`; run the checks.
8. Then item 2 (SEO Specialist and articles) brainstorming. It depends on item 1.

## The owner's six items (27 Oct)

| # | Item | Status |
|---|---|---|
| 1 | Real images in MinIO | Brainstorm: design approved, spec written, research and owner review pending |
| 2 | SEO Specialist role + articles | Not started (needs item 1); notes below |
| 3 | Login fix | Done, commit `1ce64a8`, live on dev |
| 4 | Caching | Done, commit `4e13276`, live on dev |
| 5 | Race conditions / stock | Done, commit `634bb17`, live on dev |
| 6 | E2E on dev | Answered; full `web/e2e/api-smoke.mjs` stops at the reference cart because the seeded flash sale (20–22 Oct) ended. Owner decision pending (recommended: compare the page total with the server's price for the same cart) |

The three commits are on `main` and **not pushed**. Pre-existing untracked files (`.claude/`, `.graphify/`, `CLAUDE.md`, `architecture.md`, `scripts/`, root `package.json`, setup notes) were never committed; `.graphify/` was updated per the checklist and stays untracked.

## Item 1 decisions (all approved by the owner)

- Purpose: real sample photos on the demo now, plus a staff upload flow.
- Demo photo source: free-licence photos (prefer CC0/public domain/Unsplash/Pexels; CC BY credited; CC BY-SA only if nothing else; never NC/ND), marked as samples to replace per client.
- Roles: Owner, Admin, Marketing (new permission `products.media`). Operations and CS cannot.
- Up to 6 photos per product; first is the main photo; a variant can link to one photo.
- Admin screen: photos and alt text only (product details stay in B5).
- Brief assumptions confirmed: square frames stay; drawing is the fallback; alt text required (default "Foto {nama produk}"); audit every change; served from the shop's own domain with a one-year cache; JPEG/PNG/WebP up to 10 MB with GPS and all metadata stripped; sample sources recorded.
- Approach A: `sharp` makes WebP at 480/960/1600 px at upload, stored in MinIO `media/products/{productId}/{hash16}-{width}.webp`, served by nginx `/media/` with `immutable`.
- Mockups chosen: product page **A** (thumbnails under the main photo); admin **B** (photo list). No zoom this round. Mockup files: `.superpowers/brainstorm/316-1793097478/content/` (gitignored, local only).
- Traps already written into the spec: nginx `client_max_body_size` default 1 MB (set 11m); `api()` forces a JSON content type (must not for `FormData`); the web container needs `extra_hosts` to reach MinIO; MinIO ports 9000/9001 are closed from the internet (good).

## Item 2 notes to carry forward

Decisions to ask the owner: publish directly or Owner/Admin approval first; what "link the article" means (article → product, product → articles, nav/footer/home, or all); Bahasa only or also English (`hreflang`); `/artikel/{slug}` or `/blog/{slug}` and final domains; who owns Search Console and GA4. Article fields: title, slug, SEO title (≤60), meta description (≤160), summary, body, cover image + alt, author, status (draft/scheduled/published), dates, canonical, noindex, tags, linked products. Site needs: `sitemap.xml`, `robots.txt`, JSON-LD (Article, Product, Breadcrumb), 301 on slug change, audit, a content-only `seo` role. Main architecture issue: the storefront is client-rendered, so articles and product pages need server-rendered or prerendered HTML for share previews and indexing.

## Open follow-ups (not started)

- Security headers on pages nginx serves (X-Frame-Options, nosniff, Referrer-Policy): proposed, needs owner OK.
- Web image build does not run `nginx -t` (it was run by hand at deploy).
- New public API routes must be added to `server/src/cache-policy.ts`.
- When TLS is enabled: review gzip of personal JSON (BREACH).
- B2: move payment status and expiry out of the order JSON into indexed columns.
- B4: per-staff TOTP enrolment, staff server-side session length, revoke the previous token on re-sign-in.
- Local cross-origin dev needs `CORS_ORIGINS` in `server/.env`.
- Owner to do: `npm run totp:setup` in `server/` and add the printed key to an authenticator (the staff secret was rotated; local `server/.env` and dev match).
- Dev data: Rina's account holds test orders; B01-1M-BLK onHand 41 (one paid test unit from the concurrency check).

## How the owner wants work done

- Brainstorm before building; one question at a time; architectural work gets a written spec, then a plan.
- TDD for all code; `/code-review` on every diff and fix or report each finding; design skills before any `web/` change.
- Deploy to dev, verify live, then rerun the sign-in check (`docs/superpowers/handoff/login-e2e.cjs`, run from `web/` with `STAFF_TOTP_SECRET` exported from `server/.env`: `node ../docs/superpowers/handoff/login-e2e.cjs "$(pwd)"`) and the concurrency check (`server/scripts/check-concurrency.mjs` with `BASE_URL=http://43.159.54.222` and `PAYMENT_SIMULATOR_TOKEN` from `server/.env`).
- Commit only when asked, after the CLAUDE.md checklist; stage only the change's files (never `git add -A`); end messages with the Co-Authored-By line; never push unless asked.
- Ultracode was on: use workflows for substantive tasks.

## Dev server operations (43.159.54.222)

Build the SSH key from the root `.env` `PRIVATE KEY` as `architecture.md` describes (into the session scratchpad, restrict with `icacls`, delete after use). Deploy: back up on the server (`tar czf /home/ubuntu/tian-backup-<date>-<label>.tgz` of `server`, `web` and `docker-compose.yml`), upload `server/` and/or `web/` as a tar excluding `.env`, `node_modules` and `dist`, check nginx with `docker run --rm --network tian_default -v /home/ubuntu/tian/web/nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx:1.27-alpine nginx -t`, then `docker compose up -d --build api web` in `/home/ubuntu/tian`. Existing backups: `tian-backup-20261027-pre-login-fix.tgz`, `-pre-stock-safety.tgz`, `-pre-caching.tgz`, and `server/.env.bak-20261027`.
