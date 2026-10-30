export const meta = {
  name: 'spec-review-product-images',
  description: 'Multi-angle review of the product images spec: 8 critics, a skeptic per finding, then a completeness pass (read-only)',
  whenToUse: 'Before the owner reviews docs/superpowers/specs/2026-10-27-product-images-design.md',
  phases: [
    { title: 'Review', detail: '8 independent critics read the spec and the code it touches' },
    { title: 'Verify', detail: 'a skeptic tries to refute each finding' },
    { title: 'Completeness', detail: 'what did no critic cover?' },
  ],
}

const SPEC = 'docs/superpowers/specs/2026-10-27-product-images-design.md'
const HANDOFF = 'docs/superpowers/handoff/2026-10-27-session-handoff.md'

const PREAMBLE = `You are reviewing a written design spec before the project owner reviews it. Work in the repository root (the current directory).
1. Read the spec in full: ${SPEC}.
2. Read the section "Item 1 decisions (all approved by the owner)" in ${HANDOFF}. Those product decisions are fixed: do not propose reversing them. If a real problem can only be solved by changing one, report it with needsOwnerDecision=true.
3. Appendix A (the demo photo list) is intentionally empty: separate research is filling it. Do not report its emptiness; you may report problems with how it is meant to be structured or used.
4. Check the spec's claims against the actual code and files it names. Quote evidence as path:line plus the relevant text.
Report at most 8 findings, most severe first. Only real problems: something wrong, missing, contradictory, ambiguous (two readings), untestable, unsafe or likely to trip the implementer. No style preferences, no restating what the spec already says. Severity: blocker (would ship a defect, security hole or rule breach), major (implementer would likely get it wrong or a requirement is missing), minor (worth fixing, low risk). Each fix must be concrete: the exact sentence(s) to add to or replace in the spec, naming the section.
Hard rule: read only. Do not create, edit or delete any file, do not run builds, installs or deploys, do not download anything.`

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'one-line claim' },
          section: { type: 'string', description: 'spec section the finding belongs to' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          problem: { type: 'string' },
          evidence: { type: 'string', description: 'path:line quotes or spec quotes' },
          fix: { type: 'string', description: 'exact text to add or replace in the spec' },
          needsOwnerDecision: { type: 'boolean' },
        },
        required: ['title', 'section', 'severity', 'problem', 'evidence', 'fix', 'needsOwnerDecision'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'plausible', 'refuted'] },
    reason: { type: 'string' },
    refinedFix: { type: 'string', description: 'exact spec text change; empty when refuted' },
  },
  required: ['verdict', 'reason', 'refinedFix'],
}

const DIMENSIONS = [
  { key: 'security', focus: 'Security and personal data. Upload attack surface (type detection from content, SVG and polyglot files, decompression bombs, key or path injection through productId or other inputs, oversized multipart bodies, CSRF on multipart given the cross-site check in server/src/main.ts), the MinIO bucket policy scope and exposure, the nginx /media proxy (allowed methods, header leaks, listing, error mapping, path traversal such as /media/../ or encoded slashes), metadata stripping (EXIF, GPS, XMP, IPTC, embedded thumbnails, ICC), RBAC on every endpoint, audit completeness and ALCOA+ (attributable, contemporaneous, original), the sample-removal script, env and secrets. Read server/src/main.ts, server/src/commerce/session-cookie.ts, server/src/storage.service.ts, server/src/cache-policy.ts, server/src/domain/rbac.ts, server/src/commerce/admin.service.ts, web/nginx.conf, docker-compose.yml.' },
  { key: 'code-consistency', focus: 'Consistency with the existing code. Does every file, function, type, route, header and behaviour the spec names exist and work the way the spec says, and is every integration point named? Check server/prisma/schema.prisma, server/src/commerce/catalog.service.ts, server/src/domain/types.ts and web/src/domain/types.ts, both rbac.ts files, web/src/admin/AdminShell.tsx, web/src/App.tsx, web/src/components/ui.tsx (ProductArt), web/src/components/ProductCard.tsx, web/src/pages/ProductPage.tsx, web/src/pages/CartPage.tsx, web/src/pages/Account.tsx, web/src/services/http/client.ts, backend.ts and admin.ts, web/nginx.conf, docker-compose.yml, server/Dockerfile, web/Dockerfile, server/package.json and web/package.json (is multer available through @nestjs/platform-express, which @types are needed, which exact sharp version suits node:22-bookworm-slim), server/src/storage.service.ts, server/src/health.controller.ts.' },
  { key: 'data-concurrency', focus: 'Data model and concurrency. Prisma model validity (the Product to ProductImage to Variant relation cycle, onDelete behaviours, Int[] on Postgres, unique keys), whether the `prisma db push` that runs on container start (server/Dockerfile CMD) applies these safely to the existing dev database, the reorder-with-offset plan, closing gaps on delete, first-free-position under concurrent uploads, the duplicate-hash rule, the order of MinIO writes versus database transactions and their failure handling, the variant-to-photo ownership check, the seed (idempotent, never touching uploads) and remove-samples semantics, catalogue refresh. Compare with the locking patterns already in server/src/commerce/order-lock.ts and the mutate() helper in server/src/commerce/admin.service.ts.' },
  { key: 'serving-perf', focus: 'Serving, caching and performance. The nginx /media location: templates and envsubst in the nginx:1.27-alpine image (which variables get substituted, interaction with nginx built-in $variables), proxy_pass with a URI and how the request path is mapped, proxy_intercept_errors scope, limit_except, header hiding; client_max_body_size placement; docker-compose changes; MinIO anonymous-read policy via @aws-sdk/client-s3 PutBucketPolicy against MinIO; srcset and sizes correctness for each place (are the right widths picked; is sizes=64px right for 48px thumbnails on 2x and 3x screens); LCP on the product page; cache headers and the existing server/src/cache-policy.ts (15 s catalogue cache versus photo changes).' },
  { key: 'a11y-ux', focus: 'Accessibility, UX and copy. The gallery buttons (accessible names, pressed state, focus order, 48 px targets against WCAG 2.2), alt text rules (length, decorative cases, thumbnails repeating the main alt, screen reader verbosity), the admin photo manager (labels, counter, save-on-blur risks such as navigating away or failing silently, keyboard reorder and focus after a move, the confirmation dialog, live announcements, error placement, upload progress and disabled states), Bahasa Indonesia copy quality and consistency with existing admin copy, Agent 01 design preservation (.claude/rules/frontend-design-skills.md), layout at 375 px. Read web/src/components/ui.tsx, web/src/pages/ProductPage.tsx, web/src/admin/AdminShell.tsx, web/src/admin/AdminPages.tsx, web/src/components/Dialog.tsx.' },
  { key: 'testability', focus: 'Testability and completeness of acceptance. Map every requirement and every row of the error table to at least one test in the Testing section; report requirements with no test, tests that cannot be written as described (for example how to make a JPEG fixture that really carries GPS EXIF, asserting no metadata with sharp, faking MinIO in unit tests, multipart in tests), missing edge cases (exactly 6 photos, a 1-photo product, a variant linked to a deleted photo, reorder lists with duplicates or foreign ids, alt text with only spaces, emoji or HTML, concurrent delete and reorder), and success criteria too vague to check. Look at existing patterns in server/src/**/*.test.ts and server/src/test/fake-db.ts.' },
  { key: 'compliance-licensing', focus: 'Project rules and photo licensing. Check the spec against CLAUDE.md constraints 1 to 10, .claude/rules/*.md, the relevant parts of Prompt.md (search it for audit, RBAC, PII, copy language, approvals and images rather than reading it all), and docs/01-requirements/BUSINESS_RULES.md. Check the photo licence policy: CC BY 4.0 attribution (is a credit line only under the product page gallery enough when cards, cart and account rows show the same photo?), CC BY-SA share-alike on resized derivatives, Unsplash and Pexels licence restrictions, model and property releases, visible trademarks, and the consumer-protection risk of a stock photo being read as the actual product.' },
  { key: 'spec-quality', focus: 'Spec quality, the brainstorming self-review: placeholders or TBDs, internal contradictions between sections (for example the data section versus the upload section versus the error table versus testing), requirements that can be read two ways (pick one and say which), scope (is this one implementation plan or should it be split), terms used before they are defined, and numbers that disagree (sizes, limits, counts, paths).' },
]

const verify = (f, label, phaseName) => agent(
  `You are a skeptical second reviewer. Another reviewer reported this problem in the spec ${SPEC}. Try to REFUTE it: read the spec text it refers to and the code it cites, and check.
- refuted: the claim is wrong (the spec already handles it, the code does not behave as claimed), it is only a style preference, or its fix would reverse an approved owner decision (see "Item 1 decisions" in ${HANDOFF}) without need.
- confirmed: you checked and the problem is real as described.
- plausible: likely real, but you could not fully check it.
Return refinedFix: the exact spec text to add or replace (correct or complete the reviewer's fix if needed); empty when refuted.
Read only: do not create, edit or delete any file, do not run builds or installs, do not download anything.
FINDING:
${JSON.stringify(f, null, 1)}`,
  { label, phase: phaseName, schema: VERDICT, model: 'sonnet', effort: 'medium' },
).then((v) => (v ? { ...f, verdict: v.verdict, verifyReason: v.reason, fix: v.refinedFix || f.fix } : { ...f, verdict: 'unverified', verifyReason: 'verifier returned nothing' }))

phase('Review')
const reviewed = await pipeline(
  DIMENSIONS,
  (d) => agent(`${PREAMBLE}\n\nYOUR ANGLE (${d.key}): ${d.focus}`, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS, model: 'sonnet', effort: 'medium' }),
  (res, d) => (res ? parallel(res.findings.map((f, i) => () => verify({ ...f, dimension: d.key }, `verify:${d.key}:${i + 1}`, 'Verify'))) : []),
)

const all = reviewed.filter(Boolean).flat().filter(Boolean)
const kept = all.filter((f) => f.verdict !== 'refuted')
log(`Critics reported ${all.length} findings; ${kept.length} survived verification`)
const failedCritics = reviewed.filter((r) => r === null).length
if (failedCritics) log(`${failedCritics} critic(s) returned nothing`)

phase('Completeness')
const extra = await agent(
  `${PREAMBLE}\n\nYOUR ANGLE (completeness): find what NO reviewer covered. Consider operational rollout and rollback, logging and observability, MinIO backups, configuration per client fork (env vars and defaults), behaviour when MinIO is down at API start (ObjectStorage.onModuleInit), existing data and migration, documentation that must change with this work (API contract docs in docs/05-api, BUSINESS_RULES, graphify), performance budget, and anything else a careful implementer would need that the spec leaves unsaid.\nAlready found, do not repeat:\n${kept.map((f) => `- [${f.section}] ${f.title}`).join('\n')}`,
  { label: 'completeness', phase: 'Completeness', schema: FINDINGS, model: 'sonnet', effort: 'medium' },
)
const extraVerified = extra
  ? (await parallel(extra.findings.map((f, i) => () => verify({ ...f, dimension: 'completeness' }, `verify:completeness:${i + 1}`, 'Completeness')))).filter(Boolean)
  : []

const rank = { blocker: 0, major: 1, minor: 2 }
const findings = [...kept, ...extraVerified.filter((f) => f.verdict !== 'refuted')].sort((a, b) => rank[a.severity] - rank[b.severity])
const refuted = all.length - kept.length + extraVerified.filter((f) => f.verdict === 'refuted').length
log(`Final: ${findings.length} findings (${findings.filter((f) => f.severity === 'blocker').length} blocker, ${findings.filter((f) => f.severity === 'major').length} major), ${refuted} refuted`)
return { findings, refuted }
