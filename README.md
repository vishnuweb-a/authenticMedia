# Authentic Media — Frontend

Vite + React 19 + TypeScript + Tailwind CSS v4.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run lint
npm run build
```

## Where things live

```
src/
  app/          App root + provider composition
  components/
    ui/         Primitives: Button, Card, Input, Badge, SectionEyebrow, …
    layout/     AppShell, Header, Footer, Container, Section, SectionHeading
    shared/     Cross-feature pieces (icon registry)
  features/     One directory per screen — Home, Services, About, Contact, Cart
  lib/          cn(), formatInr(), site content constants
  routes/       Router, route paths, placeholder pages
  services/     auth/ and payment/ integration boundaries + mocks
  stores/       Cart state (Context + useReducer)
  styles/       globals.css — all design tokens
  types/        Shared domain types
```

## Design tokens

All tokens live in `src/styles/globals.css`, derived from `reference/DESIGN-SYSTEM.md`.
Values tagged `[MEASURED]` there were sampled from the reference PNGs — do not round
them off. Use the token, never a raw hex value, in components.

Custom utilities: `gradient-text`, `bg-gradient-primary`, `bg-gradient-primary-long`,
`bg-hero-glow`, `shadow-glow-primary`.

## Integration boundaries

`src/services/auth` and `src/services/payment` define interfaces with mock
implementations. UI talks to the exported `authService` / `paymentService` binding
only. Supabase and Airpay are **not** integrated, and no credentials belong in this
codebase — the real payment flow will run through a backend.

## Implementing a screen

Read `AGENTS.md`, `CLAUDE.md`, and the three files in `reference/`, then build inside
`src/features/<screen>/`, reusing the layout and UI primitives. Each feature's
`index.ts` records what its reference capture does and does not prove.
# authenticMedia
