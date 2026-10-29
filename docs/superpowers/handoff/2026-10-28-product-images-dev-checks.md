# Product images: dev deploy and checks (29 Oct 2026)

Dev server 43.159.54.222, tree `/home/ubuntu/tian`, branch `feat/product-images` (uncommitted, staged). Deployed by Agent 02 (Claude) with the owner's go-ahead in chat.

## Rollout

| Step | Result |
|---|---|
| Backup | `/home/ubuntu/backups/2026-10-29-pre-product-images/`: `tree.tgz` (deployed tree without `node_modules`/`dist`), `tian.pgdump` (`pg_dump -Fc` as the local `postgres` user, 21 tables of data), `media-listing.txt`. The bucket had no `media/` prefix yet, so there was nothing to copy. MinIO runs as the `minio/minio` container with data in `/data/minio` (no `mc` on the host; the copy step uses that directory). |
| MinIO key rights | Shown by behaviour, not by reading credentials: the API wrote and read back the bucket policy at start-up (`storage_init_ok`), and every test delete removed its files (only the 9 sample objects remain). |
| `api` | Image build ran 339/339 tests. `prisma db push` added `ProductImage` and the nullable `Variant.imageId`; 18 variants and 65 orders untouched. `/health` → `storage: minio`. |
| Bucket policy, anonymous from the host | `health/` 403, missing `media/*` key 404 `NoSuchKey` (reads allowed), list 403, PUT 403. |
| `web` | Template-aware `nginx -t` passed before the switch; `docker compose exec web nginx -t` passed after. Rendered config has `/tian-media/media/`, `proxy_pass http://host.docker.internal:9000`, no `${…}`, quoted regex intact. The web container holds only `MINIO_BUCKET` and `MEDIA_UPSTREAM`. |
| Seed | `media:seed` added 3 (B05, B07, A02), skipped 0; after `restart api` the catalogue returns them with `sample: true`; a seeded file through the web origin is 200 and byte-identical to the committed file. |
| Extra hidden headers | MinIO sent `X-Ratelimit-Limit`, `X-Ratelimit-Remaining` and a second `X-Content-Type-Options`; three `proxy_hide_header` lines added (test first), web redeployed. |
| 404 content type | 404s for `.webp` paths were labelled `image/webp`; `types { }` added to `@media_404` (test first), web redeployed; now `text/plain`, `no-store`, `nosniff`. |
| Admin preview width | `w-full` in the photo frame overrode `w-14`/`w-16` on the new admin screens; previews wrapped in fixed-width boxes, web redeployed, screenshots re-checked. |

## Checks after deploy

| Check | Result |
|---|---|
| GPS JPEG (EXIF with GPS) upload | 201; three WebP copies (480/960/1500); each 200 `image/webp`, one `public, max-age=31536000, immutable`, no `x-amz`/`x-minio`/rate-limit header, RIFF chunks `VP8` only (no EXIF, XMP, ICCP) |
| `/media/`, `/media/products/`, `/media/products/B07/`, uppercase hash, unknown key, `/media/health/…`, POST/PUT/DELETE | plain-text 404, `no-store`, `nosniff` |
| `..`, `%2e%2e`, merged and doubled slashes onto a real key | nginx normalises to the same allowed key: 200 for that photo only |
| Escape attempts (`../../health`, `%2e%2e/%2e%2e/.minio.sys/…`) | 404, or the storefront `index.html` (SPA fallback); never MinIO data |
| `?response-content-type=text/html` | 200 `image/webp` (query dropped) |
| MinIO ports 9000 and 9001 from outside | no answer |
| MinIO stopped | photo 404 plain; `/health` `degraded`; cart price 201 in 3 ms; catalogue 200; after restart `/health` `minio`, photo 200 |
| Body limits | 2 MB to `/v1/auth/sign-in` 413; 2 MB to the image route reaches the API (401 without session); 12 MB upload 413 JSON `TOO_LARGE` |
| Two parallel uploads at 5 photos (real DB) | one 201, one 409 `LIMIT_REACHED`; exactly 6 rows, positions 0–5 |
| Same JPEG twice | second 409 "Foto ini sudah ada di produk ini." |
| Variant link then delete | link 200, then `imageId` null |
| Reorder and middle delete (real DB) | reorder 200, positions 0–3 in the new order, `PRODUCT_IMAGE_REORDERED` with before/after ids; middle delete renumbers to 0–2 |
| Storm: 20 parallel link/unlink/reorder/delete/cart-price | 200×6, 201×4, 409×4, 422×6; no 5xx, no `40P01` (422 is "Foto tidak milik produk ini." after the delete) |
| Ten parallel 40 MP uploads (7744×5160) | none hangs, no 5xx: 201×6, 409 `LIMIT_REACHED`×4; API memory peak 265 MiB of 1.5 GiB (`mem_limit: 1536m` kept); about 1 s processing each |
| Checkout during the burst | measured on the server against `127.0.0.1:8080/v1/cart/price` every 0.5 s: median 3 ms, max 6 ms (a first measurement from the workstation showed 1–2 s, caused by the workstation's own upload link) |
| Sign-in check | 12/12 |
| Concurrency check | 12/12 |
| Audit | every media entry has `actorId`; every staff upload has `rightsConfirmed: true`; no `PRODUCT_IMAGE_FILE_DELETE_FAILED`; no API `ERROR` lines in the 40 minutes of checks |
| `web/e2e/photos-dev.mjs` | 13/14 on the final run: the one failure is CLS on the category page (below). Earlier run had CLS 0.000 on both pages. |

## Budgets and performance

| Budget | Result |
|---|---|
| (a) gzipped `/v1/catalog` growth ≤ 15 KB | sambung 1010 → 1255 B, halimun 637 → 808 B: pass |
| (b) category images before scroll at 390 px ≤ 400 KB | 160 KB (DPR 3): pass |
| (c) product main photo at 390 px ≤ 150 KB | DPR 1: 31 KB, DPR 2: 107 KB, DPR 3: 260 KB (the 1600 copy of a landscape photo): fails only at DPR 3 |
| (d) 5 MB-class JPEG processed in < 5 s | 4.0 MB noisy JPEG: 1.28 s on the server (8.5 s end to end over the workstation upload): pass |
| LCP, Slow 4G + 4× CPU, 390 px | 3.68 s (target 2.5 s, not a gate) |
| Thumbnails after the main photo | second thumbnail requested after the main photo finished, at DPR 1 and 2: pass |
| axe | 0 serious/critical on the product page and the photo manager |

## Open

- CLS on the category page: 0.115–0.120, already 0.120 before this deploy (drawings only). Source: the footer moves when the product grid replaces the short loading state (plus 0.005 from the web font). Not the photo frames. Fixing it touches the approved catalogue layout (reserve a minimum height while loading); owner approval needed.
- Budget (c) at DPR 3: decide whether to accept, or cap the main photo's `sizes` for phones.
- Pre-existing, seen in screenshots: the product spec row reads "USB-C ??Lightning" (broken arrow character in the fixture data); the sticky "+ Keranjang" bar covers the price on a 390 px product page; `w-full` on `ProductArt`'s frame also overrides `w-14` on the account recommendation rows (unchanged behaviour, not re-checked with a customer session).
- `graphify:check` flags `.env.example` as a ".env file" (its filter matches any path containing `.env`).

## Review and fix pass (29 Oct 2026)

Branch review as a workflow: four lenses (server, security and serving, web UI, spec and tests), each finding put to a skeptic, then a completeness critic; all agents Sonnet at medium effort. 10 findings, all upheld; 8 distinct after removing duplicates; the critic found nothing more. Fixed test-first and redeployed (api image build 345/345):

| Finding | Fix | Checked on dev |
|---|---|---|
| Overlapping `/health` probes could read each other's marker and report `degraded` | one probe key per request, deleted afterwards | 10 parallel probes: all `minio`, no probe objects left |
| Photo manager built async results from stale state (a reorder could undo an alt save; an upload could bring back a deleted photo) | pure helpers in `web/src/domain/photos.ts` (`applyOrder`, `withImageAdded`, `withImagePatched`, `withImageRemoved`) applied to the latest product; reorder ids computed when the queued request runs | alt edit then immediate ↑: photo moved and the new alt kept |
| ↑/↓/Jadikan utama/Hapus right after an alt edit were dropped | alt "saving" kept apart from action "busy"; actions queue behind the save | as above |
| Delete dialog lost focus on Batal, Escape or failure | focus returns to that row's "Hapus" | Escape and Batal: focus on "Hapus foto 2"; confirmed delete: focus on the remaining row's "Hapus" |
| Live region silent for a repeated identical message | `nextAnnouncement` toggles a trailing no-break space | move announced |
| Client pre-check by MIME type only | MIME type or extension | unit tests |
| Alt cleaning missed U+2060, U+200E, U+200F, U+180E, U+034F (an invisible alt passed) | added on server and web; regexes now written with escape sequences | unit tests |
| Sample alts for B05 ("latar putih") and B07 ("latar polos") describe a background that is not in the photo (both on wood) | not changed: approved copy; owner decision | — |

After the fix pass: `photos-dev.mjs` 13/14 (CLS only), sign-in check 12/12. Product-page CLS 0.087–0.116 on a cold load has the same single source as the category page: the footer moves when content replaces the loading text; the photo frame never appears as a shift source.
