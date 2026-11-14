# Pre-Deployment Checklist

For: the developer deploying, and the person authorising the deploy.
Prepared: 14 November 2026, Phase 3. **Do not deploy until explicitly authorised** (CLAUDE.md §29.3-12).
No secret values appear in this file: names only.

## 1. Current state

- All Phase 1–3 work is **uncommitted** in the working tree. Nothing is pushed or deployed.
- The live site still serves the **pre-audit** bundle (it still contains "500+ clients").
- This phase changed one app file pair: Home's "Explore all 18 services" became "Explore all
  services" (`home.data.ts`), and the unused `CATALOGUE_SIZE` constant was removed. Production has 17 services.
- **Payment surface untouched in Phase 3:** no change to `api/`, `vercel.json`, `src/services/**`,
  checkout hooks, migrations, `.env*`, or pricing.

## 2. Checks run (14 Nov 2026, after the Phase 3 change)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | Pass |
| Lint | `npm run lint` (oxlint) | Pass, exit 0 |
| Unit + integration (incl. 17 payment test files under `api/`) | `npm test` | **447 / 447 pass**, 25 files |
| Build | `npm run build` | Pass. Warning: one 667 kB JS chunk (pre-existing, non-blocking) |
| E2E + axe, 4 viewports (390 / 500 / 768 / 1440) | `npm run test:e2e` | **100 pass, 0 fail**, 4 skipped by design |

E2E intercepts every Supabase, `/api/*` and gateway request; nothing was written to the
database and no payment was created.

## 3. Environment variables (Vercel → Production). Names only

Verified against what the code reads (`api/_lib/config.ts`, `src/lib/supabase`) and `.env.example`.

| Variable | Scope | Required | Notes |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Browser (build time) | Yes | Public by design |
| `VITE_SUPABASE_ANON_KEY` | Browser (build time) | Yes | Public by design; RLS protects data |
| `SUPABASE_URL` | Server | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes | **Never** with a `VITE_` prefix |
| `AIRPAY_MID`, `AIRPAY_CLIENT_ID`, `AIRPAY_SECRET_KEY`, `AIRPAY_API_KEY`, `AIRPAY_USERNAME`, `AIRPAY_PASSWORD` | Server | Yes | Merchant 1. Secret/API-key roles are **swapped** vs Airpay onboarding (PROVEN, AIPAY-DOCS §2.2) |
| Same six with `_2` suffix | Server | Yes | Merchant 2 (AIPAY-DOCS §2.4) |
| `AIRPAY_ENV` | Server | Yes | Not suffixed; explicit, never inferred |
| `CRON_SECRET` | Server | Yes | Bearer for `/api/payments/reconcile`; Vercel Cron sends it |
| `AIRPAY_VERIFY_URL` | Server | No | Leave **unset**, not blank (a blank value fails URL validation and stops all payments) |
| `KKCHAT_CALLBACK_URL` | Server | No | Unset = client-confirmed default; `off` disables relay |
| `PUBLIC_SITE_ORIGIN` | Server | No | Authoritative redirect origin if set |
| `AIRPAY_ACTIVE_MERCHANT` | — | **Must not be relied on** | Appears only in tests, which assert it is ignored; `.env.example` documents that no merchant switch exists |

- [ ] **Not verified (CLI not authenticated here):** run `vercel env ls production` and compare names
      with this table. Do not print values.
- Local `.env` only (not production): merchant-1 Airpay variables use **unprefixed** names
  (`CLIENT_ID`, `USERNAME`, `PASSWORD`, `API_KEY`, `SECRET_KEY`), which the code does not read;
  `USERNAME` also collides with the Windows OS variable. `VITE_SUPABASE_ANON_KEY` is **still
  truncated** (2 of 3 JWT segments; Supabase returns 401). Fix locally by copying the full anon key
  from the Supabase dashboard into the git-ignored `.env`.

## 4. Supabase connectivity

- Local and production point at the same project (`ecknryxkuyjsuppvrhbz`).
- Production anon key works: a read-only catalogue GET on 14 Nov 2026 returned 17 active services.
- [ ] Confirm migration `20260901e_retire_airpay_test_services.sql` is applied (needs dashboard access;
      the anon role cannot see inactive rows). The test services are not publicly visible, which is
      consistent with it being applied.
- [ ] Supabase MCP / dashboard access was not available in this session; the RLS policies and the
      `get_cart` definition were not inspected (see SERVICE-VERIFICATION §4 pre-check 3).

## 5. Airpay gateway selection, callbacks, redirects (reviewed; nothing changed)

| Item | Finding |
|---|---|
| Gateway choice | Native radio group in a `<fieldset>` with legend "Choose payment gateway". Keyboard and screen-reader operable. Browser sends only index `1`/`2`; server validates against an allowlist. |
| Labels | **Both options read "Pay with airpay"** (finding F4). A screen-reader user hears two identical radios, and a sighted user cannot tell them apart. This was the merchant's deliberate choice in commits `b947cc2`/`bc96c02`. **Phase 4:** now "Pay with airpay — Option 1/2"; merchant to confirm (PHASE-4 M8). |
| Callback route | `vercel.json` rewrites `/callback/cpm/arp_frontiva/collection` (with and without trailing slash) → `api/callback/cpm/arp_frontiva/collection.ts` |
| Settlement | Callback → verify server-to-server → settle → relay (KKChat). Covered by `api/` tests (callback, settlement, idempotency, multi-merchant, forwarding). |
| Browser return | 303 to `/order-success?ref=…&t=…`, or `status=unknown`; the page polls `/api/orders/:ref`. E2E covers paid / failed / cancelled / requires_review / missing reference. |
| Reconciliation | Vercel Cron `0 3 * * *` (daily, 03:00 UTC) → `/api/payments/reconcile` |
| Live hand-off | **Not tested.** It would require a real payment, which is forbidden; no sandbox MID is available. |

## 6. Cart drawer at 390 px

- Panel width `min(400px, 100vw − 30px)` = 360 px, anchored right; no horizontal overflow (E2E).
- Checkout-ready state verified in the screenshot: consent, total, "Secured by airpay" and "Pay Now" all visible and legible.
- Finding F5 (unchanged): the sticky footer takes about 45% of the drawer height, which leaves a small
  scroll area for items, gateway choice and contact fields. Usable, but tight. Optional UX follow-up.
- QA note: `e2e/flows.spec.ts` takes the `cart-drawer` screenshot during the 220 ms slide-in, so that
  frame shows the panel partly off-screen. It is a capture-timing artefact, not a layout bug.

## 7. Before authorising a deploy

- [ ] `LEGAL` values entered and checked against source documents (MERCHANT-DETAILS §A–C)
- [ ] Fintech/Collection decision applied in Supabase **and** in code (SERVICE-VERIFICATION §4)
- [ ] Policies approved; `POLICY_META.version` / `effectiveDate` set (LEGAL-APPROVAL §E)
- [ ] Gateway label decision recorded (§5)
- [ ] `vercel env ls production` names match §3
- [ ] Re-run §2 checks; all green
- [ ] Review `git diff` (confirm no `api/`, `vercel.json`, migration or pricing change unless approved)
- [ ] Commit, push and deploy **only with explicit authorisation**
- [ ] After deploy: load the live site, confirm the new bundle (no "500+ clients"), and that CIN, GSTIN,
      directors and the Grievance Officer render; repeat the read-only catalogue check
- [ ] Only then request bank re-screening
