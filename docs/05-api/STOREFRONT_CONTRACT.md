# Storefront API ready for the UI

The frontend should call only these routes. Money is integer Rupiah. Errors are `{ "error": { "code", "message", "details" } }`. Customer and staff calls send `Authorization: Bearer <token>`.

Dummy data loaded on startup for customer `C-0001` (`rina@example.com` / `demo-rina-2026`):

| Data | Value |
|---|---|
| Addresses | `rumah` (Coblong 40132), `kantor` (Sumur Bandung 40111). Phone and street are encrypted at rest |
| Wishlist | `B04`, `B06` |
| Saved cart | one `B01-2M-BLK` on Sambung |
| Consent | email promo off, WhatsApp order info on, personalised on |
| Pages | `/v1/pages/tentang`, `/v1/pages/faq`, `/v1/pages/kebijakan-privasi` |
| Catalogue | W00 Halimun and Sambung products |
| Orders | W00 `ORD-261014-0001` through `ORD-261020-0009` |
| Staff | `andi@toko.example` / `demo-staff-2026` plus the server TOTP secret |

## Public

| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/v1/catalog?brand=&q=` |
| GET | `/v1/products/{slug}` |
| GET | `/v1/promotions/active?brand=` |
| POST | `/v1/cart/price` |
| POST | `/v1/shipping/quotes` |
| GET | `/v1/pages` |
| GET | `/v1/pages/{slug}` |
| POST | `/v1/auth/sign-in` |
| POST | `/v1/auth/register` |
| POST | `/v1/auth/forgot-password` |
| POST | `/v1/auth/sign-out` |
| GET | `/v1/auth/google/start` returns `501 NOT_CONFIGURED` until `GOOGLE_CLIENT_ID` is set |
| GET | `/v1/articles?lang=id\|en&page=` |
| GET | `/v1/articles/{slug}?lang=id\|en` |
| GET | `/v1/products/{slug}/articles` |

### Blog articles

Only live articles of the deployment's store (`SITE_BRAND`) are public. A live article is published with a publish time at or before now (WIB).

- `GET /v1/articles` answers `{ "page", "pages", "items": [card] }`, newest first, 12 per page. A card is `{ id, lang, slug, title, summary, cover, readingMinutes, publishedAt }`; `cover` has the product photo shape (`src`, `srcset`, `width`, `height`, `alt`) or is `null`.
- `GET /v1/articles/{slug}` answers the card fields plus `seoTitle`, `metaDescription`, `html` (the server's Markdown renderer output; the only HTML the storefront inserts), `plain`, `noindex`, `canonicalUrl`, `updatedAt`, `authorName`, `otherLang` (`{ lang, slug }` or `null`) and `products` (catalogue products in the article's order). An old slug answers `301` with `Location` set to the current one; an unknown or not-live slug answers `404 NOT_FOUND` "Artikel tidak ditemukan.".
- `GET /v1/products/{slug}/articles` answers up to 3 live Bahasa cards that link to the product, newest first, or `[]`.
- Article covers and body images are served by nginx from `/media/articles/{articleId}/{hash16}-{target}.webp` with the same rules as product photos.

### Server-rendered pages (crawlers and first load)

nginx sends `/blog`, `/blog/{slug}`, `/en/blog`, `/en/blog/{slug}`, `/produk/{slug}` and `/kategori/{slug}` to `GET /render?path=…` on the API, which fills `index.html` with the title, description, canonical, Open Graph, `hreflang` (only when both languages exist), JSON-LD and the page text in `#ssr` (hidden once JavaScript runs). `GET /sitemap.xml` and `GET /robots.txt` come from the same service. When the API is down, nginx falls back to the plain `index.html`. These three paths have no `/v1` prefix and are not part of the JSON API.


### Product photos in catalogue responses

`GET /v1/catalog` and `GET /v1/products/{slug}` return, on each product, `images` in gallery order (position 0 is the main photo), always as an array:

```json
"images": [{
  "id": "…", "alt": "Kabel USB-C hitam melingkar di atas meja", "width": 2400, "height": 1600,
  "src": "/media/products/B01/1a2b3c4d5e6f7a8b-960.webp",
  "srcset": "/media/products/B01/1a2b3c4d5e6f7a8b-480.webp 480w, …-960.webp 960w, …-1600.webp 1600w",
  "sample": true
}]
```

- `sample` is present, and `true`, only for demo photos; the storefront then shows "Foto contoh" under the gallery. No licence or credit data is public.
- Each `srcset` descriptor `Nw` is the shorter-side target N in the file name, not the real width. `width` and `height` are the largest copy's real size.
- Each variant carries `imageId` when it is linked to a photo, and omits it otherwise.
- An empty `images` array means the storefront shows the product drawing (`art`).
- nginx serves the files from `/media/products/{productId}/{hash16}-{target}.webp` with `Cache-Control: public, max-age=31536000, immutable`. A changed photo gets a new file name. Any other `/media/` path, and any failure, is a plain-text `404` with `no-store`.

## Customer session

| Method | Path |
|---|---|
| GET, PUT | `/v1/me/cart?brand=` |
| POST | `/v1/me/cart/merge` |
| GET, PUT, DELETE | `/v1/me/wishlist` and `/v1/me/wishlist/{productId}` |
| GET, POST | `/v1/me/addresses` |
| PATCH, DELETE | `/v1/me/addresses/{id}` |
| GET, PATCH | `/v1/me/consents` |
| POST | `/v1/orders` with `Idempotency-Key` |
| GET | `/v1/me/orders` and `/v1/me/orders/{number}` |
| POST | `/v1/orders/{number}/payment` | Midtrans Core API charge JSON (`status_code`, `gross_amount` as `\"87000.00\"`, `payment_type`) |
| POST | `/v1/webhooks/payment/midtrans` | Midtrans notification. Signature is `SHA512(order_id + status_code + gross_amount + server_key)`. Paid only when `status_code` is `200`, `fraud_status` is `accept`, and `transaction_status` is `settlement` or `capture`. |
| POST | `/v1/shipping/kiriminaja/shipping_price` | KiriminAja `shipping_price` body: `origin`, `destination`, `weight` grams, `item_value`. `results[].cost` is a string. |
| POST | `/v1/webhooks/shipping/kiriminaja` | KiriminAja callback. Header `Authorization: Bearer <api key>`. `method` is `processed_packages`, `shipped_packages`, or `finished_packages`. |

Until `MIDTRANS_SERVER_KEY` and `KIRIMINAJA_API_KEY` are set, the simulator uses `SB-Midtrans-dummy` and `KA-dummy`. Setting the real sandbox keys switches verification without changing the handlers.

## Staff session

| Method | Path |
|---|---|
| POST | `/v1/admin/auth/sign-in` |
| GET | `/v1/admin/metrics` |
| GET | `/v1/admin/orders?status=` |
| POST | `/v1/admin/orders/{number}/process` |
| POST | `/v1/admin/orders/{number}/ship` |
| POST | `/v1/admin/orders/{number}/refunds` |
| GET | `/v1/admin/customers` |
| GET | `/v1/admin/customers/{id}/contact` |
| POST | `/v1/admin/customers/{id}/contact-reveals` |
| GET | `/v1/admin/promotions/{code}` |
| GET | `/v1/admin/audit-log` |

### Admin media (`products.media`: Owner, Admin, Marketing, SEO)

Staff cookie required. A guard checks the session (401) and the permission (403 `FORBIDDEN`) before any upload body is read. Every response is `private, no-store`. Each change writes an audit entry (`PRODUCT_IMAGE_ADDED`, `PRODUCT_IMAGE_REMOVED`, `PRODUCT_IMAGE_REORDERED`, `PRODUCT_IMAGE_ALT_CHANGED`, `VARIANT_IMAGE_LINKED`, `PRODUCT_IMAGE_FILE_DELETE_FAILED`) with `actorId` in `after`.

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/v1/admin/products` | | Products of both brands with photos (including `position`, `source`, licence fields) and `variants[].imageId` |
| POST | `/v1/admin/products/{id}/images` | multipart: `file` (one), `alt`, `rightsConfirmed` = `"true"` | `201` with the new photo |
| PATCH | `/v1/admin/products/{id}/images/{imageId}` | `{ "alt": "…" }` | The photo; the stored value again is a no-op without audit |
| PUT | `/v1/admin/products/{id}/images/order` | `{ "ids": [...] }`, the full new order | `{ "ids": [...] }` |
| PUT | `/v1/admin/variants/{sku}/image` | `{ "imageId": "…" or null }` | `{ "sku", "imageId" }` |
| DELETE | `/v1/admin/products/{id}/images/{imageId}` | | `{ "ok": true }`; files go after the row, and a failed file removal is audited but still answers 200 |

Upload limits: one JPEG, PNG or WebP file up to 10 MB (type read from the bytes), shorter side at least 480 px, at most 40 megapixels, 6 photos per product, alt text 1–125 characters (Unicode code points), 20 uploads per staff member per 10 minutes. nginx allows an 11 MB body on the upload path only.

| Status | Code | Message |
|---|---|---|
| 401 | `UNAUTHORIZED` | "Sesi tidak berlaku." |
| 403 | `FORBIDDEN` | "Peran {peran} tidak punya izin untuk aksi ini." |
| 404 | `NOT_FOUND` | "Produk, varian atau foto tidak ditemukan." (also for a photo of another product) |
| 409 | `LIMIT_REACHED` | "Maksimal 6 foto per produk." |
| 409 | `CONFLICT` | "Foto ini sudah ada di produk ini." / "Foto lain sedang diunggah. Coba lagi." / "Urutan foto berubah. Muat ulang halaman." / "Foto baru saja dihapus. Muat ulang halaman." |
| 413 | `TOO_LARGE` | "Ukuran file maksimal 10 MB." |
| 415 | `UNSUPPORTED_MEDIA` | "Format tidak didukung. Gunakan JPG, PNG, atau WebP." / "Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi." |
| 422 | `VALIDATION` | "Pilih satu file foto." / "File foto rusak atau tidak bisa dibaca." / "Foto terlalu kecil. Sisi terpendek minimal 480 px." / "Foto terlalu besar untuk diproses (maks. 40 megapiksel)." / "Teks alternatif wajib diisi (1–125 karakter)." / "Konfirmasi hak foto wajib dicentang." / "Daftar urutan foto tidak valid." / "Foto tidak milik produk ini." |
| 429 | `RATE_LIMITED` | "Terlalu banyak unggahan. Coba lagi nanti." |
| 503 | `STORAGE_UNAVAILABLE` | "Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar." (with `Retry-After: 10` when image work is busy) |

Live Midtrans, Duitku, and courier calls stay refused until their server keys exist. Google sign-in stays `NOT_CONFIGURED`. The UI can be built against this list.

### Admin articles and SEO (`articles.manage`, `seo.edit`: Owner and SEO)

Staff cookie, guard before any body is read, `private, no-store`, an audit entry for every change (`ARTICLE_CREATED`, `ARTICLE_UPDATED`, `ARTICLE_PUBLISHED`, `ARTICLE_SCHEDULED`, `ARTICLE_UNPUBLISHED`, `ARTICLE_DELETED`, `ARTICLE_SLUG_CHANGED`, `ARTICLE_COVER_CHANGED`, `SEO_OVERRIDE_CHANGED`) with `actorId` in `after`.

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/v1/admin/articles?store=` | | Articles of the store, newest change first |
| POST | `/v1/admin/articles` | `{ store, text }` (Bahasa fields) | The new draft |
| GET | `/v1/admin/articles/{id}` | | `{ id, store, status, publishAt, publishedAt, updatedAt, version, authorId, authorName, cover, tags, sample, texts: { id, en? }, productIds, live }` |
| PUT | `/v1/admin/articles/{id}` | `{ version, texts: { id, en?: text or null }, tags, productIds }` | The article; `en: null` removes the English version |
| POST | `/v1/admin/articles/{id}/publish` | `{ version, publishAt: ISO or null }` | The article |
| POST | `/v1/admin/articles/{id}/unpublish` | `{ version }` | The article |
| DELETE | `/v1/admin/articles/{id}` | | `{ "ok": true }`; drafts and unpublished articles only |
| POST | `/v1/admin/articles/{id}/cover` | multipart `file`, `alt`, `rightsConfirmed` | The article |
| DELETE | `/v1/admin/articles/{id}/cover` | | The article |
| POST | `/v1/admin/articles/{id}/images` | multipart `file`, `rightsConfirmed` | `{ src, width, height }` for `![alt](src)` |
| GET | `/v1/admin/seo?store=&kind=product\|category` | | `[{ key, name, path, auto: { title, description }, override }]` |
| PUT | `/v1/admin/seo/{kind}/{key}` | `{ store, seoTitle, metaDescription }` (null = automatic) | `200`, empty |
| DELETE | `/v1/admin/seo/{kind}/{key}?store=` | | `200`, empty; back to automatic |

Upload rules and messages are those of product photos. Article errors: `409 CONFLICT` "Slug sudah dipakai artikel lain." / "Artikel diubah orang lain. Muat ulang halaman." / "Batalkan terbit dulu sebelum menghapus."; `422 VALIDATION` for slugs, lengths, missing fields before publish, an incomplete English version, a schedule time not in the future, products of another store or more than 6, a canonical that is not `https://`; `404 NOT_FOUND` "Artikel tidak ditemukan.".

