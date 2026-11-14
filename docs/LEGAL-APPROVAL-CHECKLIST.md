# Legal Approval Checklist

For: the company's legal reviewer and the authorised director.
Prepared: 14 November 2026, Phase 3. **Nothing in this file approves anything.** Every box is
for the reviewer to tick.

Documents in scope, all rendered from `src/features/legal/content/` and all shown publicly as
**"Version 1.0-draft · Prepared 2 November 2026 · Effective date: to be confirmed on publication"**:

| Page | Route | Source |
|---|---|---|
| Terms & Conditions (27 sections) | /terms | `terms.ts` |
| Privacy Policy (27 sections) | /privacy | `privacy.ts` |
| Refund & Cancellation Policy (24 sections) | /refund | `refund.ts` |
| Service Delivery Policy (13 sections) | /service-delivery-policy | `service-delivery.ts` |
| Grievance Redressal | /grievance-redressal | `grievance.ts` |

The checkout requires an unticked-by-default consent box (Terms + Refund) before payment.
Verified in code and in E2E.

## A. Statements checked against the application: accurate

These were verified in code on 14 Nov 2026. The reviewer only needs to confirm the policy
wording is acceptable.

- Guest checkout only; no customer account (Terms §6, Privacy §5).
- Email **or** phone required, name optional (`checkout-contact` validation; Airpay requires one of them).
- Guest token stored in local storage as `am.guest_token` (`guest-token.ts`).
- Prices re-calculated server-side from the catalogue; browser sends only service slugs and a merchant index.
- A payment counts as confirmed only after server-to-server verification with Airpay and an
  amount check; a mismatch is held for manual review (Refund §11). Implemented in `api/_lib/settle.ts`.
- Pending payments are re-checked by the order page and by a scheduled job (`vercel.json`
  cron, **daily at 03:00 UTC**). The policy says "periodic", which is accurate.
- No automatic confirmation email; no refund form; refunds handled manually by email.
- No analytics or advertising trackers; Google Fonts is loaded (`index.html`).
- Airpay callbacks are relayed to KKChat (`api/_lib/relay.ts`).

## B. Contradictions and inconsistencies to resolve

| # | Issue | Where | Suggested resolution (reviewer decides) |
|---|---|---|---|
| B1 | **Complaint routing differs between pages.** Terms §23, Refund §21 and Service Delivery §11 send complaints to `contact@` and say escalation goes "to the same address". The Grievance page names a Grievance Officer once one is designated. Escalating to the same inbox is not a real escalation. | terms, refund, service-delivery | **Phase 4: fixed (draft).** Terms §23, Refund §21 and Service Delivery §11 now escalate via /grievance-redressal; Grievance escalation goes to the officer once `LEGAL` names one. |
| B2 | **Fintech Partner / Collection Partner** are listed in Terms §5 but not in Refund §6's categories, so there is no refund rule for them. | terms §5, refund §6 | Depends on the merchant's decision (SERVICE-VERIFICATION §2). If kept, add refund treatment. If deactivated, remove them from Terms §5. |
| B3 | **"One-time" vs ongoing wording.** Terms §5 and Refund §1 say every service is one-time, with no subscriptions. The live "Tech Maintenance" description promises "regular updates … security monitoring", which implies a period. | terms, catalogue | Merchant to define the period covered, or reword the service. |
| B4 | **Post-delivery support period undefined.** Terms §20: support "for a reasonable period afterwards". | terms | State a period or remove. |
| B5 | **"Sessions" undefined.** Refund §6: "unused sessions … are refundable", but no catalogue service defines sessions. | refund | Align with what Business Consulting actually includes. |
| B6 | **Deduction before work begins.** Refund §3: full refund, "no arbitrary cancellation fee", but an irrecoverable gateway charge may be deducted after notice. | refund | Confirm this deduction is lawful and intended, or remove it for a simpler full refund. |
| B7 | **Payment options.** Terms §7 says "choose the available payment option" (singular). Checkout offers **two** options, both labelled "Pay with airpay", routed to two Airpay merchant accounts. | terms, checkout | **Phase 4: wording fixed** ("one of the payment options shown at checkout"); labels now Option 1 / Option 2. D3 still open. |

## C. Missing confirmed information / unsupported commitments

| # | Gap | Where | Needed |
|---|---|---|---|
| C1 | No refund turnaround time ("will be published here once confirmed"). | refund §16 | A timeline the company can meet (from approval to initiation). Bank/gateway settlement time to be stated separately. |
| C2 | Grievance timelines say "within the time limits required by applicable law" instead of stating them. | grievance, FAQ | Counsel to state the acknowledgement and resolution periods required by the Consumer Protection (E-Commerce) Rules, 2020, and confirm the company can meet them. |
| C3 | No delivery timelines for any service. The policies correctly avoid promising any. | terms §18, service-delivery §8 | Not a defect. If the merchant supplies verified timelines (SERVICE-VERIFICATION §3), the policies can reference them. |
| C4 | Data-retention periods not fixed. | privacy §17 | Periods per data category, or legal confirmation that the current wording is acceptable. |
| C5 | Grievance Officer not named. | grievance | MERCHANT-DETAILS §C. Required by the E-Commerce Rules. |
| C6 | CIN / GSTIN not shown in any policy company block. | all | MERCHANT-DETAILS §A |
| C7 | DPDP Act wording ("Rules, 2025 notified in November 2025 … aligning with them"). | privacy §10 | Counsel to confirm the statement of law is current. |

## D. Payment and cancellation procedures needing confirmation

| # | Question |
|---|---|
| D1 | **GST.** Terms §8 says taxes "will be disclosed as required by law". The checkout shows one total with no tax line, and no invoice is issued by the site. Are prices GST-inclusive? Who issues the tax invoice, and how? |
| D2 | **Cancellation channel is email only.** It is accurate. Confirm it is acceptable (E-Commerce Rules require the cancellation process to be clearly stated). |
| D3 | **Two Airpay merchant accounts.** Checkout lets the shopper choose between merchant 1 and merchant 2 with identical labels. Confirm **both** accounts belong to Authentic Media and IT Sector Private Limited (the seller named in the Terms). If either is another entity, the Terms, Privacy Policy and checkout labels must say so. |
| D4 | **KKChat.** Privacy §14 says payment notifications are passed to KKChat (kkchat.in), "a third-party service involved in our payment arrangements". Per the deployment notes (`.env.example`), merchant 2's callbacks go to KKChat **directly from Airpay**, not through this site. Confirm the relationship with KKChat, its role, and that the disclosure covers both routes. |
| D5 | Guest checkout without a customer account: confirm with the acquiring bank (report item 8). |

## E. Sign-off (reviewer to complete)

| Document | Changes required? | Approved by (name, role) | Date | Effective date to publish |
|---|---|---|---|---|
| Terms & Conditions | ☐ | | | |
| Privacy Policy | ☐ | | | |
| Refund & Cancellation | ☐ | | | |
| Service Delivery | ☐ | | | |
| Grievance Redressal | ☐ | | | |
| Business memo (`BUSINESS-MEMO-DRAFT.md`) | ☐ | | | |

**After approval (developer):** apply the text changes. Set `POLICY_META.version` (for example `1.0`)
and `effectiveDate` in `policy-meta.ts`. That replaces "1.0-draft · to be confirmed on
publication" on every policy page and in the checkout consent line. Then run all checks.
