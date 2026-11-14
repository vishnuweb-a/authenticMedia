# Phase 4 — Final Blocker Resolution and Release Candidate

Prepared 14 November 2026. For: the developer who deploys, the merchant (Authentic Media and IT
Sector Private Limited), the legal reviewer and the accountant.

Nothing was committed, pushed or deployed. No production database row was read beyond the public
catalogue, and none was written. No gateway, callback route or forwarding logic was changed. No
payment was made. All five policies remain `1.0-draft`.

**BLOCKED** = cannot be verified from this repository or the public site; the exact access or
document needed is named.

---

## 1. Technical problems found

| # | Problem | Evidence | Status |
|---|---|---|---|
| T1 | **Cart total could differ from the amount charged.** `create_airpay_order` prices only `is_active` services and silently skips the rest. The cart showed whatever `get_cart` returned. The checkout never compared the server's amount with the total shown, so a retired service left in a saved cart, a price change, or a stale open tab would send the shopper to Airpay for a different amount than the drawer showed. Terms §8 promises they match. | `20260831_airpay_settlement.sql` (create RPC), `use-checkout.ts` (no amount check), `supabase-cart-service.ts` | **Fixed** (§2.1) |
| T2 | The E2E payment mock always returned ₹499, whatever was in the cart (e.g. ₹849 for Tech Maintenance), and every test still passed. That is the T1 defect, hidden by the test double. | `e2e/support/mocks.ts` | **Fixed**: the mock now prices like the RPC |
| T3 | The two payment options had identical accessible names ("Pay with airpay" ×2), so a screen reader announced two indistinguishable radios (Phase 2 F4). | `checkout-merchant-choice.tsx` | **Fixed** (§2.3) |
| T4 | Escalation in Refund §21 went "to the same address" as the first complaint. Terms §23 and Service Delivery §11 pointed to that clause instead of to the Grievance page (Phase 3 B1). | policy content | **Fixed** (§2.2) |
| T5 | Terms §7 said "choose the available payment option" (singular), but checkout offers two (B7). | `terms.ts` | **Fixed** (§2.2) |
| T6 | **Anyone can make this site forward arbitrary data to KKChat.** A POST to the public callback URL with no encrypted envelope and no `MERCID` parses as `merchantCheck: absent` and its fields are relayed to KKChat verbatim. Settlement is unaffected (it uses Order Confirmation only), but KKChat receives unauthenticated content, including a forged `SUCCESS`. First reported in the integration blueprint (R1, 13 Oct 2026); re-confirmed in code today. | `callback-payload.ts` (absent-MID branch, `relayFields` built from outer fields), `callback-flow.ts` (relay unconditional on settle outcome) | **Not changed** — forwarding logic; needs your approval (§3, M9) |
| T7 | **Contradictory statements about where merchant 2's callbacks go.** `collection.ts` and `callback-flow.ts` say MID 362380 now delivers to this site, which relays to KKChat. `create.ts`, `use-checkout.ts` and `.env.example` say merchant 2's dashboard points at KKChat directly, and the browser is not returned. Only one can be true. | files named | **BLOCKED** — Airpay dashboard for MID 362380 (§5) |
| T8 | Every callback (paid, failed, duplicate, and payments **not made on this website**, which settle as `unknown_order`) is forwarded to KKChat with all its fields. Privacy §14 describes only "when Airpay notifies us of a payment outcome". | `callback-flow.ts` | Proposed privacy wording (§4.2) |
| T9 | Cloud & Hosting's description, third feature and price are not from any reference. Micro-service cards do not show a description (only search results do), so "Right-size your hosting and get the domain configuration right." was written, not captured. ₹899 and "Server Performance Review (Basic)" were inferred. All three are live. | `catalogue.data.ts` comments, `micro-service-card.tsx`, Phase 3 catalogue read | Merchant confirmation (§3) |
| T10 | `get_cart` is not in the repository. Whether it filters `is_active` cannot be checked. | repo search | Mitigated in the client (§2.1); definition **BLOCKED** (§4.1) |

## 2. Technical corrections completed

### 2.1 Cart / payment amount (Task 1)

Gateway code, `api/`, migrations and the RPCs are unchanged. All changes are in the browser.

| Change | File |
|---|---|
| After `get_cart`, the cart re-reads `services (slug, price_inr) where is_active` for the slugs in the cart. This is the same public, RLS-limited read the catalogue page already makes. Inactive services are dropped from the cart, and every price is taken from the active row. The cart therefore matches exactly what `create_airpay_order` charges. If that read fails, the rows are shown as they are and the guard below still applies. | `src/services/cart/supabase-cart-service.ts` (`reconcileCartRows`) |
| **Last-step guard.** After the server creates the order, checkout compares the server's amount with the total shown. If they differ, or the amount is missing or zero, the shopper is **not** sent to Airpay. The payment window is closed, a message explains the difference and says nothing was charged, and the cart is re-read. | `src/features/cart/lib/charged-amount.ts`, `use-checkout.ts` |
| `refresh()` added to the cart store for that re-read. | `src/stores/cart-context.ts`, `cart-provider.tsx` |

Side effect: when the guard fires, the order row already exists as `pending_payment` and is never
sent to Airpay. That is the same state as an abandoned checkout, which the system already
produces and the reconciler already tolerates (Order Confirmation finds no payment, so the order is
never marked paid).

Regression tests: `charged-amount.test.ts` (4), `reconcile-cart-rows.test.ts` (4), and E2E "a
retired service left in a saved cart is not shown, totalled or sent" and "a server amount that
differs from the cart total stops before the gateway" (each at 4 viewports, with axe on the error
state).

### 2.2 Policy text (Task 3). Still drafts

Only wording that follows from how the site already works was changed:

| Where | Before | After |
|---|---|---|
| Refund §21 | "escalate to the same address" | escalate as described on the Grievance Redressal page |
| Terms §23 | "see the escalation section of the Refund Policy" | escalation is set out on the Grievance Redressal page |
| Service Delivery §11 | escalation steps in the Refund Policy | escalation steps on the Grievance Redressal page |
| Grievance → Escalation | always the general inbox | goes to the Grievance Officer's email **once `LEGAL.grievanceOfficer` is set**; until then, honestly, the general inbox |
| Terms §7 | "choose the available payment option" | "choose one of the payment options shown at checkout" |

Tests (`src/lib/site.test.ts`): no policy says "escalate to the same address", each links
`/grievance-redressal`, escalation reaches the officer once one is set, and the officer's
designation must be non-empty (the code required it, but no test checked it).

### 2.3 Payment option labels (Task 6)

"Pay with airpay — Option 1" and "Pay with airpay — Option 2". They are numbered, not described,
because no difference in capability between the two accounts has been established. No MID or
account name is shown. Test added in `checkout-merchant-choice.test.tsx`.

Proposed, not applied: add "opens in a new window" to option 2. The code does this for merchant 2
(`returnsToSite: merchant === 1`), but whether it is still needed depends on T7.

## 3. Remaining decisions requiring merchant approval

| # | Decision | Owner |
|---|---|---|
| M1 | Fintech Partner / Collection Partner: keep with evidence, reword, or deactivate (table below) | Merchant, legal |
| M2 | Fintech Support card and "fintech support" in the /about narrative | Merchant |
| M3 | Cloud & Hosting: confirm or replace the description, third feature and ₹899 (T9) | Merchant |
| M4 | Confirm **both** Airpay merchant accounts belong to the company named in the Terms | Merchant |
| M5 | Which URL MID 362380's Airpay dashboard registers as Response URL and IPN URL (T7) | Merchant, with Airpay dashboard access |
| M6 | KKChat's role (processor? group company? service provider?), and the contract under which it receives payment data | Merchant, legal |
| M7 | GST treatment and invoicing (§6.2 below) | Accountant |
| M8 | Whether the option labels in §2.3 are acceptable, and whether option 2 should say it opens a new window | Merchant |
| M9 | Whether to stop forwarding unauthenticated or unverified callbacks to KKChat (T6). Options in the integration blueprint §11: forward only callbacks whose envelope opened or whose MID matched, or verify before forwarding. Changes forwarding logic, so it needs explicit approval and its own regression tests. | Merchant, developer |

### Service decision table (Task 4)

Source: the production catalogue read on 14 Nov 2026 (anon role, active rows only, 17 rows) and the repository. No service was changed.

| | Fintech Partner | Collection Partner | Fintech Support | Cloud & Hosting |
|---|---|---|---|---|
| What it is | `services` row `fintech-partner` | `services` row `collection-partner` | /about capability card + narrative phrase. **Not a service** | `services` row `cloud-hosting` (micro) |
| Price | ₹499 | ₹999 | — | ₹899 ⚠ inferred |
| Visible | Catalogue, Home (first 6 core), search, Terms §5 | Catalogue, Home, search, Terms §5 | /about only | Catalogue, Home micro section, search |
| Payment-eligible | **Yes** (active) | **Yes** (active) | No | **Yes** (active) |
| Evidence of actual activity | **BLOCKED**: none supplied | **BLOCKED**: none supplied | **BLOCKED** | **BLOCKED**: no scope or timeline |
| Supporting documents | none | none | none | none |
| Refund rule | none (Refund §6 omits it, B2) | none | n/a | Refund §6 technical services |
| Unverified text | "Trusted", "compliance support" | "recovery solutions, ethical follow-ups … improved cash flow" | "payment and collection workflows" | description (authored), feature 3, price |
| Risk | Medium: financial-services reading | High: debt collection category | Low–medium | Low: accuracy only |

**Reversible deactivation procedure** (for any service the merchant decides is unsupported). It
preserves historical orders and does not create checkout inconsistencies.

1. Read-only pre-checks: SERVICE-VERIFICATION §4 queries 1–3 (rows, past orders, `get_cart` definition).
2. Apply `update public.services set is_active = false where slug in (…) and is_active;` as a new
   migration. Never `delete`: `order_items` keeps purchase-time snapshots, and `service_id` would be
   set to null.
3. Cart consistency is now handled in the client (§2.1). A shopper whose cart already holds the
   service no longer sees it, and it is not totalled or sent. This holds even if `get_cart` does not filter.
4. Same change: remove the entry from `catalogue.data.ts` (offline fallback) and from Terms §5, and
   reword /about if Fintech Support goes.
5. Verify: run all checks, then do a read-only catalogue GET and expect N − removed rows.
6. Rollback: the same `update` with `is_active = true`, and revert the code commit.

## 4. Production database operations requiring separate authorization

Nothing below has been run. Read-only items need SQL-editor or service-role access, which this
session did not have (the Supabase MCP is unauthorised, and the anon role sees only active rows).

| # | Operation | Type | Why |
|---|---|---|---|
| D1 | `select pg_get_functiondef('public.get_cart'::regproc);` (also `add_cart_item`, `remove_cart_item`, `clear_cart`) | Read | Confirms whether `get_cart` filters `is_active` and where its price comes from (T10) |
| D2 | `select slug, is_active, price_inr from public.services order by position;` | Read | Shows inactive rows, and confirms that migration `20260901e` (test services retired) is applied |
| D3 | `select polname, polcmd, pg_get_expr(polqual, polrelid) from pg_policy where polrelid in ('public.services'::regclass, 'public.orders'::regclass, 'public.order_items'::regclass, 'public.payments'::regclass);` | Read | RLS policies, which are not in the repository |
| D4 | Service deactivation (§3) | **Write** | Only after merchant decision M1 |
| D5 | Cloud & Hosting text and price correction | **Write** | Only after M3 |
| D6 | Optional hardening of `create_airpay_order`: raise when any requested slug is unknown or inactive, instead of silently skipping it. Then a stale or tampered basket fails instead of being charged a partial amount. Proposed SQL is below. | **Write** (function replace) | Defence in depth behind §2.1 |

```sql
-- D6 (proposed, NOT applied). Insert after the null/guest-token checks in create_airpay_order:
if (select count(distinct s.slug) from public.services s
     where s.slug = any (p_service_slugs) and s.is_active)
   <> (select count(distinct x) from unnest(p_service_slugs) as x) then
  raise exception 'create_airpay_order: inactive or unknown service in basket';
end if;
```
D6 turns a silent partial charge into a 502 `order_failed`, which the drawer already handles with
"Try Again". It must ship with an `api/` test update and only with approval.

### 4.1 Payment notification data flow (Task 2)

Sources: code in `api/` (FACT) and statements in code comments or `.env.example` about Airpay
dashboard settings (CLAIM, not verifiable here).

```
                      ┌───────────── authenticmedia.fun (Vercel) ─────────────┐
Shopper browser ──1──▶│ POST /api/payments/create {slugs, merchant 1|2, contact}│
                      │   └─ create_airpay_order (Supabase, server-priced)     │
                      │   └─ Airpay OAuth (credentials of merchant 1 or 2)     │
Shopper browser ◀─2───│ signed opaque fields                                   │
     │                └────────────────────────────────────────────────────────┘
     │3 hosted page (merchant 1: same tab · merchant 2: new window)
     ▼
  Airpay ──4 Response URL + IPN (per-MID dashboard setting)──┐
                                                             ▼
   MID 368250 (merchant 1): CLAIM → authenticmedia.fun/callback/cpm/arp_frontiva/collection
   MID 362380 (merchant 2): CONTRADICTORY CLAIMS → same URL  OR  KKChat directly   (T7, BLOCKED)
                                                             │
                      ┌──────────────────────────────────────▼─────────────────┐
                      │ 5 parse/decrypt → settleOrder → Airpay Order            │
                      │   Confirmation (server-to-server /verify/) → amount     │
                      │   check → settle_airpay_order (Supabase)                │
                      │ 6 THEN relay: all opened callback fields, JSON ────────────▶ kkchat.in/callback/cpm/arp_frontiva/collection
                      └─────────────────────────────────────────────────────────┘
   Also verifying (same settleOrder): /api/orders/status poll · daily cron /api/payments/reconcile
```

**Factual summary for legal review**

| Question | Answer | Basis |
|---|---|---|
| Which merchant account receives each payment? | The one the shopper picks: option 1 → merchant 1 (MID 368250, refs `AM-`), option 2 → merchant 2 (MID 362380, refs `AM2-`). The server maps the index to credentials. | FACT (`create.ts`, `config.ts`). Account ownership: **BLOCKED** (M4) |
| Callback URLs | Merchant 1: this site's `/callback/cpm/arp_frontiva/collection`. Merchant 2: **BLOCKED** (T7) | CLAIM |
| What reaches KKChat | Every field of each accepted callback, as received after decryption: typically order reference, amount, status, Airpay transaction id, and the customer's email, phone and possibly UPI VPA. Max 64 fields of up to 1,024 characters. | FACT (`relay.ts`, `callback-payload.ts`) |
| When | After this site's settlement attempt, for **every** accepted callback: paid, failed, duplicate, payments for orders this site did not create, and unauthenticated plaintext posts (T6) | FACT (`callback-flow.ts`) |
| Direct or via this backend | Merchant 1: via this backend. Merchant 2: **BLOCKED**. If the "KKChat directly" claim is true, Airpay also sends the shopper's browser to KKChat's page. | FACT / CLAIM |
| What this site stores | Supabase `orders` (reference, status, total, contact name/email/phone, guest token, access token, Airpay transaction id, verified-at), `order_items` (purchase-time snapshot), `payments` (status, amount, provider id). Callback payloads are **not** stored. Logs record event names and presence flags, not values. | FACT (migration, `settle.ts`, `log.ts`) |
| Who verifies transactions | This site's server, against Airpay Order Confirmation, for orders it created. Callbacks are never trusted. What KKChat verifies: **BLOCKED** | FACT / BLOCKED |
| Is Privacy §14 accurate? | Partly. It names KKChat and correctly says the site does not rely on the onward copy. It does not say that failed, unverified and other-portal notifications are forwarded too, or (if T7 resolves that way) that merchant 2's data goes to KKChat directly. KKChat's role is undefined. | §4.2 |

### 4.2 Proposed policy changes (for legal approval — NOT applied)

| # | Policy | Proposed change | Depends on |
|---|---|---|---|
| L1 | Privacy §14 | "When Airpay sends us a payment notification for either of our Airpay accounts, we forward a copy of it, including transaction details and the contact information it contains, to KKChat (kkchat.in), [role]. This happens whether the payment succeeded or failed, and before or independently of our own verification." Add the direct route if T7 confirms it. | M5, M6, M9 |
| L2 | Terms §5 / Refund §6 | Remove Fintech/Collection Partner, or add refund treatment (B2) | M1 |
| L3 | Terms §5, catalogue | Define the period covered by Tech Maintenance's "monitoring", or reword (B3) | Merchant |
| L4 | Terms §20 | State a post-delivery support period, or remove it (B4) | Merchant |
| L5 | Refund §6 | Define "sessions", or drop the clause (B5) | Merchant |
| L6 | Refund §3 | Keep or remove the gateway-charge deduction (B6) | Legal |
| L7 | Grievance, FAQ | State the statutory acknowledgement and resolution periods (C2) | Legal |
| L8 | Terms §8 | GST wording once M7 is answered | Accountant |

## 5. Final legal-information checklist

Enter values only in `src/lib/site.ts` → `LEGAL`. `npm test` validates the format; it cannot
validate that a value is genuine.

| Item | Status | Renders on |
|---|---|---|
| CIN | **BLOCKED** (Certificate of Incorporation) | Footer, /about, company block of all 5 policies incl. Grievance |
| GSTIN, or a written "not GST-registered" | **BLOCKED** (GST REG-06) | Same as CIN |
| Directors (name, designation, background, optional DIN) | **BLOCKED** (MCA master data) | /about → Leadership |
| Grievance Officer (name, designation, email, phone), formally designated | **BLOCKED** (board designation) | /grievance-redressal: officer block, complaint email/phone, **and now escalation** |
| Registered address | Done | Footer, /about, Contact, all policy pages |
| Support email / phone | Done: one source (`SITE`). No hard-coded copies were found in pages | All pages |
| Policy approval and effective date | **BLOCKED** (LEGAL-APPROVAL-CHECKLIST §E) | `policy-meta.ts` → every policy + checkout consent |
| KYC documents | None in `public/` or `src/`. Do not add them | — |

Consistency check: Footer, /about, Contact, Grievance, Privacy, Terms, Refund and Service Delivery
all read `SITE`/`LEGAL`. Contact shows no statutory IDs by design, and links Grievance and FAQ.

## 6. Tests actually executed (14 Nov 2026, after the changes)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | Pass |
| Lint | `npm run lint` (oxlint) | Pass, 0 findings |
| Unit + integration | `npx vitest run` | **457 / 457 pass**, 27 files (Phase 3: 447/25) |
| Payment regression | `npx vitest run api` | **389 / 389 pass**. `api/` untouched |
| Build | `npm run build` | Pass. The 667 kB chunk warning is pre-existing |
| E2E + axe (390 / 500 / 768 / 1440 px) | `npx playwright test` | **108 pass, 0 fail**, 4 skipped by design (Phase 3: 100) |
| Mobile accessibility | axe WCAG 2.0/2.1 A+AA in the E2E run | 0 serious/critical on 12 routes, the drawer, the checkout failure and amount-mismatch states, and search, at 390 px and the other three widths |
| Visual QA | `test-results/screenshots/mobile-390/checkout-amount-mismatch.png` inspected | Labels distinct; error announced; Try Again shown |

**Mocks, clearly:** every Supabase, `/api/*` and gateway request in E2E is served by
`e2e/support/mocks.ts`. The checkout tests prove what the drawer sends and how it reacts. They are
**not** payment verification. No sandbox or live payment was made.

**Untested production dependencies:** the real `get_cart`/`add_cart_item` RPCs and RLS (D1, D3);
`create_airpay_order` against real data; Airpay OAuth, the hosted page, callbacks and Order
Confirmation for either MID; KKChat delivery; the Vercel production env names (`vercel env ls
production`, CLI not authenticated); the daily reconcile cron; Safari/Firefox and real devices.

## 7. Release-candidate readiness

**Code: release candidate.** No known avoidable implementation defect remains in the website. T6
(the forwarding policy) is a known gap that needs your approval, not a defect left by omission.

**Release: BLOCKED** until CIN/GSTIN/directors/officer are entered, the policies are approved, M1
and M4–M6 are answered, and a deploy is authorised. Then follow PRE-DEPLOYMENT-CHECKLIST §7.

## 8. Bank re-screening readiness

**Not ready. BLOCKED** on report items 3, 4 and 10 (statutory IDs, directors, Grievance Officer),
policy approval, the Fintech/Collection decision, bank confirmation of guest checkout, and the
business memo sign-off. The live site still serves the pre-audit build, so nothing in this or
earlier phases is visible to the bank until an authorised deploy.
