# SEO Specialist role and articles (item 2)

**Status:** design approved in conversation on 29 Oct 2026, written spec waiting for owner review.
**Owner decisions (29 Oct 2026):** SEO publishes directly; articles and products link both ways; articles at `/blog/{slug}`; Bahasa with an optional English translation at `/en/blog/{slug}`; the SEO Specialist edits articles, SEO fields and product photos; only the SEO Specialist and the Owner write articles; search engines get a server-filled HTML shell (approach A); article page layout A (product cards after the article); "Artikel terkait" as article cards; `/blog` with the newest article featured above a grid; the blog is reached from the footer and a home-page section, the header is unchanged.

## Goal and success criteria

Bring shoppers from search engines to the shop through articles (buying guides, how-tos, care tips) that link to products, and give product, category and article pages proper titles, descriptions and share previews.

Done when:

1. An article published in the admin appears at `/blog/{slug}` (and `/en/blog/{slug}` when translated), in `/blog`, in `sitemap.xml`, and on the product pages it links to.
2. A request without JavaScript (a crawler, a link-preview bot, `curl`) to an article, product or category URL receives the real title, meta description, canonical, `hreflang`, Open Graph and Twitter tags, JSON-LD and the readable text, with status 200, 301 or 404 as appropriate.
3. Shoppers see the storefront exactly as today: no flash of server text, no new layout shift.
4. The SEO Specialist can do this work and nothing else (no orders, customers, prices, stock, promotions, refunds, dashboard or audit log).
5. Every article and SEO change is audited, and the existing W00 numbers (Rp587.250 reference cart, Rp2.097.000 / 8 / Rp262.125 / 88.9%) are unchanged.

## Constraints

- Prompt.md rules hold: Bahasa for customer and admin copy, English for code and `/v1` paths; least privilege on every endpoint; append-only audit; approved Agent 01 screens change only where this spec says so (the "Artikel terkait" block on the product page, the "Dari blog" home section and the footer link, all approved by the owner on 29 Oct 2026).
- One brand per deployment. The web build already picks it with `VITE_BRAND`; the API gets the same value as `SITE_BRAND` in `server/.env` (default `sambung`). On dev that is Sambung, so Halimun articles exist in the admin but are not served on the dev storefront.
- The storefront stays a client-rendered React app. No new rendering framework, no headless browser on the VM (2 CPUs, 3.7 GB).
- Photos reuse the item 1 pipeline (checks, WebP copies, MinIO `media/`, product-lock-style locking, audit).

## 1. Roles and permissions

New staff role `seo`, label "SEO", added to `StaffRole` on server and web, to `ROLE_LABEL`, and to the access matrix in `server/src/domain/rbac.ts` and its mirror `web/src/domain/rbac.ts`.

| Permission | Owner | Admin | Operasional | Marketing | CS | SEO |
|---|---|---|---|---|---|---|
| `articles.manage` (new) | yes | no | no | no | no | yes |
| `seo.edit` (new): SEO text of products and categories | yes | no | no | no | no | yes |
| `products.media` (item 1) | yes | yes | no | yes | no | yes |

The SEO role has no other permission. After sign-in it lands on `/admin/blog`. `docs/01-requirements/BUSINESS_RULES.md` gains the role in the access matrix ("Articles and SEO: Owner U, SEO U, others —"). A demo account "Sinta P." (`sinta@toko.example`, role `seo`, the shared demo staff password and TOTP) is seeded with the other staff.

## 2. Data

New Prisma models, applied by the existing `prisma db push` (additive only):

**`Article`**

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `storeId` | `String`, relation to `Store` | `sambung` or `halimun` |
| `status` | `String` | `draft`, `published` or `unpublished`. "Scheduled" is `published` with `publishAt` in the future. |
| `publishAt` | `String?` | WIB ISO; when it goes live |
| `publishedAt` | `String?` | WIB ISO; first time it went live (for `datePublished`) |
| `updatedAt` | `String` | WIB ISO; last content change (for `dateModified`, sitemap `lastmod`) |
| `version` | `Int` | starts at 1, +1 on every save; optimistic concurrency |
| `authorId` | `String` | staff id; author name shown on the page is the staff name |
| `coverHash`, `coverWidth`, `coverHeight`, `coverSizes` | nullable | the cover's WebP copies under `media/articles/{articleId}/{hash16}-{target}.webp`, made by the item 1 processing code |
| `coverAlt` | `String?` | required when a cover exists, 1–125 code points, same cleaning rules as photo alt text |
| `tags` | `String[]` | free tags, stored only (no tag pages this round) |
| `sample` | `Boolean @default(false)` | demo article |
| `createdAt`, `createdBy` | `String` | |

**`ArticleText`** (one per language)

| Field | Type | Notes |
|---|---|---|
| `articleId` + `lang` | `@@id([articleId, lang])` | `lang` is `id` or `en`; the `id` row is required |
| `slug` | `String` | `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–80 characters; `@@unique([storeId, lang, slug])` through a denormalised `storeId` column |
| `title` | `String` | 1–120 code points |
| `seoTitle` | `String?` | ≤ 60 code points; empty means the title is used |
| `metaDescription` | `String` | 50–160 code points, required to publish |
| `summary` | `String` | 1–200 code points; card text |
| `body` | `String` | Markdown subset (section 4), ≤ 50 000 characters |
| `noindex` | `Boolean @default(false)` | |
| `canonicalUrl` | `String?` | absolute `https://` URL; empty means self |

**`ArticleProduct`**: `articleId`, `productId`, `position` (0–5); `@@id([articleId, productId])`; at most 6 per article; the product must belong to the article's store.

**`SlugRedirect`**: `storeId`, `kind` (`article`), `lang`, `fromSlug`, `toArticleId`; `@@unique([storeId, kind, lang, fromSlug])`. A redirect never points at another redirect: it points at the article id, and the current slug is looked up when serving.

**`SeoOverride`**: `storeId`, `kind` (`product` or `category`), `key` (product id or category id), `seoTitle?` (≤ 60), `metaDescription?` (≤ 160), `updatedAt`, `updatedBy`; `@@id([storeId, kind, key])`. No row means the automatic text.

Automatic SEO text when there is no override: product title "{nama produk} | {brand}", description from the product's `spec` line (cut to 160 code points at a word boundary); category "{nama kategori} | {brand}" and "Belanja {nama kategori} di {brand}.". The content pages (Tentang, FAQ, Kebijakan privasi) have no storefront route yet, so they get no SEO fields and no sitemap entry this round.

Reading time: words in the body divided by 200, rounded up, at least 1 ("4 menit baca" / "4 min read").

## 3. Admin

Two admin screens, linked in `NAV` of `AdminShell.tsx`: "Blog" (`/admin/blog`, `articles.manage`) and "SEO" (`/admin/seo`, `seo.edit`). Pages import only from `services/http`.

**Article list (`/admin/blog`)**: store filter (default: the deployment's store); rows with cover thumbnail, Bahasa title, status ("Draf", "Terjadwal {tanggal}", "Terbit", "Tidak terbit"), languages ("ID" or "ID + EN"), "Contoh" badge for samples, last change and by whom; "Tulis artikel" button; empty state "Belum ada artikel."

**Editor (`/admin/blog/new`, `/admin/blog/{id}`)**

- Language tabs "Bahasa Indonesia" and "English". The English tab starts empty with "Tambah versi English"; "Hapus versi English" removes it (and its URL then 404s).
- Fields per language: Judul; Slug (filled from the title until edited by hand; shows the full URL); Judul SEO with "{n}/60"; Deskripsi meta with "{n}/160"; Ringkasan with "{n}/200"; Isi (Markdown, "Tulis" and "Pratinjau" tabs; the preview uses the same rules as the shop); `noindex` checkbox "Jangan tampilkan di mesin pencari"; Canonical (advanced, collapsed).
- A search-result preview under the SEO fields shows the title, URL and description as Google would cut them.
- Cover: upload with the item 1 rules (JPEG, PNG, WebP, ≤ 10 MB, ≥ 480 px, ≤ 40 MP, rights checkbox "Saya memiliki hak atau izin untuk memakai foto ini di toko."), alt text required, "Ganti" and "Hapus".
- Body images: "Sisipkan gambar" uploads with the same rules and inserts `![alt](/media/articles/{id}/{hash16}-960.webp)`; alt text required.
- Linked products: search the store's products, pick up to 6, reorder with buttons (no drag-only), remove.
- Actions: "Simpan draf", "Terbitkan", "Jadwalkan" (WIB date and time, must be in the future), "Batalkan terbit" (status `unpublished`; URL then 404s), "Hapus artikel" (drafts and unpublished only, with confirmation).
- Publish rules (also enforced by the API): Bahasa title, slug, meta description, summary and body filled; cover alt when a cover exists; an English row, when it exists, has the same fields filled, otherwise "Lengkapi versi English atau hapus dulu."
- Changing the slug of a published language shows "URL lama akan dialihkan ke URL baru." and creates a `SlugRedirect`.
- Every save sends `version`; a stale version answers 409 "Artikel diubah orang lain. Muat ulang halaman." and the editor keeps the typed text.
- Closing the tab with unsaved changes asks first (`beforeunload`).

**SEO screen (`/admin/seo`)**: one table with tabs "Produk" and "Kategori"; each row shows the current title and description with "otomatis" or "khusus"; "Ubah" opens a dialog with the two fields, counters and the search-result preview; "Kembalikan ke otomatis" deletes the override.

Admin API (staff cookie, guard before any body is read, `private, no-store`, audit on every change):

| Method and path | Does |
|---|---|
| `GET /v1/admin/articles?store=` | list |
| `POST /v1/admin/articles` | create a draft (`store`, Bahasa fields) |
| `GET /v1/admin/articles/{id}` | full article with texts, products, version |
| `PUT /v1/admin/articles/{id}` | save texts, tags, products (`version` required) |
| `POST /v1/admin/articles/{id}/publish` | publish now or at `publishAt` (`version`) |
| `POST /v1/admin/articles/{id}/unpublish` | (`version`) |
| `DELETE /v1/admin/articles/{id}` | drafts and unpublished only |
| `POST /v1/admin/articles/{id}/cover` | multipart cover upload (`file`, `alt`, `rightsConfirmed`) |
| `DELETE /v1/admin/articles/{id}/cover` | remove the cover |
| `POST /v1/admin/articles/{id}/images` | multipart body image; answers `{ src, width, height }` |
| `GET /v1/admin/seo?store=&kind=` | rows with automatic and override text |
| `PUT /v1/admin/seo/{kind}/{key}` | set override (`store`) |
| `DELETE /v1/admin/seo/{kind}/{key}?store=` | back to automatic |

Audit codes: `ARTICLE_CREATED`, `ARTICLE_UPDATED` (before/after of changed fields only), `ARTICLE_PUBLISHED`, `ARTICLE_SCHEDULED`, `ARTICLE_UNPUBLISHED`, `ARTICLE_DELETED`, `ARTICLE_SLUG_CHANGED`, `ARTICLE_COVER_CHANGED`, `SEO_OVERRIDE_CHANGED`; object is the article id or `{kind}:{key}`; `actorId` in `after`.

## 4. Article body: the Markdown subset

Allowed: paragraphs; `##` and `###` headings (no `#`: the page has one H1); `*` and `-` lists and `1.` lists; `**bold**` and `*italic*`; links `[teks](url)` where url is `https://`, `http://` or a path starting with `/`; images `![alt](url)` where url is a path under `/media/articles/`; blank lines. Anything else is shown as plain text. No raw HTML is ever passed through (`<` is escaped). External links get `rel="noopener noreferrer"` and open in the same tab.

One renderer function per package (`server/src/content/markdown.ts`, `web/src/domain/markdown.ts`), copied like the alt-text rules, with one shared list of test vectors (XSS cases included: `<script>`, `javascript:` links, `onerror=`, data URLs, nested brackets).

## 5. Public pages and the server-filled shell

Public API (cache like the catalogue: `public, max-age=15, stale-while-revalidate=45`, added to `cache-policy.ts`):

- `GET /v1/articles?lang=id|en&page=1` — published, `publishAt` ≤ now, store = `SITE_BRAND`, newest first, 12 per page, card fields only.
- `GET /v1/articles/{slug}?lang=` — one article with its rendered fields, cover, reading time, the other language's slug, and its linked products (existing, same store, in order). Unknown or not live: 404. An old slug: `{ redirect: newSlug }` with status 301 semantics for the renderer.
- `GET /v1/products/{slug}/articles` — up to 3 published articles that link to the product, newest first.

Shell renderer (new `server/src/seo/` module; Nest controller without the `/v1` prefix, reached only through nginx):

- nginx sends `/blog`, `/blog/...`, `/en/blog`, `/en/blog/...`, `/produk/...` and `/kategori/...` to `api:8080/render?path=...` and sends `/sitemap.xml` and `/robots.txt` to the API too. On any error from the API (5xx, timeout) nginx serves the plain `index.html`, so the shop never breaks.
- `web/nginx.conf`: the `/media/` allowlist regex widens from `products/...` to `(products|articles)/[A-Za-z0-9_-]+/[0-9a-f]{16}-[0-9]{3,4}\.webp`, so article covers and body images are served with the same headers and 404 rules as product photos.
- The renderer takes the built `index.html` from the web container (`http://web/__shell.html`, an `internal`-style location that answers only on the compose network), cached in memory for 60 s.
- It returns the shell with: `<html lang>`; `<title>`; meta description; `<link rel="canonical">` (absolute, from `PUBLIC_BASE_URL`); `hreflang` alternates `id`, `en` and `x-default` (Bahasa) when both languages exist; `<meta name="robots" content="noindex">` when set; Open Graph (`og:type` article or product, title, description, image as the 1600 copy URL, url, `og:locale` id_ID or en_US) and `twitter:card summary_large_image`; JSON-LD `BlogPosting` (headline, description, image, datePublished, dateModified, author name, publisher = brand) plus `BreadcrumbList` for articles, `Product` (name, image, description, sku, offers with price in IDR and availability) plus `BreadcrumbList` for products, `CollectionPage` plus `BreadcrumbList` for categories and the blog list; optional `google-site-verification` meta from `GOOGLE_SITE_VERIFICATION`.
- Inside `<div id="root">` it puts `<div id="ssr">` with the readable page (article: H1, date, cover, body, linked product names and prices as links; product: name, spec, price, availability, photos with alt; category and blog list: headings and links). An inline script at the top of `<head>` adds `class="js"` to `<html>`, and a style rule hides `#ssr` under `.js`, so shoppers never see it and React mounts as today.
- All text is HTML-escaped; JSON-LD is serialised with `<` written as `<`.
- Status: 200 for a live page; 301 with `Location` for an old article slug; 404 (shell with the normal SPA, which shows "Halaman tidak ditemukan") for unknown or not-live articles, unknown products and categories.
- Caching: `Cache-Control: no-cache` with an `ETag` (304 on repeat), like `index.html` today. Rendered results are kept in memory for 60 s per path and language; any article, SEO override or catalogue change clears that cache.

`/sitemap.xml`: home, categories, products, `/blog` and its numbered pages, and every live article that is not `noindex`, each language as its own `<url>` with `xhtml:link` alternates when both exist; `lastmod` from `updatedAt` (articles) or omitted. `/robots.txt`: `Allow: /`, `Disallow: /admin`, `/akun`, `/keranjang`, `/checkout`, `/pembayaran`, `/masuk`, `/cari`, `/bandingkan`, `/v1/`, then `Sitemap: {PUBLIC_BASE_URL}/sitemap.xml`. Both `text/plain` or `application/xml`, `public, max-age=3600`.

New `server/.env` keys (documented in `server/.env.example`): `PUBLIC_BASE_URL` (required in production; dev `http://43.159.54.222`), `SITE_BRAND` (`sambung` or `halimun`, must match `VITE_BRAND`), `GOOGLE_SITE_VERIFICATION` (optional).

## 6. What shoppers see

- `/blog` (new page): heading "Blog" and one line per store ("Panduan dan tips aksesori komputer dari Sambung." / "Panduan dan tips perawatan kulit dari Halimun."); on page 1 the newest article as a wide featured card (cover left, title, summary and date right; stacked on phone); then the article grid (3 columns ≥ 1024 px, 2 ≥ 768 px, 1 below); numbered pages of 12; "Belum ada artikel." when empty.
- `/blog/{slug}` (new page), layout A: breadcrumb Beranda / Blog / title; H1; date and reading time; cover (16:9 frame, `fetchpriority="high"`); body; "Produk di artikel ini" with the existing `ProductCard` (2 per row on phone, 3–4 on desktop); a language link "English version" or "Versi Bahasa Indonesia" when the other language exists.
- `/en/blog` and `/en/blog/{slug}`: the same pages with the English text and English labels for the article chrome ("Products in this article", "min read", "Read in Bahasa Indonesia"); the shop header and footer stay Bahasa.
- Product page: "Artikel terkait" below the specifications, up to 3 article cards (cover, title, reading time), one per row on phone; only when at least one live article links to the product. Nothing above it moves.
- Home page: "Dari blog" row of the 3 newest articles near the bottom, only when at least one is live.
- Footer: a "Blog" link.
- Article cards use the item 1 photo frame (fixed 16:9 ratio, lazy loading, `srcset` and `sizes`, a plain brand-coloured fallback when there is no cover), so they add no layout shift.
- Copy and layout go through `design-taste-frontend`, `ui-ux-pro-max` and `frontend-design:frontend-design` before any `web/` code; accessibility stays at 0 serious or critical axe findings.

## 7. Errors

| Case | Status, code | Message |
|---|---|---|
| Slug taken in this store and language | 409 `CONFLICT` | "Slug sudah dipakai artikel lain." |
| Slug format | 422 `VALIDATION` | "Slug hanya huruf kecil, angka dan tanda hubung (3–80 karakter)." |
| Reserved slug (`baru`, `halaman`, `en`, `tag`, `penulis`) | 422 `VALIDATION` | "Slug ini tidak boleh dipakai." |
| Field too long or missing before publish | 422 `VALIDATION` | "Lengkapi {nama kolom} sebelum terbit." / "{nama kolom} maksimal {n} karakter." |
| Incomplete English version | 422 `VALIDATION` | "Lengkapi versi English atau hapus dulu." |
| Schedule time not in the future | 422 `VALIDATION` | "Waktu terbit harus di masa depan." |
| Product of another store, unknown product, more than 6 | 422 `VALIDATION` | "Produk tidak ada di toko ini." / "Maksimal 6 produk per artikel." |
| Stale version | 409 `CONFLICT` | "Artikel diubah orang lain. Muat ulang halaman." |
| Delete a published article | 409 `CONFLICT` | "Batalkan terbit dulu sebelum menghapus." |
| Canonical not `https://` | 422 `VALIDATION` | "Canonical harus berupa URL https://." |
| Unknown article (admin) | 404 `NOT_FOUND` | "Artikel tidak ditemukan." |
| No permission | 403 `FORBIDDEN` | "Peran {peran} tidak punya izin untuk aksi ini." |
| Cover and body image uploads | as item 1 | the item 1 photo messages |

## 8. Demo content and launch

- Seed (by hand, like `media:seed`): `npm run content:seed` adds 2 original demo articles per store, written for this project in Bahasa, the first of each with an English translation, `sample: true`, linked to 2–3 products, covers drawn from the item 1 sample photos where one exists, and the demo SEO account. It skips articles that already exist and never touches staff-written articles.
- `npm run content:remove-samples -- --operator "<nama>"` deletes sample articles (audited, slugs then 404).
- `docs/07-delivery/LAUNCH_CHECKLIST.md` gains: remove sample articles; set `PUBLIC_BASE_URL` and `SITE_BRAND`; submit `sitemap.xml` in Search Console (owner's account); check `robots.txt`.

## 9. Testing

- Unit: Markdown renderer with the shared vectors (server and web), slug rules, reading time, automatic SEO text, sitemap XML (both languages, alternates, escaping), robots, JSON-LD builders, shell escaping (a title containing `</script>`, quotes, `&`).
- Service (fake database): create, save with version conflict, publish rules per language, schedule (live only after `publishAt`), unpublish and delete rules, slug change creates a redirect and redirects resolve to the current slug, product links limited to 6 and to the store, every change audited with `actorId`, RBAC for every route (SEO and Owner allowed; Admin, Marketing, Operasional, CS 403; SEO 403 on orders, customers, promotions, dashboard, audit).
- Renderer: 200 with all tags for a live article, product and category; 301 for an old slug; 404 for unknown and not-live; `noindex`; `hreflang` only when both languages exist; nginx fallback when the API is down.
- Web: list, article, related and home sections (source-wiring and pure helpers, as in item 1); editor helpers (slug from title, counters, version conflict handling).
- On dev after deploy: `curl` (no JavaScript) of an article, product and category shows title, description, canonical, Open Graph, JSON-LD and text; `sitemap.xml` validates against the sitemap schema; Google Rich Results Test on one article and one product (manual, owner's browser); Playwright: shoppers see no `#ssr` text, CLS not worse than before, axe 0 serious or critical on `/blog`, an article, a product page and the editor; the existing sign-in and concurrency checks.

## 10. Rollout

1. Back up (Postgres, tree, `media/`), as in item 1.
2. Set `PUBLIC_BASE_URL` and `SITE_BRAND` in `server/.env` on the VM.
3. Deploy `api` (new tables, routes, renderer), then `web` (pages, nginx locations); `nginx -t` on the rendered template before switching.
4. `docker compose exec api npm run content:seed`, restart `api`, run the checks.
5. Roll back `web` first if a page fails (the renderer locations fall back to `index.html` anyway); the database change is additive.

## Not in this round

Comments, tag and author pages, blog search, RSS, related articles between articles, GA4 event changes, English for the rest of the shop, approval workflow (the owner chose direct publishing), structured data for reviews.
