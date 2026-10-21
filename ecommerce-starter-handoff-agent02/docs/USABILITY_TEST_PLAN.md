# USABILITY_TEST_PLAN — M6 prototype

| Field | Value |
|---|---|
| Version | 1.0 draft (20 Oct 2026), pending M6 approval |
| Method | Moderated, think-aloud, remote or in person, using the M6 Play boards |
| Owner decisions needed | Number of participants, recruitment channel, incentive, consent wording, success thresholds |

No success thresholds are set here. Measures are defined so the owner can set targets (consistent with "no fabricated KPIs").

## 1. Participants (profile, not people)
| Group | Profile | Boards |
|---|---|---|
| Customers — Brand B | Buys computer accessories online; uses a phone for shopping | P01, P03, P04 |
| Customers — Brand A | Buys skincare online; uses a phone for shopping | P02, P04 |
| Store staff | Handles orders, refunds or promotions in any online store admin | P05, P06 |

Privacy: record only a participant code (e.g. U01). No names, phone numbers or emails in notes; screen recordings only with written consent; store recordings per the organisation's retention policy. Participants use the demo account only and must not enter real personal data.

## 2. Tasks
| ID | Board | Task given to participant | Success = |
|---|---|---|---|
| U1 | P01 | "Buy two 2-metre black USB-C cables and the GaN charger as cheaply as possible, and pay with QRIS." | Order created with KABEL10 + GRATISONGKIR, total Rp587.250 |
| U2 | P01 | "Try the HEMAT50 voucher. Why doesn't it work?" | Participant explains the minimum / flash-sale exclusion in own words |
| U3 | P01 | "Your payment did not go through. What can you do now?" (moderator triggers failure) | Participant identifies retry or method change before 10:30 |
| U4 | P02 | "You have sensitive skin. Find suitable products and save one for later." | Concern filter used; wishlist sign-in completed |
| U5 | P02 | "Get the free Travel Cleanser offer." | Two serums in cart, free line visible |
| U6 | P03 | "Find a 2 m USB-C cable" (typed freely) | Kabel USB-C 100W 2 m found |
| U7 | P03 | "Compare three cables and tell me which can carry video." | Compare used; HDMI/DisplayPort identified |
| U8 | P04 | "Your order from 14 Oct hasn't arrived. What do you do?" | Tracking opened; overdue message understood; CS hand-off found |
| U9 | P04 | "Stop personalised recommendations." | Toggle off and saved |
| U10 | P05 | (Operasional) "Ship order 0009." | Processed, valid tracking number, Dikirim |
| U11 | P05 | (Operasional, then Owner) "Customer of 0007 cancelled — refund it." | Operasional sees reason it is blocked; Owner records full refund with reason |
| U12 | P05 | (CS) "You need Citra's phone number to confirm delivery." | Reveal with reason; participant notices it is logged |
| U13 | P06 | (Marketing) "Schedule CHARGER15. Will customers see it this weekend?" | Explains flash sale wins 21–22 Okt; schedules after review |

## 3. Measures
| Measure | Definition |
|---|---|
| Task success | Success / partial / fail per the "Success =" column |
| Time on task | Start of task reading → success state or give-up |
| Errors | Wrong path, wrong voucher, invalid input, blocked action attempted |
| Single Ease Question (SEQ) | 1–7 rating after each task |
| Confidence in total | After U1: "How sure are you about the final price?" 1–7 |
| Observed issues | Severity: 1 cosmetic · 2 minor · 3 major · 4 blocker |

## 4. Session outline (per participant)
1. Consent and recording permission.
2. Short background questions (shopping habits; no personal identifiers).
3. Tasks for the participant's group, order randomised where independent.
4. Post-test questions: clarity of prices and vouchers, trust in payment page, privacy comfort.
5. Reset all boards ("Atur ulang") before the next participant.

## 5. Analysis and output
- Issue log: ID, task, board, severity, evidence (timestamp in recording), proposed fix, owner.
- Findings feed M7 backlog; severity 3–4 issues block M8 sign-off unless the owner accepts the risk.

## 6. Risks
| Risk | Control |
|---|---|
| Prototype panels bias participants | Moderator triggers panels; hide panels where possible |
| Fixed clock confuses participants | Moderator explains "the time in the demo is fixed" |
| Real personal data typed into inputs | Inputs are read-only or demo-prefilled; instruct participants |
| Small sample over-interpreted | Report qualitative issues; avoid percentage claims |
