export const meta = {
  name: 'demo-photo-sourcing',
  description: 'Find free-licence real photos for each demo product and adversarially verify licence, brand and people risks (read-only, no downloads)',
  whenToUse: 'Feasibility research for real demo product photos before the spec is written',
  phases: [
    { title: 'Search', detail: 'one agent per product group searches open collections (read-only)' },
    { title: 'Verify', detail: 'one skeptic per group re-checks licence, trademark, people and fit' },
  ],
}

const ROOT = 'C:\\Users\\new user\\OneDrive\\2024\\Desktop\\SelfProject\\ProjectnyaTian'
const TOOL = 'node .claude/skills/design-taste-frontend/scripts/assets.mjs'

const RULES = `
CONTEXT: ProjectnyaTian is an Indonesian B2C e-commerce starter with two fictional demo brands: Sambung (computer accessories, white/grey/blue look) and Halimun (simple skincare, warm beige/green look). The demo catalogue currently shows drawn SVG placeholders. The owner approved replacing them with REAL photos under free licences, stored later in the shop's own MinIO and clearly marked as sample photos to replace per client. Your job is feasibility research only.

HARD RULES (read-only):
- Do NOT download image files, do NOT run the tool with --get or --credits, do NOT write, create or modify any file anywhere in the project. Searching, fetching web pages/metadata and HEAD requests are fine.
- Run the search tool from the project root: cd "${ROOT}" then ${TOOL} "<query>" --license <list> --min-width 1000 --limit 8 --json --no-check
- Licence order of preference: cc0 or pd first (no credit needed). Then by (credit required on a credits page). by-sa only if nothing else fits, and flag shareAlike=true. Never nc, nd, or unclear licences. Unsplash or Pexels pages found via web search are acceptable only if the licence page is the Unsplash License / Pexels License (no credit required) and the photo page is reachable; record the page URL.
- Openverse timed out on almost every query in the first run (30 s each). Search with --source commons by default; try --source openverse at most once for the whole group, and drop it if it times out.
- Stop searching a need once you hold 3 low-risk candidates; do not run every suggested query just to run it.
- For every Wikimedia Commons candidate, fetch the raw wikitext with curl: curl -s "https://commons.wikimedia.org/w/index.php?title=File:<FileName>&action=raw" and check for {{Trademarked}}, {{Personality rights}}, {{Copyvio}}, {{delete}} or deletion requests, {{Logo}}, {{Watermark}} templates, and read the description and categories for brand names.
- Reject or flag: visible third-party brand names or logos (Apple, Anker, Ugreen, Belkin, Samsung, Xiaomi, Baseus, CeraVe, The Ordinary, Cetaphil, Wardah, etc.), identifiable people or faces, watermarks, screenshots, diagrams, 3D renders when a photo exists, images under 960 px on the shorter side. Prefer at least 1600 px wide, the product as the clear subject, a clean neutral background, and framing where a centred square crop still shows the product.
- You cannot see pixels. Judge from title, description, tags, categories, templates and file names, and say so in notes when unsure (mark risks as "possible", not "none", when you cannot tell).
`

const CANDIDATE = {
  type: 'object',
  properties: {
    ref: { type: 'string', description: 'tool ref such as commons:64025084, or the page URL for Unsplash/Pexels' },
    title: { type: 'string' },
    creator: { type: 'string' },
    license: { type: 'string', description: 'cc0, pd, by, by-sa, unsplash, pexels' },
    licenseVersion: { type: 'string' },
    licenseUrl: { type: 'string' },
    page: { type: 'string' },
    original: { type: 'string', description: 'direct URL of the full-size image' },
    width: { type: 'number' },
    height: { type: 'number' },
    attributionRequired: { type: 'boolean' },
    shareAlike: { type: 'boolean' },
    brandRisk: { type: 'string', enum: ['none', 'possible', 'visible'] },
    peopleRisk: { type: 'string', enum: ['none', 'possible', 'present'] },
    templatesFound: { type: 'array', items: { type: 'string' } },
    matchQuality: { type: 'string', enum: ['exact', 'close', 'loose'] },
    notes: { type: 'string' },
  },
  required: ['ref', 'title', 'creator', 'license', 'page', 'original', 'width', 'height', 'attributionRequired', 'shareAlike', 'brandRisk', 'peopleRisk', 'matchQuality', 'notes'],
}

const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          variant: { type: 'string' },
          candidates: { type: 'array', items: CANDIDATE },
          verdict: { type: 'string', enum: ['good', 'weak', 'none'] },
          verdictReason: { type: 'string' },
          queriesRun: { type: 'array', items: { type: 'string' } },
        },
        required: ['productId', 'variant', 'candidates', 'verdict', 'verdictReason', 'queriesRun'],
      },
    },
  },
  required: ['products'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          variant: { type: 'string' },
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ref: { type: 'string' },
                accepted: { type: 'boolean' },
                licenseConfirmed: { type: 'string', description: 'licence string exactly as found on the source page, or "not confirmed"' },
                attributionRequired: { type: 'boolean' },
                originalReachable: { type: 'boolean' },
                trademarkOrPersonalityFlag: { type: 'boolean' },
                reasons: { type: 'array', items: { type: 'string' } },
              },
              required: ['ref', 'accepted', 'licenseConfirmed', 'attributionRequired', 'originalReachable', 'trademarkOrPersonalityFlag', 'reasons'],
            },
          },
          chosenRef: { type: 'string', description: 'best accepted ref, or empty string if none survives' },
          fallback: { type: 'string', description: 'what to show if nothing survives, e.g. keep the drawing' },
        },
        required: ['productId', 'variant', 'checks', 'chosenRef', 'fallback'],
      },
    },
  },
  required: ['products'],
}

const groups = args

phase('Search')
log(`Searching ${groups.length} product groups (${groups.reduce((n, g) => n + g.products.length, 0)} photo needs), read-only`)

const results = await pipeline(
  groups,
  (group) => agent(
    `${RULES}
HINTS: an interrupted earlier run already saw these refs for this group (unverified; titles, sizes and pages may be partial or wrong): read the JSON file docs/superpowers/handoff/2026-10-27-photo-research-interim.json, key groups["search:${group.key}"].candidatesSeen. Check the promising ones first, then search for more only where a need is still uncovered.
TASK: Find up to 3 real-photo candidates per need below for the group "${group.name}". Run the listed queries as needed (and any better ones you think of) with --license cc0,pd first, then --license by, and only if still nothing, --license by-sa. Check each promising Commons candidate's raw wikitext as described. Return candidates best-first, and a verdict per need: good (a clearly fitting, low-risk photo exists), weak (only loose or risky matches), none.

NEEDS:
${group.products.map((p) => `- productId ${p.productId}, variant "${p.variant}": ${p.name}. Looking for: ${p.need}. Suggested queries: ${p.queries.join(' | ')}`).join('\n')}`,
    { label: `search:${group.key}`, phase: 'Search', schema: SEARCH_SCHEMA, model: 'sonnet', effort: 'medium' },
  ),
  (found, group) => {
    if (!found) return null
    return agent(
      `${RULES}
TASK: You are a skeptical licence and brand-safety reviewer. For each need below, examine the top 2 candidates the searcher proposed and try to REFUTE them. For each candidate:
1. Open the source page (curl or web fetch) and copy the licence string exactly as shown there. If it is not cc0, public domain, CC BY, CC BY-SA, Unsplash License or Pexels License, reject.
2. For Wikimedia Commons, fetch the raw wikitext (action=raw) and reject on {{Trademarked}}, {{Personality rights}}, {{Copyvio}}, deletion requests, {{Logo}} or {{Watermark}}; also reject if the description or categories name a third-party brand that would be visible on the product.
3. Send a HEAD request (curl -sI) to the original URL; it must answer 200 with an image content type. Do not download the body.
4. Judge whether the photo truly shows the needed product type (e.g. a multi-port charger, not a laptop power brick; an unbranded jar, not a branded cream). When in doubt, reject and say why.
Set chosenRef to the best candidate that survives, or "" if none survives, and give a fallback (normally: keep the existing drawing for that product until the client supplies a photo).

GROUP: ${group.name}
SEARCHER RESULT (JSON):
${JSON.stringify(found.products, null, 1)}`,
      { label: `verify:${group.key}`, phase: 'Verify', schema: VERIFY_SCHEMA, model: 'sonnet', effort: 'medium' },
    ).then((verified) => ({ group: group.key, name: group.name, found: found.products, verified: verified ? verified.products : null }))
  },
)

const done = results.filter(Boolean)
const needs = done.flatMap((r) => (r.verified ?? []).map((v) => ({ group: r.group, productId: v.productId, variant: v.variant, chosen: v.chosenRef })))
const missing = needs.filter((n) => !n.chosen)
log(`Verified ${needs.length} photo needs: ${needs.length - missing.length} with an accepted photo, ${missing.length} without`)
if (results.length !== done.length) log(`${results.length - done.length} group(s) failed and returned nothing`)
return { results: done, summary: { needs: needs.length, withPhoto: needs.length - missing.length, missing } }
