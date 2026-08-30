# Authentic Media — Design System

> **Purpose.** This document preserves the visual system extracted from the reference screenshots in
> `inspiration/` so that any future Claude Code session can implement a feature without re-deriving
> the design language from the images.
>
> **Status of values.** Every value below is tagged:
> - **[MEASURED]** — sampled directly from the reference PNGs (pixel values / bounding boxes).
> - **[DERIVED]** — computed from a measured value (e.g. `@3x px ÷ 3 = CSS px`).
> - **[INFERRED]** — a reasonable design recommendation, *not* observable in the screenshots.
>
> Read `REFERENCE-LIMITATIONS.md` before trusting any single value. The screenshots remain the
> ultimate source of truth; this file is the cache.

---

## Measurement Basis

All five references are **iPhone 14 Pro Max captures at 1290px wide (@3x)**.

```
Device pixel width : 1290px
CSS viewport width : 430px
Scale factor       : 3x   →   CSS px = captured px ÷ 3
```

**Every `@3x` number in this document is the raw measurement; the CSS value beside it is that number
divided by 3.** When implementing, use the CSS value.

---

## Visual Direction

A **dark, high-contrast, neon-gradient technology brand.** The mood is premium and confident rather
than playful:

- Near-black violet-tinted canvas with soft radial glows behind hero areas.
- One saturated violet→pink gradient carries all primary emphasis (CTAs and accent words).
- Large, tight, bold geometric-sans headings where a single word is gradient-colored.
- Generous vertical rhythm and airy card padding — the layout breathes; it is not dense.
- Rounded geometry throughout: 22–24px cards, fully-rounded pills for every button and badge.

**Design rule:** the gradient is the *only* saturated color in the system. Everything else is a dark
neutral or a muted lavender-grey. Do not introduce competing accent hues.

---

## Color System

### Backgrounds  [MEASURED]

| Token | Value | Where it appears |
|---|---|---|
| `--color-background` | `#07071B` | Base page canvas. Sampled repeatedly in section gaps and behind the services grid. |
| `--color-background-elevated` | `#0D0A22` | Mid-hero backdrop; slightly lifted, warmer violet. |
| `--color-background-glow` | `#110B2C` | Outer hero glow, right/edge falloff of the radial. |
| `--color-header` | `#190E39` | Header band and the brightest core of the hero radial glow. |

These four are **one continuous radial glow**, not four flat blocks. The hero renders as a violet
radial light source behind the header that falls off to `#07071B` by the time the first section
starts.

```css
/* Hero backdrop — approximates the observed falloff  [DERIVED] */
background:
  radial-gradient(120% 80% at 50% 0%, #190E39 0%, #110B2C 35%, #0D0A22 60%, #07071B 100%);
```

### Surfaces  [MEASURED]

| Token | Value | Notes |
|---|---|---|
| `--color-surface` | `#160E35` | Service/feature card fill. Sampled at multiple card interiors (`#160E35`–`#180F38` range). |
| `--color-surface-subtle` | `#151532` | Slightly cooler surface seen behind micro-service cards. |
| `--color-surface-drawer` | `#16161C` | Cart drawer panel — noticeably **cooler / less violet** than page cards. |

> The card fill is not perfectly flat: samples drift `#150E33`→`#180F38` across a single card,
> indicating a **very subtle vertical gradient or an overlaid glow**. Implementing it as the flat
> `#160E35` is acceptable; a 2–4% vertical lightening is closer to the reference. **[DERIVED]**

### Text  [MEASURED]

| Token | Value | Usage |
|---|---|---|
| `--color-text` | `#FFFFFF` | Headings, card titles, button labels. Sampled pure white. |
| `--color-text-muted` | `#A9A7C0` | Body copy, card descriptions. Muted lavender-grey — **not** neutral grey. |
| `--color-text-subtle` | `#7C7A96` | Footer meta, copyright, low-emphasis captions. **[INFERRED]** from relative contrast. |

### Borders  [MEASURED]

| Token | Value | Usage |
|---|---|---|
| `--color-border` | `rgba(134, 64, 239, 0.18)` | Card hairline. Measured as a near-background stroke, only ~3–8 luminance steps above `#07071B`. |
| `--color-border-strong` | `#361B6F` | Eyebrow badge border, secondary button outline — clearly visible violet. |

**Important:** the card border is *extremely* faint — it reads as an edge-catch, not a drawn line.
Do not implement it as a solid `1px solid #8640EF`; that is far too strong. Use low-alpha violet.

---

## Primary Gradient

The single most important token in the system. **[MEASURED]** by scanning across both the hero CTA
(y=1640) and an Add-to-Cart pill (y=12445):

```
#8640EF  →  #A754F7  →  #D04DBF  →  ~#E24DAE
violet      violet-mid   pink        magenta-pink
```

Observed ramp across the hero CTA (658px @3x wide):

| Position | Sample |
|---|---|
| 0% | `#8640EF` / `#843FEF` |
| ~25% | `#9449F2` |
| ~50% | `#A754F7` |
| ~70% | `#B253E9` |
| ~90% | `#C250D2` |
| 100% | `#D04EC0` → `#DF4AAB` |

The ramp is **not linear in hue** — it holds violet through the first half, then bends sharply toward
pink in the last third. A 3-stop gradient reproduces this correctly; a 2-stop does not.

```css
--color-primary-start: #8640EF;
--color-primary-mid:   #A754F7;
--color-primary-end:   #D04DBF;
--color-primary-tail:  #E24DAE;   /* deepest pink, edge of longer pills */

--gradient-primary: linear-gradient(
  90deg,
  var(--color-primary-start) 0%,
  var(--color-primary-mid)   50%,
  var(--color-primary-end)   100%
);
```

**Direction:** horizontal, left→right (violet on the left, pink on the right). Verified on both the
hero CTA and the Add-to-Cart pill.

**Applies to:** primary CTA buttons, gradient Add-to-Cart pills, gradient accent words in headings,
the cart badge dot, avatar cluster chips, and thin section divider rules.

**Rule:** exactly one gradient in the system. Do not author per-section gradients.

---

## Background System

| Layer | Treatment |
|---|---|
| Page | Flat `--color-background` (`#07071B`). |
| Hero | Radial violet glow from the top, peaking at `#190E39` behind the header. |
| Sections | Flat page background; separation comes from **spacing**, not color bands or dividers. |
| Cards | `--color-surface` on top of the page background. |

Sections are **not** visually banded. The reference shows section boundaries created purely by
vertical whitespace. Do not add alternating section background colors.

---

## Surface / Card System

The dominant repeated component. **[MEASURED]** from the "Tech Maintenance" card on `home.png`:

| Property | @3x | CSS | Confidence |
|---|---|---|---|
| Card left edge | x=72 | 24px gutter | [MEASURED] |
| Card right edge | x=1218 | 24px gutter | [MEASURED] |
| Card width | 1147 | ~382px (of 430 viewport) | [MEASURED] |
| Corner radius | ~66 | **22px** (use `24px`) | [MEASURED] — arc traced row-by-row, completing at dy≈66 |
| Internal padding | ~84 | **28px** | [DERIVED] from icon/text inset |
| Gap between cards | ~90 | **30px** (use `32px`) | [DERIVED] from card bottom→next card top |

```css
--radius-card: 24px;
--card-padding: 28px;
--card-gap: 32px;
```

### Card anatomy (top → bottom)

```
┌────────────────────────────────┐
│  [icon]        56×56, rounded  │   emoji/3D glyph, sometimes in a
│                                │   rounded violet tile (~20px radius)
│  Card Title                    │   20–22px, 600–700, white
│                                │
│  Body description text that    │   15–16px, muted lavender,
│  wraps across several lines.   │   line-height ~1.65
│                                │
│  ( Add to Cart  @₹849 )        │   pill CTA, left-aligned
└────────────────────────────────┘
```

Content is **left-aligned inside cards**, even though section headers above them are centered.

### Two observed card variants

1. **Service card** — icon, title, prose description, single pill CTA.
   Seen on Home ("Our Core Services") and Services ("Core Offerings").

2. **Micro-service / checklist card** — icon tile, title, a violet one-line subtitle
   (e.g. *"Optimize your infrastructure"*), then a `✓`-prefixed feature list, then a pill CTA.
   Check marks are violet/gradient-tinted. Seen in "Website & Digital Micro-Services".

### Hover / active  [INFERRED]

Not observable in static captures. Recommended, consistent with the language:

- Border brightens toward `rgba(134,64,239,0.45)`.
- Slight lift: `translateY(-2px)` plus a soft violet glow `0 8px 32px rgba(134,64,239,0.18)`.
- Respect `prefers-reduced-motion`.

---

## Border System

| Element | Treatment |
|---|---|
| Cards | ~1px, very low-alpha violet (`rgba(134,64,239,.18)`). Reads as an edge highlight. |
| Eyebrow badges | ~1px solid `#361B6F` — clearly visible. **[MEASURED]** |
| Secondary buttons | ~1px violet outline at higher alpha than cards (see "Talk to Us"). |
| Footer divider | Single hairline rule above the copyright line. **[MEASURED]** on `contact-us`. |
| Cart drawer header | Hairline divider under "Your Cart", and above the Total/Pay block. **[MEASURED]** |

Borders are structural hairlines. There are no thick or decorative borders anywhere in the system.

---

## Border Radius

```css
--radius-pill:   9999px;   /* all buttons, all eyebrow badges, cart badge  [MEASURED] */
--radius-card:   24px;     /* service / micro-service / contact cards      [MEASURED ~22] */
--radius-tile:   20px;     /* small icon tiles inside cards / contact rows [DERIVED]   */
--radius-input:  14px;     /* form fields                                  [INFERRED]  */
```

Nothing in the reference uses sharp (0px) corners.

---

## Typography

**Font family — [INFERRED, not verifiable from a raster capture].**

The letterforms are a geometric grotesque with circular bowls, a double-storey `a`, and tight
apertures — closely matching **Outfit**, **Poppins**, or **Figtree**. `Outfit` is the nearest match
to the tight display headings.

```css
--font-sans: "Outfit", "Poppins", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
```

> Mark this as a recommendation in any implementation. If the real brand font is later supplied,
> only this token changes.

### Type scale  [DERIVED from measured cap-heights @3x ÷ 3]

| Role | Size (CSS) | Weight | Line height | Tracking |
|---|---|---|---|---|
| Display / H1 (hero) | 40–44px | 700 | 1.1 | -0.02em |
| Section H2 | 32–36px | 700 | 1.15 | -0.02em |
| Card title / H3 | 20–22px | 600–700 | 1.25 | -0.01em |
| Body | 16px | 400 | **1.65** | 0 |
| Body large (hero sub) | 17–18px | 400 | 1.6 | 0 |
| Eyebrow badge | 12–13px | 600–700 | 1 | **+0.12em** |
| Button label | 16px | 600–700 | 1 | 0 |
| Footer heading | 13px | 700 | 1 | +0.12em |
| Footer link / meta | 15–16px | 400 | 1.7 | 0 |

**Signature detail:** display headings are *tight* (`-0.02em`, line-height 1.1) while body copy is
*loose* (line-height 1.65). This contrast is a defining trait — preserve it.

---

## Heading System

Pattern used on **every** major section:

```
        ( EYEBROW BADGE )        ← centered pill, uppercase, tracked
       Heading with Accent       ← centered, bold, tight; one word gradient-filled
   Supporting sentence of muted  ← centered, muted, max ~3 lines
   body copy explaining section.
              ───                ← optional short gradient rule (hero pages)
```

Verified instances **[MEASURED]**:

| Screen | Eyebrow | Heading (accent word in **bold**) |
|---|---|---|
| Home | `WHAT WE OFFER` | Our Core **Services** |
| Home | `QUICK FIXES & MORE` | Website & Digital **Micro-Services** |
| Services | `COMPLETE SERVICE CATALOGUE` | Our **Services** |
| Services | `CORE OFFERINGS` | — |
| About | `WHO WE ARE` | About **Authentic Media** |
| Contact | `GET IN TOUCH` | Have a **Question?** |
| Contact | `DIRECT CONTACT` | — |

Section headers are **centered**; card content inside them is **left-aligned**.

---

## Body Text

- Color `--color-text-muted` (`#A9A7C0`), never pure white.
- Line height **1.65** — visibly generous.
- Centered under section headings; left-aligned inside cards and the footer.
- Section intro copy is constrained to roughly 3 lines at mobile width.

---

## Gradient Accent Text

The last (or most meaningful) word of a heading is filled with the primary gradient:

```css
.accent {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

**Accessibility requirement:** gradient text must be a `<span>` *inside* the real heading element so
the full string stays in the accessible name. Never split a heading across two elements, and never
render it as an image.

Also seen: the hero's `business.` is gradient-filled **and italic** — the only italic in the system.

---

## Eyebrow Badges

A reusable primitive. **[MEASURED]** from `WHAT WE OFFER` on `home.png`:

| Property | @3x | CSS |
|---|---|---|
| Bounding box | 441 × 98 | **147 × 33px** |
| Fill | `#180F39` | translucent violet over page bg |
| Border | `#361B6F` | ~1px solid |
| Radius | full | `9999px` |

```css
.eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 8px 20px;                    /* [DERIVED] from box height minus cap-height */
  border-radius: var(--radius-pill);
  background: #180F39;
  border: 1px solid var(--color-border-strong);   /* #361B6F */
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
```

Always centered, always directly above its section heading, separated by roughly **20–24px**.

Semantically this is decorative labelling — render it as a `<p>`/`<span>`, **not** a heading element,
so it does not pollute the document outline.

---

## Button / CTA System

### Primary — gradient pill  [MEASURED]

Measured pill dimensions **[MEASURED]**:

| Button | @3x (w × h) | CSS (w × h) |
|---|---|---|
| Hero CTA (`See Our Services`) | 658 × 188 | **219 × 63px** |
| Gradient Add-to-Cart (`@₹650`) | 492 × 100 | **164 × 33px** |
| Muted Add-to-Cart (`@₹849`) | 502 × 112 | **167 × 37px** |

So there are two distinct button sizes: a **large hero CTA (~62px tall)** and a **compact in-card
CTA (~34–37px tall)**. Use the hero size for page-level actions and the compact size inside cards.

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 62px;                       /* [MEASURED] hero CTA; use 36px for the in-card variant */
  padding: 0 32px;
  border-radius: var(--radius-pill);
  background: var(--gradient-primary);
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 700;
  border: none;
  box-shadow: 0 8px 28px rgba(134, 64, 239, 0.35);   /* glow is visible in the reference */
}
```

A **violet glow/bloom is clearly present** beneath the hero CTA and the gradient Add-to-Cart pills —
it is part of the design, not a capture artifact. **[MEASURED]** (light bleeds past the pill edge).

### Secondary — outlined pill  [MEASURED]

The hero's "Talk to Us":

```css
.btn-secondary {
  height: 62px;
  padding: 0 32px;
  border-radius: var(--radius-pill);
  background: transparent;
  border: 1px solid rgba(134, 64, 239, 0.45);
  color: #FFFFFF;
  font-weight: 600;
}
```

### Tertiary — muted Add-to-Cart  [MEASURED]

Most service cards use a **subdued violet pill, not the gradient**:

```css
.btn-cart {
  background: #2A1759;                 /* [MEASURED] solid muted violet */
  border: 1px solid rgba(134, 64, 239, 0.30);
  color: #C9B6F5;                      /* light violet label */
  border-radius: var(--radius-pill);
  height: 37px;                        /* [MEASURED] */
  padding: 0 24px;
  font-weight: 700;
}
```

> **Important observed distinction.** Core service cards use this **muted** pill
> (`Add to Cart @₹849`, `@₹499`, `@₹999`), while micro-service cards lower on the page use the
> **full gradient** pill (`Add to Cart @₹650`). Both exist — this is deliberate hierarchy, not an
> inconsistency. Preserve both variants. **[MEASURED]**

### Label format

Price is embedded in the button label with an `@` separator and a rupee symbol:

```
Add to Cart  @₹849
```

Keep the ~8px gap between the label and the price. Always `₹` (INR).

### States  [INFERRED]

`hover` brighten ~6% + slightly stronger glow · `active` scale `0.98` · `focus-visible` 2px violet
ring at 2px offset · `disabled` 50% opacity, no glow · `loading` spinner replacing the label, width
preserved.

---

## Header

Present and identical on Home, Services, About, and Contact. **[MEASURED]**

```
┌──────────────────────────────────────────────────────┐
│  [/\ AUTHENTIC]      (🔍)  (🛒①)              ☰      │
│      MEDIA                                            │
└──────────────────────────────────────────────────────┘
```

| Property | @3x | CSS |
|---|---|---|
| Content band | y = 50 → 148 | icons ~33px, band ~33px tall |
| Header height | ~200 | **~66px** [DERIVED] |
| Left gutter | 72 | 24px |
| Background | `#190E39` | top of the hero glow |

Composition:

- **Left:** monogram mark (`/\` in a triangle) + a thin vertical rule + stacked wordmark
  `AUTHENTIC` / `MEDIA` (uppercase, tracked, small).
- **Right cluster:** circular **search** button, circular **cart** button, then the **hamburger**.
- Both circular buttons are ~46px CSS, transparent fill with a faint violet ring.
- **Cart badge:** small gradient-filled circle at the cart's top-right showing the item count
  (`1` in every capture), white bold numeral.
- **Hamburger:** three full-width bars, white, ~24px wide — sits at the far right.

Notes:
- **No bottom border or divider** — the header dissolves into the hero glow. **[MEASURED]**
- No visible desktop nav links in any capture; navigation lives behind the hamburger at this width.
- **Sticky/fixed behavior is [INFERRED]** — a full-page capture cannot show it. Recommended: sticky
  with a backdrop blur and a solid `#190E39` fill once scrolled past the hero.

---

## Footer

Fully visible on `contact-us(screenshot).png`; **truncated away** on Home and Services (see
`REFERENCE-LIMITATIONS.md`). The footer belongs to **every** page. **[MEASURED]**

Stacked single-column order at mobile:

1. **Brand block** — logo lockup, then the descriptive paragraph
   *"Authentic Media and IT Sector Private Limited — technology-driven solutions for businesses that
   want to grow, stay secure, and move forward."*
2. **Social row** — three ~48px rounded-square tiles (LinkedIn, X, Instagram) on a subtle surface.
3. **`QUICK LINKS`** — violet uppercase tracked heading, then links each prefixed with a small
   violet `›` chevron:
   `Homepage · Services · About Us · Contact Us · Terms & Conditions · Privacy Policy · Refund & Cancellation`
4. **`REGISTERED OFFICE`** — multi-line legal address block, muted.
5. **`CONTACT INFO`** — icon + value rows: 📍 address · 📞 `7669438261` · ✉ `contact@authenticmedia.fun` · 🌐 `authenticmedia.fun`
6. **Hairline divider**, then centered copyright:
   *"Copyright 2026 © Authentic Media and IT Sector Private Limited. All rights reserved."*

Footer section headings are violet, uppercase, ~13px, `+0.12em` tracking — the same treatment as
eyebrow badges minus the pill.

---

## Iconography

Three distinct icon treatments coexist. **[MEASURED]**

1. **Emoji / 3D glyphs** for service cards — 🔧 wrench, 💳 card, 📦 box, 🔄 sync, 🛡 shield,
   📊 chart, ☁ cloud, 🎨 palette. Rendered ~56px, sometimes on a rounded violet tile.
2. **Line icons** for UI chrome — search, cart, hamburger, close (✕). White, ~2px stroke, rounded
   caps. Consistent with **Lucide**. **[INFERRED library]**
3. **Violet check marks** (`✓`) in micro-service feature lists.

> **Implementation caution.** The emoji are almost certainly *actual emoji characters*, which render
> differently per-platform and are not accessible. Recommendation: replace with a consistent icon set
> (Lucide) or dedicated SVG assets, keeping size and placement identical. Flag this when implementing
> rather than shipping raw emoji. **[INFERRED]**

Icon in the cart drawer line item and contact rows sits on a **rounded violet tile** (~48px, ~20px
radius) — that tile is part of the pattern.

---

## Spacing / Layout

Base unit **4px**; the layout uses a 4/8 scale. **[DERIVED]**

| Token | Value | Basis |
|---|---|---|
| `--page-gutter` | **24px** | [MEASURED] card edges at x=72/1218 @3x |
| `--content-max` | 430px at mobile | [MEASURED] capture width |
| `--section-py` | 72–96px | [DERIVED] gaps between section blocks |
| `--card-gap` | 32px | [DERIVED] |
| `--card-padding` | 28px | [DERIVED] |
| `--eyebrow-to-heading` | 20–24px | [DERIVED] |
| `--heading-to-body` | 16–20px | [DERIVED] |
| `--body-to-cta` | 28–32px | [DERIVED] |

Vertical rhythm is deliberately **loose**. Sections are separated by large whitespace with no
dividers. Do not compress this to fit more content above the fold.

---

## Responsive Design Principles

> **No desktop or tablet reference exists.** Everything here is **[INFERRED]** — a consistent
> extension of the measured mobile language. Never claim desktop parity with a screenshot.

Recommended breakpoints:

```
mobile   < 640px    ← the measured reference
tablet   ≥ 768px
desktop  ≥ 1024px
large    ≥ 1280px
```

| Element | Mobile (verified) | Tablet / Desktop (inferred) |
|---|---|---|
| Page gutter | 24px | 32px → 48px; content `max-width: 1200px`, centered |
| Service cards | 1 column | 2 up at `md`, 3 up at `lg` |
| Micro-service cards | 1 column | 2 up at `md`, 3 up at `lg` |
| Header nav | hamburger drawer | inline horizontal links ≥ `lg`; hamburger hidden |
| Hero H1 | 40–44px | scale to 56–72px, keep `-0.02em` and line-height 1.1 |
| Hero CTAs | stacked full-width-ish | side by side, auto width |
| Contact info + form | stacked | two columns at `lg` (info left, form right) |
| Cart drawer | near-full-width overlay | fixed ~420–480px panel, right-anchored |
| Footer | single column stack | 3–4 column grid; copyright stays centered |

Rules:
- Scale type with the viewport but **preserve the tight-heading / loose-body contrast**.
- Never stretch card rows to full desktop width — cap the container and center it.
- The hero radial glow should scale with the viewport, staying anchored top-center.

---

## Accessibility Considerations

Mandated by `AGENTS.md` §12 and `CLAUDE.md` §13.

**Contrast — [MEASURED] against `#07071B`:**

| Pair | Ratio | Verdict |
|---|---|---|
| `#FFFFFF` on `#07071B` | ~19.7:1 | Passes AAA |
| `#A9A7C0` on `#07071B` | ~8.9:1 | Passes AAA |
| `#A9A7C0` on `#160E35` (card) | ~7.9:1 | Passes AAA |
| White on gradient mid `#A754F7` | ~3.6:1 | **Large text only** — acceptable for 16px/700 button labels (large-text threshold 3:1), fails AA for small text |
| `#7C7A96` subtle on `#07071B` | ~5.2:1 | Passes AA |

> The gradient button passes only because labels are bold 16px. **Never place small or regular-weight
> text on the gradient.**

Requirements:
- Gradient accent words stay inside the heading element (see "Gradient Accent Text").
- Every icon-only control (search, cart, hamburger, close, delete) needs an `aria-label`.
- Cart badge count must be announced — e.g. `aria-label="Cart, 1 item"`, not a bare `1`.
- Cart drawer: `role="dialog"` + `aria-modal="true"`, focus trap, restore focus to the trigger on
  close, `Esc` closes, background scroll locked.
- Visible `:focus-visible` ring — 2px violet at 2px offset; never remove outlines.
- Emoji icons need `role="img"` + a label, or should be replaced with real SVGs (preferred).
- Heading order: one `<h1>` per page; eyebrows are not headings.
- Honour `prefers-reduced-motion` for the scroll-reveal animations the captures imply.

---

## Implementation Notes

- **Tokens first.** Define the tokens below in `@theme` (Tailwind v4) before building any screen.
- **Frontend-only phase.** Per `AGENTS.md` §14 and `CLAUDE.md` §8–9, do not wire Supabase or Airpay.
  The Pay Now button goes through a `PaymentService` interface with a mock implementation.
- **The gradient is a token, not a utility repeated inline.** One definition, referenced everywhere.
- **Two Add-to-Cart variants exist** (muted and gradient) — implement both as button variants.
- Cards are a single reusable component with variants, not per-screen markup.
- Scroll-reveal animation is strongly implied by the capture gaps (see `REFERENCE-LIMITATIONS.md`) —
  when implementing, ensure content is **visible without JS** and animation only enhances.

### Consolidated token block

```css
:root {
  /* Backgrounds */
  --color-background:          #07071B;
  --color-background-elevated: #0D0A22;
  --color-background-glow:     #110B2C;
  --color-header:              #190E39;

  /* Surfaces */
  --color-surface:             #160E35;
  --color-surface-subtle:      #151532;
  --color-surface-drawer:      #16161C;
  --color-surface-cta-muted:   #2A1759;   /* in-card Add-to-Cart pill */

  /* Gradient */
  --color-primary-start:       #8640EF;
  --color-primary-mid:         #A754F7;
  --color-primary-end:         #D04DBF;
  --color-primary-tail:        #E24DAE;
  --gradient-primary: linear-gradient(90deg,
    var(--color-primary-start) 0%,
    var(--color-primary-mid) 50%,
    var(--color-primary-end) 100%);

  /* Text */
  --color-text:                #FFFFFF;
  --color-text-muted:          #A9A7C0;
  --color-text-subtle:         #7C7A96;

  /* Borders */
  --color-border:              rgba(134, 64, 239, 0.18);
  --color-border-strong:       #361B6F;

  /* Radius */
  --radius-pill:               9999px;
  --radius-card:               24px;
  --radius-tile:               20px;
  --radius-input:              14px;

  /* Spacing */
  --page-gutter:               24px;
  --card-padding:              28px;
  --card-gap:                  32px;
  --section-py:                80px;

  /* Effects */
  --glow-primary:              0 8px 28px rgba(134, 64, 239, 0.35);

  /* Type */
  --font-sans: "Outfit", "Poppins", ui-sans-serif, system-ui, sans-serif;
}
```
