# A0 — Open decisions, conflicts, and gaps

| Field | Value |
|---|---|
| Milestone | A0 |
| Status | A0 approved 21 Oct 2026 ("I approve, Go ahead and continue"). Defaults in §1 are accepted. §3 defaults stand where no separate answer was given |
| Date | 21 Oct 2026 |

Authority used while reading, from `Prompt.md` §2.1:

1. Explicit latest product-owner decisions.
2. Approved Agent 01 scope and deliverables.
3. Agent 02 requirements, once approved.
4. Documented assumptions.
5. General engineering recommendations.

Where two sources disagree, the conflict is listed here. Nothing in this file is marked accepted except where it quotes a decision the owner already approved on 20–21 Oct 2026.

**When** means the latest milestone that can still change course cheaply.

| When | Meaning |
|---|---|
| Accept with A0 | Approving A0 adopts this default. Say so in a REVISE if you want the other option |
| Before A1 | The requirement text cannot be written cleanly until this is answered |
| Before A2 / A3 / A4 / A5 | The decision belongs to that milestone's approval |
| Before launch | Does not block specification |

## 1. Decisions proposed for acceptance with A0

### OD-01 — Which mandate is active

| | |
|---|---|
| Conflict | Root `Prompt.md` (the instruction executed for this audit) makes Agent 02 a requirements and architecture role. Milestones are A0–A7. Production coding is out of scope. Agent 03 implements. `ecommerce-starter-handoff-agent02/AGENT02_PROMPT.md` makes Agent 02 the backend engineer. Milestones are B0–B9, including NestJS, migrations, webhooks, and deployment |
| Proposed default | Follow `Prompt.md`. Complete A0–A7 as specifications. Do not start B0. The B-series becomes Agent 03's implementation plan after A7, and only if the owner still wants that build |
| Risk | Medium if the owner actually wanted the B-series. Approving A0 under that intent would delay coding by the architecture milestones. The mitigation is this question, asked before any further document is written |
| When | Accept with A0 |

### OD-02 — Staff role names

| | |
|---|---|
| Conflict | `Prompt.md` §14 lists Super Admin, Store Manager, Content Editor, and Customer Service for evaluation. Decision D10 and board X12 use Owner, Admin, Operasional, Marketing, and CS |
| Proposed default | The approved names and the X12 matrix win. A1 will not introduce the prompt's role names |
| Risk | Low. The prompt says the latest owner decision wins |
| When | Accept with A0. No separate answer needed unless the owner wants to rename roles |

### OD-03 — Promotion stacking

| | |
|---|---|
| Conflict | `Prompt.md` §4.5 and §13 say stacking and priority are still awaiting business approval. Decision D3 already approves: one price promotion per line (lowest price wins), one order voucher, one shipping voucher, flash-sale lines excluded from order vouchers unless allowed, applied in that order |
| Proposed default | D3 is the rule. A1 writes it as an approved business rule |
| Still open | P12 (equal price keeps the promotion that is already active) is reversible — OD-12. How a refund splits a discounted line is not specified — A1 will state that refunds are order-level amounts (as X03 and I8 do) and will not invent per-line allocation |
| Risk | Low for stacking. Medium later if finance needs per-line refund allocation and it was never designed |
| When | Accept D3 with A0. Refund allocation stays a noted limit, revisited only if the owner asks for line-level refunds |

### OD-04 — Stale "awaiting approval" banners

| | |
|---|---|
| Conflict | `DESIGN_SYSTEM.md`, `COMPONENT_INVENTORY.md`, and `RESPONSIVE_RULES.md` say "awaiting approval". `PROTOTYPE_GUIDE.md`, `USABILITY_TEST_PLAN.md`, and the header of `ANALYTICS_METRICS.md` say pending M5 or M6 approval. `PROJECT_BRIEF.md` records M0–M8 approved (M8 on 21 Oct 2026) |
| Proposed default | The milestone table in PROJECT_BRIEF and the decision log win. The banners are leftover draft labels. HANDOFF §4 items stay open even so |
| Risk | Low. Misreading a banner could reopen a closed milestone |
| When | Accept with A0 |

### OD-05 — M7 approval wording

| | |
|---|---|
| Source | ASSUMPTIONS_AND_DECISIONS: the owner replied "Continue" to the M7 approval request. Agent 01 recorded that as approval and asked to flag it if unintended |
| Proposed default | Keep M7 approved, including R1–R11 |
| Risk | Low. If "Continue" was not approval, the React prototype's build decisions (hash routing, no browser storage, release gate, dialog behaviour) would need a fresh review |
| When | Accept with A0 unless the owner says M7 was not approved |

### OD-06 — What 88,9% means

| | |
|---|---|
| Conflict | HANDOFF §2 and `AGENT02_PROMPT.md` rule 12 say the W00 metrics must equal **Rp2.097.000 / 8 / Rp262.125 / 88,9%**. ANALYTICS_METRICS defines 88,9% as M6 payment completion (8 ÷ 9) and 0,65% as M4 conversion (8 ÷ 1.240 mock sessions). `admin.test.ts` asserts both |
| Proposed default | Both numbers stand. The slash tuple is M1 / M2 / M3 / M6. M4 stays 0,65% until a real session count replaces 1.240. A1 will cite metric IDs and will not treat 88,9% as conversion |
| Risk | Medium if a later test encodes the wrong denominator. The unit test is the tie-break used here |
| When | Accept with A0 |

The e2e figure Rp1.880.000 is explained in the audit §6. It is the seed net after a test refund, not a competing definition.

## 2. Gaps to close in A1

### OD-07 — Permission catalogue is smaller than board X12

| | |
|---|---|
| Gap | X12 gives Operasional change rights on products and inventory, view rights to Marketing and CS, change rights on promotions and content to Marketing, and shipping-settings rights to Operasional. `rbac.ts` has no permissions for catalogue, inventory, content, or settings. The prototype does not ship those screens (K-4), so the missing names were never exercised |
| Proposed default | A1 copies the nine X12 rows into the requirement. New permission names are added in A3 to match. No role gains a right the board does not show |
| Risk | High if implementation follows only `rbac.ts` and then blocks Operasional from inventory, which the approved board allows |
| When | Before A1 is approved |

### OD-08 — Address fields

| | |
|---|---|
| Gap | D13 requires recipient, phone, province, city/regency, district, postal code, and street detail, and allows kelurahan, label, and note. `Address` in `src/domain/types.ts` and the `address` row in `DATA_MODEL.md` have label, recipient, phone, line, city, and postal code only |
| Proposed default | D13 is the requirement. The type and the draft data model are incomplete. Province and district become required in A3. Kelurahan stays optional |
| Risk | Medium. Shipping quotation needs an administrative area. A city string is not enough for Indonesian courier APIs, but A4 must not invent a provider's area-code scheme |
| When | Before A1 is approved |

### OD-09 — Search behaviour

| | |
|---|---|
| Conflict | USER_FLOWS specifies at least 2 characters, a 250 ms wait, synonym expansion, typo tolerance (1 edit at ≥ 4 letters, 2 edits at ≥ 8), and rank order name > synonym > category > attribute, with at most 6 products and 3 categories in autocomplete. Decision P8 and `domain/search.ts` specify a demo synonym map and all-words substring match. P8 says the production engine is later work |
| Proposed default | A1 records P8 as the prototype compatibility baseline and the USER_FLOWS pipeline as the production requirement. A2 chooses database full-text first, with a later dedicated engine only if that cannot meet the pipeline |
| Risk | Medium. Typo tolerance is a real scope increase over the code that shipped. Ignoring the flow would drop an essential DESIGN_SCOPE item |
| When | Before A1 is approved |

### OD-10 — Delivery exception

| | |
|---|---|
| Gap | USER_FLOWS lists "Gagal kirim" as a side status, then reattempt or returned. `FulfilmentStatus` has no exception value. The only related behaviour is the 72 h overdue flag |
| Proposed default | A1 keeps overdue as a flag, not a status. "Gagal kirim" stays unspecified until a courier capability matrix exists in A4. No transition is invented in A0 |
| Risk | Medium for operations if couriers report failures and the admin has no state to put them in |
| When | Before A1 for the flag-versus-status choice. Courier mapping before A4 |

### OD-11 — Date of birth and other profile fields

| | |
|---|---|
| Gap | `Prompt.md` §4.10 lists date of birth. No approved decision, screen field, or type requires it. D16 only checks WhatsApp number format. Consent already covers personalised recommendations and marketing email |
| Proposed default | Date of birth is not collected. A1 lists it as out of scope until the owner asks for it, because personal data should not be added without a purpose |
| Risk | Low. A campaign that needs age confirmation would need a new decision |
| When | Accept with A0 |

### OD-16 — Admin path spelling

| | |
|---|---|
| Conflict | SITEMAP uses `/admin/settings/users` and `/admin/settings/payments`. X12 headers use `/admin/users` and `/admin/settings/payment` |
| Proposed default | A1 uses the sitemap paths (I1, English admin paths collected in one IA document) |
| Risk | Low. Both are unwired |
| When | Before A1 is approved |

### OD-17 — Usage limits and exclusivity beyond D3

| | |
|---|---|
| Gap | `Prompt.md` §13 asks for usage limits, per-customer limits, and exclusivity. D3 does not define them. The prototype has none |
| Proposed default | A1 does not add them. The approved stacking rules are the whole promotion policy until the owner requests limits |
| Risk | Medium for a flash-sale campaign that needs a redemption cap. That cap can be a later change with its own approval |
| When | Accept with A0 |

## 3. Owner items already open in HANDOFF §4

These have a prototype default. Approving A0 does **not** close them. Each stays reversible until the milestone named here.

| ID | Decision | Prototype default | Risk if the default is wrong | When |
|---|---|---|---|---|
| OD-12 | P12 equal-price tie | Keep the promotion that is already active | Low. Only ties change | Before A1 writes the rule as final. Default stands if you do not answer |
| OD-13 | C7 repeat buyers | All-time, not the selected report period | Low. Changes one ratio | Before A1. Default stands if you do not answer |
| OD-14 | C9 / P7 lockout and staff recovery | 5 failures, 15 minutes, TOTP required, reset by Owner, no staff Google sign-in | Medium. A weaker lockout is a security choice; a stronger one changes the sign-in UX | Before the A2 session ADR is accepted |
| OD-15 | P10 returns | No refund after shipment | High for operations if customers can return goods and the system cannot record it. The prototype is explicit that this flow was not designed | Before A1 scope is frozen. Default is "out of scope" |
| OD-18 | C2 reveal | 60 seconds, three fixed reasons, logged | Medium. A DPO review may require a different duration or reason list. This audit is not that review | Before A5 security baseline is accepted |
| OD-19 | D15 trademarks | Working names Halimun and Sambung | High for a public launch. Low for specification, because names stay in configuration | Before launch |
| OD-20 | Legal and business identity | Placeholders `[isi oleh pemilik]` on X12 A18: legal entity, CS email, WhatsApp number, CS hours, policy pages | High for launch. Specifications will keep the placeholders and will not draft legal text | Before launch. Content can arrive any time |
| OD-21 | Font hosting | Google Fonts in the prototype (K-7) | Medium under UU PDP if visitor IPs are sent to a third party. Self-hosting is the safer engineering default and will be proposed in A5, not decided here | Before A5 |
| OD-22 | Usability thresholds | None in USABILITY_TEST_PLAN | Low for engineering. The plan defines measures and refuses invented targets | Before any usability sign-off. Not an engineering blocker |

## 4. Architecture questions reserved for later milestones

These are listed so A0 does not silently answer them. No default here is a technology selection.

| ID | Question | Material effect | When |
|---|---|---|---|
| OD-23 | Frontend rendering. The prototype is a Vite SPA with HashRouter (R1). R13 recommends React Router 7. SEO requirements need crawlable URLs. Next.js is the other option in `Prompt.md` §6.1 | Changes deployment and data fetching. Must not change the approved layouts | A2 ADR, status Proposed until accepted |
| OD-24 | ORM and migration tool on PostgreSQL (Prisma, Drizzle, or another). NestJS is the preferred backend and is not re-opened unless A2 finds a constraint | Shapes A3's physical model and Agent 03's repository style | A2 |
| OD-25 | Search engine staging. PostgreSQL full-text versus a separate Meilisearch (or similar) process | Extra operational cost if a second service is added early | A2, using the OD-09 requirement |
| OD-26 | Redis, queue, and scheduled jobs: reservation expiry, webhook retry, notification send, shipping sync | Extra process on the VPS. Must be justified per job | A2 |
| OD-27 | Payment provider: Midtrans, Duitku, or an adapter with neither chosen | Webhook shape, refund support, and methods differ. A4 will compare from public capabilities and will not invent endpoints | A4 |
| OD-28 | Shipping provider: Biteship, RajaOngkir/Komerce, KiriminAja, or adapter only | Area codes, rates, and tracking webhooks differ. Quotes in W00 are fictional and are not provider prices | A4 |
| OD-29 | Session mechanism: server session cookie versus token. The API draft already says HttpOnly, Secure, SameSite cookies plus a CSRF header. `Prompt.md` §14 says not to assume JWT | Auth design for the VPS | A2. The draft is a proposal, not an acceptance |
| OD-30 | Binding performance numbers | None exist. A5 may propose targets and a measurement method. They stay proposals until accepted | A5 |
| OD-31 | Tax invoice, PPN rate as a number, and accounting retention period | Prices include PPN as a display rule. No rate and no retention period are approved. DATA_MODEL asks the owner to confirm the legal retention period | A1 states the display rule. Retention period before A3 is marked ready. Legal review, not a certification |
| OD-32 | Notification providers for email and WhatsApp | C11 decides when a message may be sent. It does not choose a vendor | A4 or A5. Consent is checked at send time |

## 5. Questions that do not need an answer to approve A0

Approving A0 means the audit, the traceability map, and the defaults in §1 are accepted, and that A1 may start.

A REVISE should name the OD id to change. A HOLD should name the item that blocks writing requirements. Silence is not approval.

Items in §3 and §4 can stay unanswered at this gate. A1 will carry §3 defaults as labelled assumptions and will stop again before those assumptions are treated as final where the "When" column says so.
