# Website Compliance Corrections — INDIPLEX@2026 Screening Report

Source: `authenticmedia.report.pdf` (14 November 2026). Outcome of that report:
**Further Verification Required — Conditional Hold / Pending.**

> **Status of this website: NOT ready for re-screening.** Mandatory statutory disclosures
> (CIN, GSTIN, directors, a named Grievance Officer) are unpublished because the merchant has
> not supplied verified values, and every policy is still an unapproved `1.0-draft`. Nothing in
> this file or on the site claims bank approval, onboarding approval or RBI compliance.

Last updated: 14 November 2026 (Phase 3 — merchant verification and final compliance preparation).
Nothing has been committed, pushed or deployed. The live site still serves the **pre-audit**
build (its bundle still contains "500+ clients"); none of the fixes below are public yet.

Phase 3 handoff documents (all in `docs/`):
[MERCHANT-DETAILS-REQUIRED.md](MERCHANT-DETAILS-REQUIRED.md) ·
[SERVICE-VERIFICATION.md](SERVICE-VERIFICATION.md) ·
[LEGAL-APPROVAL-CHECKLIST.md](LEGAL-APPROVAL-CHECKLIST.md) ·
[PRE-DEPLOYMENT-CHECKLIST.md](PRE-DEPLOYMENT-CHECKLIST.md). Phase 3 findings are in §9.
**Phase 4** (final blocker resolution, release candidate): [PHASE-4-RELEASE-CANDIDATE.md](PHASE-4-RELEASE-CANDIDATE.md).

---

## 1. Compliance matrix (all 13 requirements)

Status key — **DONE**: implemented and verified in code and browser. **PARTIAL**: the website
side is done; part of the requirement depends on merchant evidence. **BLOCKED**: cannot be
completed without merchant/legal input. No item is marked as passed while it depends on
evidence that has not been supplied.

| # | Requirement (PDF p5–6) | Priority | Status | What exists / what is missing |
|---|---|---|---|---|
| 1 | About Us — company details, nature of business | High | PARTIAL | `CompanyInfoSection` on /about: registered name, company type, nature of business, business model, registered office, contact. **Missing:** directors and statutory IDs (items 3–4). |
| 2 | Detailed service descriptions | Medium | PARTIAL | Order-to-delivery workflow on /services and /about. FAQ covers pricing, payment, timelines. Phase 3: all 17 live services specified in SERVICE-VERIFICATION §3 with gaps flagged. **BLOCKED:** per-service scope, deliverables and turnaround times; Cloud & Hosting price/feature are inferred and live. |
| 3 | GSTIN, CIN, registered address | High | BLOCKED | Address published (footer, About, every policy page). CIN/GSTIN render automatically from `LEGAL` once supplied — currently `null`, so nothing is shown. |
| 4 | Directors' details | High | BLOCKED | Leadership block on /about renders from `LEGAL.directors` — currently empty. |
| 5 | Light-mode theme | Low | DONE | Token-level light theme. Phase 2 found and fixed one remaining contrast failure (see §3). axe: 0 serious/critical violations on 12 routes × 4 viewports, plus drawer, search and checkout states. |
| 6 | Content corrections | Medium | PARTIAL | Removed "EST. 2020", "500+ clients" with avatar initials, social links to `#`, duplicate address, non-functional contact form. Phase 3: removed the false "Explore all 18 services" count (production has 17). **Pending merchant decision:** the claims in §6. |
| 7 | Fonts and design consistency | Low | DONE | One family (Outfit), shared tokens. Phase 2 fixed uneven micro-service card widths. Verified at 390/500/768/1440 px with no horizontal overflow on any route. |
| 8 | Customer sign-in, if required | High | NOT APPLICABLE — pending bank confirmation | Guest checkout with order-reference tracking, as stated in Terms and Privacy. No mock login added. The bank must confirm that guest checkout is acceptable. |
| 9 | FAQ section | Medium | DONE | `/faq`, 12 questions drawn from the published policies. Linked from header, footer and Contact. Native `<details>` (keyboard accessible). |
| 10 | Grievance Officer | High | BLOCKED (procedure DONE) | `/grievance-redressal` gives procedure, escalation and statutory remedies; linked from footer, Contact, FAQ, Privacy. **The officer's name, designation, email and phone are not published** — the Consumer Protection (E-Commerce) Rules, 2020 require them. |
| 11 | Demo / service walkthrough | Medium | PARTIAL | Written walkthrough live. **BLOCKED:** genuine sample deliverables (none were fabricated). |
| 12 | Business memo | Medium | PARTIAL | `docs/BUSINESS-MEMO-DRAFT.md` — private draft. Needs merchant facts and sign-off. Not published. |
| 13 | Final consistency review | High | PARTIAL | Single `SITE`/`LEGAL` sources; FAQ, policies and pages agree; 0 broken internal links. Cannot be closed until items 3, 4, 10 and §6 are resolved and the policies are approved. Phase 3 found 7 policy inconsistencies for legal review (LEGAL-APPROVAL-CHECKLIST §B). |

## 2. Where the blocked values go

All statutory and leadership data lives in **`src/lib/site.ts` → `LEGAL`**. Null/empty values
render nothing — no placeholder, no "N/A", no claim that a value exists.

```ts
export const LEGAL = {
  cin: null,              // Certificate of Incorporation — e.g. U12345UP2020PTC123456
  gstin: null,            // GST registration certificate — 15 characters
  directors: [],          // { name, designation, background, din? } — from MCA master data
  grievanceOfficer: null, // { name, designation, email, phone } — board-designated person
}
```

Verified fan-out once values are filled in:

| Field | Footer | About (/about) | Grievance page | Company block on every policy page |
|---|---|---|---|---|
| `cin` | ✓ | ✓ | ✓ (company block) | ✓ |
| `gstin` | ✓ | ✓ | ✓ (company block) | ✓ |
| `directors` | — | ✓ Leadership | — | — |
| `grievanceOfficer` | — | — | ✓ name, designation, email, phone; complaint email and phone switch to the officer's | — |

`src/lib/site.test.ts` (new) enforces this. CI fails if a CIN or GSTIN has the wrong format, a
director or officer entry is incomplete, the Grievance page names anyone while no officer is
set, or the page does not publish an officer once one is set. **A format check cannot prove a
value is the company's own** — copy each value from the source document.

## 3. Phase 2 findings and fixes

| # | Finding | Severity | Fix |
|---|---|---|---|
| F1 | `--color-text-subtle` (#64748b) was 4.34–4.37:1 on tinted surfaces (drawer footer #f1f5f9, panel #eff6ff), below WCAG AA 4.5:1. Found by axe on the checkout "SECURED BY" caption. | Medium (a11y) | Token changed to `#596579`: ≥4.8:1 on every surface, including the #dbeafe tile. Visually near-identical. `src/styles/globals.css`. |
| F2 | Micro-service cards shrank to their content width, giving uneven columns at ≥768px on Home and Services. Predates this audit. | Low (visual) | `w-full` on the card. `micro-service-card.tsx`. |
| F3 | The local Supabase anon key is rejected. | Local only | Diagnosed, not changed — see §5. |
| F4 | The two payment options have identical labels ("Pay with airpay"), so screen-reader users hear two indistinguishable radios. Introduced deliberately in commits `b947cc2`/`bc96c02`. | Low (a11y) | **Phase 4: fixed** — "Option 1" / "Option 2". Merchant to confirm wording (PHASE-4 M8). |
| F5 | At 390×844 the sticky checkout footer takes ~45% of the drawer height, leaving a small scroll area. It works but is tight. | Low (UX) | Not changed. Optional follow-up. |
| F6 | No E2E or browser accessibility tooling existed. | — | Added Playwright + axe-core (dev-only); see §4. |

**Payment surface verified untouched:** `git diff` shows no change to `api/`, `vercel.json`,
the `/callback/cpm/` rewrites, `src/services/**` (payment, orders, cart, catalogue),
`src/lib/supabase/**`, the checkout hook and contact validation, migrations, `.env.example` or
pricing. Cart and checkout components received colour-class changes only.

## 4. Testing evidence (actual results, 14 Nov 2026)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | Pass |
| Lint | `npm run lint` (oxlint) | Pass, 0 findings |
| Unit + integration | `npm test` | **447 / 447 pass**, 25 files (was 442; +5 LEGAL tests) |
| Payment regression (subset of above) | `npx vitest run api` | **389 / 389 pass**, 17 files — callback, settlement, idempotency, multi-merchant, forwarding, catalogue pricing |
| Build | `npm run build` | Pass (warning: one 667 kB JS chunk; pre-existing) |
| E2E + accessibility | `npm run test:e2e` (Playwright + axe) | **100 pass, 0 fail**, 4 skipped by design (link crawl runs once; mobile-menu test is skipped at desktop width). 96 screenshots. |

E2E coverage (`e2e/`), run at each viewport through explicit `viewport` configuration:

- **12 routes** (home, services, about, FAQ, contact, grievance, terms, privacy, refund,
  service delivery, order-success, 404): one `<h1>`, no horizontal overflow, no console or page
  errors, no unmocked network calls, 0 serious/critical axe (WCAG 2.0/2.1 A+AA) violations,
  full-page screenshot.
- **Catalogue** load (via the Supabase path) and catalogue error state.
- **Cart:** add, badge count, drawer, remove, empty state, Escape closes; axe on the drawer.
- **Guest checkout:** empty-submit validation, terms-consent gate, invalid email/phone blocked
  with no request sent, merchant 2 selection, hand-off to a mock gateway. Asserts the request
  carries service slugs and merchant index only — **no amount, MID, secret or price**.
- **Order-creation failure** shows "Try Again"; axe on the failure state.
- **Payment status page:** paid, failed, cancelled, requires_review, missing reference.
- **Contact:** validation, then the email-app fallback success state.
- **Search overlay:** results, empty state, Escape returns focus to the trigger; axe.
- **Navigation:** crawl of every internal link on all 10 linked pages (0 broken, no `#`
  hrefs, valid `mailto:`/`tel:`); mobile menu opens, navigates and marks the active page;
  checkout policy links open the policy.

**Safety:** every Supabase, `/api/*` and gateway request is intercepted in
`e2e/support/mocks.ts`, and any other external request is aborted and fails the test. No run
writes to the database, creates an order or contacts Airpay. No real or sandbox payment was
made.

Not covered: real Airpay sandbox hand-off (would need a sandbox MID — **not to be run against
the live MID**); the `mailto:` hand-off itself (the browser drops it — URL construction is
unit-tested); Safari/Firefox; real devices.

Screenshots: `test-results/screenshots/<viewport>/<page>.png` (git-ignored; regenerate with
`npm run test:e2e`).

## 5. Supabase configuration

| | Project ref | Role | JWT signature |
|---|---|---|---|
| Local `.env` `VITE_SUPABASE_ANON_KEY` | `ecknryxkuyjsuppvrhbz` | anon | **missing (0 chars)** |
| Deployed bundle (authenticmedia.fun) | `ecknryxkuyjsuppvrhbz` | anon | present (43 chars) |

**Root cause:** the local anon key was truncated when pasted — it ends after the payload
segment, so Supabase rejects it as an invalid API key. Local and production point at the
**same** project; the URL and the key's `ref` match.

**Fix (merchant/developer, not committed):** Supabase Dashboard → project
`ecknryxkuyjsuppvrhbz` → Project Settings → API Keys → copy the full `anon` key into the
git-ignored `.env`. Do not copy the deployed bundle's key into any committed file, and never use
the service-role key in a `VITE_` variable. No `.env` file was modified during this work.

Other configuration observations (local files only; production values live in Vercel):

- Local `.env` names merchant-1 Airpay variables `CLIENT_ID`, `USERNAME`, `PASSWORD`,
  `API_KEY`, `SECRET_KEY`, but `api/_lib/config.ts` reads `AIRPAY_CLIENT_ID`,
  `AIRPAY_USERNAME`, …. `USERNAME` also collides with the Windows OS variable. This only
  matters for running the API locally.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are absent locally, as they should be — they are
  server-only and belong in Vercel.
- **Not verified:** the Vercel production variable list. The CLI is not authenticated in this
  environment. Check it with `vercel env ls production` (names only).

## 6. Business claims needing a merchant decision

Kept on the site, **not verified**, and not described as compliant anywhere:

| Claim | Where | Concern | Decision needed |
|---|---|---|---|
| "Fintech Partner" — "Trusted fintech partner … compliance support" | Catalogue (Supabase `services`; bundled fallback copy) | A regulated-sounding service. "Trusted" and "compliance support" are unevidenced. | Evidence of actual fintech work and the legal basis, or reword/remove. |
| "Collection Partner" — "efficient recovery solutions, ethical follow-ups … improved cash flow" | Catalogue | Reads as debt collection/recovery, a high-risk category for gateway MCC screening and subject to recovery-agent conduct rules when done for regulated lenders. | Confirm what is actually delivered, for whom, under what authorisation — or remove. |
| "Fintech Support — payment and collection workflows" | /about capability list | Same as above. | Align with the decision above. |
| "complete technology partner" | /about narrative | Marketing language; low risk. | Optional. |

⚠ Production catalogue text is served from the Supabase `services` table. Editing
`catalogue.data.ts` changes only the offline fallback, so these decisions must be applied in
the database.

## 7. Legal review required before re-screening

1. Approve Terms, Privacy, Refund & Cancellation, Service Delivery and Grievance Redressal
   (all `1.0-draft`), then set `POLICY_META.effectiveDate`.
2. Grievance timelines: the page says complaints are handled "within the time limits required
   by applicable law" rather than stating the E-Commerce Rules' acknowledgement and redress
   periods. Counsel should confirm or state them explicitly.
3. Confirm guest checkout (no customer account) is acceptable to the acquiring bank.
4. Confirm the Fintech/Collection offerings (§6) are lawful for this company to sell.
5. Sign off the business memo.

## 8. Outstanding merchant information (re-screening blockers)

1. **CIN**, **GSTIN** (from certificates).
2. **Directors:** name, designation, verified background, DIN (optional).
3. **Grievance Officer:** name, designation, email, phone.
4. Decision on Fintech Partner / Collection Partner / Fintech Support (§6).
5. Per-service deliverables and typical timeframes.
6. Genuine sample deliverables for a demo (e.g. an anonymised audit report).
7. Bank confirmation on guest checkout (item 8).
8. Legal approval of policies (§7).
9. Optional: backend inbox for the contact form (it currently opens the visitor's email app);
   real social profile URLs if they are to be shown.

After 1–3 are entered in `LEGAL`, 4 is applied in Supabase, and the policies are approved:
run all checks, deploy (with authorisation), verify the live site, then request re-screening.

Added in Phase 3 (details in MERCHANT-DETAILS-REQUIRED §D and LEGAL-APPROVAL-CHECKLIST §D):

10. GST treatment of prices and how tax invoices are issued (checkout shows no tax line; no invoice is generated).
11. Confirmation that **both** Airpay merchant accounts offered at checkout belong to this company.
12. KKChat's role, and whether the Privacy Policy covers merchant 2's direct Airpay → KKChat route.
13. Confirmation of Cloud & Hosting's price (₹899) and third feature, which were inferred and are live.
14. Decision on the two identical "Pay with airpay" labels (F4).

## 9. Phase 3 findings (14 November 2026)

| # | Finding | Evidence | Action |
|---|---|---|---|
| P1 | Production catalogue = 17 active services; text and prices identical to the bundled fallback. Fintech Partner (₹499) and Collection Partner (₹999) are **active and purchasable**. "Fintech Support" is an /about capability card, not a service. | Read-only anon `GET /rest/v1/services` (same request the live site makes) | Decision required; deactivation plan in SERVICE-VERIFICATION §4. No record changed. |
| P2 | Home said "Explore all 18 services"; production has 17. | Catalogue read + `home.data.ts` | **Fixed:** label is now "Explore all services"; unused `CATALOGUE_SIZE` removed. |
| P3 | Cloud & Hosting price and third feature were inferred from a truncated screenshot and are live in the database. | `catalogue.data.ts` comments + DB row | Merchant confirmation. |
| P4 | `create_airpay_order` silently skips inactive slugs; `get_cart` is not in the repo, so whether a cart can show a deactivated item's price is unverified. Deactivating a service could make the cart total differ from the charge. | `20260831_airpay_settlement.sql` | **Phase 4: fixed in the client.** The cart drops inactive services and uses active prices; checkout refuses to hand off on any amount mismatch. `get_cart` definition still unread (PHASE-4 D1). |
| P5 | Policy inconsistencies: complaint escalation to the same inbox; Fintech/Collection missing from refund rules; "one-time" vs "monitoring"; undefined support period and "sessions"; singular "payment option". | `src/features/legal/content/*` | LEGAL-APPROVAL-CHECKLIST §B. Not edited: text changes await legal review. |
| P6 | Local `VITE_SUPABASE_ANON_KEY` still truncated (401). | Segment-length check; no value printed | Unchanged; local only. |
| P7 | The E2E `cart-drawer` screenshot is captured mid-slide-in; the layout itself is correct (360 px panel at 390 px). | Screenshot + `cart-drawer.tsx` | QA note only. |

Phase 3 checks: typecheck pass · lint pass · 447/447 unit · build pass · E2E 100 pass / 0 fail.
**Not verified:** Vercel production env names (CLI not authenticated), RLS policies, `get_cart`,
inactive `services` rows (Supabase MCP unauthorised; anon role sees active rows only).
