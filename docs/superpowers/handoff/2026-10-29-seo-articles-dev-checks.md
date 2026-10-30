# Articles and the SEO role: dev deploy and checks (30 Oct 2026)

Dev server 43.159.54.222, tree `/home/ubuntu/tian`, branch `feat/seo-articles` (uncommitted, staged). Deployed by Agent 02 (Claude) with the owner's go-ahead in chat.

## Rollout

| Step | Result |
|---|---|
| Backup | `/home/ubuntu/backups/2026-10-30-pre-seo-articles/`: `tree.tgz` (deployed tree without `node_modules`/`dist`), `tian.pgdump` (`pg_dump -Fc`, 22 tables of data), `media/` (9 objects) and `media-listing.txt`, `server.env` (copy of the env file before the change, mode 600). |
| `server/.env` | Added `PUBLIC_BASE_URL=http://43.159.54.222` and `SITE_BRAND=sambung` (values not otherwise printed; `GOOGLE_SITE_VERIFICATION` left unset). |
| `api` | Upload of `server`, `web`, `docker-compose.yml` without any env file (0 in the archive). Image build ran 506/506 tests. `prisma db push` added `Article`, `ArticleText`, `ArticleProduct`, `SlugRedirect`, `SeoOverride`; orders (90), product photos (3) and staff untouched. `/health` → `storage: minio`; `storage_init_ok`. |
| `web` | Template-aware `nginx -t` passed before the switch (renderer locations, `@spa`, `sitemap.xml`, `robots.txt`, `/__shell.html`, `/media/(products|articles)/`); `docker compose exec web nginx -t` passed after. |
| Seed | `content:seed -- --operator "Agent 02 (Claude)"`: added 4, skipped 0; demo SEO account `U-05` created; `restart api`. Public `/v1/articles` (store `sambung`) lists the two Sambung articles; the first has its English version and a cover from the B07 sample photo. |

## Fixes during the checks

| Found | Fix (test first) | Result |
|---|---|---|
| CLS 0.106 on `/blog` and 0.188 on an article at 390 px: the one-line "Memuat…" state left the footer on screen, and it jumped when the content arrived | every state of `BlogList` and `ArticlePage` reserves a screen of height (`min-h-[100svh]`) | `/blog` 0.000, article 0.000 |
| The footer "Blog" link on its own row made the footer taller, which raised the product page's existing loading jump from about 0.107 to 0.171 | link placed inline at the start of the existing footer line | product page back to the bare-shell level (below) |
| `seo-dev.mjs` compared canonical URLs with `process.env.PUBLIC`, which Windows sets to `C:\Users\Public` | variable renamed `PUBLIC_BASE` | canonical and sitemap checks pass |

## Checks after deploy

| Check | Result |
|---|---|
| `web/e2e/seo-dev.mjs` | 16/16: SEO staff lands on Blog with menu Produk, Blog, SEO; create, link B01, publish; crawler HTML (no JavaScript) of an article, a product and a category has title, description, canonical, `og:title`, JSON-LD (`BlogPosting`, `Product`, `CollectionPage`) and the page text in `#ssr`; renamed slug 301 to the new path; scheduled article 404 on the page and the API; sitemap lists the article and the product and not the scheduled one; robots names the sitemap and disallows `/admin`; shoppers see the article text once and no `#ssr`; "Produk di artikel ini", "Artikel terkait" on the product page, "Dari blog" on home, footer link; axe 0 serious/critical on `/blog`, an article, a product page and the editor; Operasional and Marketing 403 on the article and SEO API; SEO 403 on orders, customers, promotions and audit; test articles removed afterwards. |
| Sign-in check | 12/12 |
| Concurrency check | 12/12 |
| Audit | every `ARTICLE_*` entry has `actorId`; seeded entries show `CLI: Agent 02 (Claude)`, staff entries `Sinta P. (SEO)`; only the 4 sample articles remain |
| API log | no `ERROR` lines in the hour of checks |

## Layout shift (CLS) at 390 px

| Page | Result |
|---|---|
| `/blog`, an article | 0.000 after the fix |
| Product page | best of three 0.139 with the server-filled shell vs 0.137 with the bare `index.html` in the same run: no change from this item. Both swing between 0.107 and 0.16 from run to run. |
| Category page | 0.115 from the footer jump (as recorded for item 1) plus 0.004–0.044 from the web-font swap; the same with the bare `index.html` and with the old footer simulated. |

The product and category jumps come from the approved layout: the footer is on screen while the catalogue loads and is pushed down when the content arrives. Fixing it for all pages (for example a minimum height on `main` in `Layout`) changes an approved screen and is the owner's decision, as noted for item 1. The web-font share comes from Google Fonts; the release gate already asks for self-hosted fonts.

## Left for the owner

- Google Rich Results Test on one article and one product page (needs the owner's browser and a public `https://` address).
- Search Console and `GOOGLE_SITE_VERIFICATION` at launch.

## Review and fix pass (30 Oct 2026)

Branch review as a workflow: five lenses (server, security, web, SEO, spec and tests), each finding put to a skeptic, then a completeness critic; all agents Sonnet at medium effort. 30 findings upheld, 26 distinct after removing duplicates. Fixed test-first by four agents on disjoint files (Sonnet, medium), diffs reviewed, then redeployed (api image build 554/554; web 220/220).

| Finding | Fix | Checked on dev |
|---|---|---|
| Article cover and body-image uploads had nginx's 1 MB default body limit (high) | location for `/v1/admin/articles/{id}/(cover|images)` with 11 MB and the JSON 413, as for product photos | 12 MB → 413 `TOO_LARGE` "Ukuran file maksimal 10 MB."; 2 MB reaches the API (401 without session) |
| Render cache unbounded, cached 404s for any URL | only 200 pages cached, at most 500 entries, oldest out first | renderer tests |
| `$&`, `$'`, `$$` in titles or text expanded by `String.replace` | replacer functions in `injectShell` | builder and renderer tests |
| Decoded path put unescaped into `?path=` (an encoded `&` or `#` changed the request); malformed escapes gave 502 then a soft 404 | nginx sends the raw request line in `X-Render-Uri`; the API decodes it once, malformed → 404 page | `/blog/a%26b` 404; `/blog/%E0%A4%A` 400 from nginx; `/blog?page=2` 200 |
| `If-None-Match` compared to the strong ETag, but nginx gzip sends it weak | `W/` prefix and lists accepted | 304 through nginx with the weak ETag |
| `PUBLIC_BASE_URL` not validated; silent localhost fallback | origin pattern checked; required when `NODE_ENV=production`; `siteConfig()` runs at start-up | API started with the VM value |
| hreflang emitted on noindex or canonical-override pages | alternates only when both languages are indexable without an override | renderer test |
| Blog list JSON-LD lacked `BreadcrumbList`; article title added " | Brand" when the SEO title was empty | breadcrumb added; bare title per spec | renderer tests; article `<title>` now the title alone |
| `publish()`: kept a future `publishedAt`, accepted unvalidated `publishAt` (string comparison), and re-published live articles | real go-live date kept; `publishAt` parsed, 422 when invalid, stored as WIB; 409 "Artikel sudah terbit. Batalkan terbit dulu untuk menjadwalkan ulang." | service tests; `seo-dev.mjs` schedule check |
| A draft taking an old slug deleted its redirect | redirects released only when a live text takes the slug; a non-live owner falls through to the redirect | slug tests |
| `remove()` checked status outside the transaction | atomic delete guarded on status | service test |
| Replacing a cover deleted a body image that shares the file | cover files kept when a body uses the same hash | service test |
| Editor: queued jobs used the version from click time; retry after a failed publish of a new article gave a false 409; body image overwrote text typed during upload; unpublish replaced unsaved text; error banner not reset; list race; 40 px write/preview tabs | latest view read when a job runs; image appended to the latest body of its language; status-only updates keep the drafts; banner and stale flag reset; cancelled stale list loads; 44 px tabs with a tabpanel; a live article shows "Simpan perubahan" and "Batalkan terbit" only | editor helper and wiring tests; editor axe 0 serious/critical |
| Blog pagination did not scroll to the top | `BlogList` scrolls on a page-number change (Layout unchanged) | wiring test |
| No test that the SEO role gets 403 on commerce admin routes | `seo-role-commerce.test.ts` through the real controller and service: 403 on orders, customers, promotions, audit, metrics, order mutations and contact reveal | 21/21; also 403 on dev in `seo-dev.mjs` |

## Checks after the fix pass

| Check | Result |
|---|---|
| `web/e2e/seo-dev.mjs` | 16/16 (blog 0.000, article 0.000, product 0.000 vs bare shell 0.107) |
| Sign-in check | 12/12 (one run in between failed during a short network outage to the VM: SSH "No route to host"; re-run after it came back) |
| Concurrency check | 12/12 |
| API log | no `ERROR` lines in the last hour |
| Data | 4 sample articles, no leftover test articles or redirects; every `ARTICLE_*`/`SEO_*` audit entry has `actorId` |

## Owner feedback fixes (30 Oct 2026, after commit 7c3eb96)

| Reported | Cause | Fix (test first) | Checked on dev |
|---|---|---|---|
| Account "Ringkasan": text written vertically | `w-full` in the photo frame overrode `w-14` on the "Rekomendasi untukmu" rows, so the name and price got a one-letter column (the item 1 open note) | photo wrapped in a fixed `w-14` box | 390 px screenshot: names and prices on normal lines |
| Staff sign-in fails for the owner | server accepts `sinta@toko.example` / demo password with a current TOTP code (UI sign-in lands on Blog); the owner's device needs the authenticator set up | eye button on the staff and customer password fields (`PasswordInput`, 44 px, "Tampilkan/Sembunyikan kata sandi", `aria-pressed`) | field switches to text; sign-in check 12/12 |
| Article "menyambung-laptop-ke-monitor": picture does not load | the article has no cover; the card showed an empty brand-coloured 16:9 panel that read as a broken image | cards carry `coverProduct` (first linked product still for sale); the frame shows its photo or drawing; admin list shows "Tanpa sampul" | `/blog` screenshot: adaptor drawing in the frame; `seo-dev.mjs` 16/16 |
| Staff account rejected on the shop's "Masuk" page ("Email atau kata sandi salah") | staff accounts live in `StaffAccount` and sign in at `/admin/login` with an authenticator code; `/masuk` checks customer accounts only, and the shop had no link to the staff page (reproduced: staff email on `/v1/auth/sign-in` → 401) | link "Staf toko? Masuk di halaman admin" under the customer form, owner-approved | 390 px screenshot; link opens `/admin/login`; axe 0 serious/critical on `/masuk` |
