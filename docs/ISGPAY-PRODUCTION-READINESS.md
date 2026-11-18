# ISGPay Production Readiness — Phase 1

Status: **code ready, production disabled.** Branch `feat/isgpay-production-readiness`. Nothing here was deployed, no environment variable was changed, no migration was applied, and no gateway transaction (sandbox or live) was started.

This document sits on top of [ISGPAY-UAT-PHASE1.md](ISGPAY-UAT-PHASE1.md), which stays the protocol reference (SecureHash, EncData, AES, Sale and Status fields). The ISGPay production-migration guide describes another project (Firvanra) and is not in this repository. Only its concepts and its proposed production Sale host were used. No code was copied from it.

---

## 1. Current code audit

### Where ISGPay was hard-wired to UAT (before this branch)

| Location | Hard-wiring | Now |
| --- | --- | --- |
| `api/_lib/isgpay-config.ts` | `type IsgpayEnv = 'uat'`; anything else threw | `'uat' \| 'production'`, with an explicit endpoint table |
| `api/payments/isgpay/create.ts` | `testMode: true` in GET and POST | `config.env !== 'production'` |
| `api/payments/isgpay/status.ts` | `testMode: true` ("every ISGPay order is UAT") | from the **stored** `orders.gateway_environment` |
| `api/payments/isgpay/uat.ts` | relied on config being UAT-only | refuses unless `config.env === 'uat'`; stamps `uat` |
| `api/_lib/isgpay-checkout.ts` | sandbox/tester rule only | adds the production launch gate |
| `supabase/migrations/20261117_isgpay_uat_orders.sql` | no environment column; settle any `isgpay` row | additive migration `20261119_…` (§8) |
| `src/services/payment/isgpay-adapter.ts` | only the sandbox URL allowed; `testMode: true` | sandbox **or** production URL, pinned to the server-reported mode |
| `src/features/cart/hooks/use-order-status.ts` | `testMode` from the `ISG…` reference format | server-reported, with the reference format as a safe fallback |
| `src/features/cart/components/checkout-merchant-choice.tsx` | fixed label "Pay with ISGPay — Sandbox Test" | "Pay with ISGPay" only when the server reports live |

### What was already correct and is preserved

- The Sale contract: four outer fields; the required EncData fields; SecureHash inside EncData; no `Version`; SHA-256 hash; AES-256-ECB/PKCS#7 with the 32-character key's own bytes; Base64; server-side paise via BigInt; `ISG…` 27-character TxnRefNo; non-PCI hosted POST with no card data.
- Settlement discipline: return, callback and status page only **prompt** a fresh, SecureHash-verified Status Query. `evaluateTransaction` checks MerchantId, TerminalId, BankId, TxnRefNo, Currency, the exact Amount and `ResponseCode === '00'`. A mismatch goes to `requires_review`. A decline or an inconclusive result stays pending. There is one conditional SQL update (idempotent).
- Airpay isolation: every Airpay path filters `payment_method = 'airpay'`. ISGPay never reaches `settle_airpay_order`, the reconcile sweep or the KKChat relay. Tests confirm this.

### Gaps found (not fixed in Phase 1; see §10 and §14)

1. **No ISGPay reconciliation sweep.** The daily cron covers Airpay only. An ISGPay order whose shopper closes the tab, and whose callback never arrives, stays `pending_payment` until someone opens its status link. For UAT this is acceptable. For production, a sweep is needed before launch, and it needs the confirmed Status API.
2. **Retry can double-charge in one edge case.** A verified decline leaves the order pending, and "try again" creates a **new** order (a new TxnRefNo). If the bank later approves the first attempt, both orders settle as paid. Each is genuinely paid, so nothing is mis-settled, but the customer is charged twice and needs a refund. This needs ISGPay's terminal-vs-retryable code list (UAT doc Q9).
3. **UAT live behaviour is not recorded here.** This repository holds no evidence that a supervised UAT sale has confirmed AES mode, Status transport or response hashing (UAT doc Q1/Q2). Production must not launch before that UAT sale passes.

---

## 2. Git branch reconciliation

| Ref | Commit | Meaning |
| --- | --- | --- |
| `origin/main` | `fa530b2` | Merge of PR #2. **Currently deployed to Vercel Production** (GitHub deployment record, 2026-11-17 11:30 UTC, success). |
| `origin/feat/isgpay-integration-uat` | `78db26e` | `1989f8f` + one unmerged commit, "feat(auth): require sign-in to view site content" |

The two have "diverged" only in commit graph shape. The tree of `fa530b2` is **identical** to `1989f8f` (`git diff 1989f8f fa530b2` is empty). The only content difference is `78db26e`, which touches exactly the four files listed in the brief (`e2e/flows.spec.ts`, `e2e/support/mocks.ts`, `route-guards.tsx`, `routes/index.tsx`). It is an unrelated, undeployed auth/UX change.

**Base chosen: `origin/main` (`fa530b2`), the production revision.** This keeps the payment PR free of the unrelated route change, and `78db26e` stays untouched on its own branch. One interaction to note for whoever merges `78db26e`: it puts `/order-success` behind sign-in. An ISGPay or Airpay shopper who returns signed out would then be bounced to `/login` before seeing their payment result. Review that before merging it.

Local untracked files (`YesBankPG-NodeJSKit (1).zip`, `supabase/migrations/20260901c|d|e_*.sql`) predate this work and were not committed.

---

## 3. Changed files

| File | Change |
| --- | --- |
| `api/_lib/isgpay-config.ts` | `uat \| production`; endpoint table; production restricted to `VERCEL_ENV=production`; fails closed while production Status is unconfirmed |
| `api/_lib/isgpay-checkout.ts` | production launch gate `ISGPAY_PRODUCTION_LAUNCH_ENABLED` |
| `api/_lib/isgpay-settle.ts` | verifies only with the order's own environment; passes the environment to SQL |
| `api/_lib/db.ts` | new `findIsgpayGatewayEnvironment` (a separate query; Airpay's `findOrderByRef` is unchanged) |
| `api/payments/isgpay/create.ts` | stamps the environment, stores contact details, real `testMode` |
| `api/payments/isgpay/status.ts` | `testMode` from the stored environment |
| `api/payments/isgpay/uat.ts` | sandbox only; stamps `uat` |
| `supabase/migrations/20261119_isgpay_gateway_environment.sql` | **new, not applied** (§8) |
| `src/services/payment/isgpay-adapter.ts`, `src/services/{index,payment/index}.ts` | production URL allowlisted; mode/URL pairing enforced |
| `src/features/cart/hooks/use-checkout.ts`, `components/cart-drawer.tsx`, `components/checkout-merchant-choice.tsx` | `isgpayTestMode` and the live label |
| `src/features/cart/hooks/use-order-status.ts` | server-reported `testMode` |
| `.env.example` | UAT and production blocks, placeholders only, credential mapping |
| Tests | `api/_lib/isgpay-production-config.test.ts` (new), `api/payments/isgpay/create-production.test.ts` (new), plus extensions to `isgpay-config`, `create`, `isgpay-flow`, `isgpay-adapter` and `checkout-merchant-choice` tests and the shared fixture |
| `docs/ISGPAY-PRODUCTION-READINESS.md` | this file |

Unchanged: every Airpay module (`config.ts`, `airpay*.ts`, `settle.ts`, `callback-*`, `relay.ts`, `payments/create.ts`, `reconcile.ts`, `orders/status.ts`), `vercel.json`, the crypto module and the Sale builder.

---

## 4. Credential-name mapping (names only)

| Credential sheet | Variable | Validation (v1.6) |
| --- | --- | --- |
| MERCHANT_CODE | `ISGPAY_MERCHANT_ID` | 1–16 alphanumeric |
| BANK_ID | `ISGPAY_BANK_ID` | 6 alphanumeric, **string** (leading zeros kept) |
| TERMINAL_ID | `ISGPAY_TERMINAL_ID` | 8 alphanumeric, string |
| MCC CODE | `ISGPAY_MCC` | 4 digits |
| ACCESS_CODE / PASS_CODE | `ISGPAY_PASSCODE` | 8 alphanumeric |
| SECURE SECRET / SALT | `ISGPAY_SECURE_SECRET` | 16–128 alphanumeric |
| ENC_KEY | `ISGPAY_ENC_KEY` | exactly 32 printable ASCII characters; its bytes are the AES-256 key (not hex-decoded) |
| MERCHANT_NAME | — | business identification only; not a Sale field, not configured |

- Firvanra's `ISGPAY_PASS_CODE` is **not** read (a test confirms it).
- `ISGPAY_UAT_ACCESS_KEY` unlocks the sandbox tester pages. It is unrelated to ACCESS_CODE and is never sent to ISGPay.
- If a production value fails a shape rule (for example, a MerchantId longer than 16 characters), the config refuses to load and names the variable, never the value. Do not loosen a rule until ISGPay confirms the format.

---

## 5. UAT versus production configuration

| | UAT | Production |
| --- | --- | --- |
| `ISGPAY_ENV` | `uat` | `production` |
| Runs on | Preview, local, Production deployment (tester-gated) | **Vercel Production deployment only** (`VERCEL_ENV=production`, otherwise ConfigError) |
| Sale URL | `https://sandbox.isgpay.com/ISGPay-Genius/request.action` | `https://isgpay.com/ISGPay-Genius/request.action` (proposed) |
| Status URL | `https://sandbox.isgpay.com/ISGPay-Genius/Status` | **unconfirmed → config refuses to load** |
| Checkout visibility | `ISGPAY_CHECKOUT_ENABLED=true`; on Production also a tester cookie | `ISGPAY_CHECKOUT_ENABLED=true` **and** `ISGPAY_PRODUCTION_LAUNCH_ENABLED=true`; the tester cookie does **not** apply |
| Label | "Pay with ISGPay — Sandbox Test" + warning | "Pay with ISGPay" |
| Orders | `gateway_environment = 'uat'` (or legacy NULL); `testMode: true` | `gateway_environment = 'production'`; `testMode: false` |
| `/api/payments/isgpay/uat` | available (key + flags) | refuses to create orders |

Fail-closed rules (all tested):

- Only `uat` or `production` is accepted.
- Every gateway URL must be the exact pinned endpoint for that environment. Sandbox URLs are rejected under production and production URLs under UAT. HTTP, other ports, other paths, look-alike hosts, `www.`, userinfo, queries and fragments are all rejected.
- Return and callback URLs must be HTTPS on `authenticmedia.fun` or `www.authenticmedia.fun`. They cannot carry a query string, a port or credentials, and cannot point at the Airpay callback. Preview `*.vercel.app` hosts are accepted only on Preview, so never in production.
- The client never chooses an environment, a URL or an amount (tested: injected `environment`/`actionUrl` fields are ignored).

---

## 6. Endpoints and their status

| Endpoint | Value | Status |
| --- | --- | --- |
| UAT Sale | `https://sandbox.isgpay.com/ISGPay-Genius/request.action` | from the UAT onboarding |
| UAT Status | `https://sandbox.isgpay.com/ISGPay-Genius/Status` | from the UAT onboarding; transport UNCONFIRMED (UAT doc Q2) |
| Production Sale | `https://isgpay.com/ISGPay-Genius/request.action` | **PROPOSED** (migration guide). Needs ISGPay confirmation for this MID. |
| Production Status | — | **UNCONFIRMED.** Deliberately `null` in `ISGPAY_ENDPOINTS`. Not assumed to match UAT. |

To enable production after ISGPay confirms it: make a reviewed code change that sets `ISGPAY_ENDPOINTS.production.status` (and corrects `.sale` if needed), and update `ISGPAY_PRODUCTION_URL` in `src/services/payment/isgpay-adapter.ts` if the Sale host changes. If production uses a different Status transport or format, change `querySaleStatus`/`parseStatusBody` in the same reviewed change. An environment variable alone can never enable production.

---

## 7. ReturnURL and callback requirements

- `ISGPAY_RETURN_URL=https://authenticmedia.fun/api/payments/isgpay/return`
- `ISGPAY_CALLBACK_URL=https://authenticmedia.fun/api/payments/isgpay/callback`
- Both must be **registered with ISGPay for the production MID**. Ask whether ISGPay uses the ReturnURL sent in EncData or a registered one, and where the push callback is configured.
- They must not contain a Vercel protection-bypass token or any query string.
- Return and callback only trigger a Status Query. Neither can mark an order paid.

---

## 8. Database and environment separation

Migration `supabase/migrations/20261119_isgpay_gateway_environment.sql`. **Not applied. Review first.**

- Adds `orders.gateway_environment text NULL`, with CHECK `NULL or 'uat' or 'production'`.
- **No backfill.** Existing ISGPay rows stay NULL, and NULL is read as `uat` everywhere (`coalesce(…, 'uat')` in SQL, `?? 'uat'` in `findIsgpayGatewayEnvironment`). They were all created by UAT-only code, so they are sandbox orders and can never be read as live revenue.
- New overload `create_isgpay_order(slugs, ref, guest, p_gateway_environment, contact_name?, contact_email?, contact_phone?)`. The environment is required (no default), so the deployed 3-argument call resolves only to the old function. Contact details are stored so production orders can be fulfilled (Airpay parity).
- New overload `settle_isgpay_order(ref, status, gateway_ref, p_gateway_environment)`. It updates only a row whose `coalesce(gateway_environment,'uat')` equals the verifying environment.
- The legacy 3-argument `settle_isgpay_order` is re-created **restricted to UAT rows**, so the currently deployed code keeps working and can never settle a production row. The legacy 3-argument create inserts NULL (= UAT) and needs no change.
- Airpay: untouched.

**Deploy order:** apply the migration **before** deploying this branch. The new code calls the 4-argument functions and reads `gateway_environment`. If the code is deployed first, ISGPay order creation fails and settlement stays pending (fail closed). Airpay is unaffected either way.

**Revenue and fulfilment rule:** an ISGPay order is real revenue only when `payment_method = 'isgpay' AND gateway_environment = 'production' AND status = 'paid'`. Any report or fulfilment query must apply this filter. UAT rows can still reach `status = 'paid'` (sandbox), exactly as before.

---

## 9. In-flight UAT transactions (drain and cutover)

There is a single credential set per deployment, by design. `settleIsgpayOrder` refuses to query when the order's environment differs from `ISGPAY_ENV`. Such an order stays `pending`, logged as `environment_mismatch`, and the SQL environment pin is a second barrier. So after cutover:

- A UAT order is **never** verified with production keys, and a production order never with UAT keys (tested).
- A late UAT browser return or callback cannot even be decrypted with production keys, so it lands on `/order-success?status=unverified`.

Procedure:

1. Set `ISGPAY_CHECKOUT_ENABLED=false` on Production and redeploy. No new UAT orders can start.
2. Wait at least 2 hours (ISGPay reposts callbacks up to 3 times, 30 minutes apart), then list `payment_method='isgpay' AND status='pending_payment' AND coalesce(gateway_environment,'uat')='uat'`. Read-only.
3. Each remaining UAT order is a sandbox test. Leave it pending: it is never fulfilled and never counted. **Do not** mark anything paid or failed by hand.
4. Then switch the Production scope to production credentials (§13).

---

## 10. Checkout changes needed for launch

Done in this branch, all disabled:

- Server-reported `testMode` drives the label: "Pay with ISGPay" with no warning only when live.
- The browser accepts the live Sale URL only for a live order, and the sandbox URL only for a test order.
- The success page derives "test vs purchase" from the stored order environment.
- A production order stores contact details.

Still needed before public launch:

- An ISGPay reconciliation sweep (gap 1), once the production Status API is confirmed.
- A decision on the decline/retry policy (gap 2, UAT doc Q9).
- A successful supervised UAT sale, recorded (gap 3).
- A controlled live smoke test. There is currently **no** tester-only live mode: the launch gate opens production checkout to everyone. If a private live test is wanted first, that needs a small reviewed addition (for example, a production-tester cookie). It was deliberately not built in Phase 1.

---

## 11. Automated test results

Run on this branch (Windows, Node, local only, no network or database):

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` (oxlint) | pass |
| `npm test` (Vitest) | **39 files, 810 tests passed** |
| `npm run build` | pass (only the existing >500 kB chunk warning) |
| `npx playwright test` (4 viewports, all network mocked) | **188 passed, 8 skipped** (skips are pre-existing) |
| Bundle scan of `dist/` for `ISGPAY_`, `SECURE_SECRET`, `PASSCODE`, `ENC_KEY`, `SUPABASE_SERVICE_ROLE` and fixture secrets | no matches |

Required coverage:

| # | Requirement | Where |
| --- | --- | --- |
| 1 | UAT config still valid | `isgpay-config.test.ts`, `isgpay-production-config.test.ts` |
| 2 | Production accepted when complete and confirmed | `isgpay-production-config.test.ts` |
| 3 | Production rejects sandbox endpoints | same |
| 4 | UAT rejects production endpoints | `isgpay-config.test.ts` |
| 5 | Missing or malformed secrets fail closed | both config tests |
| 6 | BankId leading zeros | both config tests |
| 7 | Credential mapping | `isgpay-production-config.test.ts` |
| 8–10 | No `Version`; four outer fields; SecureHash inside EncData | `isgpay-production-config.test.ts`, `isgpay.test.ts` |
| 11 | Production orders not marked sandbox | `isgpay-flow.test.ts`, `create-production.test.ts`, `isgpay-adapter.test.ts` |
| 12 | Sandbox orders never live | `isgpay-flow.test.ts` (NULL/`uat` → `testMode: true`, even when paid) |
| 13 | In-flight UAT not verified with production keys | `isgpay-flow.test.ts` |
| 14 | Invalid signatures never settle | `isgpay-flow.test.ts`, `isgpay.test.ts`, `isgpay-crypto.test.ts` |
| 15 | Amount mismatch never paid | `isgpay-flow.test.ts`, `isgpay.test.ts` |
| 16 | Repeated callbacks cannot double-settle | `isgpay-flow.test.ts` |
| 17 | Airpay merchants 1 and 2 unchanged | existing Airpay suites unchanged and passing; sandbox-isolation test |
| 18 | Production checkout disabled by default | `create-production.test.ts` |
| 19 | Sandbox tester auth still works | `create.test.ts` |
| 20 | No secrets in logs, bundle or responses | `create-production.test.ts`, config tests, bundle scan |

The SQL overloads were reviewed but **not executed**: there is no local Postgres in this setup. Run the migration against a Supabase branch or staging database before production (§13, step 1).

---

## 12. Rollback plan

Independent controls. Each needs a **fresh deployment** after an environment change.

| Control | Effect |
| --- | --- |
| `ISGPAY_PRODUCTION_LAUNCH_ENABLED=false` | hides live ISGPay from every shopper; settlement of existing orders continues |
| `ISGPAY_CHECKOUT_ENABLED=false` | hides ISGPay in checkout entirely (UAT and production) |
| `ISGPAY_ENABLED=false` | blocks every new ISGPay initiation; return, callback and status keep verifying existing orders |
| `ISGPAY_ENV=uat` + UAT credentials | back to sandbox. Production orders then stay pending (environment-pinned) until switched back, so prefer the flags above. |
| Code rollback | redeploy `fa530b2`. The migration is backward-compatible with it. Do **not** drop the new column while production orders exist. |

Airpay is not affected by any of these.

---

## 13. Phase 2: exact Vercel steps (when approved)

1. **Database:** apply `20261119_isgpay_gateway_environment.sql` to a Supabase branch or staging database, verify both overloads, then apply it to production. Read-only check afterwards: existing ISGPay rows have `gateway_environment IS NULL`.
2. **Scope separation:** in Vercel → Settings → Environment Variables, make sure every `ISGPAY_*` variable is scoped **per environment**. Preview and Development keep UAT values only. Production gets production values only. Remove any `ISGPAY_*` entry that is shared across "All Environments", or Preview will inherit live secrets (the code refuses `ISGPAY_ENV=production` off Production, but secrets must still not be there).
3. **Drain UAT** on Production (§9).
4. **Production scope** (after credential rotation and ISGPay confirmation; values never pasted into chat, code or tickets):
   - `ISGPAY_ENV=production`
   - `ISGPAY_ENABLED=false`
   - `ISGPAY_CHECKOUT_ENABLED=false`
   - `ISGPAY_PRODUCTION_LAUNCH_ENABLED=false`
   - `ISGPAY_MERCHANT_ID`, `ISGPAY_BANK_ID`, `ISGPAY_TERMINAL_ID`, `ISGPAY_MCC`, `ISGPAY_PASSCODE`, `ISGPAY_SECURE_SECRET`, `ISGPAY_ENC_KEY` ← production sheet (marked Sensitive)
   - `ISGPAY_CURRENCY=356`
   - `ISGPAY_SALE_URL=<confirmed production Sale URL>`
   - `ISGPAY_STATUS_URL=<confirmed production Status URL>`
   - `ISGPAY_RETURN_URL=https://authenticmedia.fun/api/payments/isgpay/return`
   - `ISGPAY_CALLBACK_URL=https://authenticmedia.fun/api/payments/isgpay/callback`
   - Leave `ISGPAY_UAT_WEBSITE_TEST_ENABLED` unset or false.
5. **Code:** merge the reviewed change that sets the confirmed production Status URL (§6) together with this branch. Deploy after step 1.
6. **Verify, with no payment:**
   - `GET /api/payments/isgpay/create` returns `{ available: false, … }`, so the gate is closed.
   - An **empty** `POST /api/payments/isgpay/callback` returns `400 invalid_request` if the production config loaded, or `503 unavailable` if it is invalid or incomplete. It carries no EncData, so it can settle nothing.
   - Airpay checkout is unchanged.
7. Only then, in a separately approved phase: `ISGPAY_ENABLED=true` → a controlled live test → `ISGPAY_CHECKOUT_ENABLED=true` + `ISGPAY_PRODUCTION_LAUNCH_ENABLED=true`.

---

## 14. Outstanding approvals and confirmations from ISGPay

1. Production MID activation and go-live approval.
2. Production **Sale** URL for this merchant (the proposed `https://isgpay.com/ISGPay-Genius/request.action`).
3. Production **Status** URL, transport (body vs query string, content type) and response format and hashing (UAT doc Q2).
4. Whether production uses the same AES mode, padding and key handling as UAT (UAT doc Q1).
5. ReturnURL handling and push-callback registration for the production MID; acknowledgement wire format (UAT doc Q8).
6. Enabled payment modes on the production MID.
7. Terminal-decline vs retryable response codes (UAT doc Q9), needed for the retry and double-charge policy.
8. Whether `Amount` is always present in successful Status responses (UAT doc Q10).
9. Field-format confirmation if any production identifier falls outside the v1.6 shapes in §4.
10. Credential rotation: the production sheet was shared by email/spreadsheet, so ask for rotated credentials to be issued through a secure channel before installation.
