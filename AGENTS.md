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