# Product Images in MinIO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the drawn product placeholders with real WebP photos stored in MinIO and served by nginx from `/media`, with demo sample photos, an Owner/Admin/Marketing photo manager, and the drawing as fallback.

**Architecture:** `sharp` resizes each upload once into WebP copies (shorter-side targets 480/960/1600) stored under `media/products/{productId}/{hash16}-{target}.webp`. A new `MediaModule` (guard, controller, service, `ObjectStorage` seam) writes rows and audit entries under a per-product row lock (`lockProduct`). `CatalogService` returns `images` and `variants[].imageId`; nginx serves an allowlisted `/media/` path with one-year caching; React `ProductPhoto` replaces `ProductArt` in the photo areas only.

**Tech Stack:** NestJS 10, Prisma 5 (`db push`), `@aws-sdk/client-s3` 3.687.0, `sharp` 0.33.5, Multer (via `@nestjs/platform-express`), vitest, React 18, Tailwind, nginx 1.27 templates, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-product-images-design.md` (executors read it alongside this plan; where the plan says "spec section N" it means that file).

## Global Constraints

- TDD for every code task: failing test, run it to see it fail, implement, run to pass.
- Subagents use `model: "sonnet"` and `effort: "medium"` (`.claude/rules/subagent-model.md`).
- Commits only when the owner asks. Each task ends with "Stage this task's files" (never `git add -A`); the commit itself waits for the owner. No `git push`, ever. Nothing is published outside the dev server.
- Copy shown to customers and staff is Bahasa Indonesia; code, paths (`/v1`, `/media`), docs and commit text are English.
- Agent 01's screens stay unchanged outside the photo area (product page photo, photo inside cards, cart rows, account rows) and the new admin Produk screens. Edits to `web/src/domain/{types,rbac}.ts` are approved (spec section 1, 2).
- Web work (Tasks 11, 12): invoke `design-taste-frontend`, `ui-ux-pro-max` and `frontend-design:frontend-design` with the Skill tool before writing code (`.claude/rules/frontend-design-skills.md`). Self-hosted fonts only, no CDN. Money only through `web/src/domain/money.ts`.
- Money is integer Rupiah; reference cart Rp587.250 and W00 metrics must still pass.
- Limits are constants, not env vars: `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`, 6 photos, min shorter side 480 px, 40,000,000 pixels, WebP quality 80, targets 480/960/1600, alt 1-125 code points, 20 uploads per staff per 10 min, limiter 2 jobs / 10 s wait.
- Bucket policy: one Allow, principal everyone, `s3:GetObject` only, `arn:aws:s3:::${MINIO_BUCKET}/media/*`. MinIO never exposed publicly; `web` never gets `server/.env`.
- Audit: every media change writes one append-only entry in the same transaction, `actorId` inside `after`; rejected requests write nothing.
- No `--accept-data-loss`; the change is roll-forward only.
- Test commands: server `cd server && npx vitest run <file>`; web `cd web && npx vitest run <file>`; full: `npm run test:api`, `npm run test:web` from the repo root. Web typecheck: `cd web && npm run typecheck`; server compile: `cd server && npx tsc -p tsconfig.json --noEmit`.
- vitest uses esbuild, which does not emit decorator metadata: every media-module class that Nest injects uses explicit `@Inject(Token)` constructor parameters so tests can boot it.

## Review Focus

Failure modes the spec implies but does not test, most likely first. Each has its test in the named task.

1. Extreme-aspect photo (for example 25000x1600, exactly 40 MP): the 1600 copy would be 25000 px wide and WebP stops at 16383 px per side, so encoding would throw and surface as a 500. Expected: 422 with the over-size message, nothing written. (Task 4)
2. PNG with transparency, and an animated WebP: expected a normal static WebP (first frame only, alpha kept), never an error or an animated copy. (Task 4)
3. Hostile upload filename (`../../etc/passwd` plus a right-to-left override, 300 characters, non-ASCII): never reaches a storage key; audit keeps it cut to 120 characters. (Task 6)
4. PATCH alt to the value already stored: expected 200 and no audit entry (same rule as a no-op variant link). (Task 6)
5. A cached pre-deploy or partial catalogue payload where an image lacks `srcset` or the product lacks `images`: the card must still render the photo or the drawing without throwing. (Task 10)

## File map

| Area | Create | Modify |
|---|---|---|
| Data | | `server/prisma/schema.prisma` |
| Types | | `server/src/domain/types.ts`, `web/src/domain/types.ts` |
| Server media | `server/src/media/{public-image,policy,limits,errors,rules,process,limiter,renumber,error-map,rate-limit,media-log,media.types,media.service,staff-media.guard,upload-exception.filter,media.controller,media.module}.ts`, `server/src/media/cli/{seed,remove-samples,common}.ts`, `server/seed/media/*` | `server/src/storage.service.ts`, `server/src/health.controller.ts`, `server/src/app.module.ts`, `server/src/commerce/{catalog.service,order-lock,commerce.module}.ts`, `server/src/domain/rbac.ts`, `server/package.json`, `server/tsconfig.json`, `server/Dockerfile` |
| Server test support | `server/src/test/{fake-storage,fake-media-db,image-fixtures}.ts` | |
| Web | `web/src/domain/photos.ts`, `web/src/components/{ProductPhoto,ProductGallery}.tsx`, `web/src/admin/{ProductPages,serial-queue}.tsx/ts` | `web/src/domain/rbac.ts`, `web/src/services/{contracts.ts,http/client.ts,http/admin.ts}`, `web/src/components/{ui,ProductCard}.tsx`, `web/src/pages/{ProductPage,CartPage,Account,Catalog,Home,SearchPage}.tsx`, `web/src/admin/AdminShell.tsx`, `web/src/App.tsx`, `web/e2e/admin.mjs` |
| Serving | `.env.example` | `web/nginx.conf`, `web/Dockerfile`, `docker-compose.yml` |
| Docs | `docs/07-delivery/LAUNCH_CHECKLIST.md`, `docs/07-delivery/photo-licences/*` | `docs/05-api/STOREFRONT_CONTRACT.md`, `docs/01-requirements/BUSINESS_RULES.md`, `architecture.md`, `docs/README.md`, `.graphify/{config.json,GRAPHIFY.md,report.json}` |

Notes on the breakdown (the only deviations from the requested 14 tasks, each because a piece is not independently testable where first listed):

- Service-level concurrency cases ("two uploads at 5 photos", "delete during variant link", and so on) need `MediaService`, so they are written in Task 6. Task 5 proves the lock primitive, the fake database (no serialisation, unique keys, row locks, rollback) and `renumber`. Task 6 runs a mutation check (comment out `lockProduct`, see the test fail).
- `web/src/admin/serial-queue.ts` (one request at a time per product) is a pure function and is tested in Task 12 with the admin page that uses it.
- `web/e2e/photos-dev.mjs` (the Playwright run against dev) is written in Task 14, next to the deploy it verifies.

---

### Task 1: Data model and catalogue payload

**Files:**
- Modify: `server/prisma/schema.prisma` (add `images ProductImage[]` to `Product` line 43 area; add `imageId String?`, `image ProductImage? @relation(fields: [imageId], references: [id], onDelete: SetNull)`, `@@index([imageId])` to `Variant` lines 48-58; new `model ProductImage`)
- Modify: `server/src/domain/types.ts`, `web/src/domain/types.ts` (Product/Variant)
- Create: `server/src/media/public-image.ts`
- Modify: `server/src/commerce/catalog.service.ts` (`refresh()` line 128 include; `toProduct` lines 208-250)
- Test: `server/src/media/public-image.test.ts`, `server/src/media/schema.test.ts`, `server/src/commerce/catalog.service.test.ts` (extend; add `images: []` to the existing `productRow` helper and `imageId: null` to its variant)

**Interfaces:**
- Produces (types, both copies of `types.ts`): `export interface ProductImage { id: string; alt: string; width: number; height: number; src: string; srcset: string; sample?: true }`; `Variant.imageId?: string`; `Product.images?: ProductImage[]`.
- Produces: `mediaKey(productId: string, hash16: string, target: number): string` returns `media/products/{productId}/{hash16}-{target}.webp`; `toPublicImage(row: { id: string; productId: string; alt: string; hash: string; width: number; height: number; sizes: number[]; source: string }): ProductImage`.
- Prisma `ProductImage` fields exactly as spec section 1 (`id cuid`, `productId` Cascade, `position`, `alt`, `hash`, `width`, `height`, `sizes Int[]`, `source`, `creator?`, `licence?`, `licenceUrl?`, `sourceUrl?`, `retrievedAt?`, `licenceCheck?`, `createdAt String`, `createdBy String`, `@@unique([productId, position])`, `@@unique([productId, hash])`, `variants Variant[]`).

- [ ] **Step 1: Write the failing tests**

```ts
// public-image.test.ts
it("builds srcset descriptors from the stored targets, src is the largest target <= 960", () => {
  const img = toPublicImage({ id: "i1", productId: "B01", alt: "Kabel", hash: "1a2b3c4d5e6f7a8b" + "0".repeat(48), width: 2400, height: 1600, sizes: [480, 960, 1600], source: "upload" });
  expect(img.src).toBe("/media/products/B01/1a2b3c4d5e6f7a8b-960.webp");
  expect(img.srcset).toBe("/media/products/B01/1a2b3c4d5e6f7a8b-480.webp 480w, /media/products/B01/1a2b3c4d5e6f7a8b-960.webp 960w, /media/products/B01/1a2b3c4d5e6f7a8b-1600.webp 1600w");
});
it("src falls back to the smallest target when sizes is [480]", /* expect -480.webp */);
it("sample is true only for source sample and no credit or licence keys leak", () => {
  expect(toPublicImage({ ...row, source: "sample" }).sample).toBe(true);
  expect("sample" in toPublicImage({ ...row, source: "upload" })).toBe(false);
  expect(Object.keys(toPublicImage({ ...row, source: "sample" })).sort()).toEqual(["alt", "height", "id", "sample", "src", "srcset", "width"]);
});
// schema.test.ts (needs `npx prisma generate` first)
it("ProductImage has both unique keys and Variant.imageId is SetNull", () => {
  const m = Prisma.dmmf.datamodel.models;
  expect(m.find((x) => x.name === "ProductImage")!.uniqueFields).toEqual(expect.arrayContaining([["productId", "position"], ["productId", "hash"]]));
  expect(m.find((x) => x.name === "Variant")!.fields.find((f) => f.name === "image")!.relationOnDelete).toBe("SetNull");
  expect(m.find((x) => x.name === "ProductImage")!.fields.find((f) => f.name === "product")!.relationOnDelete).toBe("Cascade");
});
// catalog.service.test.ts
it("asks for images ordered by position and returns them in that order with variant imageId", /* findMany spy: include.images.orderBy = { position: "asc" }; list("sambung").products[0].images.map(i => i.id) equals the rows' order; variant.imageId === "i2"; a variant with imageId null omits the key */);
it("bySlug carries images", /* product.images[0].src startsWith "/media/products/" */);
```

- [ ] **Step 2: Run to verify it fails.** `cd server && npx vitest run src/media/public-image.test.ts src/commerce/catalog.service.test.ts` Expected: FAIL "Cannot find module './public-image'"; catalogue cases fail on `images` undefined.
- [ ] **Step 3: Edit `schema.prisma`, run `cd server && DATABASE_URL=postgresql://u:p@localhost:5432/x npx prisma generate`, then implement `public-image.ts` and extend `refresh()`/`toProduct`.** `toProduct` row type gains `images` and `variants[].imageId`; map `images` through `toPublicImage`, set `Variant.imageId` only when non-null; `Product.images` always an array (empty when none). Add the optional fields to both `types.ts` copies.
- [ ] **Step 4: Run to pass.** `cd server && npx vitest run src/media src/commerce/catalog.service.test.ts` then `npx tsc -p tsconfig.json --noEmit` and `cd ../web && npm run typecheck`. Expected: PASS, no type errors.
- [ ] **Step 5: Stage this task's files** (never `git add -A`): `git add server/prisma/schema.prisma server/src/domain/types.ts web/src/domain/types.ts server/src/media/public-image.ts server/src/media/public-image.test.ts server/src/media/schema.test.ts server/src/commerce/catalog.service.ts server/src/commerce/catalog.service.test.ts`

---

### Task 2: Storage seam

**Files:**
- Modify: `server/src/storage.service.ts` (today a concrete `ObjectStorage` with `ensureBucket` that creates the bucket on any error, lines 22-32)
- Create: `server/src/media/policy.ts`, `server/src/storage.module.ts`, `server/src/test/fake-storage.ts`
- Modify: `server/src/app.module.ts` (import `StorageModule`, drop the `ObjectStorage` provider), `server/src/health.controller.ts`
- Test: `server/src/media/policy.test.ts`, `server/src/storage.service.test.ts`, `server/src/health.controller.test.ts`

**Interfaces:**
- Produces (`storage.service.ts`): `export abstract class ObjectStorage` (token and type) with `abstract readonly bucket: string; ready: boolean; lastErrorClass?: string` and methods `init(): Promise<boolean>` (one attempt: ensureBucket then ensurePublicMediaPolicy, sets `ready`), `ensureBucket(): Promise<void>`, `putText(key, body): Promise<void>`, `getText(key): Promise<string>`, `putObject(key: string, body: Buffer, contentType: string): Promise<void>`, `deleteObjects(keys: string[]): Promise<void>`, `exists(key: string): Promise<boolean>`, `putBucketPolicy(json: string): Promise<void>`, `getBucketPolicy(): Promise<string | null>`, `ensurePublicMediaPolicy(): Promise<void>` (put, read back, compare with `policyMatches`, throw on mismatch).
- Produces: `export class S3ObjectStorage extends ObjectStorage` with constructor `(@Optional() @Inject(S3_CLIENT) client?: S3Client)`; `export const S3_CLIENT = Symbol("S3_CLIENT")`; `export const STORAGE_RETRY_MS = 30_000`.
- Produces (`policy.ts`): `publicMediaPolicy(bucket: string): string`, `policyMatches(actual: string, bucket: string): boolean`.
- Produces (`fake-storage.ts`): `fakeStorage(): FakeStorage` implementing `ObjectStorage` with `objects: Map<string, { body: Buffer; contentType: string }>`, `policy: string | null`, `ready = true`, `failNthPut?: number`, `failAll = false`, `failDeletes = false`, `deleteCalls: string[][]`; failures throw an error whose `name` is `"ServiceUnavailable"`.
- `StorageModule` provides `{ provide: ObjectStorage, useClass: S3ObjectStorage }` and exports `ObjectStorage`.

- [ ] **Step 1: Write the failing tests**

```ts
// policy.test.ts
it("builds the single read-only statement", () => {
  expect(JSON.parse(publicMediaPolicy("tian-media"))).toEqual({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Principal: { AWS: ["*"] }, Action: ["s3:GetObject"], Resource: ["arn:aws:s3:::tian-media/media/*"] }] });
});
it("compares by meaning: string vs array, principal '*' vs {AWS:'*'}", /* reformatted equal -> true */);
it.each(["s3:ListBucket extra action", "Resource arn:aws:s3:::tian-media/*", "second statement", "Effect Deny", "a Condition block", "invalid JSON"])("rejects %s", /* policyMatches false */);
// storage.service.test.ts (stub S3Client { send } recording command names)
it("(d) ensurePublicMediaPolicy replaces a broader existing policy and verifies the read-back", /* stub stores the last PutBucketPolicy; broader policy before; after call GetBucketPolicy equals publicMediaPolicy; a stub that returns a different policy on read-back makes the call reject */);
it("(e) HeadBucket/CreateBucket/policy calls throwing: onModuleInit resolves, ready=false, one storage_init_failed log with error class and no keys", /* spy Logger */);
it("(e) a non-404 HeadBucket error (name 'NetworkingError') never sends CreateBucketCommand; NotFound does", /* ... */);
it("(e) retries every STORAGE_RETRY_MS until bucket and policy are in place, then ready=true and storage_init_ok logged once", /* vi.useFakeTimers; advanceTimersByTimeAsync(30_000) */);
it("(f) putObject sends ContentType image/webp as given and exists() maps NotFound to false", /* ... */);
// health.controller.test.ts
it("reports storage degraded with the normal result when not ready and does not call putText", /* ok:true, storage:"degraded" */);
it("reports degraded instead of throwing when the MinIO write fails", /* ... */);
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/media/policy.test.ts src/storage.service.test.ts src/health.controller.test.ts` Expected: FAIL (modules or exports missing).
- [ ] **Step 3: Implement.** `policy.ts` pure (parse JSON, normalise principal/action/resource to sets, require exactly one Allow statement and no Condition). `ensureBucket` creates only when HeadBucket answers `NotFound` (error name or `$metadata.httpStatusCode === 404`); anything else is rethrown. `onModuleInit` awaits one `init()` attempt capped at 5 s (`Promise.race`) so a hanging MinIO cannot hold up start-up, swallows the error, logs `event=storage_init_failed errorClass=<name>` once per failure, then schedules retries every `STORAGE_RETRY_MS` (timer `unref()`'d, cleared in `onModuleDestroy`) until `init()` succeeds and logs `storage_init_ok` once. `putObject` sets `ContentType`; `deleteObjects` uses `DeleteObjectsCommand` in batches of 1000. Health: `ready` false or any storage error gives `storage: "degraded"` with HTTP 200, otherwise `"minio"`.
- [ ] **Step 4: Run to pass.** Same command, then `npx tsc -p tsconfig.json --noEmit`. Expected: PASS.
- [ ] **Step 5: Stage this task's files:** `git add server/src/storage.service.ts server/src/storage.service.test.ts server/src/storage.module.ts server/src/media/policy.ts server/src/media/policy.test.ts server/src/test/fake-storage.ts server/src/app.module.ts server/src/health.controller.ts server/src/health.controller.test.ts`

---

### Task 3: Pure media rules and error table

**Files:**
- Create: `server/src/media/limits.ts`, `server/src/media/errors.ts`, `server/src/media/rules.ts`
- Test: `server/src/media/rules.test.ts`, `server/src/media/errors.test.ts`

**Interfaces:**
- Produces (`limits.ts`): `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`, `MAX_PHOTOS = 6`, `MIN_SHORTER_SIDE = 480`, `MAX_PIXELS = 40_000_000`, `MAX_WEBP_SIDE = 16383`, `WEBP_QUALITY = 80`, `TARGET_LADDER = [480, 960, 1600] as const`, `ALT_MAX = 125`, `UPLOAD_LIMIT = 20`, `UPLOAD_WINDOW_MS = 600_000`, `LIMITER_JOBS = 2`, `LIMITER_WAIT_MS = 10_000`, `FILENAME_AUDIT_MAX = 120`.
- Produces (`errors.ts`): `type MediaErrorKey`, `mediaError(key: MediaErrorKey): HttpException` with body `{ code, message }`, and `class MediaBusyException extends HttpException` (503 `STORAGE_UNAVAILABLE`, property `retryAfterSeconds = 10`).
- Produces (`rules.ts`): `cleanAlt(input: string): string`, `altLength(text: string): number`, `parseAlt(input: unknown): string` (cleaned text or throws `mediaError("altInvalid")`), `defaultAlt(productName: string): string`, `detectImageType(head: Buffer): "jpeg" | "png" | "webp" | "heic" | "unsupported"`, `targetsFor(shorterSide: number): number[]`.

Exact copy for `errors.ts` (key: status, code, message):

| key | status | code | message |
|---|---|---|---|
| `unsupportedFormat` | 415 | `UNSUPPORTED_MEDIA` | Format tidak didukung. Gunakan JPG, PNG, atau WebP. |
| `heic` | 415 | `UNSUPPORTED_MEDIA` | Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi. |
| `tooLarge` | 413 | `TOO_LARGE` | Ukuran file maksimal 10 MB. |
| `noFile` | 422 | `VALIDATION` | Pilih satu file foto. |
| `corrupt` | 422 | `VALIDATION` | File foto rusak atau tidak bisa dibaca. |
| `tooSmall` | 422 | `VALIDATION` | Foto terlalu kecil. Sisi terpendek minimal 480 px. |
| `tooManyPixels` | 422 | `VALIDATION` | Foto terlalu besar untuk diproses (maks. 40 megapiksel). |
| `altInvalid` | 422 | `VALIDATION` | Teks alternatif wajib diisi (1–125 karakter). |
| `rightsRequired` | 422 | `VALIDATION` | Konfirmasi hak foto wajib dicentang. |
| `orderInvalid` | 422 | `VALIDATION` | Daftar urutan foto tidak valid. |
| `notThisProducts` | 422 | `VALIDATION` | Foto tidak milik produk ini. |
| `notFound` | 404 | `NOT_FOUND` | Produk, varian atau foto tidak ditemukan. |
| `limitReached` | 409 | `LIMIT_REACHED` | Maksimal 6 foto per produk. |
| `duplicate` | 409 | `CONFLICT` | Foto ini sudah ada di produk ini. |
| `positionCollision` | 409 | `CONFLICT` | Foto lain sedang diunggah. Coba lagi. |
| `orderChanged` | 409 | `CONFLICT` | Urutan foto berubah. Muat ulang halaman. |
| `photoDeleted` | 409 | `CONFLICT` | Foto baru saja dihapus. Muat ulang halaman. |
| `rateLimited` | 429 | `RATE_LIMITED` | Terlalu banyak unggahan. Coba lagi nanti. |
| `storageUnavailable` | 503 | `STORAGE_UNAVAILABLE` | Penyimpanan foto sedang tidak tersedia. Coba lagi sebentar. |

- [ ] **Step 1: Write the failing tests**

```ts
// rules.test.ts
it.each([["   "], [" ​‍﻿"], ["\n\t"]])("parseAlt refuses %j", /* throws status 422 code VALIDATION */);
it("cleanAlt trims whitespace and zero-width ends and turns inner control runs into one space", () => expect(cleanAlt("​ a\n\tb  ")).toBe("a b"));
it("counts code points: 125 emoji ok, 126 refused", () => { expect(parseAlt("😀".repeat(125))).toHaveLength(250); expect(() => parseAlt("😀".repeat(126))).toThrow(); expect(altLength("😀".repeat(125))).toBe(125); });
it("stores HTML verbatim", () => expect(parseAlt("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>"));
it("defaultAlt cuts a 140-character name to 125 code points and prefixes 'Foto '", /* result code points === 125 */);
it.each([[Buffer.from([0xff,0xd8,0xff,0xe0]),"jpeg"],[png,"png"],[riffWebp,"webp"],[ftyp("heic"),"heic"],[ftyp("heix"),"heic"],[ftyp("hevc"),"heic"],[ftyp("mif1"),"heic"],[ftyp("msf1"),"heic"],[ftyp("avif"),"heic"],[Buffer.from("<svg "),"unsupported"],[Buffer.from("<?xml "),"unsupported"],[Buffer.from("GIF89a"),"unsupported"],[Buffer.from("GIF87a"),"unsupported"],[Buffer.from("hello.jpg text"),"unsupported"],[Buffer.alloc(0),"unsupported"]])("detectImageType %#", /* ... */);
it.each([[479,[]],[480,[480]],[960,[480,960]],[1200,[480,960,1200]],[1599,[480,960,1599]],[1600,[480,960,1600]],[5000,[480,960,1600]]])("targetsFor(%i)", /* sorted, no duplicates; below 480 returns [] */);
it("MAX_UPLOAD_BYTES is 10 MiB", () => expect(MAX_UPLOAD_BYTES).toBe(10485760));
// errors.test.ts
it.each(ALL_KEYS)("mediaError(%s) has the status, code and exact message of the spec table", /* one row per table line above */);
it("MediaBusyException is 503 STORAGE_UNAVAILABLE with retryAfterSeconds 10", /* ... */);
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/media/rules.test.ts src/media/errors.test.ts` Expected: FAIL "Cannot find module".
- [ ] **Step 3: Implement the three files.** `cleanAlt`: strip `\s`, U+00A0, U+200B-U+200D, U+FEFF from both ends; replace each run of control characters and tabs/line breaks inside with one space; no Unicode normalisation. `detectImageType` reads only the first 32 bytes; ISO-BMFF `ftyp` brand at bytes 8-11 in {heic, heix, hevc, mif1, msf1, avif}. `targetsFor`: ladder values `<= shorterSide`, plus `shorterSide` itself when under 1600 and not present; `[]` under 480.
- [ ] **Step 4: Run to pass.** Same command. Expected: PASS.
- [ ] **Step 5: Stage this task's files:** `git add server/src/media/limits.ts server/src/media/errors.ts server/src/media/rules.ts server/src/media/rules.test.ts server/src/media/errors.test.ts`

---

### Task 4: Image processing

**Files:**
- Modify: `server/package.json` (add `"sharp": "0.33.5"` to dependencies, `"@types/multer": "1.4.12"` to devDependencies, exact pins), `server/package-lock.json` (changes with the install; the image has no lockfile because the Dockerfile copies only `package.json`, so the pins in `package.json` stay the only pin there), `server/tsconfig.json` (`"types": ["node", "multer"]`)
- Create: `server/src/media/process.ts`, `server/src/media/limiter.ts`, `server/src/test/image-fixtures.ts`
- Test: `server/src/media/process.test.ts`, `server/src/media/limiter.test.ts`

**Interfaces:**
- Consumes: Task 3 `detectImageType`, `targetsFor`, `mediaError`, `MediaBusyException`, limits.
- Produces: `inspectImage(buffer: Buffer): Promise<ImageInfo>` where `ImageInfo = { format: "jpeg" | "png" | "webp"; width: number; height: number }` (oriented dimensions; throws `mediaError` for unsupported, heic, corrupt, tooManyPixels, tooSmall; header-only, never decodes pixels).
- Produces: `processImage(buffer: Buffer, info?: ImageInfo): Promise<ProcessedImage>`, `ProcessedImage = { hash: string; hash16: string; width: number; height: number; sizes: number[]; copies: { target: number; width: number; height: number; buffer: Buffer }[] }` (hash = SHA-256 hex of the largest copy; width/height = largest copy's real size).
- Produces: `configureSharp(): void` (`sharp.cache(false)`, `sharp.concurrency(2)`), `class ImageJobLimiter { constructor(jobs = LIMITER_JOBS, waitMs = LIMITER_WAIT_MS); run<T>(fn: () => Promise<T>): Promise<T> }` (rejects with `MediaBusyException` after the wait).
- Produces (`image-fixtures.ts`): `solidJpeg(w, h, opts?)`, `solidPng(w, h, opts?: { alpha?: boolean })`, `jpegWithMetadata()` (EXIF with GPS, XMP, ICC p3), `orientedJpeg(w, h, orientation)`, `animatedWebp()`, `heicBytes()`, `svgBytes()`.

- [ ] **Step 0: Confirm the pins.** `cd server && npm view sharp@0.33.5 version && npm view @types/multer@1.4.12 version`, then `npm install --save-exact sharp@0.33.5 && npm install --save-dev --save-exact @types/multer@1.4.12`. Run `node -e "const s=require('sharp'); console.log(['withExif','withIccProfile','withXmp'].map(k=>k+':'+typeof s()[k]))"`. Decision rule from spec section 2: if `withXmp` is missing in 0.33.5 (likely, it arrived in a later 0.34), keep the 0.33.5 pin and build the XMP fixture by inserting an APP1 `http://ns.adobe.com/xap/1.0/` segment into the JPEG bytes inside `jpegWithMetadata()`; do not bump the pin unless the owner agrees. Record the result in the task notes. Also confirm `sharp().metadata().xmp` exists.
- [ ] **Step 1: Write the failing tests**

```ts
// process.test.ts
it("precondition: the metadata fixture really carries exif, xmp and icc", async () => { const m = await sharp(jpegWithMetadata()).metadata(); expect(m.exif && m.xmp && m.icc).toBeTruthy(); });
it("every copy has no exif, xmp, iptc, icc or orientation and no EXIF/XMP /ICCP RIFF chunk", async () => { for (const c of (await processImage(await jpegWithMetadata())).copies) { const m = await sharp(c.buffer).metadata(); expect([m.exif, m.xmp, m.iptc, m.icc, m.orientation]).toEqual([undefined, undefined, undefined, undefined, undefined]); expect(riffChunks(c.buffer)).not.toEqual(expect.arrayContaining(["EXIF"])); /* also "XMP ", "ICCP" */ } });
it("outputs sRGB for a Display-P3 and a CMYK input", /* space === "srgb" */);
it.each([[3000,2000,[[480,720,480],[960,1440,960],[1600,2400,1600]]],[2000,3000,[[480,480,720],[960,960,1440],[1600,1600,2400]]]])("%ix%i gives (target,w,h) %j", /* copies match, largest width/height stored */);
it("shorter side 1200 gives targets 480/960/1200; 480 gives [480]; 960 gives [480,960]; nothing enlarged", /* sizes, no duplicate target, each copy's shorter side equals its target */);
it("orientation 6 on 1200x900 is read as 900x1200, passes 480, stores width 900 height 1200, no orientation tag", /* ... */);
it("hash is SHA-256 of the largest copy and hash16 its first 16 hex chars", /* ... */);
it("479 refused (tooSmall) and 480 accepted", /* 422 VALIDATION messages */);
it("rejects a solid PNG of 8001x5000 (40.005 MP) with tooManyPixels before decoding", /* inspectImage only; also assert elapsed small and no copies produced */);
it("Review Focus 1: 25000x1600 (40 MP) is refused with tooManyPixels because the 1600 copy would be 25000 px wide (> 16383)", /* inspectImage rejects; 16000x2000 accepted */);
it("Review Focus 2: PNG with alpha gives static WebP copies that keep alpha; animated WebP gives single-frame output", /* metadata().hasAlpha true; metadata().pages is 1 or undefined */);
it("rejects truncated and corrupt files with corrupt, SVG/GIF with unsupportedFormat, HEIC bytes with heic", /* ... */);
it("configureSharp sets concurrency 2 and cache off", /* sharp.concurrency() === 2 */);
// limiter.test.ts
it("runs 2 jobs at once and queues the rest", /* ... */);
it("rejects with MediaBusyException when a job cannot start within the wait (waitMs=50 in the test)", /* ... */);
it("frees the slot when a job throws", /* ... */);
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/media/process.test.ts src/media/limiter.test.ts` Expected: FAIL "Cannot find module './process'".
- [ ] **Step 3: Implement.** `inspectImage`: `detectImageType` on the first bytes, then `sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "error" }).metadata()` (a throw becomes `corrupt`; sharp's pixel-limit error becomes `tooManyPixels`), swap width/height when `orientation` is 5-8, refuse `w*h > MAX_PIXELS` and, for the largest target `t = targetsFor(shorter).at(-1)`, refuse when `round(longer * t / shorter) > MAX_WEBP_SIDE`, then `shorter < 480` gives `tooSmall`. `processImage`: per target `sharp(buffer, same options).rotate().resize({ width | height: target, withoutEnlargement: true })` (width for portrait/square, height for landscape), `.toColourspace("srgb").webp({ quality: WEBP_QUALITY })`, no `withMetadata`/`keepMetadata`, `animated` left false. Read each copy's real size with `metadata()`.
- [ ] **Step 4: Run to pass.** Same command, then `npx tsc -p tsconfig.json --noEmit`. Expected: PASS.
- [ ] **Step 5: Stage this task's files:** `git add server/package.json server/package-lock.json server/tsconfig.json server/src/media/process.ts server/src/media/process.test.ts server/src/media/limiter.ts server/src/media/limiter.test.ts server/src/test/image-fixtures.ts`

---

### Task 5: Product lock, fake media database, renumbering

**Files:**
- Modify: `server/src/commerce/order-lock.ts` (add after `lockOrder`, line 31)
- Create: `server/src/test/fake-media-db.ts`, `server/src/media/renumber.ts`
- Test: `server/src/commerce/order-lock.test.ts` (extend), `server/src/test/fake-media-db.test.ts`, `server/src/media/renumber.test.ts`

**Interfaces:**
- Produces (`order-lock.ts`): `lockProduct(tx: Prisma.TransactionClient, productId: string): Promise<void>` runs `SELECT id FROM "Product" WHERE id = $1 FOR UPDATE`, throws `HttpException({ code: "NOT_FOUND", message: "Produk, varian atau foto tidak ditemukan." }, 404)` when no row; `lockVariants(tx, productId): Promise<string[]>` runs `SELECT sku FROM "Variant" WHERE "productId" = $1 ORDER BY sku FOR UPDATE` and returns the SKUs.
- Produces (`renumber.ts`): `renumber(tx: Prisma.TransactionClient, productId: string, orderedIds: string[]): Promise<void>`: `productImage.updateMany({ where: { productId }, data: { position: { increment: 100 } } })` first, then `productImage.update` per id to position `0..n-1`.
- Produces (`fake-media-db.ts`): `fakeMediaDb(seed?: { products?: {...}[]; variants?: {...}[]; images?: {...}[] }): { prisma, state, inject }`. Surface the real code may call (anything else is a plan violation): `$transaction(fn, opts?)`, `$queryRaw` (recognises `FROM "Product"` lock and `FROM "Variant" WHERE "productId"` lock), `product.{findUnique,findMany}`, `productImage.{findMany,findFirst,count,create,update,updateMany,delete}`, `variant.{findMany,findUnique,update,updateMany}`, `auditRecord.{create,findFirst}`. Behaviour: transactions are not serialised (each awaited call yields to the event loop); `FOR UPDATE` on a product row holds a FIFO per-product mutex until the transaction ends; unique keys `(productId, position)` and `(productId, hash)` enforced at write time by throwing `new Prisma.PrismaClientKnownRequestError(msg, { code: "P2002", clientVersion: "5.22.0", meta: { target: [...] } })`; a throwing transaction rolls back via an undo journal; `inject.p2003OnVariantUpdate` makes the next `variant.update`/`updateMany` throw P2003; `state.audit` records `{ code, object, before, after }`.

- [ ] **Step 1: Write the failing tests**

```ts
// order-lock.test.ts (uses the existing fakeTx style)
it("lockProduct selects FOR UPDATE on the product id and throws 404 NOT_FOUND when absent", /* values[0] === "B01"; rows [] -> HttpException status 404 */);
it("lockVariants returns SKUs in sorted order", /* ["B01-1M-BLK","B01-2M-BLK"] */);
// fake-media-db.test.ts
it("does not serialise: two transactions interleave their reads", /* both read count 5 before either writes */);
it("a lock-holding transaction blocks a second lockProduct until it ends, FIFO", /* ... */);
it("duplicate (productId, position) and (productId, hash) throw P2002 with meta.target containing 'position' / 'hash'", /* ... */);
it("a throwing transaction leaves rows, links and audit as before", /* ... */);
// renumber.test.ts
it("moves to +100 first, then writes 0..n-1 in the wanted order without a unique-key error", /* 6 photos reversed on the fake; positions 0..5 in new order; no row above 5 afterwards */);
it("renumbering after deleting the middle of four leaves 0,1,2 in the old order", /* ... */);
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/commerce/order-lock.test.ts src/test/fake-media-db.test.ts src/media/renumber.test.ts` Expected: FAIL (`lockProduct` not exported; modules missing).
- [ ] **Step 3: Implement** the helpers and the fake. The fake is a test double only; keep it under about 200 lines by journaling writes as inverse closures.
- [ ] **Step 4: Run to pass.** Same command. Expected: PASS.
- [ ] **Step 5: Stage this task's files:** `git add server/src/commerce/order-lock.ts server/src/commerce/order-lock.test.ts server/src/test/fake-media-db.ts server/src/test/fake-media-db.test.ts server/src/media/renumber.ts server/src/media/renumber.test.ts`

---

### Task 6: MediaService

**Files:**
- Create: `server/src/media/{media.types,error-map,rate-limit,media-log,media.service}.ts`
- Test: `server/src/media/media.service.test.ts` (uploads, alt, variant link, audit, storage cases), `server/src/media/media.concurrency.test.ts`, `server/src/media/media.delete-reorder.test.ts`, `server/src/media/error-map.test.ts`, `server/src/media/rate-limit.test.ts`
- Modify: `server/src/commerce/commerce.module.ts` (add `exports: [CatalogService, AuthService]`)

**Interfaces:**
- Consumes: Tasks 1-5 (`ObjectStorage`, `fakeStorage`, `fakeMediaDb`, `lockProduct`, `lockVariants`, `renumber`, `inspectImage`, `processImage`, `ImageJobLimiter`, `parseAlt`, `mediaError`, `mediaKey`, `toPublicImage`, `LOCKED_TX`).
- Produces (`media.types.ts`): `MediaActor = { id: string; label: string }` (label is the audit actor string `Nama (Peran)`, or `CLI: {operator}` with id `cli`); `AdminImage = ProductImage & { position: number; source: "upload" | "sample"; creator: string | null; licence: string | null; licenceUrl: string | null; sourceUrl: string | null; retrievedAt: string | null; licenceCheck: string | null; createdAt: string; createdBy: string }`; `AdminProduct = { id: string; brand: BrandId; slug: string; name: string; art: Product["art"]; variants: { sku: string; label: string; imageId: string | null }[]; images: AdminImage[] }`.
- Produces (`media.service.ts`): `class MediaService` with constructor `(@Inject(PrismaService) prisma, @Inject(ObjectStorage) storage, @Inject(CatalogService) catalog: Pick<CatalogService, "refreshAfterWrite">)` and
  `list(): Promise<AdminProduct[]>`,
  `upload(actor: MediaActor, productId: string, file: { buffer: Buffer; originalname: string; size: number }, input: { alt?: string; rightsConfirmed?: string }): Promise<AdminImage>`,
  `changeAlt(actor, productId, imageId, alt: unknown): Promise<AdminImage>`,
  `reorder(actor, productId, ids: unknown): Promise<{ ids: string[] }>`,
  `remove(actor, productId, imageId): Promise<{ ok: true }>`,
  `linkVariant(actor, sku: string, imageId: string | null): Promise<{ sku: string; imageId: string | null }>`,
  `onModuleInit(): void` (calls `configureSharp()`).
- Produces: `mapMediaError(error: unknown): never` (error-map.ts), `class UploadRateLimiter { hit(staffId: string, now?: number): boolean }`, `logMedia(event: MediaEvent, fields: Record<string, unknown>): void` (Nest `Logger`; error level for `media_delete_files_failed` and `media_compensation_failed`).
- Audit actions (exact copy): `PRODUCT_IMAGE_ADDED` "Foto produk ditambahkan", `PRODUCT_IMAGE_REMOVED` "Foto produk dihapus", `PRODUCT_IMAGE_REORDERED` "Urutan foto diubah", `PRODUCT_IMAGE_ALT_CHANGED` "Teks alternatif foto diubah", `VARIANT_IMAGE_LINKED` "Foto varian ditautkan", `PRODUCT_IMAGE_FILE_DELETE_FAILED` "File foto gagal dihapus". Payloads exactly as the audit table in spec section 2.
- Order of work is spec section 2 "Order of work" (upload, renumbering, reorder, delete in two phases, variant link). Upload check order: rate limit (CLI exempt), product exists (404), `rightsConfirmed === "true"` (422), `parseAlt`, size over `MAX_UPLOAD_BYTES` (413), `inspectImage`, then `limiter.run(processImage)`, then transaction: `lockProduct`, duplicate hash (409), count >= 6 (`limitReached`), first free position, write keys (remember which this request wrote), insert row and audit, commit; compensation deletes only this request's keys. Delete phase two: new transaction, `lockProduct`, delete keys only if no row of the product has the same hash, 3 attempts, then `PRODUCT_IMAGE_FILE_DELETE_FAILED` audit entry and error log while the response stays 200. Every successful change ends with `catalog.refreshAfterWrite()`.
- `mapMediaError`: P2002 `meta.target` containing `position` is `positionCollision`; containing `hash` is `duplicate`; any other P2002 is rethrown unchanged (500); P2003 is `photoDeleted`; sharp decode error is `corrupt`; sharp pixel-limit error is `tooManyPixels`; S3 or connection errors (error name in a known set, `$metadata`, or `ECONNREFUSED`/`ETIMEDOUT`) are `storageUnavailable`; `HttpException` passes through.

- [ ] **Step 1: Write the failing tests** (all with `fakeMediaDb`, `fakeStorage`, real processing)

```ts
// media.service.test.ts
it("upload stores three WebP files with contentType image/webp, one row at position 0, one PRODUCT_IMAGE_ADDED audit with rightsConfirmed true, uploadedBytes, uploadedFilename and actorId in after", /* every storage object contentType === "image/webp" (f); after.rightsConfirmed === true */);
it("refuses rightsConfirmed missing, 'false' or 'yes' with 422 and writes no file, row or audit", /* it.each */);
it("a rejected request (401-class excluded; 409, 413, 415, 422, 503) leaves no rows, no files, no audit", /* it.each over duplicate, 7th photo, oversize, svg, tooSmall, storage down */);
it("(a) the 2nd of 3 puts fails: 503, no row, no files", /* fake.failNthPut = 2 */);
it("(b) the transaction fails after the puts: only this request's files are deleted and the original error is returned", /* ... */);
it("(c) deleteObjects fails after the row delete: request succeeds, only unlinked files remain", /* ... */);
it("(g) S3 errors map to 503 STORAGE_UNAVAILABLE with the Bahasa message; while ready=false upload and delete answer 503", /* ... */);
it("(h) a failed compensation delete and a failed post-delete removal each log at error level with the key list; logs hold no filename or alt", /* spy Logger.prototype.error */);
it("sixth photo ok, seventh 409 LIMIT_REACHED; same bytes twice 409 duplicate with the original's files untouched; failed transaction for a different hash deletes only its own files", /* ... */);
it("Review Focus 3: filename '../../etc/passwd\\u202E.jpg' and a 300-character name never appear in a key; audit uploadedFilename is cut to 120 characters", /* ... */);
it("Review Focus 4: PATCH alt to the stored value returns 200 and writes no audit entry; a changed alt writes PRODUCT_IMAGE_ALT_CHANGED with before { imageId, alt } and after { imageId, alt, actorId }", /* ... */);
it("alt rules apply to PATCH too, and a photo of another product gives 404", /* ... */);
it("variant link: foreign or unknown photo 422 'Foto tidak milik produk ini.', unknown sku 404, same photo again 200 with no new audit, simulated P2003 gives 409 not 500, null on null is a no-op", /* inject.p2003OnVariantUpdate */);
it("upload rate limit: the 21st upload in 10 minutes gives 429 RATE_LIMITED and logs; another staff id is unaffected; CLI actor exempt", /* rate-limit.test.ts for the window maths with a fake clock */);
it("limiter timeout gives 503 STORAGE_UNAVAILABLE with MediaBusyException", /* inject a limiter with waitMs 20 and a blocked job */);
// media.delete-reorder.test.ts
it("reorder: stale list, duplicate ids, foreign id, missing id, unknown id and empty list on a product with photos all give 409 with positions unchanged; non-array body 422; empty list on empty product is a 200 no-op with no audit", /* ... */);
it("reorder writes PRODUCT_IMAGE_REORDERED with before { ids } and after { ids, actorId }", /* ... */);
it("delete of the middle of four leaves positions 0,1,2 in order; deleting position 0 promotes the next; links cleared by the explicit updateMany; other product's photo 404; last photo leaves the empty state", /* ... */);
it("delete writes before = full row, after = { actorId }; 3 failed file removals write one PRODUCT_IMAGE_FILE_DELETE_FAILED listing the keys, row stays removed, response 200", /* ... */);
// media.concurrency.test.ts (each case also verified by the mutation check in Step 4)
it("two simultaneous uploads at 5 photos: one success, one 409, loser's files absent", /* ... */);
it("upload during reorder; delete during variant link; upload during delete at the same slot", /* final state consistent, positions 0..n-1 unique */);
it("the same photo uploaded twice at once keeps the first row's files", /* ... */);
it("delete followed at once by a re-upload of the same photo leaves the files in place", /* phase two sees the new row's hash */);
it("lockProduct on an unknown product gives 404 for every operation", /* ... */);
// error-map.test.ts: one case per mapping above incl. unmapped P2002 stays unchanged
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/media` Expected: FAIL "Cannot find module './media.service'".
- [ ] **Step 3: Implement** the five files, the `exports` line in `CommerceModule`, and run `npx tsc -p tsconfig.json --noEmit`.
- [ ] **Step 4: Run to pass, then the mutation check.** `cd server && npx vitest run src/media` Expected: PASS. Then temporarily comment out the `lockProduct` call in `upload` (and again in `reorder`, `remove`, `linkVariant`); each time `media.concurrency.test.ts` must fail; restore the calls and re-run to PASS. Record the mutation results in the task notes.
- [ ] **Step 5: Stage this task's files:** `git add server/src/media/media.types.ts server/src/media/error-map.ts server/src/media/error-map.test.ts server/src/media/rate-limit.ts server/src/media/rate-limit.test.ts server/src/media/media-log.ts server/src/media/media.service.ts server/src/media/media.service.test.ts server/src/media/media.delete-reorder.test.ts server/src/media/media.concurrency.test.ts server/src/commerce/commerce.module.ts`

---

### Task 7: HTTP layer

**Files:**
- Create: `server/src/media/{staff-media.guard,upload-exception.filter,media.controller,media.module}.ts`
- Modify: `server/src/domain/rbac.ts` (add `"products.media"` to `Permission` and to the owner, admin and marketing lists), `server/src/app.module.ts` (import `MediaModule`), `server/src/cache-policy.test.ts` (extend)
- Test: `server/src/media/media.controller.test.ts`, `server/src/media/media.errors.table.test.ts`, `server/src/media/media.guard-order.test.ts`, `server/src/media/media.rbac.test.ts`

**Interfaces:**
- Consumes: Task 6 `MediaService`, `MediaActor`; existing `AuthService.staff(authorization)` and `can`, `ROLE_LABEL`.
- Produces: `StaffMediaGuard` (`@Inject(AuthService)`): reads the `authorization` header (`main.ts` copies the staff cookie into it), `auth.staff()` (401 otherwise), `can(role, "products.media")` else 403 `{ code: "FORBIDDEN", message: "Peran {ROLE_LABEL[role]} tidak punya izin untuk aksi ini." }`; stores `{ id, label }` on the request as `mediaActor`.
- Produces: `MediaController` at `@Controller("admin")` with class-level `@UseGuards(StaffMediaGuard)`: `GET products`, `POST products/:id/images` (method-level `@UseInterceptors(FileInterceptor("file", { limits: { files: 1, fields: 2, parts: 4, fileSize: MAX_UPLOAD_BYTES } }))`, `@UseFilters(UploadExceptionFilter)`), `PATCH products/:id/images/:imageId` (body `{ alt }`), `PUT products/:id/images/order` (body `{ ids }`), `PUT variants/:sku/image` (body `{ imageId }`), `DELETE products/:id/images/:imageId`.
- Produces: `UploadExceptionFilter` (`@Catch()`): `PayloadTooLargeException` becomes `mediaError("tooLarge")`, `BadRequestException` (other Multer faults, wrong field name) becomes `mediaError("noFile")`, `MediaBusyException` also sets `Retry-After: 10`; everything else is handed to `new ApiExceptionFilter().catch(...)`. The global filter is not changed.
- Produces: `MediaModule` (imports `CommerceModule`, `StorageModule`; providers `MediaService`, `StaffMediaGuard`, `ImageJobLimiter`, `UploadRateLimiter`; controller `MediaController`).

- [ ] **Step 1: Write the failing tests**

```ts
// media.errors.table.test.ts: one row per SERVER row of the spec Error messages table, run through ApiExceptionFilter with a stub host; assert status, error.code, exact message
it.each(rows)("%s", /* JPEG, PNG, WebP accepted (201-path resolves); svg, gif, a renamed text file -> 415 generic; ftyp heic bytes -> 415 HEIC message; exactly MAX_UPLOAD_BYTES accepted; +1 byte -> 413 TOO_LARGE via UploadExceptionFilter(PayloadTooLargeException); 479 px 422 / 480 px ok; 8001x5000 PNG -> 422 and fakeStorage.objects.size 0; corrupt file 422; no file / wrong field -> 422 'Pilih satu file foto.'; operations and cs -> 403 with 'Peran Operasional ...' / 'Peran CS ...' */);
// media.guard-order.test.ts: vi.mock("@nestjs/platform-express") replacing FileInterceptor with a spy interceptor; boot a minimal Nest app (NestFactory.create on a test module with useValue fakes, listen(0)) and call it with global fetch
it("no cookie/authorization with a 10 MB multipart body gives 401 and the Multer interceptor never ran", /* spy not called */);
it("an Operations session gives 403 and the interceptor never ran; an owner session reaches the interceptor", /* ... */);
// media.rbac.test.ts
it.each(["owner","admin","marketing"])("%s has products.media", /* true */);
it.each(["operations","cs"])("%s has not products.media and gets 403 on every media route", /* iterate the six route handlers found via Reflect metadata; guard throws 403 */);
it("the guard is class-level on the controller and every route inherits it", /* Reflect.getMetadata("__guards__", MediaController) contains StaffMediaGuard */);
// media.controller.test.ts
it("missing or non-multipart file gives 422 noFile; rightsConfirmed and alt are forwarded from the body; upload answers the created AdminImage", /* hand-built Express.Multer.File */);
it("UploadExceptionFilter sets Retry-After 10 on MediaBusyException", /* ... */);
// cache-policy.test.ts
it("admin media routes stay private, no-store", /* cachePolicy("GET","/v1/admin/products") === NO_STORE; "/v1/admin/products/B01/images" POST too */);
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/media/media.errors.table.test.ts src/media/media.guard-order.test.ts src/media/media.rbac.test.ts src/media/media.controller.test.ts src/cache-policy.test.ts` Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the four files and the rbac line. If booting a Nest app inside vitest proves impractical, fall back to Reflect-metadata assertions (guard at class level, interceptor at method level) and keep the real check in Task 14; record that in the task notes.
- [ ] **Step 4: Run to pass.** Same command, then `cd server && npm test` (full suite) and `npx tsc -p tsconfig.build.json --noEmit`. Expected: PASS, no regressions (Rp587.250 and W00 tests included).
- [ ] **Step 5: Stage this task's files:** `git add server/src/media/staff-media.guard.ts server/src/media/upload-exception.filter.ts server/src/media/media.controller.ts server/src/media/media.module.ts server/src/media/*.test.ts server/src/domain/rbac.ts server/src/app.module.ts server/src/cache-policy.test.ts`

---

### Task 8: Sample seed and removal

**Files:**
- Create: `server/src/media/cli/{common,seed,remove-samples}.ts`, `server/seed/media/samples.json`, `server/seed/media/{hash16}-{target}.webp` (up to 6 photos), `docs/07-delivery/photo-licences/` (dated copies)
- Modify: `server/src/media/media.service.ts` (add `addSample` for the CLI), `server/package.json` (scripts), `server/Dockerfile` (line after `COPY src ./src`)
- Test: `server/src/media/cli/seed.test.ts`, `server/src/media/cli/remove-samples.test.ts`, `server/src/media/cli/samples.test.ts`

**Interfaces:**
- Consumes: Task 6 `MediaService.remove`, `MediaActor`; Task 4 `processImage`; Task 2 `ObjectStorage.init()`.
- Produces: `runSeed(deps: CliDeps, opts: { repairFiles: boolean; operator?: string }): Promise<{ exitCode: 0 | 1; added: number; skipped: number; lines: string[] }>`, `runRemoveSamples(deps, opts: { operator?: string }): Promise<{ exitCode: 0 | 1; removed: number; lines: string[] }>`, `CliDeps = { prisma; storage: ObjectStorage; media: MediaService; seedDir: string }`, `MediaService.addSample(actor: MediaActor, entry: SampleEntry, copies: { target: number; buffer: Buffer }[]): Promise<"added" | "skipped">`, `validateSamples(entries: SampleEntry[], deps): Promise<string[]>` (returns problems; empty means valid).
- `samples.json` is one entry per photo (decision: the spec says "per file" but a photo has 3 files): `{ productId, position, alt, variantSkus: string[], files: string[], creator, licence, licenceUrl, sourceUrl, retrievedAt, licenceCheck }`. `retrievedAt` is the WIB date. `licenceCheck` reads "Diperiksa oleh {operator} pada {date}; salinan: docs/07-delivery/photo-licences/{file}".
- Behaviour (spec section 5): validate all entries first (file present, `hash16` and target in each file name match content, variant SKU exists on the product, licence and source URLs start with `https://`); any problem exits 1 and writes nothing for any product. After validation: per product under `lockProduct`, add only when the product has no photos and no earlier `PRODUCT_IMAGE_REMOVED` audit entry, upload only objects missing from storage, row `source: "sample"`, `createdBy: "seed"`, `PRODUCT_IMAGE_ADDED` audit in the same transaction, variant links resolved by SKU. Storage not ready: print "Penyimpanan foto sedang tidak tersedia." plus the error class, exit 1, write nothing. `--repair-files` re-uploads missing objects of existing sample rows, no row or audit change. `remove-samples` needs `--operator`, calls `MediaService.remove` per sample row (actor label `CLI: {operator}`), no entries when nothing changes. Both commands build `PrismaService`, `S3ObjectStorage` and `MediaService` by hand with a no-op `refreshAfterWrite` (separate Node process, so the operator restarts `api` afterwards); `seed.ts` and `remove-samples.ts` call `main()` only when run directly. `seedDir` is `path.resolve(process.cwd(), "seed/media")`.
- Scripts: `"media:seed": "node dist/media/cli/seed.js"`, `"media:remove-samples": "node dist/media/cli/remove-samples.js"`. Dockerfile: `COPY seed ./seed` immediately after `COPY src ./src` and before the `RUN npx prisma generate && npm test && npm run build` line.

- [ ] **Step 1: Write the failing tests** (fake storage and fake database; a temporary seed directory is generated from `processImage` fixtures, so no committed binary is needed for the logic tests)

```ts
it("adds each sample once; running twice changes nothing; prints counts", /* added: n, skipped: 0, then added: 0 */);
it("skips products that already have photos, including one a staff upload reached first", /* ... */);
it("skips a product with an earlier PRODUCT_IMAGE_REMOVED entry", /* ... */);
it.each(["hash mismatch","target mismatch","missing file","unknown variant SKU","http:// licence URL","http:// source URL"])("refuses on %s, exits 1, writes nothing for any product", /* ... */);
it("storage not ready: both commands print 'Penyimpanan foto sedang tidak tersedia.', exit 1, write nothing", /* ... */);
it("--repair-files restores a deleted sample object and writes no row and no audit entry", /* ... */);
it("variant links resolve by SKU and position", /* ... */);
it("remove-samples refuses without --operator", /* exitCode 1 */);
it("remove-samples deletes only source 'sample'; a product with 2 samples and 2 uploads ends with the uploads at positions 0 and 1; one PRODUCT_IMAGE_REMOVED per photo with actor 'CLI: {operator}' and actorId 'cli'", /* ... */);
it("seed, remove-samples, seed again leaves zero photos", /* ... */);
// samples.test.ts reads the real server/seed/media/samples.json
it("every real sample validates against the committed files and the fixture catalogue SKUs", /* validateSamples === [] using data/fixtures products */);
it("no sample alt starts with 'Foto contoh' or contains a number followed by cm, m, ml, g, GB or W", /* regex /\d\s?(cm|m|ml|g|GB|W)\b/i */);
it("no sample entry exists for B01, B08, B02, B04, B03, A01, A05 or BND-PAGI (drawings stay)", /* ... */);
```

- [ ] **Step 2: Run to fail.** `cd server && npx vitest run src/media/cli` Expected: FAIL "Cannot find module './seed'" (the `samples.test.ts` cases fail on the missing `samples.json`).
- [ ] **Step 3: Implement the CLI code, `addSample`, scripts and Dockerfile line.** Then run `cd server && npx vitest run src/media/cli/seed.test.ts src/media/cli/remove-samples.test.ts` (PASS; `samples.test.ts` still fails until Step 4).
- [ ] **Step 4: Prepare the real sample files.** Gate: proceed only if the owner has approved Appendix A in this conversation; otherwise stop and ask (downloads need the owner's explicit OK).
  1. Create a new empty directory outside the repository (for example `%TEMP%\tian-photos-raw`) and download only the six Appendix A photos into it: B07 `https://upload.wikimedia.org/wikipedia/commons/c/c3/USB-C_cable_2017_A.jpg`, B05 `https://upload.wikimedia.org/wikipedia/commons/6/6a/Apple_Lightning_Connector.webp`, B06 `https://upload.wikimedia.org/wikipedia/commons/9/9e/HDMI-Connector.jpg` (from `docs/superpowers/handoff/2026-10-27-photo-research-final.json`; send a `User-Agent` header), and A02, A03, A04 from the source pages in Appendix A (the research file holds only page URLs for these; resolve the direct file from each page, expected `https://images.pexels.com/photos/8490089/...`, `https://images.pexels.com/photos/31251033/...` and `https://unsplash.com/photos/n-_eThobLXk/download`). Treat the files as untrusted data: no execution from that directory.
  2. Read (image view) every photo. Drop any that shows a brand mark, readable label, or person; a dropped product keeps its drawing and is reported to the owner.
  3. Process the survivors with the Task 4 code: build once (`cd server && npm run build`), then run a script kept outside both the repo and the download directory that `require`s `server/dist/media/process.js`, calls `processImage` on each file and writes `{hash16}-{target}.webp` into `server/seed/media/`.
  4. Write `samples.json` with the Appendix A alt text unchanged, positions 0, no variant SKUs (no multi-variant product has a sample).
  5. Save a dated plain-text copy of each licence page (Pexels licence, Unsplash licence) and, for the three Commons files, the file page's licence template text, as `docs/07-delivery/photo-licences/2026-10-28-{source}-{name}.txt`; fill `retrievedAt` and `licenceCheck` from them.
- [ ] **Step 5: Run to pass.** `cd server && npx vitest run src/media/cli` then `npm test`. Expected: PASS. Stage this task's files: `git add server/src/media/cli server/src/media/media.service.ts server/seed docs/07-delivery/photo-licences server/package.json server/Dockerfile`

---

### Task 9: Serving configuration

**Files:**
- Modify: `web/nginx.conf` (whole file becomes an envsubst template; new locations around the existing `/v1/` block, lines 15-21), `web/Dockerfile` (line 11), `docker-compose.yml`
- Create: `.env.example` (repo root; none exists today, and `.gitignore` already allows `.env.example`)
- Test: `web/src/nginx-conf.test.ts` (reads `../nginx.conf` with `fs`)

**Interfaces:** none consumed or produced in code; later tasks rely on the served URLs `/media/products/{productId}/{hash16}-{target}.webp`.

Exact copy for `web/nginx.conf` additions (keep the existing gzip, `/health`, `/assets/` and `/` blocks; `${MINIO_BUCKET}` and `${MEDIA_UPSTREAM}` are the only template variables):

```nginx
  # Photo upload: 11 MB body, JSON 413. A regex location does not inherit the proxy lines of /v1/.
  location ~ ^/v1/admin/products/[^/]+/images$ {
    client_max_body_size 11m;
    limit_except POST { deny all; }
    error_page 413 = @too_large;
    proxy_pass http://api:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location @too_large {
    internal;
    default_type application/json;
    add_header Cache-Control "no-store" always;
    return 413 '{"error":{"code":"TOO_LARGE","message":"Ukuran file maksimal 10 MB.","details":[]}}';
  }

  # Product photos: allowlist only. The regex is quoted because it contains braces.
  location ~ "^/media/(products/[A-Za-z0-9_-]+/[0-9a-f]{16}-[0-9]{3,4}\.webp)$" {
    limit_except GET { deny all; }
    proxy_set_header Cookie "";
    proxy_set_header Authorization "";
    rewrite ^/media/(.*)$ /${MINIO_BUCKET}/media/$1? break;
    proxy_pass ${MEDIA_UPSTREAM};
    proxy_next_upstream off;
    proxy_intercept_errors on;
    error_page 400 401 403 404 405 500 502 503 504 = @media_404;
    proxy_hide_header Server;
    proxy_hide_header Cache-Control;
    proxy_hide_header Set-Cookie;
    proxy_hide_header x-amz-request-id;
    proxy_hide_header x-amz-id-2;
    proxy_hide_header x-amz-version-id;
    proxy_hide_header x-amz-server-side-encryption;
    proxy_hide_header x-minio-deployment-id;
    proxy_hide_header x-minio-error-code;
    proxy_hide_header Strict-Transport-Security;
    proxy_hide_header X-Xss-Protection;
    proxy_hide_header Content-Security-Policy;
    proxy_hide_header Vary;
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Content-Type-Options "nosniff";
  }

  # Everything else under /media/ (including /media/ itself) never reaches MinIO.
  location /media/ {
    error_page 404 = @media_404;
    return 404;
  }

  location @media_404 {
    internal;
    default_type text/plain;
    add_header Cache-Control "no-store" always;
    add_header X-Content-Type-Options "nosniff" always;
    return 404 "Not found";
  }
```

(`/v1/` keeps nginx's default 1 MB body limit. During the dev check in Task 14, add one `proxy_hide_header` line for any other `x-amz-*` or `x-minio-*` header seen in `curl -I`.) `web/Dockerfile`: `COPY nginx.conf /etc/nginx/templates/default.conf.template`, nothing copied to `conf.d`. `docker-compose.yml`: `web` gets `extra_hosts: ["host.docker.internal:host-gateway"]` and `environment: ["MINIO_BUCKET=${MINIO_BUCKET:-tian-media}", "MEDIA_UPSTREAM=${MEDIA_UPSTREAM:-http://host.docker.internal:9000}", "NGINX_ENVSUBST_FILTER=^(MINIO_BUCKET|MEDIA_UPSTREAM)$"]`, no `env_file`; `api` gets `mem_limit: 1536m` (starting value, at least 1 GB; Task 14 confirms it against the measured peak). `.env.example` documents `MINIO_BUCKET` (must equal `server/.env`) and `MEDIA_UPSTREAM` (match `MINIO_ENDPOINT` when MinIO is on another host or port).

- [ ] **Step 1: Write the failing test**

```ts
it("serves /media from an allowlist: quoted regex, GET only, cookies stripped, query dropped", () => {
  const conf = readFileSync(resolve(__dirname, "../nginx.conf"), "utf8");
  expect(conf).toContain('location ~ "^/media/(products/[A-Za-z0-9_-]+/[0-9a-f]{16}-[0-9]{3,4}\\.webp)$"');
  expect(conf).toContain("limit_except GET { deny all; }");
  expect(conf).toContain('proxy_set_header Cookie "";');
  expect(conf).toContain("rewrite ^/media/(.*)$ /${MINIO_BUCKET}/media/$1? break;");
  expect(conf).toContain("proxy_pass ${MEDIA_UPSTREAM};");
});
it("hides every MinIO header one per line and adds a single immutable Cache-Control", /* the 12 proxy_hide_header names from the spec; one 'public, max-age=31536000, immutable' */);
it("answers every other /media/ path and every failure with the plain no-store 404", /* location /media/ block, @media_404 text, 'always' on no-store and nosniff, error_page list 400 401 403 404 405 500 502 503 504 */);
it("allows an 11m body only on the image upload path and answers 413 as JSON", /* client_max_body_size 11m appears exactly once; @too_large JSON copy exact; no 11m on /v1/ */);
it("uses only the two template variables", /* the only ${...} tokens are MINIO_BUCKET and MEDIA_UPSTREAM */);
it("Dockerfile copies the config to templates and compose gives web the env, extra_hosts and no env_file", /* read web/Dockerfile and ../docker-compose.yml */);
```

- [ ] **Step 2: Run to fail.** `cd web && npx vitest run src/nginx-conf.test.ts` Expected: FAIL (assertions on the current nginx.conf).
- [ ] **Step 3: Edit the four files and create `.env.example`.**
- [ ] **Step 4: Run to pass, then the template-aware config check.** `cd web && npx vitest run src/nginx-conf.test.ts` Expected: PASS. Then, where Docker is available, run the spec's check (replace `<path>`): `docker run --rm --network tian_default --add-host host.docker.internal:host-gateway -e MINIO_BUCKET=tian-media -e MEDIA_UPSTREAM=http://host.docker.internal:9000 -e NGINX_ENVSUBST_FILTER='^(MINIO_BUCKET|MEDIA_UPSTREAM)$' -v <path>/web/nginx.conf:/etc/nginx/templates/default.conf.template:ro nginx:1.27-alpine nginx -t` Expected: `syntax is ok` and `test is successful`. Never mount the file at `conf.d/default.conf` (that skips substitution). If Docker is not available locally, run it in Task 14 on the dev server and note that here.
- [ ] **Step 5: Stage this task's files:** `git add web/nginx.conf web/Dockerfile web/src/nginx-conf.test.ts docker-compose.yml .env.example`

---

### Task 10: Web foundations

**Files:**
- Create: `web/src/domain/photos.ts`
- Modify: `web/src/domain/rbac.ts` (add `"products.media"` to `Permission` and the owner, admin, marketing arrays, lines 7-20), `web/src/services/http/client.ts` (lines 17-29)
- Test: `web/src/domain/photos.test.ts`, `web/src/domain/rbac-media.test.ts`, `web/src/services/http/client.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1 web types (`Product`, `Variant`, `ProductImage`).
- Produces (`photos.ts`, pure, no React imports): `type PhotoPlace = "catalogCard" | "homeCard" | "searchCard" | "productMain" | "productThumb" | "cartRow" | "accountRecommended" | "accountWishlist"`; `photoSizes(place: PhotoPlace): string`; `photoSrcSet(image: ProductImage): string | undefined`; `photoForVariant(product: Product, sku: string): ProductImage | null`; `galleryPick(product: Product, variant: Variant | undefined, currentId: string | undefined): string | null`; `moveId(ids: string[], index: number, delta: -1 | 1): string[]`; `buildUploadInit(file: File, alt: string, rightsConfirmed: boolean): RequestInit`; `altLength(text: string): number`; `cleanAlt(text: string): string`; `canUpload(file: File | null | undefined, rightsConfirmed: boolean, busy: boolean): boolean`; `thumbLabel(index: number, total: number): string` (zero-based index); `showThumbnails(product: Product): boolean`; `safeSourceLink(url: string | null | undefined): string | null`; `uploadPrecheck(file: { name: string; type: string; size: number }): string | null`; `MAX_UPLOAD_BYTES = 10 * 1024 * 1024`.
- Sizes (exact copy from spec section 3): `catalogCard` `(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw`; `homeCard` `(min-width: 768px) 25vw, 50vw`; `searchCard` `(min-width: 1024px) 25vw, 50vw` (not in the spec table: `SearchPage.tsx` renders cards in `grid-cols-2 lg:grid-cols-4`); `productMain` `(min-width: 768px) 50vw, 100vw`; `productThumb` `48px`; `cartRow` `80px`; `accountRecommended` `56px` (the `w-14` row in `Account.tsx` is the "Rekomendasi" list, not order rows); `accountWishlist` `72px`.
- Produces (`client.ts`): `api()` does not set `content-type` when `body instanceof FormData`; a 413 becomes `ApiError("TOO_LARGE", "Ukuran file maksimal 10 MB.")` whatever the body; a non-JSON body on an error response becomes `ApiError("HTTP", response.statusText || "Permintaan gagal.")`; a non-JSON body on a success response becomes `ApiError("BAD_RESPONSE", "Respons server tidak dapat dibaca.")`; an empty body stays `{}`.

- [ ] **Step 1: Write the failing tests**

```ts
// photos.test.ts
it("srcset descriptors equal the targets in the file names", /* each 'Nw' equals the -N.webp number */);
it.each(allPlaces)("photoSizes(%s) is never empty and equals the spec table value", /* ... */);
it("photoForVariant: the variant's photo, else the main photo, else null", /* three cases; imageId missing from images -> main */);
it("galleryPick first render: default variant's linked photo if present, else position 0", /* ... */);
it("galleryPick keeps the current photo when the variant has no imageId or its imageId is not in images", /* returns currentId */);
it("galleryPick switches to a linked photo; a one-photo product returns that photo even when a variant links to it", /* ... */);
it("showThumbnails is false for 0 or 1 photo, true for 2", /* ... */);
it("thumbLabel(1, 4) is 'Foto 2 dari 4' and contains no alt text", /* ... */);
it("altLength counts code points: 125 emoji give 125; same cleaning vectors as the server ('\\u200B a\\n\\tb \\u00A0' -> 'a b')", /* ... */);
it("moveId clamps: first up and last down return the same order; middle swaps", /* ... */);
it("canUpload is false without a file, without the rights box, or while busy", /* ... */);
it("buildUploadInit returns POST with a FormData body (file, alt, rightsConfirmed 'true') and no headers", /* init.headers undefined; body instanceof FormData */);
it.each([["javascript:alert(1)"],["http://example.com"],[""],[null],[undefined]])("safeSourceLink(%s) is null", /* ... */);
it("safeSourceLink returns an https URL unchanged", /* ... */);
it("uploadPrecheck: 10 MB ok, 10 MB + 1 byte 'Ukuran file maksimal 10 MB.', gif and svg 'Format tidak didukung. Gunakan JPG, PNG, atau WebP.', .heic 'Foto iPhone (HEIC) belum didukung. Ekspor sebagai JPG lalu unggah lagi.'", /* ... */);
it("Review Focus 5: photoSrcSet returns undefined for an image with an empty or missing srcset, and photoForVariant tolerates a product without images", /* no throw */);
// rbac-media.test.ts
it("owner, admin and marketing have products.media; operations and cs do not", /* ... */);
// client.test.ts (extend)
it("a FormData body sends no content-type header and keeps credentials include", /* headers.get("content-type") null */);
it("a JSON string body still gets application/json", /* regression */);
it("a non-JSON error body yields an ApiError, not a SyntaxError", /* Response("<html>", {status: 502, statusText: "Bad Gateway"}) */);
it("a 413 maps to TOO_LARGE with the Bahasa message whatever the body", /* HTML body and JSON body */);
```

- [ ] **Step 2: Run to fail.** `cd web && npx vitest run src/domain/photos.test.ts src/domain/rbac-media.test.ts src/services/http/client.test.ts` Expected: FAIL "Failed to resolve import './photos'" and the new client cases fail.
- [ ] **Step 3: Implement `photos.ts`, the rbac lines and the `api()` changes.** The cleaning logic in `cleanAlt` is a copy of the server rules in `server/src/media/rules.ts` (two packages, no shared code); both test files use the same vectors.
- [ ] **Step 4: Run to pass.** Same command, then `cd web && npm run typecheck` and `npm test`. Expected: PASS.
- [ ] **Step 5: Stage this task's files:** `git add web/src/domain/photos.ts web/src/domain/photos.test.ts web/src/domain/rbac.ts web/src/domain/rbac-media.test.ts web/src/services/http/client.ts web/src/services/http/client.test.ts`

---

### Task 11: Storefront photos

**Files:**
- Create: `web/src/components/ProductPhoto.tsx`, `web/src/components/ProductGallery.tsx`
- Modify: `web/src/components/ui.tsx` (`ProductArt` line 8 gains `decorative?: boolean`: when true the frame renders `aria-hidden="true"` with no `role="img"` and no `aria-label`), `web/src/components/ProductCard.tsx` (line 29; new optional `sizes` prop defaulting to `photoSizes("homeCard")`), `web/src/pages/ProductPage.tsx` (line 55), `web/src/pages/CartPage.tsx` (line 45), `web/src/pages/Account.tsx` (lines 90 and 200), `web/src/pages/Catalog.tsx` (line 86, pass `photoSizes("catalogCard")`), `web/src/pages/SearchPage.tsx` (line 48, pass `photoSizes("searchCard")`), `web/src/pages/Home.tsx` (default sizes, no change unless the prop is required)
- Test: `web/src/components/photo-wiring.test.ts`

**Interfaces:**
- Consumes: Task 10 `photos.ts` functions.
- Produces: `ProductPhoto(props: { product: Product; image?: ProductImage | null; sizes: string; decorative?: boolean; priority?: boolean; className?: string; onSettled?: () => void })`: square frame (`aspect-square w-full`, brand radius via `className`, brand `bg-alt` while loading); renders `<img className="absolute inset-0 h-full w-full object-cover" src srcSet sizes width height decoding="async">` with `loading="lazy"` (or `loading="eager" fetchPriority="high"` when `priority`), `alt=""` when `decorative` else `image.alt`; falls back to `ProductArt` (passing `decorative`) when `image` is missing or `onError` fires; calls `onSettled` on `load` or `error`.
- Produces: `ProductGallery(props: { product: Product; variant: Variant })`: main photo (`sizes` productMain, priority), caption "Foto contoh" in the existing muted small text while the shown photo has `sample: true`, thumbnail group `<div role="group" aria-label="Galeri foto">` of 48 px `<button aria-pressed aria-label={thumbLabel(i, n)}>` with inner `alt=""`, rendered only after the main photo's `onSettled` and only when `showThumbnails(product)`; thumbnails use `loading="lazy" fetchPriority="low"` and `photoSizes("productThumb")`; visible focus ring. Selection follows `galleryPick`; pressing a thumbnail never changes the variant.
- Which photo shows: cart rows `photoForVariant(product, line.sku)`; cards, account recommended and wishlist rows the main photo (`product.images?.[0]`); decorative everywhere the product name is beside the photo (cards, cart, account); product page main uses the photo's alt, or the drawing's `Ilustrasi {nama}` label.

- [ ] **Step 0: Invoke the design skills first.** Skill tool: `design-taste-frontend`, then `ui-ux-pro-max`, then `frontend-design:frontend-design`. These screens are approved, so use the skills to review the photo area and report; do not restyle.
- [ ] **Step 1: Write the failing test** (`photo-wiring.test.ts`, node-only: scans source text; behaviour is verified by Playwright in Task 14)

```ts
it("ProductArt is rendered only inside ProductPhoto", /* no page or component except ProductPhoto.tsx and ui.tsx references <ProductArt */);
it.each([["pages/Catalog.tsx", 'photoSizes("catalogCard")'], ["components/ProductCard.tsx", 'photoSizes("homeCard")'], ["pages/SearchPage.tsx", 'photoSizes("searchCard")'], ["pages/CartPage.tsx", 'photoSizes("cartRow")'], ["pages/Account.tsx", 'photoSizes("accountRecommended")'], ["pages/Account.tsx", 'photoSizes("accountWishlist")'], ["components/ProductGallery.tsx", 'photoSizes("productMain")'], ["components/ProductGallery.tsx", 'photoSizes("productThumb")']])("%s uses %s", /* source includes the call */);
it("cart row uses photoForVariant and decorative; the product page uses ProductGallery", /* ... */);
it("ProductPhoto img has width, height, decoding async and the square classes", /* source contains 'aspect-square', 'object-cover', 'decoding="async"' */);
```

- [ ] **Step 2: Run to fail.** `cd web && npx vitest run src/components/photo-wiring.test.ts` Expected: FAIL (ProductArt still used in pages; files missing).
- [ ] **Step 3: Implement the two components and the call-site edits.** Keep the product page layout (`grid gap-6 md:grid-cols-2`) and copy unchanged; the gallery replaces only the `ProductArt` element at `ProductPage.tsx:55`.
- [ ] **Step 4: Run to pass.** `cd web && npx vitest run src/components/photo-wiring.test.ts` then `npm run typecheck` and `npm test`. Expected: PASS. Visual review (390 px and 1440 px, with the design skills) happens on dev in Task 14.
- [ ] **Step 5: Stage this task's files:** `git add web/src/components/ProductPhoto.tsx web/src/components/ProductGallery.tsx web/src/components/ui.tsx web/src/components/ProductCard.tsx web/src/components/photo-wiring.test.ts web/src/pages/ProductPage.tsx web/src/pages/CartPage.tsx web/src/pages/Account.tsx web/src/pages/Catalog.tsx web/src/pages/SearchPage.tsx web/src/pages/Home.tsx`

---

### Task 12: Admin Produk screens

**Files:**
- Create: `web/src/admin/ProductPages.tsx` (`AdminProducts`, `AdminProductPhotos`), `web/src/admin/serial-queue.ts`
- Modify: `web/src/services/contracts.ts` (types only), `web/src/services/http/admin.ts` (new methods on `HttpAdmin`), `web/src/admin/AdminShell.tsx` (`NAV` line 13-18), `web/src/App.tsx` (admin routes lines 34-40), `web/e2e/admin.mjs`
- Test: `web/src/admin/serial-queue.test.ts`, `web/src/admin/product-pages-wiring.test.ts`

**Interfaces:**
- Consumes: Tasks 6/7 routes and the `AdminProduct` / `AdminImage` shapes; Task 10 `photos.ts`; existing `Dialog`, `Toaster`, `useShop().notify`, `can`.
- Produces (`contracts.ts`): `AdminImage`, `AdminProduct` (same fields as server `media.types.ts`).
- Produces (`http/admin.ts`, all via `api()` and rethrowing `ApiError` messages): `listProducts(): Promise<AdminProduct[]>` (`GET /v1/admin/products`), `uploadPhoto(productId: string, file: File, alt: string, rightsConfirmed: boolean): Promise<AdminImage>` (uses `buildUploadInit`), `changePhotoAlt(productId, imageId, alt): Promise<AdminImage>`, `reorderPhotos(productId, ids: string[]): Promise<{ ids: string[] }>`, `linkVariantPhoto(sku, imageId: string | null): Promise<{ sku: string; imageId: string | null }>`, `deletePhoto(productId, imageId): Promise<{ ok: true }>`.
- Produces: `createSerialQueue(): { enqueue<T>(job: () => Promise<T>): Promise<T> }` (jobs run one at a time in issue order; a failed job does not block the next).
- `NAV` gains `{ to: "/admin/products", label: "Produk", perm: "products.media" }`; routes `products` and `products/:id` under the admin shell (the shell's existing "Tidak ada akses" panel handles roles without the permission).
- Screens follow spec section 4 "Admin" exactly (list page "3/6 foto" with "Kelola foto"; photo manager layout B: upload area with accept `image/jpeg,image/png,image/webp`, rules line "JPG, PNG, WebP · maks. 10 MB · min. 480 px", the people/licence warning, required unchecked rights checkbox "Saya memiliki hak atau izin untuk memakai foto ini di toko." reset after each upload, help line "Simpan file foto asli Anda. Toko hanya menyimpan salinan yang sudah diperkecil."; `role="status"` "Mengunggah…"; `aria-disabled` on "Pilih file" while uploading; one-file drop with "Unggah satu foto per kali."; "Sudah 6 foto. Hapus satu untuk menambah." at 6; rows keyed by photo id with 64 px preview, labelled alt input and "{n}/125 karakter" counter via `aria-describedby`, ↑/↓ with `aria-label` "Naikkan foto {n}" / "Turunkan foto {n}", "Jadikan utama" / "Foto utama" (`aria-disabled` on the first row), "Hapus" opening the `Dialog` titled "Hapus foto 2 dari 4: {alt}?" with `autoFocus` on "Batal"; focus rules; alt saves on blur only when the trimmed value changed and is valid; per-row `role="alert"` errors and `role="status"` result ("Tersimpan" / "Gagal menyimpan. Coba lagi." with retry); `beforeunload` guard; visually hidden polite live region ("Foto 3 dipindah ke urutan 2 dari 4", "Foto dijadikan utama", "Foto dihapus. 3 foto tersisa"); "Foto per varian" selects only when a product has more than one variant; sample rows "Foto contoh · {lisensi}" with the link only when `safeSourceLink` returns a URL (`target="_blank" rel="noopener noreferrer"`) and the banner "Foto contoh. Ganti dengan foto produk asli atau hapus sebelum toko diluncurkan."; empty state "Belum ada foto. Foto pertama yang diunggah menjadi foto utama."). Pages import only from `services/http`, never `services/mock` (the client release gate).

- [ ] **Step 0: Invoke the design skills first** (`design-taste-frontend`, `ui-ux-pro-max`, `frontend-design:frontend-design`). These are new screens, so apply them fully within the existing admin look (tokens, `card`, `btn-*` classes).
- [ ] **Step 1: Write the failing tests**

```ts
// serial-queue.test.ts
it("runs jobs one at a time in the order issued", /* second starts only after the first resolves */);
it("a failed job rejects its caller and does not block the next", /* ... */);
// product-pages-wiring.test.ts (source scan, node-only)
it("NAV has the Produk item with products.media and App.tsx routes products and products/:id", /* ... */);
it("ProductPages imports only from services/http and never from services/mock or dangerouslySetInnerHTML", /* ... */);
it("ProductPages contains the spec copy: warning, rights label, help line, banner, empty state, delete title pattern, live-region strings", /* string includes for each exact copy above */);
// http admin client (extend client or add admin-media.test.ts with a stubbed fetch)
it("uploadPhoto posts multipart to /v1/admin/products/B01/images with credentials include and no content-type", /* ... */);
it("reorderPhotos PUTs { ids } to /images/order; linkVariantPhoto PUTs { imageId } to /v1/admin/variants/{sku}/image; deletePhoto DELETEs; changePhotoAlt PATCHes { alt }", /* ... */);
```

- [ ] **Step 2: Run to fail.** `cd web && npx vitest run src/admin` Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** contracts types, client methods, `serial-queue.ts`, `ProductPages.tsx`, the NAV item and routes.
- [ ] **Step 4: Extend `web/e2e/admin.mjs`, run to pass.** Add two checks: an owner sees a "Produk" link; a role without `products.media` (Dewi O., Operasional) opening `#/admin/products` sees "Tidak ada akses". First run `cd web && npm run e2e` on the unmodified file to learn the baseline: the script drives mock-era flows (demo staff buttons, a "Masukkan 6 digit kode autentikator." message that no longer exists in `AdminShell.tsx`) while the app now uses the HTTP clients, so it may already fail on main. If it does, keep the two checks in the file anyway and report the baseline to the owner; the same two checks run against dev in Task 14. Then `cd web && npx vitest run src/admin && npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 5: Stage this task's files:** `git add web/src/admin web/src/services/contracts.ts web/src/services/http/admin.ts web/src/App.tsx web/e2e/admin.mjs`

---

### Task 13: Documentation

**Files:**
- Modify: `docs/05-api/STOREFRONT_CONTRACT.md`, `docs/01-requirements/BUSINESS_RULES.md`, `architecture.md`, `docs/README.md` (A6 row), `.graphify/config.json`, `.graphify/GRAPHIFY.md`, `.graphify/report.json` (generated)
- Create: `docs/07-delivery/LAUNCH_CHECKLIST.md`
- Test: `scripts/` has no doc test; the verification is the checklist below plus `npm run graphify:sync`

**Interfaces:** consumes the final routes, codes and messages from Tasks 6-9.

- [ ] **Step 1: Write the doc checks first (a failing grep list).** Run each and see no match: `grep -n "imageId" docs/05-api/STOREFRONT_CONTRACT.md`, `grep -n "Foto contoh" docs/01-requirements/BUSINESS_RULES.md`, `grep -n "MEDIA_UPSTREAM" architecture.md`, `grep -n "server/src/media" .graphify/config.json`, `ls docs/07-delivery/LAUNCH_CHECKLIST.md`.
- [ ] **Step 2: Confirm they fail** (no match, file missing).
- [ ] **Step 3: Write the changes (English text, Bahasa copy quoted as in the spec).**
  1. `STOREFRONT_CONTRACT.md`: `images` (with `sample`) on `GET /v1/catalog` and `GET /v1/products/:slug`, `variants[].imageId`, a new "Admin media" section with the six routes (guard, 401/403, error codes from the spec table), `Cache-Control` notes.
  2. `BUSINESS_RULES.md`: photo rules (max 6, position 0 is the main photo, alt text 1-125 code points required, roles owner/admin/marketing, rights confirmation, sample photos carry the "Foto contoh" caption and must be removed before launch).
  3. `architecture.md`: the `/media` path and allowlist, the anonymous-read policy on `media/*`, the nginx template with `MINIO_BUCKET` and `MEDIA_UPSTREAM`, the MinIO key rights (`s3:PutBucketPolicy`, `s3:GetBucketPolicy`, `s3:DeleteObject`), and a deploy backup step (today `architecture.md` has none): Postgres, the bucket `media/` prefix mirrored to a dated folder off the MinIO volume, and a dated `mc ls --recursive` listing, on every deploy until B9. Grep the repo for any other runbook or deploy script with its own backup step and add the same line.
  4. `docs/07-delivery/LAUNCH_CHECKLIST.md` titled "Daftar periksa sebelum peluncuran", English headings, "Before launch" section with the three items of spec section 5 (remove samples with the exact command and the `SELECT count(*) FROM "ProductImage" WHERE source = 'sample';` check, backup of `media/` and staff keep originals, browsers keep removed photos up to a year); row in `docs/README.md` under A6 (`07-delivery/`).
  5. `.graphify/config.json`: modules `server/src/media` and `server/seed`; then `npm run graphify:sync` (root); `GRAPHIFY.md` entry with what and why.
- [ ] **Step 4: Run to pass.** Re-run the Step 1 commands (all match or exist) and `npm run graphify:check`. Expected: matches present, no graphify error.
- [ ] **Step 5: Stage this task's files:** `git add docs/05-api/STOREFRONT_CONTRACT.md docs/01-requirements/BUSINESS_RULES.md architecture.md docs/README.md docs/07-delivery/LAUNCH_CHECKLIST.md .graphify`

---

### Task 14: Deploy to dev, verify, review

**Files:**
- Create: `web/e2e/photos-dev.mjs` (Playwright run against the dev origin, with `API`/`BASE` from env, staff and customer sign-in the way `docs/superpowers/handoff/login-e2e.cjs` does)
- Modify: `docs/superpowers/handoff/` deploy notes file for the check log (a new dated `2026-10-28-product-images-dev-checks.md` there, or the existing dev checks log the owner uses; do not invent a second place if one exists)

**Interfaces:** consumes everything above. Dev server: `43.159.54.222`, SSH user `ubuntu`, deployed tree `/home/ubuntu/tian` (`architecture.md`; the key is in `.env`, never printed). Deploying changes a shared server, so confirm the owner's go-ahead in chat before step 3 (memory: the owner wants dev deploy plus checks, never push).

- [ ] **Step 1: Full local gate.** `npm run test:api`, `npm run test:web`, `cd web && npm run typecheck`, `npm run lint`. Expected: all pass (Rp587.250 and W00 tests included).
- [ ] **Step 2: Write `web/e2e/photos-dev.mjs` (the failing check).** It must fail until deployed. It prints `N/N` and exits non-zero on any failure. Contents (spec Testing, "Playwright"): as Marketing, upload two JPEG fixtures to B01 through the admin API and link one to `B01-2M-WHT`; check product page photo loaded (`naturalWidth > 0`), thumbnail switching and variant switching on those photos; check the "Foto contoh" caption on a seeded sample product (A02) and its absence on the uploaded B01 photos; Marketing can upload; Operations has no "Produk" nav item and gets 403 from the API; the owner sees "Produk" and Operations sees "Tidak ada akses" at `/admin/products`; CLS 0.00 on a category page and product page at 390 px (`layout-shift` entries); after deleting a photo the product page falls back to the drawing with no console error loop; finally delete both uploads. Run once before deploy: Expected FAIL (no `/media`, no routes).
- [ ] **Step 3: Roll out (spec "Rollout on dev", steps 1-5).**
  1. Backup before the `api` deploy: Postgres as before, `mc mirror <alias>/${MINIO_BUCKET}/media ./backup/media-YYYYMMDD` (operator fills the target off the MinIO volume), dated `mc ls --recursive` listing. Confirm the MinIO key has `s3:PutBucketPolicy`, `s3:GetBucketPolicy`, `s3:DeleteObject`.
  2. Deploy `api` first. Expected: `/health` shows `storage: minio`; anonymous GET of a `media/*` object works while `GET /media/` stays 404. Never deploy `web` before `api`.
  3. Deploy `web`. Run the Task 9 template-aware `nginx -t` command, then `docker compose exec web nginx -t` and `docker compose exec web grep -n "media/" /etc/nginx/conf.d/default.conf` (real bucket name, no `${`, no `//media/`, quoted regex with braces intact). If either fails, send no traffic to the new web image.
  4. `docker compose exec api npm run media:seed`, `docker compose restart api`, confirm `GET /v1/catalog` returns images for the seeded products and one seeded file answers 200 through the web origin; otherwise stop with "Gambar tidak dapat dimuat lewat /media; periksa MEDIA_UPSTREAM dan MINIO_BUCKET." and print the upstream URL.
  5. Add any extra `x-amz-*`/`x-minio-*` header seen in `curl -I` as one more `proxy_hide_header` line (re-run the Task 9 test and redeploy `web`).
- [ ] **Step 4: Run every "On dev, after deploy" check** from spec section "Testing" and record each result in the dev checks log: GPS JPEG upload (three WebP files, 200 `image/webp`, one `Cache-Control: public, max-age=31536000, immutable`, no `x-amz`/`x-minio` header, no EXIF in the served file); listing and probe requests (`/media/`, `/media/products/`, `%2e%2e` forms, merged slashes, `?response-content-type=...`, POST, MinIO stopped); anonymous requests straight to MinIO from the dev host (`health/` 403, `media/` object 200, `?list-type=2`, PUT and DELETE 403), stored policy equals the single statement, ports 9000 and 9001 closed from outside; body limits (2 MB to `/v1/auth/login` gives 413; 2 MB to the image route reaches the API; 12 MB upload returns the JSON `TOO_LARGE`); concurrency on the real database (two parallel uploads at 5 photos give one 201 and one 409 and exactly 6 rows; same JPEG twice refused; variant link then delete gives null `imageId` in Postgres; `prisma db push` added the nullable `Variant.imageId` without data loss; 20 parallel checkout plus delete/link runs end only in 200, 201, 404 or 409, never 500 or `40P01`); the existing concurrency check 12/12 and sign-in check 12/12; ten parallel 40 MP uploads keep API memory under `mem_limit`, none hangs, and a checkout during the burst answers in its normal time (adjust `mem_limit` if the measured peak needs it, never below 1 GB).
- [ ] **Step 5: Run Playwright, budgets and axe.** `node web/e2e/photos-dev.mjs` Expected: `N/N passed`. Budgets: (a) gzipped `GET /v1/catalog` grows at most 15 KB versus the pre-change response (`curl --compressed`; take the baseline before step 3.2), (b) at most 400 KB of images on a category page at 390 px before scrolling, (c) product page main photo at most 150 KB at 390 px, (d) a 5 MB JPEG upload processed in under 5 s with at most 300 MB API memory growth. LCP on "Slow 4G" at 390 px is recorded (target 2.5 s, not a gate) and the thumbnail requests start after the main photo. axe: 0 serious or critical on a product page and the photo manager. Screenshots at 390 px and 1440 px of a category page, a product page and the photo manager, reviewed with the design skills. If budget (a) is exceeded, apply the spec fallback (main and variant photos in the list, full `images` on `GET /v1/products/:slug`) only after confirming cart, account and card views still show the right photo.
- [ ] **Step 6: Review the branch diff.** Run `/code-review` (subagents on Sonnet, medium effort) on the branch diff; fix findings test-first; re-run Steps 1 and 5.
- [ ] **Step 7: Stage this task's files:** `git add web/e2e/photos-dev.mjs docs/superpowers/handoff/2026-10-28-product-images-dev-checks.md`. The owner decides when to commit; nothing is pushed.
