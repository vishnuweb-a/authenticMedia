# ISGPay Production — Phase 4 (endpoint configuration)

Scope: set the production Status URL and prove nothing else moved. Live gateway stays **disabled**. No payment, no Status Query, no migration, no deploy was performed.

## 1. Source

- Branch: `feat/isgpay-phase3-integration` (in sync with origin at start).
- Base commit: `03f1f89`. Phase 4 commit: see `git log` on the branch.
- `origin/main` is at `fa530b2` and not touched. Not merged.

## 2. Files changed

| File | Change |
|------|--------|
| `api/_lib/isgpay-config.ts` | `production.status` `null` → `https://isgpay.com/ISGPay-Genius/Status`; comment updated. Nothing else. |
| `api/_lib/isgpay-production-config.test.ts` | Pins both production URLs, cross-environment rejection, Status-URL variants, null-Status still fails closed, loads with the real table with checkout still off. |
| `api/payments/isgpay/isgpay-flow.test.ts` | Replaced the stale "unconfirmed Status → 503" test with: a production callback cannot settle when the Status Query is unavailable. |
| `api/_lib/isgpay-test-fixture.ts` | Comment only on `CONFIRMED_TEST_ENDPOINTS` (now equals the real table). |

No change to Sale payload, AES, SecureHash, the four outer fields, `Version`, routes, SQL, Airpay code or the frontend.

## 3. Production endpoint configuration

```ts
production: {
  sale:   'https://isgpay.com/ISGPay-Genius/request.action',
  status: 'https://isgpay.com/ISGPay-Genius/Status',
}
```

`pinnedUrl` is unchanged: https only, exact origin and path, no query, fragment, port or credentials. UAT keeps its sandbox pair; each environment rejects the other's URLs (tested). `ISGPAY_ENV=production` still loads only when `VERCEL_ENV=production`.

The Status URL is owner-supplied. **It is not evidence that ISGPay's live response format or transport has been validated.** No real Status Query was made.

## 4. Vercel environment verification

Method: `vercel env ls` (names/scopes) and a temporary `vercel env pull` read in memory for booleans and URL equality only; the file was deleted and no value was printed.

Production scope:

| Variable | Result |
|----------|--------|
| `ISGPAY_ENV` | `production` |
| `ISGPAY_ENABLED`, `ISGPAY_CHECKOUT_ENABLED`, `ISGPAY_PRODUCTION_LAUNCH_ENABLED` | `false` |
| `ISGPAY_LIVE_PRIVATE_TEST_ENABLED`, `ISGPAY_RECONCILE_ENABLED`, `ISGPAY_LIVE_TESTER_USER_IDS` | absent (off) — the spec listed the first two as `false`; absent is read as off but is not literally set |
| `ISGPAY_SALE_URL`, `ISGPAY_STATUS_URL`, `ISGPAY_RETURN_URL`, `ISGPAY_CALLBACK_URL` | exactly match the expected values |
| `ISGPAY_BANK_ID`, `_MERCHANT_ID`, `_TERMINAL_ID`, `_MCC` | present, lengths fit the validators (6 / 15 / 8 / 4) |
| `ISGPAY_PASSCODE`, `_SECURE_SECRET`, `_ENC_KEY` | present as Sensitive; **values are unreadable by the CLI, so their format was not checked** |
| `ISGPAY_CURRENCY`, `ISGPAY_REFUND_URL`, `ISGPAY_REFUND_STATUS_URL` | present (refund URLs are unused by this code) |

Findings to act on:

- `ISGPAY_UAT_ACCESS_KEY` and `ISGPAY_UAT_WEBSITE_TEST_ENABLED=false` exist in the **Production** scope. The sandbox page refuses under `ISGPAY_ENV=production` (tested), but sandbox tester variables do not belong in Production.
- Preview has its own ISGPay set (UAT) plus branch-scoped entries for `feat/isgpay-integration-uat`. I did not read Preview values, so "Preview is still UAT" is by scope and name only.
- No `VITE_` variable carries an ISGPay or merchant value. The built bundle contains no `ISGPAY_*` name; it contains only the public sandbox form-action URL.

## 5. Database prerequisites

Unchanged, nothing applied.

| Migration | State | Needed by this code |
|-----------|-------|---------------------|
| `20261117_isgpay_uat_orders` | live | yes |
| `20261118_custom_auth` | live | yes |
| `20261119_isgpay_gateway_environment` | **not applied** | **yes — deployment blocker.** `create`/`settle_isgpay_order` pass `p_gateway_environment`; the 8-arg create and 4-arg settle depend on it. |
| `20261120_revoke_browser_settle_payment` | **not applied, deliberately** | no |

Without `20261119` the production code cannot create ISGPay orders. I did not work around it. Status is from the Phase 3 live read-only review; this phase did not query the database.

## 6. Callback preservation

Routes `return.ts`, `callback.ts`, `status.ts` and `isgpay-settle.ts` are byte-identical to `03f1f89` (not in the diff). Existing tests, all passing, cover: EncData decrypt + SecureHash verify, malformed/unsigned refusal, a callback never settling by itself (new test: Status Query unreachable → no settle RPC, nothing leaked), amount/ref matching → `requires_review` on mismatch, duplicate callbacks settle once, guest return by order token.

If the bank requires different callback behaviour in production, that is a separate provider dependency, not changed here.

## 7. Airpay regression

Airpay MID 1/2, callbacks, settlement and the merchant choice UI are untouched. `multi-merchant-flow`, `callback-forwarding`, `callback`, `settle`, `merchant-selection` suites and the checkout e2e flows pass.

## 8. Tests and results

| Check | Result |
|-------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass (0 warnings after removing one unused import) |
| `npm test` | 40 files, 855 tests pass |
| `npm run build` | pass (chunk-size warning only, pre-existing) |
| `npx playwright test --workers=4` | 196 passed, 8 skipped, 0 failed |
| `node scripts/validate-isgpay-sql.mjs` | all checks pass, on in-memory PGlite only; nothing applied anywhere |
| Credentials in browser bundle | none found |

Not run: visual QA beyond the existing e2e (no UI change), any live or sandbox payment.

## 9. Provider confirmations still outstanding

- That this Status URL serves this MID/TID, with the same transport (POST form) as UAT.
- The production Status response format and SecureHash rule.
- Merchant activation for live transactions.
- Final-decline `ResponseCode` list and how long a pending transaction can still succeed.
- Whether production pushes a callback to `ISGPAY_CALLBACK_URL`, and its retry schedule.
- The ReturnURL and callback URL registered on the production merchant profile.

## 10. Production deployment blockers

1. `20261119` not applied (§5).
2. Status response unvalidated against the live gateway (§3, §9).
3. Unchanged public `settle_payment` (§12).
4. Previously shared production credentials should be rotated before any real-money test.
5. Sensitive ISGPay secret formats could not be verified from Vercel (§4).
6. No staging database for the concurrent-create test.
7. Remove sandbox tester variables from the Production scope (§4).

## 11. Controlled live-testing procedure (later, needs explicit approval)

1. Confirm §9 items in writing.
2. Apply `20261119` (owner decision); verify read-only.
3. Remove UAT tester variables from Production.
4. Set `ISGPAY_ENABLED`, `ISGPAY_CHECKOUT_ENABLED`, `ISGPAY_LIVE_PRIVATE_TEST_ENABLED` to `true`; set `ISGPAY_LIVE_TESTER_USER_IDS` to one verified account. Leave `ISGPAY_PRODUCTION_LAUNCH_ENABLED=false`.
5. Deploy this branch to Production only with explicit sign-off.
6. One minimum-price payment by the allowlisted tester.
7. Treat it as successful only when the bank Status response verifies it **and** the merchant portal shows a matching record. Not on `orders.status='paid'`.
8. Turn the flags back off.

## 12. Known risk: unchanged public `settle_payment`

By owner instruction `public.settle_payment` is unchanged and `20261120` is not applied. In that state the browser-callable function can set an order's status without gateway verification. Therefore **`orders.status='paid'` alone is not reliable evidence of payment**, for ISGPay or Airpay orders. This code verifies ISGPay through the Status Query before it settles, but it cannot stop that other path. Do not treat the system as ready for unrestricted real-money checkout while this stands. `20261120` is committed and validated on PGlite; applying it is the owner's decision.
