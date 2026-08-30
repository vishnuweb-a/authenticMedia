CLAUDE.md — Feature Implementation Playbook

Role

You are the implementation agent for this repository.

Your responsibility is to build each requested feature as a production-quality frontend while preserving the architecture required for the future full-stack application.

The application will eventually use:

Supabase for authentication/database/backend capabilities.

Airpay for payment processing.

Backend services for production business logic.

For the current development stage, implement the frontend only.

Never prematurely couple the UI to Supabase or Airpay.

1. Every Feature Starts With Reconnaissance

Before writing code, inspect:

The requested feature requirements.

Existing application structure.

Existing routes.

Existing components.

Existing design system.

Existing state management.

Relevant .agents/skills/.

Relevant screenshots inside inspiration/.

Do not start by blindly creating files.

Required skills to consult when relevant

Use the repository skills for:

screenshot-to-code → image-to-code

React architecture → react

debugging → react-devtools

shared state → react-state-management

Tailwind patterns → tailwind-patterns

Tailwind v4 → tailwind-v4

shadcn + Tailwind → tailwind-v4-shadcn

Tailwind fundamentals → tailwindcss-fundamentals-v4

advanced TypeScript → typescript-advanced-types

TypeScript quality → typescript-best-practices

React/TypeScript review → typescript-react-reviewer

Do not read every skill for every feature. Read the skills that materially apply to the task.

2. Screenshot-First Implementation

When a screenshot exists, treat it as the design specification.

Do not interpret the screenshot as vague inspiration.

Analyze:

Layout

page width

max-width

sidebar/header structure

column count

section hierarchy

alignment

spacing

padding

gaps

Typography

font family if identifiable

font size

font weight

line height

hierarchy

capitalization

Visual system

background

surfaces

borders

radii

shadows

dividers

badges

iconography

button treatment

Interaction

Infer obvious interactions from:

buttons

tabs

dropdowns

navigation

forms

pagination

cards

action menus

Implement those interactions unless the task explicitly excludes them.

3. Visual Matching Process

Use this sequence:

Screenshot
   ↓
Analyze structure
   ↓
Identify reusable components
   ↓
Build page shell
   ↓
Build major sections
   ↓
Add content
   ↓
Add interactions
   ↓
Add responsive behavior
   ↓
Compare against screenshot
   ↓
Fix visual differences
   ↓
Run checks

Prioritize fixes in this order:

Overall page structure

Major widths/heights

Positioning/alignment

Spacing

Typography

Colors

Borders/radius/shadows

Icons

Micro-details

Do not spend time polishing icons while the overall layout is wrong.

4. Reuse Before Creating

Before creating a new component, search the codebase for an existing equivalent.

For example:

Button
Card
Input
Modal
Dialog
Table
Badge
Dropdown
Tabs
Sidebar
Header
PageContainer
FormField

If an existing component can support the requirement, extend it rather than creating a duplicate.

If the existing component is intentionally different, create a feature-specific component.

5. Feature Architecture

Prefer feature isolation.

Example:

src/
  features/
    payments/
      components/
      hooks/
      services/
      types/
      data/
    profile/
      components/
      hooks/
      services/
      types/
      data/

Keep feature-specific code close to its feature.

Shared code belongs in shared/common locations.

6. Data Must Be Separated From UI

During frontend-only development, use mock data.

Example:

// feature/data/mock-data.ts

export const mockApplications = [
  // realistic data
];

Then consume it through a hook/service:

const { data, isLoading } = useApplications();

Do not put large mock datasets directly inside JSX.

This makes the later Supabase/API migration straightforward.

7. Service Boundaries

Frontend code must not directly depend on external providers.

Use an interface:

export interface PaymentService {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
}

Current implementation:

export const mockPaymentService: PaymentService = {
  async createPayment(input) {
    // frontend-only simulation
  },
};

Future implementation:

paymentService → backend → Airpay

The component should not care which implementation is used.

The same rule applies to authentication:

UI
 ↓
useAuth()
 ↓
AuthService
 ↓
MockAuthService (now)
 ↓
SupabaseAuthService (later)

8. Supabase Rule

Do not install/configure/use Supabase for a frontend-only feature unless the task explicitly changes the project into the integration phase.

Do not:

add Supabase credentials,

create Supabase client code unnecessarily,

call Supabase directly from components,

create database schemas as part of frontend work,

pretend mock authentication is production authentication.

When the integration phase begins, use a dedicated integration task.

9. Airpay Rule

Do not implement real Airpay integration during frontend-only work.

You may implement:

payment screens,

payment forms,

order summaries,

transaction status UI,

success screens,

failure screens,

retry UI,

mock payment state.

Keep the integration boundary clean.

Never place:

merchant keys,

secrets,

private credentials,

real callback secrets

inside frontend code.

10. State Rules

Use the smallest appropriate state scope.

Local state

Use for:

modal open/close

form input

tabs

dropdowns

temporary UI state

Feature state

Use for:

feature-wide data

multi-component workflows

Global state

Use only for:

authenticated session

user preferences

application-wide state

Do not introduce global state simply because a component has multiple fields.

11. UI Interaction Requirements

Interactive controls must actually work.

Examples:

Button

Should:

trigger its intended action,

show loading when appropriate,

disable during submission when appropriate.

Form

Should:

validate,

show errors,

submit,

show loading,

show success/failure.

Navigation

Should:

navigate to the intended route,

indicate active state.

Modal

Should:

open,

close,

support keyboard interaction,

trap focus if the component system requires it.

Do not build decorative controls that look functional but do nothing.

12. Responsive Requirements

Implement responsive behavior as part of the feature, not as a later cleanup.

Check:

Mobile
Tablet
Desktop
Large desktop

Pay special attention to:

sidebar behavior

header

tables

cards

multi-column forms

buttons

dialogs

navigation

long text

overflow

A desktop screenshot does not mean the page can be desktop-only.

13. Accessibility Requirements

Every feature must include:

semantic elements

labels for inputs

keyboard navigation

focus states

accessible button names

proper heading hierarchy

appropriate ARIA attributes

meaningful alt text

Do not use:

<div onClick={...}>

when a button or link is appropriate.

14. TypeScript Requirements

Use strict TypeScript.

Prefer:

type UserRole = "CITIZEN" | "GOVERNMENT_OFFICER";

over arbitrary strings where the domain is constrained.

Prefer:

interface Payment {
  id: string;
  amount: number;
  status: PaymentStatus;
}

over untyped objects.

Never solve type errors by blindly adding:

as any

15. Tailwind Requirements

Use the project's Tailwind version and established patterns.

Do not mix:

Tailwind

arbitrary CSS

another CSS framework

without a reason.

Prefer reusable classes/components for repeated patterns.

If the project uses shadcn/ui, reuse and customize its primitives rather than recreating accessible primitives from scratch.

16. Routing Requirements

When adding a page:

Determine whether a route already exists.

Follow existing route conventions.

Add the route in the established routing location.

Do not create duplicate route definitions.

Consider protected/public status.

Ensure direct navigation works.

Future RBAC should be enforced at the appropriate application/backend boundary, not simulated as a security mechanism only in the UI.

17. Error / Loading / Empty States

For any feature that displays data, implement:

Loading state

A visual state consistent with the application.

Empty state

Tell the user what is empty and what they can do.

Error state

Give a useful human-readable message and recovery action when possible.

Success state

Clearly confirm successful actions.

These states should feel like part of the design, not afterthoughts.

18. Do Not Over-Engineer

Avoid:

unnecessary libraries,

unnecessary abstractions,

premature backend architecture,

excessive generic components,

global state for local problems,

custom utilities for one-line operations,

complicated patterns where simple React is sufficient.

The goal is clean, scalable, understandable code.

19. Do Not Under-Engineer

Avoid:

giant page components,

duplicated markup,

hardcoded data everywhere,

provider-specific code in UI components,

any,

fake API calls scattered through the application,

inaccessible interactions,

unhandled loading/error states.

20. Preserve Existing Work

Before editing an existing file:

Read → Understand → Extend → Verify

Do not replace unrelated code.

Do not modify unrelated features simply because you prefer another implementation.

If a refactor is genuinely necessary, keep its scope narrow and explain why.

21. Validation Before Completion

Run the project's available checks.

At minimum, where scripts exist:

npm run lint
npm run typecheck
npm run build

Also check:

console errors

broken routes

failed imports

runtime exceptions

responsive layout

If the project uses another package manager or command convention, follow the existing repository setup.

22. Visual QA

For screenshot-driven work, perform visual QA.

Check:

desktop screenshot comparison

mobile behavior

spacing

typography

alignment

component dimensions

colors

borders

shadows

icons

content density

If browser/devtools tooling is available through the project skills, use it.

Fix the largest mismatch first.

23. Feature Implementation Output

After implementation, report:

Implemented

pages/screens

components

interactions

routes

mock data

responsive behavior

Integration boundary

Explain what is intentionally mocked and where future Supabase/Airpay integration will connect.

Validation

Report:

typecheck

lint

build

visual QA

Known limitations

Only list actual limitations.

Do not claim a check passed if it was not run.

24. Standard Feature Workflow

Use this exact workflow for each feature:

PHASE 1 — Understand
→ Read requirements
→ Inspect existing code
→ Identify relevant screenshot
→ Identify relevant skills

PHASE 2 — Plan
→ Define screen/component structure
→ Identify reusable components
→ Define types
→ Define mock data
→ Define service boundary
→ Define route

PHASE 3 — Implement
→ Build/reuse layout
→ Implement components
→ Implement interactions
→ Add validation
→ Add loading/error/empty states
→ Add responsive behavior

PHASE 4 — Integrate
→ Connect feature to route
→ Connect mock service
→ Verify existing navigation
→ Verify no unrelated behavior changed

PHASE 5 — QA
→ Typecheck
→ Lint
→ Build
→ Browser/runtime check
→ Screenshot comparison

PHASE 6 — Finalize
→ Fix issues
→ Remove dead code
→ Review diff
→ Report implementation

25. Feature Prompt Contract

When a user gives you a feature request, interpret it as:

"Implement this feature inside the existing application while following AGENTS.md, the relevant .agents/skills/, the provided reference screenshots, and the existing codebase conventions."

Do not ask for information that can be discovered from the repository.

Only ask a clarification when the missing information genuinely blocks a correct implementation.

26. Important Development Principle

Build for today's frontend without blocking tomorrow's backend.

The current implementation should be:

Production-quality frontend
        ↓
Clean service boundary
        ↓
Mock implementation today
        ↓
Real Supabase / backend / Airpay implementation later

Never:

UI → Supabase directly everywhere
UI → Airpay directly everywhere
UI → hardcoded mock API everywhere

The frontend should be replaceable at the integration boundary, not rewritten when backend services are introduced.

27. Final Definition of Done

A feature is done only when:

[ ] Requirements implemented
[ ] Reference screenshot matched
[ ] Existing components reused where appropriate
[ ] New components are well structured
[ ] Types are correct
[ ] Mock data is separated from UI
[ ] Service boundary exists where external integration will be needed
[ ] Interactions work
[ ] Validation works
[ ] Loading state works
[ ] Error state works
[ ] Empty state works where applicable
[ ] Responsive layout works
[ ] Accessibility considered
[ ] No secrets introduced
[ ] No premature Supabase integration
[ ] No premature Airpay integration
[ ] Lint passes
[ ] Typecheck passes
[ ] Build passes
[ ] Visual QA completed
[ ] Existing features remain intact

28. Non-Negotiable Rules

Screenshot is the visual source of truth.

Existing code is the architectural source of truth.

Relevant .agents/skills/ are the implementation guidance.

Frontend first; backend later.

Supabase integration later.

Airpay integration later.

Mock external services behind interfaces.

Do not hardcode secrets.

Do not use any to hide problems.

Do not claim visual parity without checking it.

Do not rewrite unrelated code.

Every feature must be responsive and accessible.