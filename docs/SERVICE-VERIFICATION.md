# Service Verification

For: the merchant (to confirm or correct each service) and the developer (to apply the decisions).
Prepared: 14 November 2026, Phase 3.

## 1. Source and method

- **Production catalogue:** read-only `GET` on the Supabase `services` table (project
  `ecknryxkuyjsuppvrhbz`) with the public anon key the live site already ships to every
  browser. That is the same request authenticmedia.fun makes. No write was made.
- RLS on `services` only exposes rows where `is_active = true`, so **inactive rows are
  invisible to this check**. The retired Airpay test services (`airpay-integration-test`,
  `airpay-101-payment-test`) do not appear. Migration `20260901e` sets them inactive.
  Whether that migration is applied can only be confirmed with dashboard or service-role access.
- **Result:** 17 active services (12 core, 5 micro). Every title, description, price,
  subtitle and feature matches the bundled fallback `src/features/services/data/catalogue.data.ts`
  word for word.
- **Checkout:** every active service has an "Add to cart" button, and anything in the cart can
  be paid for. `create_airpay_order` re-prices from `services.price_inr` server-side and only
  includes rows with `is_active = true`. So "active" means "purchasable".

## 2. Services needing a business decision

Declared nature of business (site, About, Terms): *IT and digital services, ordered online and delivered remotely.*

| | **Fintech Partner** | **Collection Partner** | **Fintech Support** |
|---|---|---|---|
| Where | `services` row, slug `fintech-partner`, position 2 | `services` row, slug `collection-partner`, position 3 | **Not a service.** Capability card on /about (`about.data.ts`) and the phrase "fintech support" in the About narrative |
| Public text | "Trusted fintech partner delivering secure, scalable financial technology solutions, seamless integrations, compliance support, and continuous innovation to drive business growth." | "Reliable collection partner providing efficient recovery solutions, ethical follow-ups, transparent reporting, and improved cash flow while maintaining strong customer relationships." | "Payment and collection workflows set up to run reliably, with the operational detail handled." |
| Price | ₹499 | ₹999 | n/a (not sold) |
| Active | Yes | Yes | n/a |
| At checkout | Yes, purchasable | Yes, purchasable | No |
| Also named in | Terms §5 "Business and brand services" | Terms §5 | — |
| Category risk | **Medium.** Reads as a financial-services offering, not IT. "Compliance support" implies regulatory advice. "Trusted" is unevidenced. A one-time ₹499 "partnership" has no stated deliverable. | **High.** Reads as debt collection / recovery, a high-risk category in gateway merchant-category screening. If done for RBI-regulated lenders, recovery-agent conduct rules apply. | **Low–medium.** "Collection workflows" echoes the same concern. |
| Information needed | What is actually delivered (for example payment-gateway integration consulting = IT); for whom; the evidence for "compliance support" | What is actually delivered. If it is software or workflow set-up for a client's own receivables, say so. If it involves contacting debtors, the authorisation under which it is done. | Align with the two decisions on the left |

**Options for the merchant (choose one per service):**
1. **Keep**, with evidence of the activity and of the legal basis for it.
2. **Reword** to the IT service actually delivered (for example "Payment Integration
   Consulting"). This needs new title, description and scope from the merchant. It is not written here.
3. **Deactivate** (plan in §4).

## 3. Service specification (all 17 live services)

Legend: ✅ taken from the live catalogue · ⚠ inferred, needs confirmation · ❌ **missing, merchant to supply**.
Pricing model for every service, from the Terms and the Refund policy: **one-time, fixed price in INR,
no subscription, paid in advance through Airpay**. Fulfilment for every service, from the Service
Delivery Policy: **manual, remote, electronic. Work starts after payment is verified and access or
information is received.** GST treatment: ❌ (MERCHANT-DETAILS D5).

### Core services

| # | Service | Price | Description (live) | Scope / deliverables | Timeline | Sample |
|---|---|---|---|---|---|---|
| 1 | Tech Maintenance | ₹849 | Regular updates, quick fixes, security monitoring, support | ❌ What is covered, for how long ("monitoring" implies a period, but the service is one-time) | ❌ | ❌ |
| 2 | Fintech Partner | ₹499 | see §2 | ❌ | ❌ | ❌ |
| 3 | Collection Partner | ₹999 | see §2 | ❌ | ❌ | ❌ |
| 4 | Software Orchestration | ₹899 | Coordinating applications, services, workflows | ❌ | ❌ | ❌ |
| 5 | Cyber & Security Basics | ₹499 | Protecting systems, networks, data; secure practices | ❌ (assessment? training? configuration?) | ❌ | ❌ |
| 6 | Data & Automation Basics | ₹999 | Collecting/analysing data, automating tasks | ❌ | ❌ | ❌ |
| 7 | Business Consulting | ₹899 | Market positioning, sales strategy, process optimisation | ❌ Number or length of sessions; written output? | ❌ | ❌ |
| 8 | Branding & Content (badge POPULAR) | ₹499 | Design and content, social media, ad creatives | ❌ Number of creatives / revisions. "POPULAR" badge: evidence? | ❌ | ❌ |
| 9 | AI & Automation | ₹999 | Chatbots, CRM workflows, data-driven systems | ❌ | ❌ | ❌ |
| 10 | Website Security Audit | ₹149 | WordPress/WooCommerce vulnerability audit with recommendations | Partial: audit report with actionable recommendations ✅; checks performed ❌ | ❌ | ❌ (an anonymised report would satisfy item 11) |
| 11 | SEO Audit Service | ₹349 | Technical, on-page, performance, ranking review with report | Partial: "detailed actionable report" ✅ | ❌ | ❌ |
| 12 | AI & Automation Advanced | ₹999 | Custom CRM integrations, data pipelines, workflow systems | ❌ "Custom" work at a fixed ₹999 needs a defined boundary | ❌ | ❌ |

### Micro-services (features are shown on the card)

| # | Service | Price | Live feature list (= stated scope) | Missing | Sample |
|---|---|---|---|---|---|
| 13 | Website Health Check | ₹999 | Broken link check & fix (basic); mobile responsiveness audit; SSL installation assistance | ❌ Deliverable format, timeline, what "basic" covers | ❌ |
| 14 | Tech Support & Maintenance | ₹999 | One-time website error fix (minor); plugin/theme update; CMS login & access recovery | ❌ Definition of "minor"; timeline | ❌ |
| 15 | API & Tech Integrations | ₹799 | Payment-gateway integration review; API connectivity check; webhook set-up (basic) | ❌ Timeline; deliverable | ❌ |
| 16 | App & UI Support | ₹650 | UI bug reporting (audit); app crash-log review (basic); screen-flow review | ❌ Timeline; report format | ❌ |
| 17 | Cloud & Hosting | ₹899 ⚠ | Hosting comparison & recommendation; domain & DNS help; Server Performance Review (Basic) ⚠ | ⚠ **Price and third feature were inferred** from a truncated reference screenshot and are live. Confirm or correct. ❌ Timeline | ❌ |

**Consistency note fixed in this phase:** Home's link read "Explore all **18** services", but
production has 17. The label is now "Explore all services" (`home.data.ts`), so it cannot
drift when services are added or retired.

## 4. Safe deactivation plan (NOT executed; requires written merchant approval)

Deactivate, never delete. `order_items.service_id` is `ON DELETE SET NULL`, and deleting would
degrade any real order record that references the row. This follows the existing pattern in
`supabase/migrations/20260901e_retire_airpay_test_services.sql`.

**Pre-checks (read-only, Supabase SQL editor):**
```sql
-- 1. Rows to change (expect exactly the approved slugs)
select slug, title, price_inr, is_active from public.services
 where slug in ('fintech-partner', 'collection-partner');

-- 2. Any past or open orders for them (for the record; they are not modified)
select o.reference, o.status, oi.service_slug, o.created_at
  from public.order_items oi join public.orders o on o.id = oi.order_id
 where oi.service_slug in ('fintech-partner', 'collection-partner')
 order by o.created_at desc;

-- 3. ⚠ Check how get_cart treats inactive services
select pg_get_functiondef('public.get_cart'::regproc);
```
⚠ **Phase 4 update:** the cart now drops inactive services and re-prices from active rows in the client, and checkout refuses any amount mismatch, so the risk below no longer reaches the shopper. Pre-check 3 is still worth running.

⚠ **Pre-check 3 matters.** `get_cart` is not in this repository. `create_airpay_order` silently
**skips** inactive slugs. If `get_cart` still returns a deactivated item with its price, a shopper
whose cart already holds it would see a total higher than the amount charged. Terms §8 promises
those two amounts match. If `get_cart` does not filter `is_active`, fix that first (separate
approved change), or remove those cart rows with approval.

**Change (as a new migration, for example `2026MMDD_retire_unsupported_services.sql`):**
```sql
update public.services
   set is_active = false
 where slug in ('fintech-partner', 'collection-partner')   -- only the slugs approved in writing
   and is_active;
```
Idempotent. `is_active = false` removes the services from the public RLS read, the catalogue, and the
server-side price sum.

**Code follow-ups in the same change (otherwise the text survives elsewhere):**
1. `catalogue.data.ts`: remove the entries from the offline fallback.
2. `terms.ts` §5: remove them from "Business and brand services".
3. `about.data.ts`: reword or remove the "Fintech Support" card and "fintech support" in the narrative.
4. Run all checks, then verify the live catalogue with a fresh read-only GET (expect 15 rows).

**Rollback:** the same `update` with `is_active = true`.
