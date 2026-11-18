# ISGPay Production — Phase 3

Branch consolidation, atomic duplicate-payment protection, database review.
Date: 2026-11-18. Follows `ISGPAY-PRODUCTION-PHASE2.md`.

**Nothing in this phase was deployed, applied to a database, or sent to a gateway.**
No credential was read, changed or printed. No Sale request was made.

> ### ⚠ Read §7 first — a live payment-bypass exists in production today
> The mock-era RPC `public.settle_payment` can be called with the **public anon key**
> and marks any order `paid` without gateway verification. It affects live Airpay
> orders now, not only ISGPay. The fix is a one-line privilege revoke, prepared in
> `20261120_revoke_browser_settle_payment.sql` and **not applied**.

---

## 1. Final branch and commits

| | |
|---|---|
| Branch | `feat/isgpay-phase3-integration` (pushed to `origin`) |
| Based on | `ab02403` (tip of `feat/isgpay-production-readiness`) |
| Merge commit | `f3a98e7`: brings in `fix/order-success-guest-return` (`5e1cec5`, which contains the live `78db26e`) |
| Code commit | `ee68985`: atomic guard, migrations, tests, SQL validator |
| Docs commit | the commit that adds this file (the branch tip) |

`feat/isgpay-production-readiness`, `fix/order-success-guest-return` and `main` were not
changed. Nothing was force-pushed.

## 2. Branch reconciliation

What each branch had:

- **Live (Vercel, `78db26e`)**: members-only routing. Built on `1989f8f`, it never went into `main`.
- **`fix/order-success-guest-return` (`5e1cec5`)**: `78db26e` plus `/order-success` moved out of `RequireAuth`.
- **`feat/isgpay-production-readiness` (`ab02403`)**: `main` plus the Phase 1–2 ISGPay work. It has neither routing change.

`git merge --no-ff fix/order-success-guest-return` merged with **no conflicts**. The two
lines of work touch different files: routing and e2e on one side, `api/` and the
payment UI on the other. Files the merge brought in: `src/routes/index.tsx`,
`src/features/auth/components/route-guards.tsx`, `e2e/flows.spec.ts` and `e2e/support/mocks.ts`.

**Note for anyone deploying:** if this branch is deployed as it stands, the live
members-only behaviour stays and the guest-return fix is added. If
`feat/isgpay-production-readiness` were deployed directly, it would **remove**
members-only routing from the live site.

## 3. Guest-return route fix

- `/order-success` is a public route, a sibling of the legal pages. A shopper who comes back from the gateway signed out (because of another tab, an expired session or another device) sees their result instead of being sent to `/login`.
- The page reveals only what the order's own `access_token` unlocks. `GET /api/orders/:ref` and `/api/payments/isgpay/status` still require that token: identical 404s for a wrong token or an unknown order (`api/endpoints.test.ts` edge case 38, `isgpay-flow.test.ts` "one 404 for wrong token").
- Home, services, about, contact, FAQ and account remain behind `RequireAuth`. That guard is for UX only; the API enforces access.
- Covered by e2e: "signed-out visitors are sent to login; legal pages stay public" and "a signed-out shopper returning from the gateway still sees the payment result", on all 4 viewports.

## 4. Atomic duplicate-payment protection

### Strategy

Inside `create_isgpay_order` (8-argument overload), **only when `p_gateway_environment = 'production'`**:

1. **Locks.** The function computes up to two keys, `hashtextextended('isgpay-live:guest:<token>')` and `hashtextextended('isgpay-live:user:<app_user_id>')`, and takes `pg_advisory_xact_lock` on each **in sorted order**. Two requests that share a key queue behind each other. Sorting prevents deadlock between {guest A, user U} and {guest B, user U}.
2. **Check.** Under those locks, it looks for any order with `payment_method='isgpay' AND gateway_environment='production' AND status='pending_payment'` that matches the guest token **or** the account.
3. **Refuse or insert.** If such an order exists, it raises `SQLSTATE IG409` with `DETAIL = <original reference>`, writes nothing and leaves the earlier row untouched. Otherwise it inserts, in the same transaction. The locks are released at commit.
4. **Backstop.** Two partial **unique indexes** on the same predicate enforce the rule even for writes that bypass the function: `orders_isgpay_live_pending_guest_key (guest_token)` and `orders_isgpay_live_pending_user_key (app_user_id)`.

`create.ts` around it:

- **Account identity.** The account comes from the **server session** (the HttpOnly cookie, then `auth_session_user`), or from the already-verified live-tester id. It never comes from the request body. If a session cookie is present but cannot be resolved, the request gets 502 and no order is created (fail closed).
- **Pre-check.** `findUnresolvedIsgpayOrder(guest, account, env)` has **no time window**. If an earlier attempt exists, it is re-verified once through `settleIsgpayOrder`, the one authoritative Status Query path. Only `paid`, `requires_review` or `already_settled` releases the shopper. A timeout, an unreadable answer, `pending`, `declined_pending` or `unknown_order` still blocks.
- **Responses.** `IG409` is returned as HTTP **409 `payment_unresolved`**, which the checkout UI already handles. Any other RPC error is returned as 502, and no hand-off is built.

### Requirements

| # | Requirement | How |
|---|---|---|
| 1 | Same shopper and context cannot create concurrently | Advisory locks + check in `create_isgpay_order` |
| 2 | Transaction-scoped lock or database uniqueness | Both: `pg_advisory_xact_lock` + partial unique indexes |
| 3 | Check and insert in one transaction | One plpgsql function, one RPC call, one transaction |
| 4 | Fail closed | Any SQL error aborts the insert. App: lookup or session error gives 502, never a charge |
| 5 | Not only UI, memory or an initial SELECT | The guarantee is in Postgres. The SELECT pre-check is only a re-verify step |
| 6 | Preserve the original reference | The earlier row is never modified. Its reference is returned in `DETAIL` and logged |
| 7 | Application error, not another charge | 409 `payment_unresolved` |
| 8 | No automatic release after 24 h | No window in SQL or in the app. `UNRESOLVED_ATTEMPT_WINDOW_MS` was removed |
| 9 | Signed-in user on another browser or device | `orders.app_user_id` + per-account lock + unique index |
| 10 | Sandbox never blocks production | The guard and the indexes match `gateway_environment = 'production'` only. UAT and legacy (NULL) rows are never locked, matched or indexed |

### Limitations

- **A signed-out shopper on a new device is a new shopper.** Without an account, the only identity is the guest token, so clearing storage or switching device allows a second live attempt. Phone and email are not used as keys: they are unverified input, and matching on them would let anyone block a stranger. If that matters, require sign-in for live ISGPay. During private live testing it already is required.
- **A pending order blocks until it is resolved.** Under the current decline policy (Phase 2 §10, Q9), a *verified decline* stays `pending_payment`. One declined live attempt therefore blocks that shopper until either (a) ISGPay confirms which response codes are final and code marks those orders `failed`, or (b) an operator resolves it. Operators must never mark an order paid. This is fail-closed by design and acceptable for the private test. **It is a blocker for public launch** (§11).
- **An order that never reached the gateway also blocks.** If the database row was created but the hand-off build failed (a configuration error), the Status Query cannot find the order, so it stays pending. The same operator resolution applies.
- **Hash collisions** between two different shoppers' lock keys only serialise them. They never refuse anyone, because the refusal comes from the row check, not the lock.
- **Lock contention between real backends was not exercised** (§6). PGlite has a single backend.

## 5. Database migration review: `20261119_isgpay_gateway_environment.sql`

The live schema of project `ecknryxkuyjsuppvrhbz` was reviewed with **read-only catalog queries** through the Supabase CLI (Management API), plus aggregate row counts. No customer row was read. That project ref is the one the repository's `.env` and earlier release docs record as production. It has **no branches**.

| Check | Finding |
|---|---|
| `gateway_environment` + CHECK | Absent live, which confirms the migration is not applied. Adds a nullable column with `CHECK (NULL or 'uat'/'production')`. Verified on PGlite: unknown values are rejected |
| Legacy UAT compatibility | Live: 3 ISGPay orders, all `pending_payment`, will be NULL and read as UAT. The 3-argument `create`/`settle` keep working and can only touch UAT rows (verified) |
| New create function | 8 args (added `p_app_user_id uuid default null`). SECURITY DEFINER, `search_path=public`, validates environment, reference format and services, and prices server-side |
| New settle function | Pinned to the environment. A UAT settle cannot touch a production row, nor the reverse. Idempotent (a second settle returns NULL) |
| Contact details | Stored for production orders, as for Airpay |
| Owner model | Live `orders.user_id` → `auth.users` (Supabase Auth, unused) with `orders_one_owner CHECK (num_nonnulls(user_id, guest_token) = 1)`. That is why the account goes in the **new** `app_user_id → app_private.app_users ON DELETE SET NULL`, and why `user_id` is not reused |
| Indexes and uniqueness | The Phase 2 non-unique `orders_isgpay_guest_pending_idx` is replaced by the two partial unique indexes (§4), which also serve the lookup. They are safe to build: no live row has `gateway_environment='production'` |
| Permissions | `revoke all … from public, anon, authenticated` + `grant execute … to service_role` on every ISGPay function. Live ACLs of the existing ISGPay and Airpay functions are already `postgres` + `service_role` only |
| RLS / SECURITY DEFINER | RLS is enabled on `orders` and `payments`. The functions are reachable only by `service_role`, which bypasses RLS anyway, so the definer rights add no new exposure. Existing `authenticated` SELECT policies use `auth.uid()`, which is always NULL under custom auth, so they grant nothing |
| Airpay compatibility | No Airpay function, column or row is touched. Airpay rows get `gateway_environment` NULL and are excluded from every ISGPay predicate by `payment_method` |
| Migration history | Live `supabase_migrations.schema_migrations` does **not** record `20261117_isgpay_uat_orders` or `20261118_custom_auth`, although both are live. They were applied outside the CLI. Apply this one the same deliberate way, or reconcile history first. Do not run `supabase db push` blindly |

**Pre-existing hardening note (not changed):** `anon` and `authenticated` hold
table-level `INSERT/UPDATE/DELETE/TRUNCATE` on `orders` and `payments`. This is the Supabase default.
RLS blocks the first three, and PostgREST cannot issue `TRUNCATE`, so it is not
exploitable through the Data API. Revoking these is a sensible separate change.

## 6. Staging validation

**No staging database exists.** `supabase branches list` returns none for the production project, Docker is not running and no local Postgres is installed. Production was **not** used as a substitute.

What was done instead: `scripts/validate-isgpay-sql.mjs` runs all three ISGPay migrations
(`20261117`, `20261119`, `20261120`) on **PGlite** (in-memory WASM Postgres). It uses a stub of the base
tables built from the live catalog. **28/28 checks passed**:

- The migration applies, and re-applying it is harmless.
- A second live order for the same guest token is refused with `IG409`, the refusal names the original reference, and nothing is written.
- The same account with a different guest token is refused. A different signed-out shopper is not affected.
- A pending order **3 days old** still blocks. After a production settle, the shopper can buy again.
- UAT and legacy-NULL pending orders never block live orders.
- The unique indexes reject a second pending live row written directly (`23505`), per guest token and per account.
- Settlement is environment-pinned, the legacy settle cannot touch production, and settle is idempotent.
- `anon` and `authenticated` cannot execute the ISGPay functions or (after `20261120`) `settle_payment`. `service_role` can.

To rerun: `npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/validate-isgpay-sql.mjs`

**Still required on a real staging database (a Supabase branch or a disposable clone):**

1. Apply `20261117` if it is missing, then `20261119` and `20261120`.
2. **Concurrency:** fire 20 parallel `create_isgpay_order(..., 'production', ...)` calls with one guest token. Expect exactly 1 row and 19 `IG409`. Repeat with 20 distinct guest tokens and one `p_app_user_id`. Repeat with mixed keys to confirm there is no deadlock (no `40P01`).
3. `get_advisors` (security + performance) again, and confirm nothing new appears for ISGPay objects.
4. Read-only check: every existing ISGPay row has `gateway_environment IS NULL`.

## 7. Supabase security advisors (production, read-only)

| Level | Finding | Assessment |
|---|---|---|
| **WARN, critical in effect** | `public.settle_payment(uuid, boolean, text, uuid, text)`: SECURITY DEFINER, executable by `anon` and `authenticated` | **Payment bypass.** For an order whose id and guest token are known, it sets `orders.status='paid'` and `payments.status='succeeded'`. It checks neither `payment_method` nor the current status, and does no verification. The id comes from the equally anon-callable `get_orders(p_guest_token)`, and the guest token is the shopper's own. Any shopper can therefore mark their own Airpay or ISGPay order paid without paying. **No evidence of use:** all 11 paid Airpay orders carry `ap_verified_at`. **Fix:** `20261120_revoke_browser_settle_payment.sql` (revoke EXECUTE from public, anon and authenticated). Nothing deployed calls it: its only caller, `mock-payment-service.ts`, is used by no UI |
| WARN | `add_cart_item`, `remove_cart_item`, `clear_cart`, `get_cart`, `get_order`, `get_orders` and `create_order` callable by anon | This is the intended guest-cart surface. `create_order` creates `mock` orders only, so no money moves. Review separately |
| INFO | RLS enabled with no policy on `app_private.app_users` and `auth_rate_limits` | Intended: the schema is not exposed and is accessed only through service-role functions |

**Recommendation:** apply `20261120` to production as soon as it is approved. It
is independent of ISGPay. It removes a privilege and touches no row.

## 8. Production environment verification

**Not verified.** The Vercel CLI is not installed or authenticated in this
environment, so variable names and scopes could not be listed. Values were not
examined in any case.

What the code guarantees whatever the env values are:

- `ISGPAY_ENV=production` loads **only** when `VERCEL_ENV=production`. On Preview or locally it throws.
- The production Status endpoint is `null` in `ISGPAY_ENDPOINTS`, so **`ISGPAY_ENV=production` cannot load at all**. ISGPay is unavailable on the Production deployment until a reviewed code change, whatever `ISGPAY_STATUS_URL` says. That safeguard stays in place.
- `ISGPAY_ENABLED`, `ISGPAY_CHECKOUT_ENABLED` and `ISGPAY_PRODUCTION_LAUNCH_ENABLED` must each be exactly `true` to open anything.

To verify by hand (names and scopes only): `vercel env ls production` and `vercel env ls preview`. Confirm that:

- Preview has UAT credentials, `ISGPAY_ENV=uat` and no production merchant values.
- Production has the expected flags `false`.
- `ISGPAY_LIVE_PRIVATE_TEST_ENABLED` and `ISGPAY_LIVE_TESTER_USER_IDS` are absent or off.

**The reviewed change, once ISGPay confirms the production Status API**
(`api/_lib/isgpay-config.ts`):

```diff
   production: {
     sale: 'https://isgpay.com/ISGPay-Genius/request.action',
-    status: null,
+    status: 'https://isgpay.com/ISGPay-Genius/Status',
   },
```

This is the only line to change, and only after ISGPay confirms in writing that:

- this exact URL serves this MID/TID;
- the transport is the same as UAT (POST form `BankId`, `MerchantId`, `TerminalId`, `EncData`);
- the response format and SecureHash rule are the same.

If anything differs, `querySaleStatus` needs a reviewed change of its own. Also
update the tests that assert `status: null` (`isgpay-production-config.test.ts`,
`isgpay-flow.test.ts` "with the real endpoint table…").

## 9. Private live-testing safeguards

`isgpayCheckoutAccess` + `loadIsgpayConfig` require **all** of the following:

1. `ISGPAY_CHECKOUT_ENABLED=true` and `ISGPAY_ENABLED=true`.
2. `ISGPAY_ENV=production` **and** `VERCEL_ENV=production`.
3. `ISGPAY_LIVE_PRIVATE_TEST_ENABLED` exactly `true` (`TRUE` is refused).
4. A valid HttpOnly session cookie, resolved server-side.
5. `email_verified_at` set. Self-registered accounts are always unverified.
6. The account id in `ISGPAY_LIVE_TESTER_USER_IDS`. Malformed entries are dropped and never matched.
7. A production config that loads, which today is impossible (§8).

`ISGPAY_PRODUCTION_LAUNCH_ENABLED` stays off. The UAT access key and the sandbox
tester cookie **never** open live payments, and neither do client-sent `isTester`,
`liveTester` or `userId` fields.

Tests (all synthetic, no network): the allowlisted, verified account is allowed. A guest,
another account, an unverified allowlisted id, a flag value other than exactly `true`,
an empty or invalid allowlist, a session lookup error, Preview, and the sandbox cookie or key
are all refused (`isgpay-phase2.test.ts`). No Sale request was executed.

## 10. Test results

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` (oxlint) | pass, 0 findings |
| `npm test` (vitest) | **845 passed**, 40 files (Phase 2: 838 + 7 new) |
| `npm run build` | pass |
| `npx playwright test --workers=4` (4 viewports, network mocked) | **196 passed, 8 skipped** (skips pre-existing; +8 = the merged routing tests × 4 viewports) |
| `scripts/validate-isgpay-sql.mjs` (PGlite) | **28/28 passed** |

Where each required scenario is tested:

| Scenario | Where |
|---|---|
| Two concurrent creates | `isgpay-phase2.test.ts` "two concurrent requests…" + PGlite |
| Same account on two devices | `isgpay-phase2.test.ts` + PGlite |
| Pending attempts older than 24 h | `isgpay-phase2.test.ts` (no window) + PGlite (3-day-old row) |
| Different gateway environments | PGlite (UAT/legacy never block) + `isgpay-flow.test.ts` environment separation + phase2 UAT test |
| Failed Status queries | phase2 "unreadable verification still blocks" + `isgpay-flow.test.ts` inconclusive return |
| Duplicate callbacks | `isgpay-flow.test.ts` "repeated callbacks cannot double-settle", `api/callback.test.ts` |
| Guest `/order-success` | e2e (4 viewports) + `isgpay-flow.test.ts` guest return |
| Unauthorized members-only routes | e2e "signed-out visitors are sent to login…" and "/account" |
| Sandbox-only and private live-test authorization | `isgpay-phase2.test.ts` |
| Public production checkout disabled | `isgpay-production-config.test.ts`, `isgpay-flow.test.ts` real-endpoint fail-closed |
| Both Airpay merchants | `api/multi-merchant-flow.test.ts`, `api/callback-forwarding.test.ts` |

## 11. Deployment blockers

1. **`settle_payment` bypass (§7).** Apply `20261120` first. It is independent of ISGPay and urgent.
2. **No staging database.** The concurrency test on real Postgres is outstanding (§6).
3. **Migration history drift.** `20261117` and `20261118` are live but not recorded in history (§5).
4. **Production Status API not confirmed** by ISGPay, so `status: null` stays (§8).
5. **Credential rotation.** The previously shared production credentials must be rotated before any real-money test.
6. **Vercel env names and scopes not verified** (§8).
7. **Public launch only:** the decline-policy decision (Q9). Until it is made, one verified decline blocks a shopper indefinitely (§4 limitations).

## 12. Missing provider confirmations (ISGPay)

- The production Status URL for this MID/TID, its transport, request fields, response format and SecureHash rule.
- Merchant activation for live transactions on MID/TID (currently unconfirmed).
- Which `ResponseCode` values are final declines (decline policy Q9), and how long a pending transaction can still turn successful.
- Whether production sends the push callback to `ISGPAY_CALLBACK_URL`, and its retry schedule.
- The registered ReturnURL and callback URL on the production merchant profile.

## 13. Next steps for controlled live testing

Each step needs explicit approval. Stop if any check fails.

1. **Approve and apply `20261120_revoke_browser_settle_payment.sql`** to production. Then verify that `has_function_privilege('anon', 'public.settle_payment(uuid,boolean,text,uuid,text)', 'execute')` is false and that the site still works (nothing uses the function).
2. Create a Supabase branch or a disposable clone. Run the staging checklist in §6 (concurrency included). Run the advisors.
3. Apply `20261119_isgpay_gateway_environment.sql` to production with the same method used for `20261117` and `20261118`. Then, read-only: every ISGPay row has `gateway_environment IS NULL`; the 8-argument `create` and 4-argument `settle` exist with `service_role`-only ACLs; both unique indexes exist.
4. Merge `feat/isgpay-phase3-integration` through a reviewed PR. Deploy with **every ISGPay flag off**. Smoke test: members-only routing, guest `/order-success`, and both Airpay merchants. ISGPay must not be offered.
5. Rotate the ISGPay production credentials in Vercel Production (operator, not an agent).
6. Once ISGPay confirms in writing (§12), make the one-line reviewed `status` change in §8 in a PR with updated tests, and deploy with flags off.
7. Private live test: provision **one** verified tester with `scripts/provision-user.mjs`. Set `ISGPAY_LIVE_TESTER_USER_IDS` to that id, then set `ISGPAY_LIVE_PRIVATE_TEST_ENABLED=true`, `ISGPAY_CHECKOUT_ENABLED=true` and `ISGPAY_ENABLED=true`. Keep `ISGPAY_PRODUCTION_LAUNCH_ENABLED=false`. Then:
   - Confirm from a second account and from a signed-out browser that ISGPay is **not** offered.
   - Make one lowest-value purchase as the tester. Confirm that settlement comes only from the Status Query, and that the ISGPay dashboard and the order row agree.
   - Try a second purchase while the first is pending: expect 409.
8. Turn the private-test flags off again and record the results. Public launch is a separate decision after Q9 is resolved.
