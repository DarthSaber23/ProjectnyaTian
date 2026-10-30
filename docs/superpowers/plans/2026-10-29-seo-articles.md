# SEO Specialist Role and Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an SEO Specialist role, bilingual articles at `/blog` and `/en/blog` linked both ways to products, editable SEO text for products and categories, and server-filled HTML (meta, JSON-LD, readable text), `sitemap.xml` and `robots.txt` so search engines and link previews see real pages.

**Architecture:** A new `server/src/content/` module holds the article rules, Markdown renderer, `ArticleService`, `SeoService` and the admin and public controllers; a new `server/src/seo/` module renders the HTML shell (`/render`), `sitemap.xml` and `robots.txt`. nginx sends blog, product and category URLs to the renderer and falls back to the plain `index.html` on any error. The React storefront gets `/blog`, article pages, "Artikel terkait", "Dari blog" and a footer link; the admin gets "Blog" and "SEO" screens. Article images reuse the item 1 photo pipeline under `media/articles/`.

**Tech Stack:** NestJS 10, Prisma 5 (`db push`), the item 1 media code (`sharp` 0.33.5, `ObjectStorage`), vitest, React 18, Tailwind, nginx 1.27 templates, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-29-seo-articles-design.md` (executors read it alongside this plan; "spec section N" means that file).

## Global Constraints

- TDD for every code task: failing test, run it to see it fail, implement, run to pass.
- Subagents use `model: "sonnet"` and `effort: "medium"` (`.claude/rules/subagent-model.md`).
- Commits only when the owner asks. Each task ends with "Stage this task's files" (never `git add -A`). No `git push`, ever.
- Copy shown to customers and staff is Bahasa Indonesia (English only on `/en/blog` article chrome); code, paths and docs are English.
- Agent 01's screens change only where the spec says: "Artikel terkait" below the product specifications, "Dari blog" on the home page, a "Blog" footer link. The header is unchanged.
- Web tasks (10, 11): invoke `design-taste-frontend`, `ui-ux-pro-max` and `frontend-design:frontend-design` with the Skill tool before writing code. No CDN fonts or scripts.
- Least privilege: `articles.manage` and `seo.edit` for `owner` and `seo` only; `products.media` gains `seo`. Every admin route uses a guard that runs before any body is read; every response `private, no-store`.
- Audit: every article and SEO change writes one append-only entry in the same transaction, `actorId` inside `after`; rejected requests write nothing.
- Limits (spec section 2): slug `^[a-z0-9]+(-[a-z0-9]+)*$`, 3-80 chars, reserved `baru`, `halaman`, `en`, `tag`, `penulis`; title 1-120, SEO title ≤ 60, meta description 50-160, summary 1-200 code points; body ≤ 50 000 characters; ≤ 6 linked products; reading time = ceil(words / 200), min 1; 12 articles per list page; up to 3 related articles.
- One brand per deployment: `SITE_BRAND` (server) must equal `VITE_BRAND` (web); `PUBLIC_BASE_URL` builds every absolute URL.
- Rendered HTML: every text value HTML-escaped; JSON-LD with `<` as `<`; `Cache-Control: no-cache` with `ETag`.
- No `--accept-data-loss`; the schema change is additive.
- vitest has no decorator metadata: Nest classes use explicit `@Inject(Token)`.
- Test commands: `cd server && npx vitest run <file>`, `cd web && npx vitest run <file>`; full `npm run test:api`, `npm run test:web`, `npm run lint` from the repo root. Reference cart Rp587.250 and W00 metrics must still pass.

## Review Focus

Failure modes the spec implies but does not test, most likely first. Each has its test in the named task.

1. A slug changed twice (A → B → C), and later a new article taking slug A: both A and B answer 301 to C until A is reused, then A serves the new article and its redirect row is removed. (Task 4)
2. A scheduled article before its time: 404 on its URL and absent from the list, the sitemap, "Artikel terkait" and "Dari blog"; after `publishAt` passes it appears with no job running. (Tasks 4, 6, 7)
3. An article linking a product that was later removed from the catalogue or belongs to the other store: silently skipped on the page, in JSON-LD and in the API; never a 500. (Task 6)
4. Titles and descriptions with `</script>`, quotes, `&`, emoji and 300 characters: escaped in every tag and JSON-LD, automatic descriptions cut at a word boundary within 160 code points. (Task 7)
5. Deleting the English version of a published article: `/en/blog/{slug}` becomes 404 and the Bahasa page drops its `hreflang` alternates and its "English version" link. (Tasks 4, 7)

## File map

| Area | Create | Modify |
|---|---|---|
| Roles | `server/src/content/permission.guard.ts` | `server/src/domain/{types,rbac}.ts`, `web/src/domain/{types,rbac}.ts`, `server/src/data/fixtures.ts`, `web/src/admin/AdminShell.tsx` |
| Data and rules | `server/src/content/{rules,markdown,content.types}.ts`, `server/src/content/markdown.vectors.json` | `server/prisma/schema.prisma` |
| Services | `server/src/content/{article.service,seo.service,article-media,content.module,admin-content.controller,public-content.controller}.ts`, `server/src/test/fake-content-db.ts` | `server/src/media/public-image.ts`, `server/src/app.module.ts`, `server/src/cache-policy.ts`, `server/src/commerce/catalog.service.ts` |
| Renderer | `server/src/seo/{site-config,shell,head,jsonld,ssr-body,sitemap,robots,render.controller,seo.module}.ts` (site-config in Task 6) | `server/.env.example` |
| Serving | | `web/nginx.conf`, `web/index.html` |
| Web | `web/src/domain/{markdown,articles}.ts`, `web/src/domain/markdown.vectors.json`, `web/src/pages/{BlogList,ArticlePage}.tsx`, `web/src/components/{ArticleCard,RelatedArticles,FromBlog}.tsx`, `web/src/admin/{BlogPages,SeoPage}.tsx` | `web/src/services/{contracts.ts,http/admin.ts,http/backend.ts}`, `web/src/App.tsx`, `web/src/pages/{ProductPage,Home}.tsx`, `web/src/components/Layout.tsx` |
| CLI and docs | `server/src/content/cli/{seed,remove-samples}.ts`, `server/seed/content/articles.json` | `server/package.json`, `docs/05-api/STOREFRONT_CONTRACT.md`, `docs/01-requirements/BUSINESS_RULES.md`, `docs/07-delivery/LAUNCH_CHECKLIST.md`, `architecture.md`, `.graphify/*` |

---

### Task 1: SEO role and permission guard

**Files:**
- Create: `server/src/content/permission.guard.ts`
- Modify: `server/src/domain/types.ts`, `server/src/domain/rbac.ts`, `web/src/domain/types.ts`, `web/src/domain/rbac.ts`, `server/src/data/fixtures.ts` (staff list), `web/src/admin/AdminShell.tsx` (`AdminLogin` landing)
- Test: `server/src/content/permission.guard.test.ts`, `web/src/domain/rbac-seo.test.ts`

**Interfaces:**
- Produces: `StaffRole` gains `"seo"`; `ROLE_LABEL.seo = "SEO"`; `Permission` gains `"articles.manage" | "seo.edit"`; matrix: `owner` gains both, `seo: ["articles.manage", "seo.edit", "products.media"]`.
- Produces: `@RequirePermission(p: Permission)` decorator and `PermissionGuard` (`@Inject(AuthService)`, `@Inject(Reflector)`): reads the route's permission, `auth.staff(authorization)` (401), `can(role, p)` else 403 "Peran {ROLE_LABEL} tidak punya izin untuk aksi ini.", sets `request.staffActor = { id, label }` (`MediaActor` shape).
- Produces: staff fixture `{ id: "U-05", name: "Sinta P.", role: "seo", email: "sinta@toko.example" }`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each(["owner", "seo"])("%s has articles.manage and seo.edit", ...);
it.each(["admin", "operations", "marketing", "cs"])("%s has neither", ...);
it("seo has products.media and nothing else: no dashboard.view, orders.view, customers.*, promotions.*, reports.export, audit.view, users.manage", ...);
it("PermissionGuard: no session 401, seo on a route marked orders.view 403 with 'Peran SEO tidak punya izin untuk aksi ini.', seo on articles.manage passes and sets staffActor", ...);
it("AdminLogin sends a role without dashboard.view but with articles.manage to /admin/blog", /* source check: can(role, "articles.manage") ? "/admin/blog" */);
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/content/permission.guard.test.ts` and `cd web && npx vitest run src/domain/rbac-seo.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, matrices (server and web identical), guard, fixture line and login landing (`dashboard.view` → `/admin`, else `articles.manage` → `/admin/blog`, else `/admin/orders`, in both the `Navigate` and the `navigate` call).
- [ ] **Step 4: Run to pass**, then `npm run test:api`, `npm run test:web`. Expected: PASS (existing RBAC and admin tests unchanged).
- [ ] **Step 5: Stage this task's files.**

### Task 2: Data model, content rules and Markdown renderer

**Files:**
- Create: `server/src/content/{rules,markdown,content.types}.ts`, `server/src/content/markdown.vectors.json`, `web/src/domain/markdown.ts`, `web/src/domain/markdown.vectors.json`
- Modify: `server/prisma/schema.prisma` (models `Article`, `ArticleText`, `ArticleProduct`, `SlugRedirect`, `SeoOverride` exactly as spec section 2; relations to `Store` and `Product`)
- Test: `server/src/content/{rules,markdown,schema}.test.ts`, `web/src/domain/markdown.test.ts`

**Interfaces:**
- Produces (`rules.ts`): `RESERVED_SLUGS`, `isValidSlug(s): boolean`, `slugFromTitle(title): string` (lowercase, ASCII-fold Indonesian text, non-alphanumerics to `-`, trimmed, cut to 80 at a hyphen), `readingMinutes(body): number`, `cutAtWord(text, max): string` (code points), `autoProductSeo(product, brandName): { title, description }`, `autoCategorySeo(category, brandName)`, `checkLengths(text: ArticleTextInput, forPublish: boolean): string[]` (Bahasa messages from spec section 7).
- Produces (`content.types.ts`): `Lang = "id" | "en"`, `ArticleTextInput`, `ArticleView` (admin), `PublicArticle`, `PublicArticleCard` (id, lang, slug, title, summary, cover image in the item 1 public shape, readingMinutes, publishedAt).
- Produces (`markdown.ts`, same in both packages): `renderMarkdown(source: string): string` (safe HTML string per spec section 4), `plainText(source): string` (for word count and `#ssr`).
- `markdown.vectors.json`: `[{ name, input, html }]`, at least: headings `##`/`###` only, `#` as text, lists, bold/italic, `https` link, `/produk/x` link, external `rel`, image under `/media/articles/` kept, image elsewhere as text, `<script>`, `javascript:` link, `data:` URL, `onerror=`, `[x](javascript:...)` with spaces, nested brackets, raw `<b>`, `&` and quotes escaped.

- [ ] **Step 1: Write the failing tests** (rules table-driven from the spec limits; markdown: `it.each(vectors)` in both packages; web test also asserts its JSON file equals `../../../server/src/content/markdown.vectors.json` when that file exists; schema test via `Prisma.dmmf` like item 1).
- [ ] **Step 2: Run to fail.** Expected: FAIL "Cannot find module".
- [ ] **Step 3: Implement** the schema, `prisma generate`, rules and the renderer (a line-based block pass and an inline pass that escapes first and only re-introduces the allowed tags; no HTML library).
- [ ] **Step 4: Run to pass**, `cd server && npx tsc -p tsconfig.json --noEmit`, `cd web && npm run typecheck`.
- [ ] **Step 5: Stage this task's files.**

### Task 3: Fake content database and article media keys

**Files:**
- Create: `server/src/test/fake-content-db.ts`, `server/src/content/article-media.ts`
- Modify: `server/src/media/public-image.ts` (add `articleMediaKey(articleId, hash16, target)` → `media/articles/{articleId}/{hash16}-{target}.webp` and `toPublicArticleImage(...)` returning the item 1 `ProductImage` shape without `sample`)
- Test: `server/src/test/fake-content-db.test.ts`, `server/src/content/article-media.test.ts`

**Interfaces:**
- Produces: `fakeContentDb(seed)` → `{ prisma, state, inject }` covering `article`, `articleText`, `articleProduct`, `slugRedirect`, `seoOverride`, `product.findMany`, `category.findMany`, `auditRecord.create`, `$transaction` with rollback; unique keys throw P2002 with `meta.target`; `inject.failNextWrite`.
- Produces (`article-media.ts`): `storeArticleImage(storage, articleId, buffer): Promise<{ hash, width, height, sizes, keys }>` using `inspectImage` and `processImage` from item 1 and `ImageJobLimiter`; compensation deletes only keys it wrote.

- [ ] **Step 1: Write the failing tests** (fake: unique slug per store and language throws P2002 `["storeId","lang","slug"]`, rollback restores rows and audit; media: three keys under `media/articles/{id}/`, `contentType image/webp`, a failed 2nd put leaves no files).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to pass.**
- [ ] **Step 5: Stage this task's files.**

### Task 4: ArticleService

**Files:**
- Create: `server/src/content/article.service.ts`
- Test: `server/src/content/article.service.test.ts`, `server/src/content/article.slugs.test.ts`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: `ArticleService(@Inject(PrismaService), @Inject(ObjectStorage), @Inject(CatalogService) catalog: Pick<CatalogService, "snapshot">)` with
  `list(store: BrandId): Promise<ArticleView[]>`, `get(id): Promise<ArticleView>`,
  `create(actor, store, text: ArticleTextInput): Promise<ArticleView>`,
  `save(actor, id, input: { version: number; texts: Partial<Record<Lang, ArticleTextInput | null>>; tags: string[]; productIds: string[] }): Promise<ArticleView>` (`null` for `en` removes the English row),
  `publish(actor, id, { version, publishAt?: string }): Promise<ArticleView>`, `unpublish(actor, id, { version })`, `remove(actor, id)`,
  `setCover(actor, id, file, { alt, rightsConfirmed })`, `removeCover(actor, id)`, `addBodyImage(actor, id, file, { rightsConfirmed })`,
  `isLive(article, now: string): boolean` (status `published` and `publishAt ≤ now`),
  `resolvePublic(store, lang, slug, now): Promise<{ article } | { redirectTo: string } | null>`.
- Every write: one transaction, version check (409 "Artikel diubah orang lain. Muat ulang halaman."), audit code from spec section 3, `updatedAt = toWibIso(now)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("create makes a draft with version 1, the Bahasa text, author and ARTICLE_CREATED audit");
it("save with a stale version gives 409 and writes nothing");
it("publish refuses missing Bahasa fields, an incomplete English row, a cover without alt, with the spec messages");
it("publish with publishAt in the past gives 422 'Waktu terbit harus di masa depan.'; in the future it is live only after that time (isLive)");
it("products: other store, unknown, or 7 products give 422; order is kept");
it("slug taken in the same store and language 409; the same slug in the other language or store is allowed; reserved and malformed slugs 422");
it("Review Focus 1: A -> B -> C keeps 301s from A and B to C; a new article taking A serves A and removes its redirect");
it("Review Focus 5: save with en: null on a published article deletes the English row; resolvePublic(en) is null");
it("unpublish then remove; remove of a published article 409 'Batalkan terbit dulu sebelum menghapus.'");
it("every change writes exactly one audit entry with actorId in after; rejected calls write none");
```

- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.** Slug changes write `SlugRedirect(fromSlug → articleId)` only when that language had been live; reusing a slug deletes a redirect row with the same `fromSlug`.
- [ ] **Step 4: Run to pass.**
- [ ] **Step 5: Stage this task's files.**

### Task 5: SEO overrides and the admin HTTP layer

**Files:**
- Create: `server/src/content/{seo.service,admin-content.controller,content.module}.ts`
- Modify: `server/src/app.module.ts`, `server/src/media/media.module.ts` (no change in behaviour; `products.media` now includes `seo` through the matrix)
- Test: `server/src/content/seo.service.test.ts`, `server/src/content/admin-content.controller.test.ts`, `server/src/content/content.rbac.test.ts`

**Interfaces:**
- Produces: `SeoService` with `rows(store, kind: "product" | "category"): Promise<{ key, name, auto: { title, description }, override: { seoTitle?, metaDescription? } | null }[]>`, `set(actor, store, kind, key, { seoTitle?, metaDescription? })` (lengths ≤ 60 / ≤ 160, unknown key 404), `clear(actor, store, kind, key)`, `effective(store, kind, key): { title, description }`; audit `SEO_OVERRIDE_CHANGED`.
- Produces: `AdminContentController` with the 13 routes of spec section 3, class-level `@UseGuards(PermissionGuard)`, `@RequirePermission("articles.manage")` on article routes and `"seo.edit"` on SEO routes; multipart routes reuse item 1's `FileInterceptor` limits and `UploadExceptionFilter`.

- [ ] **Step 1: Write the failing tests** (SEO lengths and audit; every route: seo and owner reach the service, admin/marketing/operations/cs get 403, no session 401 before Multer runs, reflected over the controller's route metadata as in item 1).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.** Admin responses go through the existing `cachePolicy` default (`private, no-store`).
- [ ] **Step 4: Run to pass**, then `npm run test:api`.
- [ ] **Step 5: Stage this task's files.**

### Task 6: Public article API and catalogue SEO text

**Files:**
- Create: `server/src/content/public-content.controller.ts`, `server/src/seo/site-config.ts`
- Modify: `server/src/content/content.module.ts`, `server/src/cache-policy.ts` (`/v1/articles`, `/v1/articles/{slug}`, `/v1/products/{slug}/articles` as catalogue reads), `server/src/cache-policy.test.ts`
- Test: `server/src/content/public-content.test.ts`

**Interfaces:**
- Produces: `GET /v1/articles?lang=&page=` → `{ page, pages, items: PublicArticleCard[] }`; `GET /v1/articles/{slug}?lang=` → `PublicArticle` (rendered `html`, cover, readingMinutes, `otherLang: { lang, slug } | null`, `products: catalogue Product[]` live and same store only) or 404, or 301-style `{ redirect: slug }` with status 301 and `Location`; `GET /v1/products/{slug}/articles` → `PublicArticleCard[]` (≤ 3).
- Produces (`site-config.ts`): `siteConfig(): { baseUrl: string; brand: BrandId; verification?: string }` from `PUBLIC_BASE_URL` (trailing `/` removed), `SITE_BRAND` (default `sambung`, anything else than `sambung`/`halimun` throws at start-up) and `GOOGLE_SITE_VERIFICATION`. All three routes serve `siteConfig().brand` only.

- [ ] **Step 1: Write the failing tests** (live-only; newest first; 12 per page; Review Focus 2 for list and related; Review Focus 3: a linked product removed from the catalogue or of the other store is skipped; `lang=en` without an English row 404; cache headers).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to pass.**
- [ ] **Step 5: Stage this task's files.**

### Task 7: Shell renderer, sitemap and robots

**Files:**
- Create: `server/src/seo/{shell,head,jsonld,ssr-body,sitemap,robots,render.controller,seo.module}.ts`
- Modify: `server/src/app.module.ts`, `server/src/main.ts` (exclude `render`, `sitemap.xml`, `robots.txt` from the `v1` prefix), `server/.env.example` (`PUBLIC_BASE_URL`, `SITE_BRAND`, `GOOGLE_SITE_VERIFICATION`)
- Test: `server/src/seo/{head,jsonld,sitemap,robots,render}.test.ts`

**Interfaces:**
- Consumes: `siteConfig()` (Task 6).
- Produces: `ShellSource` with `get(): Promise<string>` (fetches `http://web/__shell.html`, 60 s cache, throws on failure); `buildHead(page: HeadInput): string`; `articleJsonLd`, `productJsonLd`, `breadcrumbJsonLd`, `collectionJsonLd`; `ssrBody(page): string`; `renderSitemap(entries): string`; `renderRobots(baseUrl): string`.
- Produces: `GET /render?path=` → 200 / 301 / 404 HTML per spec section 5, 502 when the shell cannot be fetched (nginx then serves `index.html`); `GET /sitemap.xml`; `GET /robots.txt`. In-memory 60 s cache per path, cleared by an `invalidate()` that `ArticleService`, `SeoService` and `CatalogService.refreshAfterWrite` call.

- [ ] **Step 1: Write the failing tests**

```ts
it("article page: title, description, canonical, hreflang id/en/x-default only when both exist, og:*, twitter:card, BlogPosting + BreadcrumbList, #ssr with H1 and body, html lang");
it("product page: Product JSON-LD with IDR price and InStock/OutOfStock, override text wins over automatic text");
it("old slug 301 with Location; unknown article, product, category 404 with the shell; noindex adds robots meta and leaves the sitemap");
it("Review Focus 4: </script>, quotes, & and 300-char titles are escaped in tags and JSON-LD (no '</script' inside the JSON-LD block)");
it("shell fetch failure gives 502");
it("sitemap: both languages with xhtml:link alternates, no scheduled or noindex articles, valid XML (parse with a small checker)");
it("robots: the Disallow lines of spec section 5 and the Sitemap line from PUBLIC_BASE_URL");
it("ETag + no-cache; a second request with If-None-Match gives 304");
```

- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to pass**, `npm run test:api`, `cd server && npx tsc -p tsconfig.build.json --noEmit`.
- [ ] **Step 5: Stage this task's files.**

### Task 8: nginx routing and the shell hide rule

**Files:**
- Modify: `web/nginx.conf`, `web/index.html` (inline `<script>document.documentElement.classList.add("js")</script>` first in `<head>` and `<style>.js #ssr{display:none}</style>`), `web/src/nginx-conf.test.ts`
- Test: `web/src/nginx-conf.test.ts`, `web/src/index-html.test.ts`

**Interfaces:** locations: `location = /__shell.html` (serves `/index.html`, `allow` only the compose network range and `127.0.0.1`, `deny all`); `location ~ ^/(blog|en/blog)(/|$)` and `location ~ ^/(produk|kategori)/` → `proxy_pass http://api:8080/render?path=$uri` with `proxy_intercept_errors on; error_page 500 502 503 504 = /index.html;`; `location = /sitemap.xml` and `location = /robots.txt` → API; the `/media/` regex widens to `(products|articles)`.

- [ ] **Step 1: Write the failing tests** (each location and its fallback line present; `/__shell.html` denies outside; media regex contains `(products|articles)`; index.html carries the script before any stylesheet and the `#ssr` rule).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to pass.** Template-aware `nginx -t` runs in Task 13.
- [ ] **Step 5: Stage this task's files.**

### Task 9: Web foundations

**Files:**
- Create: `web/src/domain/articles.ts`
- Modify: `web/src/services/contracts.ts` (types mirror `content.types.ts`), `web/src/services/http/backend.ts` (public article calls), `web/src/services/http/admin.ts` (admin article and SEO calls)
- Test: `web/src/domain/articles.test.ts`, `web/src/admin/admin-content.test.ts`

**Interfaces:**
- Produces (`articles.ts`): `articleUrl(lang, slug)`, `blogUrl(lang, page)`, `readingLabel(minutes, lang)` ("4 menit baca" / "4 min read"), `articleDate(iso, lang)`, `slugFromTitle` (copy of the server rule), `seoCount(text, max)`, `snippet(title, url, description)` (Google-style cut: 60 / 160).
- Produces: `backend.articles(lang, page)`, `backend.article(lang, slug)`, `backend.productArticles(slug)`; `admin.listArticles(store)`, `getArticle`, `createArticle`, `saveArticle`, `publishArticle`, `unpublishArticle`, `deleteArticle`, `uploadArticleCover`, `uploadArticleImage`, `seoRows`, `setSeo`, `clearSeo` (paths of spec section 3).

- [ ] **Step 1: Write the failing tests** (helpers; each client method's method, path and body with a stubbed fetch; FormData without content-type).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to pass**, `cd web && npm run typecheck`.
- [ ] **Step 5: Stage this task's files.**

### Task 10: Storefront blog pages

- [ ] **Step 0: Invoke the design skills** (`design-taste-frontend`, `ui-ux-pro-max`, `frontend-design:frontend-design`).

**Files:**
- Create: `web/src/pages/{BlogList,ArticlePage}.tsx`, `web/src/components/{ArticleCard,RelatedArticles,FromBlog}.tsx`
- Modify: `web/src/App.tsx` (routes `blog`, `blog/:slug`, `en/blog`, `en/blog/:slug`), `web/src/pages/ProductPage.tsx` (`<RelatedArticles>` below the specifications only), `web/src/pages/Home.tsx` (`<FromBlog>` near the bottom), `web/src/components/Layout.tsx` (footer "Blog" link)
- Test: `web/src/pages/blog-wiring.test.ts`

**Interfaces:** layouts per spec section 6 (list B with featured card on page 1; article layout A with `ProductCard` row "Produk di artikel ini"; related as `ArticleCard`s, ≤ 3; "Dari blog" 3 newest). `ArticleCard` uses the item 1 `ProductPhoto`-style frame at 16:9 with a brand-colour fallback; article HTML comes only from `renderMarkdown` via `dangerouslySetInnerHTML` in one component (`ArticleBody`), nowhere else.

- [ ] **Step 1: Write the failing tests** (source wiring: routes; `RelatedArticles` placed after the specs block; `FromBlog` and footer link; `dangerouslySetInnerHTML` appears only in `ArticlePage.tsx` and its input is `renderMarkdown(`; English chrome strings on `/en`; empty states "Belum ada artikel.").
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to pass**, `npm run test:web`, `cd web && npm run typecheck`.
- [ ] **Step 5: Stage this task's files.**

### Task 11: Admin Blog and SEO screens

- [ ] **Step 0: Invoke the design skills.**

**Files:**
- Create: `web/src/admin/{BlogPages,SeoPage}.tsx` (`AdminBlogList`, `AdminArticleEditor`, `AdminSeo`)
- Modify: `web/src/admin/AdminShell.tsx` (`NAV` "Blog" `articles.manage`, "SEO" `seo.edit`), `web/src/App.tsx` (`blog`, `blog/new`, `blog/:id`, `seo`)
- Test: `web/src/admin/blog-wiring.test.ts`

**Interfaces:** spec section 3 copy and behaviour: language tabs, counters, snippet preview, slug auto-fill until edited, "URL lama akan dialihkan ke URL baru.", cover and body image upload with the rights checkbox, product picker (≤ 6, buttons to reorder), actions and their confirmations, version conflict keeps the typed text, `beforeunload`; SEO screen tabs "Produk" and "Kategori" with "otomatis"/"khusus" and "Kembalikan ke otomatis". Requests per article run through `createSerialQueue` (item 1).

- [ ] **Step 1: Write the failing tests** (wiring and exact copy; pages import only from `services/http`; no `dangerouslySetInnerHTML` except the preview, which uses `renderMarkdown(`).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to pass**, `npm run test:web`, typecheck.
- [ ] **Step 5: Stage this task's files.**

### Task 12: Demo content, CLIs and docs

**Files:**
- Create: `server/src/content/cli/{seed,remove-samples}.ts`, `server/seed/content/articles.json` (2 original articles per store; the first of each with English; 2-3 linked products; covers taken from the item 1 sample photo files where the product has one)
- Modify: `server/package.json` (`content:seed`, `content:remove-samples`), `docs/05-api/STOREFRONT_CONTRACT.md`, `docs/01-requirements/BUSINESS_RULES.md` (matrix row "Articles and SEO"), `docs/07-delivery/LAUNCH_CHECKLIST.md`, `architecture.md` (renderer, `PUBLIC_BASE_URL`, `SITE_BRAND`), `.graphify/{config.json,GRAPHIFY.md}`
- Test: `server/src/content/cli/{seed,remove-samples,articles-json}.test.ts`

**Interfaces:** `runContentSeed(deps, { operator? })` (validates every entry first with `checkLengths` and the Markdown renderer; upserts the demo SEO staff `U-05` if missing; adds articles whose Bahasa slug does not exist; `sample: true`; never touches other articles); `runContentRemoveSamples(deps, { operator })` (`--operator` required, deletes `sample` articles through `ArticleService.remove` after unpublishing, audited).

- [ ] **Step 1: Write the failing tests** (seed twice changes nothing; invalid entry exits 1 and writes nothing; remove only samples; `articles.json` passes every publish rule and contains no product claims the catalogue does not state).
- [ ] **Step 2: Run to fail.**
- [ ] **Step 3: Implement and write the articles.** Copy is original, Bahasa Indonesia (English translation for the first of each store), practical buying and care guidance, no medical claims for Halimun.
- [ ] **Step 4: Run to pass**, `npm run graphify:sync`.
- [ ] **Step 5: Stage this task's files.**

### Task 13: Deploy to dev, verify, review

**Files:**
- Create: `web/e2e/seo-dev.mjs`, `docs/superpowers/handoff/2026-10-29-seo-articles-dev-checks.md`

- [ ] **Step 1: Full local gate.** `npm run test:api`, `npm run test:web`, `npm run lint`. Expected: all pass.
- [ ] **Step 2: Write `web/e2e/seo-dev.mjs`** (fails before deploy): SEO staff signs in and lands on Blog; creates, publishes and schedules an article through the API; `curl`-style fetch without JavaScript shows title, description, canonical, og, JSON-LD and the text for the article, a product and a category; old slug 301; scheduled article 404; `sitemap.xml` and `robots.txt` content; shoppers see no `#ssr` text; product page shows "Artikel terkait"; CLS not worse than the item 1 baseline; axe 0 serious or critical on `/blog`, an article, a product page and the editor; Operasional and Marketing get 403 on the article API; cleanup.
- [ ] **Step 3: Roll out** (spec section 10): ask the owner for the go-ahead; back up; set `PUBLIC_BASE_URL` and `SITE_BRAND` in `server/.env` on the VM; deploy `api`, then template-aware `nginx -t`, then `web`; `content:seed`; restart `api`.
- [ ] **Step 4: Run** `seo-dev.mjs`, the sign-in check and the concurrency check; record every result in the dev checks log, with the Rich Results Test left for the owner.
- [ ] **Step 5: Review** the branch with a workflow (Sonnet, medium effort), fix findings test-first, re-run Steps 1 and 4.
- [ ] **Step 6: Stage this task's files.** The owner decides when to commit.
