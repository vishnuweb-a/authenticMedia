# ISGPay Production — Phase 2: database preparation, live-test controls, release safety

Status: **code ready, everything live remains off.** Nothing here applied a migration, changed a Vercel variable, deployed, or started any payment (sandbox or live). Builds on [ISGPAY-PRODUCTION-READINESS.md](ISGPAY-PRODUCTION-READINESS.md) (Phase 1) and the protocol notes in [ISGPAY-UAT-PHASE1.md](ISGPAY-UAT-PHASE1.md).

**The integration is NOT live-payment-ready.** Production Status verification, merchant activation, credential rotation and callback registration are all unconfirmed (§12).

---

## 1. Git branch and commit

| Item | Value |
| --- | --- |
| Feature branch | `feat/isgpay-production-readiness` (based on `origin/main` = `fa530b2`) |
| Phase 1 commit | `931d98c` |
| Phase 2 commit | the commit that adds this file (see `git log`) |
| Route fix (separate branch) | `fix/order-success-guest-return` → `5e1cec5`, based on `78db26e` (§6) |

No force-push, reset or rebase happened. `78db26e` was not merged into the payment branch.

### Which commit serves authenticmedia.fun?

| Ref | Commit | Route guards |
| --- | --- | --- |
| `origin/main` | `fa530b2` | none: all site pages public |
| `origin/feat/isgpay-integration-uat` | `78db26e` | members-only, **including `/order-success`** |
| `origin/feat/isgpay-production-readiness` | `931d98c` → Phase 2 | none (descends from `fa530b2`) |

**Finding (evidence, not a Vercel record):** the deployed bundle `assets/index-BZrTqlaN.js` fetched from `https://authenticmedia.fun` has its route table with `home, services, services/:slug, about, contact, faq, orderSuccess, account` all inside one `RequireAuth` group. That is the `78db26e` route table; `fa530b2` has `orderSuccess` public. So **Production is serving `78db26e`-equivalent code, not `fa530b2`**, and Phase 1's "deployed = `fa530b2`" statement was wrong.

Limits of this check: this machine has neither the `vercel` nor the `gh` CLI, and the Supabase/Vercel connectors are unauthenticated, so the **deployment record (commit SHA, deployment id, environment) was not read from Vercel**. `78db26e` is the only commit on any remote with that route table, so it is the near-certain commit, but confirm in Vercel → Deployments → Production before Phase 3.

**Merge hazard (important):** deploying `feat/isgpay-production-readiness` as it is would **remove the members-only gate** from the live site, because it descends from `fa530b2`. Whoever merges must merge `78db26e` (or `main` after it lands there) and `fix/order-success-guest-return` together with the payment branch. Merge order proposal in §13.

---

## 2. Database migration review (`20261119_isgpay_gateway_environment.sql`)

**Method:** desk review against the repository's migrations. **It was not executed anywhere**: there is no local Postgres, Docker Desktop's engine is not running on this machine, and the Supabase connector is unauthenticated. No connected database was assumed to be staging, and none was touched. The base `orders`, `services`, `order_items` and `payments` tables are created outside this repository's migrations, so a faithful local replay is not possible from the repo alone.

| Check | Result |
| --- | --- |
| `20261117_isgpay_uat_orders.sql` present | yes; it creates the legacy 3-arg `create_isgpay_order` and `settle_isgpay_order`, and widens `payment_method`/`provider` checks |
| New RPC signatures | `create_isgpay_order(text[], text, uuid, text, text, text, text)`; `settle_isgpay_order(text, text, text, text)` |
| Overload resolution | no ambiguity. The new create has a required `p_gateway_environment` (no default), so a 3-argument call can only match the legacy function and a 7-argument named call only the new one. The new settle's 4th argument is required, so a 3-argument call matches only the legacy one. PostgREST resolves RPC overloads by the named-argument set |
| Prices from the active catalogue | yes: `sum(s.price_inr) … where s.slug = any(p_service_slugs) and s.is_active`; the caller sends slugs only. `create.ts` additionally refuses if any slug is missing/inactive, so a subset is never charged |
| Environment and contact columns | `gateway_environment` is added (nullable, CHECK `null or uat/production`). `contact_name/email/phone` and `guest_token` already exist: `20260831_airpay_settlement.sql` inserts into them |
| anon / authenticated cannot execute | `revoke all … from public, anon, authenticated` on every new function and the re-created legacy settle. **Added this phase:** explicit `grant execute … to service_role` for all three, so the model is stated, not inherited from default privileges |
| `SECURITY DEFINER` model | functions run as owner with `set search_path = public`, every table reference is schema-qualified (`public.orders`…), and no dynamic SQL is used. Only the service role (the server) can call them |
| Additive; Airpay untouched | yes. One nullable column, one CHECK, new overloads, one **narrowing** of the legacy ISGPay settle (UAT rows only), one index. No row is rewritten, no Airpay function/column/row changes. The only changed existing function is the **ISGPay** 3-arg settle |
| **Added this phase** | partial index `orders_isgpay_guest_pending_idx (guest_token, created_at desc) where payment_method='isgpay' and status='pending_payment'` for the duplicate-payment lookup |

Recommendations (not done, judged out of scope):

1. Supabase's advisor prefers `set search_path = ''` (or `public, pg_temp`) on `SECURITY DEFINER` functions. It was not changed because the existing deployed Airpay/ISGPay functions use `public`, execute is restricted to the service role, and an untested change to the empty search path (e.g. `returning orders.id`) is riskier than the finding. Re-run the Supabase security advisor after applying and decide then.
2. The Supabase **security advisors and current docs were not consulted** (connector unavailable here). Run `get_advisors` (security + performance) on the staging branch.

### Required production database changes

Exactly one migration file: `20261119_isgpay_gateway_environment.sql`, applied **before** code that calls the 4-argument functions. The production-readiness code also needs nothing else (the duplicate guard and the reconcile sweep use existing columns plus the new index).

### Staging validation

**Not performed** (no staging database reachable). Required before production, on a Supabase branch or a disposable project cloned from production schema:

1. Apply the migration. Expect no errors on a re-run (`if not exists`, `create or replace`).
2. `select proname, pg_get_function_identity_arguments(oid) from pg_proc where proname in ('create_isgpay_order','settle_isgpay_order');` → 2 + 2 overloads.
3. As `anon` and `authenticated`: each `rpc` call returns `permission denied for function`. As `service_role`: succeeds.
4. Create a `uat` and a `production` order through the new function; settle the `production` one with `p_gateway_environment='uat'` → returns null (no change); with `'production'` → paid. Legacy 3-arg settle on the production row → null.
5. Existing legacy ISGPay rows read `gateway_environment is null`; Airpay rows unchanged (compare a before/after row count and checksum).

### Rollback / recovery

The migration is backward-compatible with the code on `fa530b2`/`78db26e`, so the first step is always **code**, not SQL.

1. Disable first: `ISGPAY_PRODUCTION_LAUNCH_ENABLED=false`, `ISGPAY_LIVE_PRIVATE_TEST_ENABLED=false`, `ISGPAY_CHECKOUT_ENABLED=false`, redeploy.
2. Only if the schema must be reverted, and **only while no `gateway_environment='production'` row exists** (check `select count(*) from public.orders where gateway_environment='production'` → must be 0):
   - `drop index if exists public.orders_isgpay_guest_pending_idx;`
   - `drop function if exists public.create_isgpay_order(text[], text, uuid, text, text, text, text);`
   - `drop function if exists public.settle_isgpay_order(text, text, text, text);`
   - re-run the legacy 3-arg `settle_isgpay_order` body from `20261117_isgpay_uat_orders.sql` (removes the UAT-only predicate);
   - the column and its CHECK may stay (nullable, harmless). Dropping the column loses the sandbox/live distinction, so do not.
3. If production rows exist, never delete them and never mark them paid or failed by hand: leave them for the verified reconcile path.

---

## 3. Tester-only live checkout

Two independent switches, both **off by default**, both honoured only on the Vercel **Production** deployment with `ISGPAY_ENV=production`:

| Switch | Meaning |
| --- | --- |
| `ISGPAY_PRODUCTION_LAUNCH_ENABLED=true` | public launch, every shopper (unchanged from Phase 1) |
| `ISGPAY_LIVE_PRIVATE_TEST_ENABLED=true` + `ISGPAY_LIVE_TESTER_USER_IDS=<uuid,uuid>` | private test: only listed accounts |

Rules, all in `api/_lib/isgpay-checkout.ts` and enforced by **both** `GET` (checkout availability) and `POST` (payment creation) of `/api/payments/isgpay/create`:

- Identity is the server-side session: the HttpOnly `__Host-am_session` cookie → `findSessionUser(hashToken(token))` (the existing custom auth RPC). Not a browser flag, a profile field, a request body field or the guest token.
- The account must have `email_verified_at` set. Operator-provisioned verified accounts qualify; self-registered unverified accounts never do, even if their id were listed.
- Matching is by immutable **user id** (UUID), never by email or name, which the user can influence. Malformed entries in the allowlist are dropped; an empty allowlist means nobody.
- `ISGPAY_UAT_ACCESS_KEY` and the sandbox tester cookie have no effect on live money (tested). Sandbox testing keeps its own path and is independent.
- Any error in the session lookup → closed. The answer for "not a tester" and "disabled" is the same 404 on POST and `available:false` on GET.
- The audit log records the tester's user id (`liveTester`) on `isgpay.checkout.initiated`; no contact data or credentials.

Even with both switches on, `ISGPAY_ENV=production` still cannot load until a reviewed code change sets the confirmed production Status URL (Phase 1 §6), so this is double-gated until ISGPay answers.

Tests: `api/payments/isgpay/isgpay-phase2.test.ts` — allowlisted verified user succeeds; guest, other user, unverified user, flag off/odd-case, empty/invalid allowlist, session error, UAT key + sandbox cookie + client-sent flags, Preview deployment, and master flags off are all refused with no order created.

---

## 4. Payment-return accessibility

Finding: on the live code (`78db26e`) `/order-success` sits inside `RequireAuth`, so a shopper returning from Airpay or ISGPay while signed out (new browser, expired session, in-app browser, or a payment opened in another window) is redirected to `/login` **instead of seeing their payment result**. The return handlers (`/api/payments/isgpay/return`, Airpay's return) 303 to `/order-success?ref=…&t=…`; the guard fires before the page loads. Sign-in cannot be required to read a payment result.

Fix: **`fix/order-success-guest-return` (`5e1cec5`, based on `78db26e`)**: moves the `orderSuccess` route out of `RequireAuth` into the public group, next to the legal pages. It changes nothing else. The existing access-token validation is unchanged: the API (`/api/payments/isgpay/status`, `/api/orders/status`) returns the same single 404 for a wrong token, an unknown order or a non-ISGPay order, and the page only shows what the order's own token unlocks.

On the payment branch the route is already public (it descends from `fa530b2`), so no change was needed there.

Tests:

| Case | Where | Result |
| --- | --- | --- |
| Guest returning from a successful payment (paid, live) sees the result with the token alone; token not echoed | `isgpay-flow.test.ts` | pass |
| Guest returning with pending status sees pending; nothing settled | same | pass |
| Wrong / empty / truncated token → same 404 as an unknown order | same | pass |
| Unsigned/malformed callback → 400, nothing settled | same | pass |
| Forged `SecureHash` on return → `/order-success?status=unverified`, token not leaked, nothing settled | same | pass |
| Existing Airpay return behaviour | existing `browser-return.test.ts`, `callback*.test.ts`, `multi-merchant*.test.ts` | unchanged and passing |
| Signed-out browser reaches `/order-success` (Airpay + ISGPay links) | e2e on the fix branch, desktop-1440 | pass; **fails without the route change** (redirects to `/login`; verified by stashing the fix) |

Token **expiry**: orders have no token expiry in the schema today (the token is a per-order UUID valid for the life of the order). "Expired" is therefore not a state the server can produce; this is stated, not tested. If expiry is wanted it needs a schema change (a later phase).

---

## 5. Duplicate-payment protections

The Phase 1 risk: a retry creates a new order (new TxnRefNo) while the first attempt may still be approved later, so the customer could pay twice.

Implemented (`api/payments/isgpay/create.ts`, live orders only; UAT sandbox behaviour is unchanged):

1. Before creating an order, look up the shopper's newest still-`pending_payment` ISGPay order in the same environment inside a **24-hour window** (`UNRESOLVED_ATTEMPT_WINDOW_MS`: past ISGPay's callback retries, and across at least one daily reconcile run).
2. If one exists, run **one fresh verified Status Query** on it through the existing single settlement path (`settleIsgpayOrder`).
   - `paid` / `requires_review` / already settled → the earlier attempt is resolved; a new purchase may proceed.
   - anything else (pending, declined-but-not-final, unknown order, timeout, thrown error, unreadable answer) → **HTTP 409 `payment_unresolved`, no order is created**. A timeout is never read as "failed".
3. If the duplicate lookup itself fails → 502, **no order**. Unknown means "an earlier attempt may exist".
4. The earlier order and its `TxnRefNo` are never modified, replaced or reused, so they stay available for investigation. Inconclusive responses leave the order `pending_payment` (unchanged settlement rule: only a verified `00` with matching MerchantId/TerminalId/BankId/TxnRefNo/Currency/Amount marks paid).
5. The browser shows: "We are still confirming your earlier payment attempt. Please wait a few minutes before paying again, so you are not charged twice." The existing pending-guard still keeps one click to one order.

Tests: `isgpay-phase2.test.ts` (block after a verification; pending / declined_pending / unknown_order / throw all block; paid → allowed; lookup failure → 502; none → normal; UAT unaffected) and the adapter test for the 409 mapping.

**Known limits (stated, not hidden):**

- **Concurrency:** two requests inside the same few milliseconds from one guest token could both pass the check; the second would not see the first order yet. The UI disables the button during the request and the one-click guard exists; a hard guarantee needs an atomic check inside `create_isgpay_order` (advisory lock + existence check). That SQL could not be tested here, so it was **not** added. Do it in Phase 3 together with staging validation.
- **A genuine, final decline also blocks a retry for up to 24 h** until a final verdict is known. This is the deliberate cost of not guessing ISGPay's codes. It affects live (tester) orders only.
- The block is keyed on the browser's guest token. A shopper who clears storage gets a new token and is not blocked; closing that needs customer identity, which guest checkout does not have.

### What ISGPay must confirm before final retry logic is enabled

Do **not** guess these: (1) the list of **final-failure** ResponseCodes (safe to retry with a new order) versus **retryable/ambiguous** ones; (2) whether a Status Query for an abandoned (never-submitted) TxnRefNo returns a definitive "not found/never attempted"; (3) how long a hosted payment session stays payable after the Sale POST (this should set the window); (4) whether a duplicate TxnRefNo is rejected by the gateway (would allow a safe idempotent re-submit of the same order instead of a new one); (5) whether late approvals after a decline/timeout are possible and how they are notified.

---

## 6. Reconciliation (ISGPay)

Airpay's sweep (`/api/payments/reconcile`, daily cron) selects `payment_method='airpay'` only and is **unmodified**. ISGPay got its own endpoint:

`GET|POST /api/payments/isgpay/reconcile` (`api/payments/isgpay/reconcile.ts`)

- `CRON_SECRET` bearer required (404 otherwise, like Airpay).
- **Off** unless `ISGPAY_RECONCILE_ENABLED=true` (returns `{enabled:false}` otherwise). **Not added to `vercel.json` crons**, so nothing schedules it.
- Selects ISGPay `pending_payment` orders **of the configured environment only** (`findUnsettledIsgpayOrders`): `production` rows for production, `uat`/legacy-NULL for UAT; never Airpay; 5 minutes to 7 days old; 25 per run, oldest first.
- Each order goes through `settleIsgpayOrder` (the single settlement function): fresh SecureHash-verified Status Query with the order's **own** environment credentials, merchant/terminal/bank/TxnRefNo/currency/exact-amount checks, one idempotent conditional SQL update pinned to that environment. The sweep itself writes nothing and cannot mark an order paid; a redirect never settles.
- Verified decline, inconclusive, timeout, unreadable → stays pending. Amount mismatch → `requires_review`.
- Logs `isgpay.reconcile.swept` with counts only; no TxnRefNo list, amounts, credentials or customer data.
- Production cannot run it: `loadIsgpayConfig` refuses `ISGPAY_ENV=production` while the Status endpoint is unconfirmed (the sweep answers 503).

Status: **built and mock-tested, live execution disabled.** Tests (`isgpay-phase2.test.ts`): needs the secret; inert by default; environment-scoped selection; per-order failure does not stop the sweep; never writes itself; 503 when config cannot load.

Not covered: nothing exercises the real Status transport. Enabling needs ISGPay's confirmation (§12 items 2–3) and a scheduled entry in `vercel.json` in a reviewed change.

---

## 7. Vercel environment separation — change plan

**Not applied, and not audited live:** no Vercel access from this session (no CLI/connector auth). The plan below is from `.env.example`, the code, and the Phase 1 variable list. Before changing anything, export the current names and scopes (`vercel env ls`, names and scopes only, never values) and diff against this plan.

**Incident requirement:** the screenshot that was shared contained **live secrets**. Treat every value in it as exposed. Obtain **rotated** credentials from ISGPay through a secure channel before installing anything in Production, and discard the exposed set. Do not paste values into chat, tickets or source.

### Preview (and Development)

Scope each variable to **Preview** (and Development) only; none may be "All Environments".

| Variable | Value |
| --- | --- |
| `ISGPAY_ENV` | `uat` |
| `ISGPAY_ENABLED`, `ISGPAY_CHECKOUT_ENABLED` | `true` only where sandbox testing is wanted |
| `ISGPAY_BANK_ID`, `ISGPAY_MERCHANT_ID`, `ISGPAY_TERMINAL_ID`, `ISGPAY_MCC`, `ISGPAY_PASSCODE`, `ISGPAY_SECURE_SECRET`, `ISGPAY_ENC_KEY` | UAT credentials (Sensitive) |
| `ISGPAY_CURRENCY` | `356` |
| `ISGPAY_SALE_URL` / `ISGPAY_STATUS_URL` | `https://sandbox.isgpay.com/ISGPay-Genius/request.action` / `…/Status` |
| `ISGPAY_RETURN_URL` / `ISGPAY_CALLBACK_URL` | the deployment's own `*.vercel.app` URLs (accepted only on Preview), or unset if not testing returns |
| `ISGPAY_UAT_ACCESS_KEY` | ≥ 24 random chars (sandbox tester pages) |
| `ISGPAY_PRODUCTION_LAUNCH_ENABLED`, `ISGPAY_LIVE_PRIVATE_TEST_ENABLED`, `ISGPAY_RECONCILE_ENABLED` | `false` / unset |
| **Must not exist here** | any production ISGPay credential, `ISGPAY_LIVE_TESTER_USER_IDS` |

(The code refuses `ISGPAY_ENV=production` off the Production deployment, but secrets must still not be present.)

### Production — initial state after rotation (everything real-money OFF)

| Variable | Value |
| --- | --- |
| `ISGPAY_ENV` | `production` |
| `ISGPAY_ENABLED` | `false` |
| `ISGPAY_CHECKOUT_ENABLED` | `false` |
| `ISGPAY_PRODUCTION_LAUNCH_ENABLED` | `false` |
| `ISGPAY_LIVE_PRIVATE_TEST_ENABLED` | `false` |
| `ISGPAY_LIVE_TESTER_USER_IDS` | empty until Phase 3 approval |
| `ISGPAY_RECONCILE_ENABLED` | `false` |
| `ISGPAY_MERCHANT_ID`, `ISGPAY_BANK_ID`, `ISGPAY_TERMINAL_ID`, `ISGPAY_MCC`, `ISGPAY_PASSCODE`, `ISGPAY_SECURE_SECRET`, `ISGPAY_ENC_KEY` | **rotated** production values, Sensitive |
| `ISGPAY_CURRENCY` | `356` |
| `ISGPAY_SALE_URL` | the production Sale URL **as confirmed by ISGPay** (proposed `https://isgpay.com/ISGPay-Genius/request.action`; also requires the reviewed code change in Phase 1 §6) |
| `ISGPAY_STATUS_URL` | production Status URL **after ISGPay confirms it** (code change required; an env var alone cannot enable it) |
| `ISGPAY_RETURN_URL` | `https://authenticmedia.fun/api/payments/isgpay/return` |
| `ISGPAY_CALLBACK_URL` | `https://authenticmedia.fun/api/payments/isgpay/callback` (must be registered with ISGPay for the production MID) |
| `CRON_SECRET` | already used by Airpay's cron; keep one strong value |
| `ISGPAY_UAT_ACCESS_KEY`, `ISGPAY_UAT_WEBSITE_TEST_ENABLED` | unset |

No `VITE_`, `NEXT_PUBLIC_` or `REACT_APP_` prefix on any ISGPay or Airpay variable. Each change needs a fresh deployment. Steps and order: Phase 1 §13, with this Phase's variables added.

---

## 8. Implemented — files

| File | Change |
| --- | --- |
| `api/_lib/isgpay-checkout.ts` | async `isgpayCheckoutAccess`; private live-test authorisation (`liveTesterId`) |
| `api/payments/isgpay/create.ts` | uses the async gate; unresolved-attempt guard; 409 |
| `api/_lib/db.ts` | `findUnresolvedIsgpayOrder`, `findUnsettledIsgpayOrders` (new; Airpay queries untouched) |
| `api/payments/isgpay/reconcile.ts` | new, disabled, unscheduled |
| `src/services/payment/isgpay-adapter.ts` | maps 409 to a wait message |
| `supabase/migrations/20261119_…sql` | explicit grants + guest-pending index (still **not applied**) |
| `.env.example` | `ISGPAY_LIVE_PRIVATE_TEST_ENABLED`, `ISGPAY_LIVE_TESTER_USER_IDS`, `ISGPAY_RECONCILE_ENABLED` (names, placeholders) |
| Tests | `isgpay-phase2.test.ts` (new), `isgpay-flow.test.ts` (guest return), `create-production.test.ts` (mock), `isgpay-adapter.test.ts` |
| Route fix | on `fix/order-success-guest-return`, not on this branch |

---

## 9. Test results (actual, this machine, no network, no database, no payment)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` (oxlint) | pass (exit 0) |
| `npm test` (Vitest) | **40 files, 838 tests passed** (Phase 1: 39 / 810). One earlier run had a 5 s timeout in the unrelated `src/lib/site.test.ts` while Playwright ran concurrently; it passed on the clean re-run |
| `npm run build` | pass (only the existing >500 kB chunk warning) |
| `npx playwright test` on this branch (4 viewports, network mocked) | **188 passed, 8 skipped** (skips pre-existing) |
| `npx playwright test` on `fix/order-success-guest-return` | **188 passed, 8 skipped**, including the new signed-out return test; that test **fails** without the route change |
| Bundle scan of `dist/` | no match for `ISGPAY_`, `SECURE_SECRET`, `PASSCODE`, `ENC_KEY`, `SERVICE_ROLE`, `LIVE_TESTER`, `CRON_SECRET` |
| SQL migration execution | **not run** (no database available) |
| Real gateway, real payment | **not run, by design** |

---

## 10. Verification of the required properties

| Property | How verified |
| --- | --- |
| Legacy UAT orders remain test orders | Phase 1 tests (NULL/`uat` → `testMode: true`, even when paid); migration adds no backfill |
| Production orders cannot be created when disabled | `create-production.test.ts`, `isgpay-phase2.test.ts` |
| Tester-only access enforced server-side | `isgpay-phase2.test.ts` (POST returns 404, GET `available:false`, no RPC) |
| Guest returns work with valid tokens | `isgpay-flow.test.ts`; e2e on the fix branch |
| No silent double charge | duplicate guard tests; limits in §5 |
| Inconclusive responses never mark paid | `isgpay-flow.test.ts`, `isgpay.test.ts`; sweep and guard tests |
| Airpay merchants 1 and 2 unchanged | no Airpay module edited; all Airpay suites pass; `git diff` touches none |
| No sensitive values in bundles or logs | `dist/` scanned for `ISGPAY_`, `SECURE_SECRET`, `PASSCODE`, `ENC_KEY`, `SERVICE_ROLE`, `LIVE_TESTER`, `CRON_SECRET`: no matches; log assertions in the production tests |

---

## 11. Known limitations

- Migration and SQL overloads **not executed** anywhere; staging validation outstanding (§2).
- Vercel deployment record and variable scopes **not read**; the live-commit finding rests on the deployed bundle (§1).
- Race window on concurrent first requests in the duplicate guard (§5).
- Order access tokens have no expiry in the schema (§4).
- The ISGPay Status transport is still unproven against the real gateway; the sweep and every settle depend on it.

---

## 12. Missing ISGPay approvals and confirmations

1. Production MID activation and written go-live approval.
2. Production **Status** URL, transport (body vs query string, content type), response format and response hashing.
3. Production **Sale** URL for this merchant (proposed host unconfirmed).
4. Whether production uses the same AES mode, padding and key handling as UAT.
5. ReturnURL handling and callback registration for the production MID; acknowledgement wire format.
6. Final vs retryable ResponseCodes; Status result for abandoned transactions; session lifetime; duplicate-TxnRefNo behaviour; late approvals (§5).
7. Enabled payment modes on the production MID.
8. Whether `Amount` is always present in successful Status responses.
9. **Rotated** credentials via a secure channel (the earlier set was exposed in a screenshot).
10. A recorded, supervised UAT sale (AES mode / Status transport / response hashing evidence).

---

## 13. Next actions — Phase 3 (each needs explicit approval)

1. Confirm the Production deployment commit in Vercel.
2. Merge order: land `78db26e` → `main`; merge `fix/order-success-guest-return`; then merge this branch. Re-run the e2e suite on the merged result.
3. Staging: apply the migration to a Supabase branch, run the §2 checklist and the Supabase advisors; add the atomic duplicate guard in SQL and test it.
4. Collect the §12 confirmations; then a reviewed code change for the production Status URL/transport and (if different) Sale URL.
5. Rotate credentials; install Preview then Production variables per §7 (all real-payment gates off); deploy; run the no-payment verification list (Phase 1 §13 step 6).
6. Apply the migration to production (separate approval), read-only checks.
7. Enable reconcile in a reviewed change (`vercel.json` cron + `ISGPAY_RECONCILE_ENABLED=true`).
8. A single supervised live test through the private allowlist (`ISGPAY_LIVE_PRIVATE_TEST_ENABLED=true`, one verified operator account) with a minimal amount; verify settlement, reconcile, return page and refund path; then decide on public launch.
