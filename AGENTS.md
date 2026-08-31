AGENTS.md — Frontend-First Full-Stack Application Engineering Rules

1. Purpose

This repository is a full-stack application that is being implemented in phases.

Current phase

The immediate goal is frontend implementation only.

The frontend must:

Match the provided reference screenshots in the inspiration/ directory as closely as possible.

Be production-quality, responsive, accessible, and componentized.

Use the existing project architecture and installed skills instead of introducing unnecessary patterns.

Keep all backend/payment/auth integrations behind clean interfaces so they can be connected later.

Future integrations

Do not implement these integrations unless a feature explicitly requires a frontend placeholder/interface:

Supabase authentication/database/storage

Airpay/payment integration

Backend APIs

Production payment callbacks/webhooks

Server-side business logic

The architecture must, however, make those future integrations easy to add without rewriting the UI.

2. Repository Structure

The .agents/skills/ directory contains reusable engineering skills.

Expected skill areas include:

image-to-code

react

react-devtools

react-state-management

tailwind-patterns

tailwind-v4

tailwind-v4-shadcn

tailwindcss-fundamentals-v4

typescript-advanced-types

typescript-best-practices

typescript-react-reviewer

inspiration/

The inspiration/ directory contains the reference screenshots that define the visual target.

Rule

Before implementing a feature, inspect the relevant skills and reference screenshots. Do not ignore existing repository guidance and recreate patterns that are already available.

3. Source of Truth Priority

When implementing a feature, follow this priority:

Explicit feature requirements provided by the task.

Reference screenshots in inspiration/.

Existing project architecture and established components.

Existing .agents/skills/ guidance.

Established TypeScript/React/Tailwind best practices.

Personal implementation preference.

Do not replace a requirement with a preferred implementation style.

4. Screenshot Fidelity

The reference screenshots are the visual source of truth.

When a screenshot exists for a screen:

Reproduce layout hierarchy accurately.

Reproduce spacing and alignment.

Reproduce typography scale and weight.

Reproduce borders, radii, shadows, and dividers.

Reproduce colors and contrast.

Reproduce icons and icon placement.

Reproduce cards, tables, forms, navigation, tabs, badges, buttons, and empty states.

Reproduce responsive behavior logically when screenshots only show one viewport.

Preserve the visual density of the reference.

Do not "improve" the design unless the task explicitly requests a redesign.

Important

Do not create a generic dashboard and claim it matches the screenshot.

If the screenshot has a specific composition, implement that composition.

5. Image-to-Code Workflow

For screenshot-driven features:

Identify the exact reference screenshot(s).

Inspect the screenshot carefully.

Break the page into:

shell

navigation

header

page sections

reusable components

data displays

forms

actions

responsive behavior

Identify typography and spacing patterns.

Identify reusable visual primitives.

Implement the page.

Compare the implementation against the screenshot.

Fix the largest visual differences first.

Repeat until the result is visually close.

Never stop after the first implementation if obvious visual mismatches remain.

6. Frontend Architecture

Use a maintainable React + TypeScript architecture.

Prefer a structure similar to:

src/
  app/
  components/
    ui/
    layout/
    shared/
  features/
    <feature>/
      components/
      hooks/
      types/
      data/
      utils/
  pages/
  routes/
  lib/
  services/
  stores/
  types/
  assets/

Adapt this to the existing repository instead of blindly creating a new structure.

Component rules

Create components when:

a UI section is reusable,

a component has meaningful internal behavior,

a section makes a page unnecessarily large,

a visual pattern appears multiple times.

Do not create excessive one-line wrapper components.

7. React Rules

Use modern React patterns.

Prefer:

functional components

hooks

composition

controlled components when appropriate

clear props

colocated feature logic

reusable UI primitives

Avoid:

unnecessary global state

prop drilling across many unrelated layers

giant components

duplicated UI markup

business logic embedded directly in JSX

unnecessary useEffect

premature abstractions

Keep components readable.

8. TypeScript Rules

TypeScript must be strict and meaningful.

Prefer:

explicit domain types

discriminated unions where useful

typed component props

typed service interfaces

unknown over any

reusable type definitions

Avoid:

any unless absolutely unavoidable

duplicated types

type assertions used to silence errors

loosely typed API placeholders

Future backend contracts should be represented with types/interfaces even when the implementation is mocked.

9. Styling Rules

Use the project's existing Tailwind CSS setup.

Prefer:

Tailwind utility classes

existing design tokens

reusable UI components

consistent spacing

responsive utility classes

CSS variables/design tokens where already established

Do not:

introduce another styling framework without a clear requirement,

mix multiple styling approaches unnecessarily,

hardcode repeated visual values throughout the application,

create arbitrary CSS when Tailwind or an existing component already solves the problem.

Follow the installed Tailwind v4 and shadcn-related skills when applicable.

10. Design System

Create consistency across screens.

Establish reusable patterns for:

buttons

inputs

selects

textareas

cards

badges

alerts

dialogs

tabs

dropdowns

tables

pagination

breadcrumbs

navigation

loading states

empty states

error states

If the screenshot establishes a visual language, preserve it across newly created screens.

11. Responsive Design

Every new screen must be responsive unless the feature explicitly states otherwise.

Check at minimum:

mobile

tablet

desktop

large desktop

Do not simply shrink the desktop layout.

Consider:

navigation collapse

stacking

table overflow

card wrapping

typography scaling

button placement

form layout

modal dimensions

content padding

12. Accessibility

All UI must be accessible.

Use:

semantic HTML

accessible labels

keyboard navigation

visible focus states

sufficient color contrast

appropriate ARIA attributes where necessary

buttons for actions

links for navigation

Do not use clickable div elements when a semantic element is appropriate.

Images require meaningful alt text unless decorative.

13. Frontend Data Strategy

Until Supabase/backend integration exists, use a clear mock-data layer.

Example:

features/
  feature-name/
    data/
      mock-data.ts
    types/
      feature.types.ts

Mock data must resemble realistic production data.

Do not scatter fake objects directly throughout JSX.

Prefer:

const data = getMockData();

over embedding large arrays inside components.

14. Future Backend Boundaries

The UI must not depend directly on Supabase or Airpay during the frontend-only phase.

Use service boundaries such as:

export interface AuthService {
  signIn(...): Promise<...>;
  signOut(...): Promise<void>;
  getSession(...): Promise<...>;
}

or feature-specific service interfaces.

For now, implementations may be mock/local implementations.

Later:

UI
 ↓
Feature hooks
 ↓
Service interface
 ↓
Supabase / Backend / Airpay

This prevents vendor-specific logic from spreading throughout the UI.

15. Authentication Placeholders

If authentication screens are implemented before Supabase:

Build the complete UI.

Implement frontend validation.

Implement loading/error/success states.

Use a mock authentication service where interaction is needed.

Do not pretend a user is actually authenticated against Supabase.

Clearly isolate the future integration point.

When Supabase is introduced, replace the service implementation rather than rewriting the UI.

16. Payment / Airpay Placeholders

For payment-related screens before Airpay integration:

Implement the complete payment UI.

Implement amount/order/transaction types.

Implement validation.

Implement loading, success, failure, and retry states.

Mock the payment service.

Keep payment-provider-specific logic outside UI components.

Do not add fake production payment credentials or hardcode provider secrets.

17. Routing

Routes should be:

explicit,

readable,

feature-oriented,

protected through route guards once authentication exists.

During the frontend-only phase, routes may use mock auth state where necessary.

Do not duplicate route definitions across components.

18. State Management

Use local state by default.

Use shared/global state only when state is genuinely shared across unrelated components or routes.

Examples of appropriate global state:

authenticated user/session

application-wide preferences

persistent UI state

Avoid global state for:

one form

one modal

one dropdown

one page's temporary data

Follow the repository's react-state-management skill before introducing a state library.

19. Forms

Forms should include:

labels

validation

helpful error messages

loading/submitting state

disabled state during submission where appropriate

success feedback

keyboard accessibility

Prefer schema validation if the project already uses a validation library.

Do not add a large form library unless the project requires it.

20. Error, Loading, and Empty States

Every data-dependent screen should consider:

Loading

Show a visual loading state that fits the screenshot/design system.

Empty

Explain what is missing and provide a useful next action where applicable.

Error

Explain the problem without exposing implementation details.

Success

Give clear confirmation for completed actions.

Do not leave buttons apparently broken while data is loading.

21. Performance

Avoid unnecessary complexity and rendering.

Prefer:

component-level memoization only when justified

lazy loading for genuinely large routes/features

optimized image assets

stable list keys

avoiding unnecessary effects

avoiding large dependencies for small problems

Do not prematurely optimize at the expense of maintainability.

22. Security

Even in frontend-only development:

never commit secrets,

never expose credentials,

never put private keys in frontend code,

never trust client-side authorization as the final security boundary,

never implement fake security that could accidentally be mistaken for production security.

Real authorization will be enforced by the backend/Supabase layer later.

23. Dependency Rules

Before adding a dependency:

Check whether the repository already has an equivalent.

Check whether the existing skills recommend a solution.

Prefer native/browser/React/Tailwind solutions for small requirements.

Add a dependency only when it provides meaningful value.

Do not introduce duplicate libraries.

24. File and Naming Conventions

Use predictable naming.

Prefer:

user-profile.tsx
UserProfile.tsx
useUserProfile.ts
user-profile.types.ts
user-profile.service.ts

Follow the existing repository convention if one already exists.

Avoid vague names such as:

Stuff.tsx
Helper.ts
NewComponent.tsx
TestPage.tsx

25. Code Quality

Before considering a feature complete:

TypeScript passes.

Lint passes.

Build passes.

No obvious console errors.

No broken routes.

No missing imports.

No dead code introduced.

No unnecessary dependencies.

Responsive behavior is checked.

Screenshot fidelity is checked.

26. Do Not Overwrite Existing Work

Before changing an existing file:

Read it.

Understand its responsibility.

Preserve working behavior.

Extend existing abstractions when appropriate.

Avoid rewriting unrelated code.

Do not delete an existing implementation merely because a new implementation looks cleaner.

27. Feature Completion Standard

A feature is complete only when:

UI is implemented.

Relevant screenshot fidelity is achieved.

Interactions work.

Validation works.

Loading/error/empty states are handled where relevant.

Responsive layout works.

Types are correct.

Existing functionality is not broken.

Code follows repository architecture.

Future backend integration has a clear boundary.

Build/lint/type checks pass.

28. What NOT To Do

Never:

invent screens that conflict with provided references,

redesign the UI without permission,

replace the entire project architecture for one feature,

introduce Supabase prematurely,

introduce Airpay prematurely,

hardcode secrets,

hardcode fake production API URLs,

put business logic everywhere in components,

create massive monolithic pages,

use any to bypass TypeScript errors,

ignore responsive behavior,

ignore accessibility,

claim screenshot parity without checking the implementation.

29. Definition of Done

Before finishing any feature, verify:

[ ] Requirement understood
[ ] Relevant screenshot(s) identified
[ ] Existing implementation inspected
[ ] Relevant .agents/skills reviewed
[ ] Component structure planned
[ ] Responsive behavior planned
[ ] UI implemented
[ ] Interactions implemented
[ ] Validation implemented where needed
[ ] Loading/error/empty states handled
[ ] Future integration boundary preserved
[ ] TypeScript passes
[ ] Lint passes
[ ] Build passes
[ ] Visual comparison completed
[ ] No unrelated files changed

30. New Airpay Integration — Engineering Reference

30.1 Source of truth

The specification for the NEW Airpay integration lives at:

docs/AIPAY-DOCS.md

(Note the filename: AIPAY-DOCS.md, not AIRPAY-DOCS.md and not documentation.md.)

That document is the PRIMARY SOURCE OF TRUTH. It is authoritative over:

general Airpay knowledge,

any previous Yarnvia/Frontiva Airpay implementation,

the placeholder guidance in section 16 of this file,

the frontend seam in src/services/payment/airpay-adapter.ts.

Read it completely before touching anything Airpay-related. Items it marks
"PROVEN" were established empirically against the live gateway (MID 366950) at
the cost of real payments. Do not "tidy", normalise, or correct them using
general Airpay knowledge.

The document cites a reference implementation (api/_lib/airpay.ts,
callbackPayload.ts, settle.ts, callbackFlow.ts, relay.ts). None of those files
exist in this repository. There is no api/ directory. The integration is
therefore a new server-side build, not an edit of existing server code.

30.2 The one rule

A callback is a prompt to go and check, never proof of payment.

The only thing that may mark an order paid is Airpay's Order Confirmation API
answering, server-to-server, that it was paid, for an amount the server computed
itself.

The callback body, the browser redirect and ap_SecureHash are all
attacker-reachable and decide nothing. ap_SecureHash is CRC32 — unkeyed, with
every input derivable by anyone holding the MID and username. It is an integrity
check, not authentication.

Required pipeline:

callback -> parse/decrypt -> validate -> Airpay Order Confirmation
         -> trusted result -> settlement -> optional relay

Forbidden:

callback -> trust transaction status -> mark paid

30.3 Integration stages

Stage 1 — Configuration. Environment variables (30.6), Airpay dashboard callback
URL confirmed against a real route, KKChat path segment confirmed with the
merchant.

Stage 2 — Protocol primitives, in ONE module: privateKey, aesKey, encrypt,
decrypt, checksum, istDate, crc32/verifySecureHash, buildEnvelope,
buildSignedEnvelope. Reimplementing any of these elsewhere is how integrations
drift.

Stage 3 — Payment creation. Validate schema, re-price the basket from the
database (this is the security boundary), INSERT the order as initiated with the
server's amount, then mint the OAuth token, then build/encrypt/sign.

Stage 4 — Callback ingestion. Routing, body hydration, decode, envelope open,
merchant check, field extraction.

Stage 5 — Settlement. Exactly one settleOrder function; every path calls it.

Stage 6 — Recovery. Authoritative status endpoint with self-healing settle,
client polling, authorized cron reconciliation sweep.

Stage 7 — Relay. KKChat forwarding, strictly after settlement, strictly
auxiliary.

30.4 Callback expectations

Airpay calls the URL registered in its DASHBOARD, resolved per MID. It does not
use anything sent at transaction time. For MID 366950 both the Response URL and
the IPN URL are:

https://www.yarnvia.online/callback/cpm/arp/collection

The dashboard is not ours to change; the application moves to meet it. A rewrite
for that path must sit ABOVE any SPA catch-all, or the callback is served
index.html and a real payment is stranded.

Both the browser and the IPN daemon are pointed at that same URL. Settle both
legs identically and unconditionally; only the reply shape differs — 303 to the
order-success page for a browser (detected via Sec-Fetch-Dest, falling back to
Accept: text/html), 200 JSON for a machine.

Always answer 2xx to a machine, even for an unparseable body. Non-2xx triggers
Airpay retries. Carry the outcome in the body and logs, never in the status code.

Live envelope shape (native v4, two fields, neither an order reference):

{ "merchant_id": "366950", "response": "<16 hex IV><base64 ciphertext>" }

Envelope field names in precedence order: encdata, encresponse, response.
MERCID is a field of the PAYLOAD, not of the envelope.

Reading the body is the hard part. See docs/AIPAY-DOCS.md section 9 in full. The
non-negotiables: drain the request stream when the runtime leaves req.body
undefined; decode JSON, then multipart, then urlencoded IN THAT ORDER; repair
plus-to-space corruption only AFTER a first attempt on the bytes as received has
failed; walk the plaintext breadth-first because the payload nests under data;
let a deeper name win and carry each name once; match field names
case-insensitively across all documented aliases.

Check order is exact: merge query + body (body wins) -> merchant check ->
open envelope -> order reference present. When the envelope opens, the plaintext
fields REPLACE the outer fields. Never merge, and never fall back to the outer
fields when the envelope is unreadable — that is precisely what lets a forger
pair a captured envelope with plaintext of their own.

Three separate endpoint concerns, kept distinct:

Response URL and IPN URL: both the dashboard URL above.

Transport adapters over the same pipeline: /api/payments/callback (relays) and
/api/payments/return (does not relay).

Relay destination: KKCHAT_CALLBACK_URL, default
https://kkchat.in/callback/cpm/arp_frontiva/collection

The relay host routes only on the trailing /collection and answers 200 "success"
to ANY middle segment, discarding what it does not recognise. A 200 from it is
NOT evidence of delivery. Confirm the exact segment with the merchant.

30.5 Security requirements

Preserve all of these. None may be weakened, and none has a development
shortcut:

Never trust a callback transaction status for settlement.

Order Confirmation via POST /verify/ is the sole basis for marking an order
paid. Never /orderconfirmation/ — it 404s and every order stays unsettled.

Re-price from the database. The create request accepts no price, subtotal,
shipping fee, or total, so there is nothing for the client to state and nothing
to accidentally trust.

Idempotency is a conditional UPDATE with NOT IN (terminal states), where the
check and the write are one statement. The loser of a race updates zero rows;
that is a correct outcome, not an error.

Terminal states: paid, failed, cancelled, requires_review. requires_review is
terminal so a later callback cannot overwrite a flag raised for a human.

A null status is an UNKNOWN, not a failure. Guard it twice — in
verifyTransaction and again in settleOrder. A genuine payment was terminally
marked failed by exactly this, unrecoverably.

Amount mismatch beyond 0.001 is requires_review — never paid, never failed, and
never left initiated.

Sandbox refuses to settle. There is no convenience flag; that flag is the hole
this design exists to close.

All five Order Confirmation fail-closed cross-checks. Verification never throws;
null means "could not obtain an answer" and is treated as "ask again later",
never as a failure reported to the customer.

Callback parsing never throws for hostile input. Missing environment reports
unavailable and fails closed a step later.

Order references come from a CSPRNG, never Math.random().

The status endpoint compares the token in constant time and answers one
indistinguishable 404 for "no such order" and "wrong token".

The reconcile endpoint requires a bearer token compared with timingSafeEqual,
answering 404 on mismatch.

The public callback endpoint is unauthenticated by nature: bound relayed
payloads at 64 fields and 1024 chars per value.

Log names and categories only. Never log credentials, derived keys,
encdata/response blobs, access tokens, or any callback field value.

30.6 Environment and configuration

Names and purposes only. Never commit values; never print them; never place a
real credential in this file, in CLAUDE.md, or anywhere in the repository.

AIRPAY_MID=<secret>            Merchant ID; sent in the clear
AIRPAY_CLIENT_ID=<secret>      OAuth2 client_id
AIRPAY_SECRET_KEY=<secret>     OAuth2 client_secret
AIRPAY_API_KEY=<secret>        the secret used in the privatekey derivation
AIRPAY_USERNAME=<secret>       key derivation + ap_SecureHash
AIRPAY_PASSWORD=<secret>       key derivation
AIRPAY_ENV=live|sandbox        explicit, never inferred
AIRPAY_VERIFY_URL=<optional>   Order Confirmation override; unset, not blank
PUBLIC_SITE_ORIGIN=<optional>  absolute origin for the return redirect
KKCHAT_CALLBACK_URL=<optional> relay destination; off disables
CRON_SECRET=<secret>           bearer token for the reconcile endpoint

PROVEN: AIRPAY_SECRET_KEY is the OAuth client secret and AIRPAY_API_KEY is the
privatekey secret — the opposite of what merchants and Airpay onboarding state.
Each credential has exactly one role. Do not swap them back.

No public build prefix (VITE_, NEXT_PUBLIC_, REACT_APP_) may ever appear on an
Airpay variable. This repository is a Vite app, so every VITE_-prefixed value is
shipped to browsers. All signing happens server-side; the browser receives only
opaque, already-signed fields.

AIRPAY_VERIFY_URL defined-but-empty fails URL validation and takes all payments
down. Normalise an empty string to undefined.

30.7 Required routes

POST /api/payments/create              create an order and hand off to Airpay
ANY  /callback/cpm/arp/collection      the dashboard-registered callback,
                                       rewritten above the SPA catch-all
ANY  /api/payments/callback            transport adapter; relays
ANY  /api/payments/return              transport adapter; does not relay
GET  /api/orders/:ref?t=<token>        authoritative status; self-healing
GET|POST /api/payments/reconcile       cron sweep; bearer-authorized

30.8 Data

The documented orders table is server-side and service-role only: RLS enabled
with deliberately NO policies, so a browser anon key can neither read nor write
it. Columns include order_ref, access_token, payment_method, payment_status with
a check constraint that must include requires_review, amount as the authority,
ap_transactionid and ap_verified_at.

Do not mirror Airpay transaction data — payment mode, card BIN, bank, RRN and
settlement batch stay in Airpay, one dashboard lookup away keyed by order_ref.
Duplicating them creates two sources of truth about money.

30.9 Testing requirements

Regression tests are part of the integration, not a follow-up. Cover at minimum:

the primitives — privatekey, the 32-ASCII-char AES key, encrypt/decrypt round
trip, checksum ordering, IST date across the 00:00–05:30 IST window, the
ap_SecureHash field order including the VPA case;

callback decoding — JSON, multipart, urlencoded, an undefined req.body, the
plus-to-space corruption, a nested data payload, a wrapper message shadowing a
payload MESSAGE, casing variants;

rejection paths — merchant mismatch, unreadable envelope, missing order
reference, envelope-fails-then-outer-fields;

settlement — duplicate and concurrent callbacks, a null status, status 211,
amount mismatch, sandbox MID, unknown order;

verification — each of the five fail-closed cross-checks, non-2xx, timeout;

relay — that it never throws and never affects settlement;

recovery — status endpoint 404 indistinguishability, polling exhaustion
reporting unresolved, the reconcile window bounds and its authorization.

Never exercise these against the live MID. Do not create a payment to test.

30.10 Constraints

Do not deploy until explicitly authorized.

Do not create a payment or call Airpay payment APIs during investigation.

Do not modify production payment data.

Never manually mark an order paid.

Keep callback processing and settlement separate; settlement completes before
the relay is attempted.

Exactly one settleOrder. Never write a second settlement path.

Timeouts must sit below the platform function ceiling: 8 s for Airpay OAuth and
verify, 5 s for the relay. At the ceiling the abort never fires, the platform
kills the function, and the catch block never runs — so there are no logs at all.

The relay is auxiliary and must be awaited anyway: a serverless instance may be
frozen the moment the response is written, silently dropping an un-awaited
request.

30.11 Open questions

These are not established by docs/AIPAY-DOCS.md and must not be invented:

The reference implementation paths the document cites (api/_lib/*.ts) do not
exist here, and this repository has no server runtime, no api/ directory, and no
serverless platform configuration. The target platform is implied to be Vercel
(rewrites syntax, 10 s function ceiling, Hobby cron cadence) but is never stated
for this project.

The schema, order reference prefix (YV-), MID (366950) and callback host
(yarnvia.online) in the document come from the Yarnvia integration. This
repository's existing order model uses a different reference format (AM-) and
different payment status values. Which of the two the new integration adopts is
unresolved.

The exact KKChat middle path segment is explicitly flagged as needing merchant
confirmation before go-live.

Whether an Airpay sandbox MID and credentials are available at all, given that
Order Confirmation works only against a live MID and there is no separate
sandbox hostname.

No sandbox test data, test card, or test UPI handle is documented.

The relationship between the documented server-side orders table and this
repository's existing Supabase schema is not addressed.
