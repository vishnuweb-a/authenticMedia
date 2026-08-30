# Authentic Media — Reference Limitations

> **Why this file exists.** `AGENTS.md` §4 makes the screenshots the visual source of truth, and
> `CLAUDE.md` §23 forbids claiming visual parity that was not checked. Several references are
> **incomplete**. This file records exactly what the captures do and do not prove, so a future
> session never mistakes a rendering artifact for a design decision — or claims fidelity it cannot
> demonstrate.
>
> **Read this before implementing About, Contact, or any footer.**

---

## Mobile-only References

**All five captures are iPhone 14 Pro Max, 1290px wide (@3x → 430px CSS).**
There is **no desktop reference. There is no tablet reference.**

```
Mobile           = visual source of truth   (VERIFIED)
Tablet / Desktop = derived responsively     (INFERRED)
```

Consequences:

- Every desktop/tablet decision in `DESIGN-SYSTEM.md` → *Responsive Design Principles* is a
  **recommendation**, not a reproduction.
- **Never claim desktop pixel parity with a screenshot** — none exists to compare against.
- Multi-column layouts, inline desktop navigation, and container max-widths are all inferred.
- Responsive work is still **mandatory** (`AGENTS.md` §11, `CLAUDE.md` §12). Absence of a desktop
  reference is not permission to ship a desktop-only or mobile-only layout.

When reporting visual QA on a wide viewport, state that it was checked for **consistency with the
mobile design language**, not for parity with a reference.

---

## Screenshot Truncation

`home.png` and `services(iPhone 14 Pro Max).png` are both exactly **16384px** tall — the PNG capture
ceiling of the tool that produced them. Both end **mid-section**.

| File | Height | Ends at |
|---|---|---|
| `home.png` | 16384 (capped) | Mid "Cloud & Hosting" micro-service card |
| `services(iPhone 14 Pro Max).png` | 16384 (capped) | Mid Micro-Services section |

Consequences:

- **Neither capture contains a footer.** This is a truncation artifact, **not** evidence that these
  pages lack a footer.
- Both pages **must** render the global footer (canonical reference: `contact-us(screenshot).png`).
- Content below the cut is unknown — there may be further sections (testimonials, FAQ, CTA band)
  between the last visible card and the footer. Do not assert the page ends where the capture ends.

---

## Missing Scroll-Reveal Content

Several captures contain large regions of flat background where content should be. The pattern —
full-width blank bands between correctly-rendered sections — indicates **scroll-triggered reveal
animations that never fired** during capture (elements left at `opacity: 0`).

This affects `about-us` most severely and `contact-us` in the form area.

**This is a capture artifact, not a design feature.**

Two implications:

1. **Never reproduce these blank regions.** Large empty voids are not part of the design.
2. When implementing reveal animations, ensure content is **visible without JavaScript**, animate
   only as enhancement, and honour `prefers-reduced-motion` — precisely so this failure mode cannot
   reach a user.

---

## About Blank Region

**File:** `about-us(screenshot).png` (1290 × 14973)

Measured programmatically by scanning per-row pixel variance:

```
Blank region:  y ≈ 3060  →  y ≈ 10430
Extent:        ≈ 7370px  @3x   (≈ 2457px CSS)
Proportion:    ≈ 49% of the entire page height
```

**Roughly half of the About page did not render.**

What is verified on About: header, hero (`WHO WE ARE`, *About Authentic Media*, sub-copy, gradient
rule), the *About Us* narrative heading and its two paragraphs, and the footer.

What is missing: everything between the narrative and the footer. Given the height, this plausibly
held mission/vision, values, "why choose us", statistics, or team content — **but none of that is
observable, and none of it should be presented as reference-backed.**

**Rules for this region:**

- Do **not** reproduce the blank space.
- Do **not** claim the About implementation matches the reference — only the hero and narrative can
  be compared.
- Reconstruct from **real product requirements** first. Absent those, follow the established section
  pattern (eyebrow → gradient-accent heading → muted body → optional cards) and **explicitly label
  each reconstructed section as inferred** in the implementation report.

---

## Contact Form Gap

**File:** `contact-us(screenshot).png`

The page's own hero copy says *"**Fill out the form** or reach out directly"*, so a contact form
unquestionably exists. **Its fields did not render** — the capture shows a blank region where the
form belongs.

Verified on Contact: header, hero, `DIRECT CONTACT` section, all four contact info rows, the
24-hour response notice card, and the complete footer.

Not verified: field list, field order, layout, labels, placeholders, submit button copy, and all
validation/success/error states.

**Rules for the form:**

- Reconstruct using the visible design language (dark surfaces, ~14px radius inputs, violet focus
  ring, gradient submit pill).
- Keep it **minimal and justified**: Name, Email, Phone (optional), Subject/Service, Message.
- **Do not silently invent unrelated fields** — no budget ranges, company size, file uploads, or
  marketing consent checkboxes unless a requirement asks for them.
- Implement labels, validation, loading, error and success states (`AGENTS.md` §19–20).
- Mark the field list as **inferred** when reporting.

---

## Missing Footer Areas

| Screen | Footer in capture? | Action |
|---|---|---|
| Home | ❌ truncated at 16384px | Implement the global footer |
| Services | ❌ truncated at 16384px | Implement the global footer |
| About | ✅ visible | — |
| Contact | ✅ **complete — canonical reference** | Use as the source of truth |
| Cart | N/A (drawer overlay) | Footer belongs to the page beneath |

**Use `contact-us(screenshot).png` as the definitive footer reference.** Its absence elsewhere proves
nothing except that the capture ran out of pixels.

Also never captured: the footer's legal destinations — **Terms & Conditions**, **Privacy Policy**,
and **Refund & Cancellation**. The links are verified; those pages' contents are entirely unknown.

---

## What Is Verified

Directly observed in, or measured from, the reference PNGs:

**Color** — background `#07071B`; elevated `#0D0A22`; glow `#110B2C`; header `#190E39`; card surface
`#160E35`; drawer surface `#16161C`; muted CTA fill `#2A1759`; badge fill `#180F39`; badge border
`#361B6F`; white headings; muted lavender body.

**Gradient** — `#8640EF → #A754F7 → #D04DBF → ~#E24DAE`, horizontal left→right, sampled across both
the hero CTA and an Add-to-Cart pill; non-linear (holds violet, bends to pink late).

**Geometry** — page gutter 72px @3x (**24px CSS**); card width 1147px @3x (**~382px CSS**); card
radius ~66px @3x (**~22px CSS**); badge box 441×98 @3x (**147×33px CSS**); hero CTA 658×188 @3x
(**219×63px CSS**); gradient card CTA 492×100 @3x (**164×33px CSS**); muted card CTA 502×112 @3x
(**167×37px CSS**); header content band y=50–148 @3x.

**Structure** — header composition and the absence of a header border; the section pattern
(eyebrow → accent heading → muted sub-copy); card anatomy for both card variants; the two distinct
Add-to-Cart treatments; the full footer; the cart as a **drawer over a dimmed page**; cart line item
with delete and **no quantity stepper**; the Airpay `Pay Now` block.

**Content** — all headings, eyebrow labels, body copy, service names and prices quoted in
`SCREEN-MAP.md`; contact details; footer link list and address.

---

## What Is Inferred

Recommendations that are **not** observable in any capture:

- **Font family** (`Outfit`/`Poppins`/`Figtree`) — a raster image cannot identify a typeface with
  certainty. The *metrics* (sizes, weights, tracking, line-heights) are derived from measurement;
  the *family* is a recommendation.
- **All tablet and desktop layouts**, breakpoints, column counts, and container max-widths.
- **All interactive states** — hover, active, focus, disabled, loading. Static captures show only
  the resting state.
- **Header sticky/fixed behavior** — unobservable in a full-page capture.
- **Mobile nav drawer contents** and the **search overlay** — never captured open.
- **Cart states** other than populated: empty, loading, payment pending/success/failure.
- **Add-to-Cart feedback** — whether it opens the drawer, toasts, or only increments the badge.
- **Scroll-reveal animation** — strongly implied by the capture gaps, but its timing, distance, and
  easing are unknown.
- **Exact internal padding and section spacing** — derived from content insets, not from visible
  boxes; treat as ±4px.
- **The subtle vertical gradient on card surfaces** — samples drift `#150E33`→`#180F38`; flat
  `#160E35` is an acceptable simplification.
- **Icon library** for UI chrome (Lucide is a recommendation matching the observed stroke style).
- **About's missing sections** and **Contact's form fields** (see above).
- **Legal page contents** (Terms, Privacy, Refund).

---

## Rules For Future Reconstruction

1. **Never present inferred work as reference-matched.** In every implementation report, separate
   "matches the reference" from "reconstructed — no reference exists."
2. **A gap in a capture is not a design decision.** Blank regions and missing footers are artifacts.
   Never reproduce them; never cite them as evidence something is absent.
3. **Absence of evidence ≠ evidence of absence** — with one exception: where a control would
   obviously be visible in a rendered region and is not (e.g. the **quantity stepper** in the
   correctly-rendered cart line item), its absence *is* informative. Distinguish "not rendered" from
   "rendered and not present."
4. **Prefer real requirements over invention.** When reconstructing, ask for requirements or use the
   established pattern — do not invent product content (fake testimonials, fabricated statistics,
   invented team members, fake client logos).
5. **Reconstruct in the established language.** Same tokens, same card anatomy, same section rhythm.
   Never introduce a new visual pattern to fill a gap.
6. **Re-open the screenshot when it matters.** This documentation is a cache, not a replacement. For
   pixel-level work on a specific screen, open the PNG.
7. **Report honestly.** `CLAUDE.md` §23 and §31: never claim typecheck/lint/build/visual QA passed if
   it was not run, and never claim parity that was not verified against a real reference.
8. **Update this file** when a new or better reference (especially a desktop capture or a re-capture
   with animations disabled) arrives — and move items from *Inferred* to *Verified* as they become
   observable.
