# Final Website Release Report

For: the business owner and the developer who will deploy to a Vercel preview.
Prepared: 14 November 2026. Scope: website-only (no payment, API, callback, database or `vercel.json` changes).

**Verdict: technically ready for a Vercel _preview_ deployment.** It is not ready for production
sign-off. The policies are still `1.0-draft`, statutory identifiers are not supplied, and several
services still lack merchant-confirmed scope (see §9).

Nothing has been committed, pushed or deployed.

## 1. Verification table

| # | Requirement | Previously available | Changes made | Final result | Test evidence |
|---|---|---|---|---|---|
| 1 | Multi-page website | 11 routes, incl. all 5 policies, FAQ, 404. No per-service pages, no policies hub. Home/Contact/Services/About had the generic title only | Added `/policies` and `/services/:slug`. Added titles, descriptions and canonical links to Home, Services, About, Contact, 404 and service pages | **PASS** | `pages.spec.ts`: 16 routes × 4 viewports (one h1, no overflow, axe, no console errors). Live smoke: every route + refresh |
| 2 | FAQ in header | FAQ already in header and footer; 13 questions | Added 8 questions (now 21) covering all 14 requested topics. Added a search filter with a result count and an empty state. Kept the native `<details>` accordions | **PASS** | `FAQ search filters questions and links to the refund policy` (4 viewports) |
| 3 | Policies in header | Only in footer | Desktop: "Policies" disclosure menu (button + links; Escape returns focus; closes on outside click or blur). Mobile: "Policies" section in the menu. New `/policies` hub with 5 cards. One shared `POLICIES` list feeds all three | **PASS** | `desktop Policies menu works by keyboard…`, `mobile menu has a Policies section` |
| 4 | About Us | Hero, narrative, company facts, What We Do, How It Works, CTA | Added **Business Operations** and **Contact and Registered Office** sections and reordered the page into the requested sequence. Moved contact and office out of the facts table so they are not repeated. Leadership still renders only from `LEGAL.directors` (empty) | **PASS** | `about` page test × 4 viewports; screenshots |
| 5 | Refund policy | `/refund` with 22 sections covering every listed provision; linked from footer and FAQ | Now also linked from the Policies menu, hub and mobile menu, a new FAQ entry and every service page. Policy text unchanged; still a draft | **PASS** | Dropdown test navigates to `/refund`; link crawl |
| 6 | Local / hosting | Vercel (`vercel.json`); Vite locally | None. Verified only | **PASS** | §5 |
| 7 | Service visibility | Services page showed all 17, in two fixed sections. No search, filter or sort. Home showed 6 core + 5 micro | One catalogue browser: search (title, subtitle, description, deliverables), category filter, sort (featured, price ↑/↓, name), "Showing X of Y", a no-match state with Clear filters, and the existing loading, error and empty states. No pagination: 17 items do not need it. Home link renamed **View all services** | **PASS** | `services page lists, searches, filters and sorts…`; `browse-services.test.ts` (4); live smoke "Showing 17 of 17" |
| 8 | Service details | None (cards only; search jumped to an anchor) | `/services/:slug` for every active service. Service-specific content comes from its Supabase row; everything else comes from the policies. Cards have a title link and "View details"; search results open the detail page. Missing slug → 404 | **PARTIAL** | All 17 detail pages load from live data with the correct price. Per-service scope, timelines and samples still need merchant input (§4) |

## 2. Files changed in this phase

New:
- `src/routes/pages/policies-page.tsx`
- `src/routes/pages/service-detail-page.tsx`
- `src/features/legal/content/policies.ts`: the shared ordered policy list
- `src/features/services/components/services-browser.tsx`
- `src/features/services/lib/browse-services.ts` + `browse-services.test.ts`
- `src/features/services/hooks/use-service.ts`
- `src/features/about/components/operations-section.tsx`: Business Operations and Contact & Registered Office
- `docs/FINAL-WEBSITE-RELEASE-REPORT.md`

Modified:
- `src/routes/index.tsx`, `src/routes/paths.ts`: new routes, `servicePath()`, "Policies" in the footer
- `src/components/layout/header.tsx`: Policies dropdown and mobile section; the mobile menu now scrolls
- `src/features/faq/data/faq.data.ts`, `src/routes/pages/faq-page.tsx`
- `src/features/about/data/about.data.ts`, `components/company-info-section.tsx`, `components/index.ts`, `index.ts`, `src/routes/pages/about-page.tsx`
- `src/features/services/components/service-card.tsx`, `micro-service-card.tsx`, `components/index.ts`, `index.ts`
- `src/routes/pages/services-page.tsx`, `home-page.tsx`, `contact-page.tsx`, `not-found-page.tsx`: page metadata
- `src/features/search/components/search-result-row.tsx`: opens the detail page
- `src/features/home/data/home.data.ts`: "View all services"
- `src/features/legal/index.ts`: exports `POLICIES`
- `e2e/pages.spec.ts`, `e2e/flows.spec.ts`: new routes and flows; the link crawl now expects 11 + 17 pages
- `api/payments/test-service-101.test.ts`: **file list only**. That test scans catalogue UI files for a retired slug; it pointed at the two deleted components and now points at their replacements. No payment logic changed.

Deleted (replaced by `services-browser.tsx`):
- `src/features/services/components/core-offerings-section.tsx`
- `src/features/services/components/catalogue-micro-services-section.tsx`

Not touched: `api/` runtime code, `vercel.json`, `supabase/`, `src/services/` (catalogue, cart, payment), checkout, `.env*`.
Other uncommitted changes in the working tree (cart, migrations, docs) predate this phase.

## 3. Routes and navigation

| Route | Status |
|---|---|
| `/policies` | **New**: policies hub |
| `/services/:slug` | **New**: service detail. An unknown or inactive slug renders the 404 page |
| `/`, `/services`, `/about`, `/faq`, `/contact`, `/terms`, `/privacy`, `/refund`, `/service-delivery-policy`, `/grievance-redressal`, `/order-success`, `*` | Unchanged URLs |

There are no duplicate policy URLs. Every policy appears once, at its existing path.

Header: Home · Services · About Us · FAQs · **Policies ▾** · Contact Us (desktop, ≥1024px). The mobile
menu lists the same pages, then a **Policies** section with All policies plus the five policies.
Footer: "Policies" added to Quick Links.

## 4. Services

Live catalogue (read-only GET, 14 Nov 2026): **17 active: 12 core, 5 micro**, all HTTP 200.

| # | Slug | Service | Price |
|---|---|---|---|
| 1 | tech-maintenance | Tech Maintenance | ₹849 |
| 2 | fintech-partner | Fintech Partner | ₹499 |
| 3 | collection-partner | Collection Partner | ₹999 |
| 4 | software-orchestration | Software Orchestration | ₹899 |
| 5 | cyber-security-basics | Cyber & Security Basics | ₹499 |
| 6 | data-automation-basics | Data & Automation Basics | ₹999 |
| 7 | business-consulting | Business Consulting | ₹899 |
| 8 | branding-content | Branding & Content | ₹499 |
| 9 | ai-automation | AI & Automation | ₹999 |
| 10 | website-security-audit | Website Security Audit | ₹149 |
| 11 | seo-audit-service | SEO Audit Service | ₹349 |
| 12 | ai-automation-advanced | AI & Automation Advanced | ₹999 |
| 13 | website-health-check | Website Health Check | ₹999 |
| 14 | tech-support-maintenance | Tech Support & Maintenance | ₹999 |
| 15 | api-tech-integrations | API & Tech Integrations | ₹799 |
| 16 | app-ui-support | App & UI Support | ₹650 |
| 17 | cloud-hosting | Cloud & Hosting | ₹899 |

**New service records awaiting approval: none.** No new offerings were added. No name, scope,
price or merchant authorisation exists for any. The production catalogue was not modified.
Service IDs (slugs) are unchanged, so cart rows and historic orders still resolve.

### What each detail page shows, and where it comes from
| Section | Source |
|---|---|
| Name, icon, subtitle, overview, price | The service's Supabase row |
| Scope and deliverables | The row's feature list (micro-services). For core services, which have none, the page says scope is confirmed in writing (Service Delivery Policy, "Scope Confirmation") |
| How it works | The existing 4-step workflow shared with About and Services |
| Information we may need | Service Delivery Policy, "Information We May Need From You" |
| Timeline / Revisions | "No fixed time / number published; agreed in writing" (Terms, Service Delivery Policy) |
| Cancellations and refunds | Refund policy summary + links |

**Needs merchant review** (unchanged from `docs/SERVICE-VERIFICATION.md` §2–3):
- Deliverables for all 12 core services.
- Timelines and samples for all 17.
- The Cloud & Hosting price (₹899) and its third feature, which were inferred from a screenshot.
- The category risk of Fintech Partner and Collection Partner.
- Evidence for the "POPULAR" badge.

Once supplied, these belong in the Supabase `services` row (for example in `features`), and the
detail page shows them with no code change.

## 5. Local run and hosting (Requirement 6)

- Hosting: **Vercel**. `vercel.json` builds with `npm run build` into `dist/`, with an SPA rewrite for every non-`/api` path. That rewrite is why direct links and refreshes work on Vercel. No migration was made.
- Commands:
  - `npm install`
  - `npm run dev`: local dev server (Vite; serves the SPA fallback, so direct routes work)
  - `npm run build`: typecheck + production build to `dist/`
  - `npm run preview`: serve the built `dist/` locally
  - `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`
- Environment: `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set (values not printed). The project host matches production (`ecknryxkuyjsuppvrhbz`).
- `npm run dev` serves the website only. `/api/*` functions run only on Vercel (or `vercel dev`), so local checkout cannot complete. That is expected and was not exercised.

**Live-data smoke test** (dev server + real Supabase, no mocks, desktop 1440):
- All 11 public routes plus the 404 loaded **and survived a reload**. Each has its own title and one h1.
- `/services` showed "Showing 17 of 17 services". All 17 detail pages loaded from live data with the correct prices.
- 48 Supabase reads, **all HTTP 200**. No 401 or invalid-API-key errors, no runtime errors, no console errors.
- For safety, all `/rpc/*` calls and `/api/*` were aborted, so no cart row, order or payment could be created. The only aborted call was `get_cart`.

## 6. Test results (all run 14 Nov 2026)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **Pass**, 0 errors |
| Lint | `npm run lint` (oxlint) | **Pass**, 0 warnings |
| Unit tests | `npm test` (vitest) | **Pass**, 28 files, 461 tests |
| Browser + accessibility | `npx playwright test` (390 / 500 / 768 / 1440) | **Pass**, 140 passed, 8 skipped (viewport-specific tests skip where not applicable), 0 failed |
| Production build | `npm run build` | **Pass** |
| Live-data smoke | §5 | **Pass** |

The browser suite runs axe (WCAG 2.0/2.1 A/AA) on every page at every viewport and fails on any
serious or critical violation. It also checks horizontal overflow, console errors, one h1 per page,
and broken internal links (it crawls all 28 linked pages).

Payments: the suite mocks Supabase, `/api/*` and the gateway, and fails if any request leaves
localhost. No real payment was attempted.

## 7. Screenshots

Written by the browser suite to `test-results/screenshots/<viewport>/`. The viewports are
`mobile-390`, `small-500`, `tablet-768` and `desktop-1440`. That folder is git-ignored and is
regenerated on every run.

Highlights: `policies-dropdown.png` (desktop), `mobile-menu.png`, `policies.png`, `services.png`,
`services-no-match.png`, `service-detail-core.png`, `service-detail-micro.png`,
`service-detail-missing.png`, `faq.png`, `about.png`.

Visually reviewed: the desktop service detail page, the policies dropdown, the policies hub, the
mobile services page and the mobile menu.

## 8. Known outstanding issues

1. **Policies are drafts** (`1.0-draft`, effective date unset). They are not marked approved. See `LEGAL-APPROVAL-CHECKLIST.md`.
2. **No CIN, GSTIN, directors or grievance officer** in `LEGAL` (`src/lib/site.ts`). The About Leadership block and footer identifiers stay hidden until these are supplied from company documents.
3. **Service scope gaps** (§4), and the open decision on Fintech Partner and Collection Partner.
4. **SEO meta is client-side**: titles and descriptions are set after the page loads (SPA). Google renders JavaScript, but social-preview crawlers will see the `index.html` default. There is no sitemap or robots file yet.
5. **Bundle size**: one 691 kB JS chunk (202 kB gzipped). It works, but route-level code splitting would speed up first load. This was not done in this phase.
6. **Contact details mismatch**: the FAQ "How do I book" answer says checkout asks for name, email and phone. The Privacy Policy says email *or* phone, with name optional. One should be aligned to the actual checkout form. This is policy text and was left for review.

## 9. Deployment checklist (Vercel preview)

- [ ] Review the diff (`git status` also contains earlier uncommitted cart, migration and docs work; decide what ships together).
- [ ] Commit on a branch (not done by this phase).
- [ ] Vercel preview environment has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and the server-only Airpay and `CRON_SECRET` variables (names only; none may carry a `VITE_` prefix).
- [ ] Deploy as a **preview**, not production.
- [ ] On the preview URL: refresh `/policies`, `/services/seo-audit-service` and `/faq` directly. Open the Policies menu with a keyboard. Confirm "Showing 17 of 17 services".
- [ ] Do not run a real payment on the preview unless separately authorised under `docs/AIPAY-DOCS.md`.
- [ ] Before production: policy approval, `LEGAL` values, and the merchant decisions in §4 and §8.
