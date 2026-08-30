# Authentic Media — Screen Reference Map

> Companion to `DESIGN-SYSTEM.md`. This file records **what each screen contains and in what order**,
> so a future session can implement any single screen without re-reading every screenshot.
>
> Tags: **[VERIFIED]** = visible in the capture · **[INFERRED]** = reconstructed, not observable.
> Read `REFERENCE-LIMITATIONS.md` before implementing About or Contact.

---

## Reference Directory

Location: **`inspiration/` at the repository root** — *not* inside `.agents/skills/`.

| File | Screen | Size (px) | Completeness |
|---|---|---|---|
| `home.png` | Home | 1290 × 16384 | Truncated at the 16384px capture ceiling — no footer |
| `services(iPhone 14 Pro Max).png` | Services | 1290 × 16384 | Truncated at the 16384px ceiling — no footer |
| `about-us(screenshot).png` | About | 1290 × 14973 | ~7370px blank void (y≈3060–10430) |
| `contact-us(screenshot).png` | Contact | 1290 × 9729 | Complete incl. footer; **form body missing** |
| `cart(screenshot).png` | Cart drawer | 1290 × 9729 | Drawer overlay visible over a dimmed page |

All captures are **iPhone 14 Pro Max @3x** → 430px CSS viewport.

---

## Home

**Reference:** `home.png`
**Purpose:** Primary landing page — positions the brand, then sells services directly from the page.

### Section order  [VERIFIED]

1. **Header** — global (see `DESIGN-SYSTEM.md` → Header).
2. **Hero**
   - Location eyebrow with a leading gradient rule: `— NOIDA, INDIA — EST. 2020`
   - H1: *"We build the digital backbone of your **business.**"*
     (`business.` is gradient-filled **and italic** — the only italic in the system)
   - Body: *"From SEO audits to AI automation, Authentic Media delivers IT solutions that actually
     move the needle — not just reports that sit in a drawer."*
   - **Primary CTA** (gradient pill): `See Our Services`
   - **Secondary CTA** (outlined pill): `Talk to Us`
   - **Social proof row:** 4 overlapping circular gradient avatar chips (`PS`, `RK`, `AM`, `VT`)
     followed by *"**500+ clients** trust Authentic Media"* (count bold-white, rest muted)
   - A small centered dot below — a carousel/scroll indicator. **[VERIFIED presence, purpose INFERRED]**
3. **Our Core Services**
   - Eyebrow `WHAT WE OFFER`
   - H2: *"Our Core **Services**"*
   - Sub: *"End-to-end digital services tailored for modern businesses — from branding to AI
     automation. Starting from ₹149."*
   - **6 service cards**, single column, in this order:

   | # | Title | Price | Icon |
   |---|---|---|---|
   | 1 | Tech Maintenance | ₹849 | 🔧 wrench |
   | 2 | Fintech Partner | ₹499 | 💳 card |
   | 3 | Collection Partner | ₹999 | 📦 box |
   | 4 | Software Orchestration | ₹899 | 🔄 sync |
   | 5 | Cyber & Security Basics | ₹499 | 🛡 shield |
   | 6 | Data & Automation Basics | ₹999 | 📊 chart |

   Each uses the **muted** Add-to-Cart pill (`#2A1759`).
   - Trailing link: **`Explore all 18 services →`** — implies the full catalogue holds **18** items.
4. **Website & Digital Micro-Services**
   - Eyebrow `QUICK FIXES & MORE`
   - H2: *"Website & Digital **Micro-Services**"* (accent wraps to a second line)
   - Sub: *"Focused, affordable micro-services to keep your digital presence running at peak
     performance."*
   - **Micro-service cards** — a different anatomy from core service cards:

   ```
   [icon tile 56px, rounded violet]
   Card Title                      ← white, bold
   Violet subtitle line            ← e.g. "Speed, SEO & Security"
   ✓ Feature one                   ← violet check + muted text
   ✓ Feature two
   ✓ Feature three
   ( Add to Cart  @₹999 )          ← GRADIENT pill (not muted)
   ```

   Verified cards: **Website Health Check** (₹999, *Speed, SEO & Security*), **Tech Support &
   Maintenance** (₹999, *Keep it running smooth*), **API & Tech Integrations** (₹799,
   *Starter package*), **App & UI Support** (₹650, *Fix & audit your app*), **Cloud & Hosting**
   (*Optimize your infrastructure*).
5. **Footer** — **[INFERRED for this page]**: cut off by truncation, but the footer is global and
   appears in full on `contact-us`. Include it.

### CTA patterns
- Core service cards → **muted** pill. Micro-service cards → **gradient** pill.
- Every card CTA both adds to cart *and* increments the header cart badge.

---

## Services

**Reference:** `services(iPhone 14 Pro Max).png`
**Purpose:** The complete catalogue — the destination of Home's `Explore all 18 services →`.

### Section order  [VERIFIED]

1. **Header** — global.
2. **Page hero**
   - Eyebrow `COMPLETE SERVICE CATALOGUE`
   - H1: *"Our **Services**"*
   - Sub: *"From foundational tech maintenance to AI-powered automation — everything your business
     needs to grow, stay secure, and move fast."*
   - Short centered gradient rule beneath.
3. **Core Offerings**
   - Eyebrow `CORE OFFERINGS`
   - The **same 6 core service cards as Home**, same order, same prices, same muted CTA.
4. **Additional catalogue cards** — same card component, extending the list toward 18 total.
   Verified examples: **Website Security Audit** (₹149, 🔒), **SEO Audit Service** (📈).
   ₹149 matches Home's *"Starting from ₹149"*, confirming this is the cheapest tier.
5. **Website & Digital Micro-Services** — the same section as Home, same eyebrow
   `QUICK FIXES & MORE`, same heading and sub-copy. **[VERIFIED]**
6. **Footer** — **[INFERRED]**, truncated away.

### Relationship between categories
Two tiers sharing one card component:
- **Core services** — broad retainers/partnerships, higher price, muted CTA.
- **Micro-services** — narrow fixed-scope tasks, checklist of deliverables, gradient CTA.

Home shows a **curated subset**; Services shows the **full set**. The card component must be shared.

---

## About

**Reference:** `about-us(screenshot).png`
⚠️ **This capture is ~50% blank.** See `REFERENCE-LIMITATIONS.md` → About Blank Region.

### Section order

1. **Header** — global. **[VERIFIED]**
2. **Hero** **[VERIFIED]**
   - Eyebrow `WHO WE ARE`
   - H1: *"About **Authentic Media**"* (accent wraps to a second line)
   - Sub: *"A forward-thinking technology company built to help businesses grow, adapt, and stay
     secure in a fast-evolving digital world."*
   - Short centered gradient rule.
3. **About Us narrative** **[VERIFIED]**
   - H2: *"About **Us**"*
   - Paragraph 1: *"Authentic Media and IT Sector Private Limited is a forward-thinking technology
     company built to help businesses grow, adapt, and stay secure in a fast-evolving digital world.
     We focus on creating practical, scalable, and reliable technology solutions that solve real
     business problems — not just today, but for the long term."*
   - Paragraph 2: *"Our approach is simple: understand the client's challenges, design smart systems,
     and deliver solutions that are efficient, secure, and easy to manage. From software solutions
     and system orchestration to fintech support, data, automation, and cybersecurity basics, we act
     as a complete technology partner rather than just a service provider."*
   - Body copy here is **left-aligned**, unlike centered hero copy.
4. **Missing region (y≈3060–10430)** — **[NOT VERIFIABLE]**
   Roughly 7370px of content did not render. Judging by the page height and the copy above, this
   likely held mission/vision, values, "why choose us", stats, or team sections.
   **Do not reproduce the blank space.** When implementing, either build from real product
   requirements or use the established section pattern (eyebrow → heading → body → cards) and flag
   each reconstructed section as inferred.
5. **Footer** — **[VERIFIED]** the capture does reach the footer.

---

## Contact

**Reference:** `contact-us(screenshot).png`
⚠️ **The form body did not render.** See `REFERENCE-LIMITATIONS.md` → Contact Form Gap.

### Section order

1. **Header** — global. **[VERIFIED]**
2. **Hero** **[VERIFIED]**
   - Eyebrow `GET IN TOUCH`
   - H1: *"Have a **Question?**"*
   - Sub: *"At Authentic Media, we believe in clear communication and quick support. Fill out the
     form or reach out directly — we'll get back to you as soon as possible."*
   - Short centered gradient rule.
3. **Direct Contact** **[VERIFIED]**
   - Eyebrow `DIRECT CONTACT`
   - H2: *"Let's start a **conversation.**"*
   - Body: *"Whether you have a question, want to know more about our services, or are ready to start
     your project, our team is here to help you at every step."*
   - **Four contact rows**, each = rounded violet icon tile (~48px) + white label + muted value:

   | Icon | Label | Value |
   |---|---|---|
   | ✉ | Email | `contact@authenticmedia.fun` |
   | 📞 | Phone | `7669438261` |
   | 📍 | Address | UNIT NO 44, FORTH FLOOR, TOWER A, PLOT NO A-16, ITHUM HEIGHTS, SECTOR 62, Noida, UP-201301, India |
   | 🌐 | Website | `authenticmedia.fun` |

   - **Response-time notice card** (bordered, violet-tinted, rounded):
     *"🕐 We typically respond within **24 hours** on business days."*
4. **Contact form** — **[NOT VERIFIED — capture gap]**
   The hero copy says *"Fill out the form"*, so a form definitely exists; its fields did not render.
   Reconstruct minimally from the visible design language and real requirements:
   Name · Email · Phone (optional) · Subject/Service · Message · gradient submit CTA.
   **Do not invent unrelated fields** (no budget/company-size/file upload unless requested).
   Must include labels, validation, loading, error and success states per `AGENTS.md` §19–20.
5. **Footer** — **[VERIFIED in full]** — this is the canonical footer reference.

---

## Cart

**Reference:** `cart(screenshot).png`

> ### Critical: the cart is a **slide-over drawer**, not a route.
> The capture clearly shows the drawer panel overlaying a **dimmed, still-visible page** behind it
> (the page's dark content and a footer edge are visible at the left). Implement it as an overlay
> that can open from any screen. **Do not build `/cart` as a standalone page.**

### Structure  [VERIFIED]

```
┌─────────────────────────────────────────┐
│  Your Cart                          ✕   │  ← title + close, hairline divider under
├─────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  │
│  │ [🎨]  Branding & Content     [🗑]  │  │  ← line item card
│  │       ₹499                        │  │
│  └───────────────────────────────────┘  │
│                                          │
│           (empty space grows)            │
│                                          │
├─────────────────────────────────────────┤
│  Total                            ₹499  │  ← bold, large
│  ┌───────────────────────────────────┐  │
│  │ SECURED BY        ( Pay Now )     │  │  ← airpay wordmark + gradient CTA
│  │ airpay                            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Details:
- Drawer surface `#16161C` — **cooler/greyer** than page cards (`#160E35`). **[MEASURED]**
- Panel occupies most of the width; a narrow strip of dimmed page shows at the left. **[VERIFIED]**
- **Line item:** rounded violet icon tile (🎨 palette) + white title + **violet price** (`₹499`) +
  a red-tinted rounded **delete/trash** button at the right.
- **No quantity stepper is visible.** Items appear to be single-purchase services with delete as the
  only line action. Do not add a quantity control unless requirements call for it. **[VERIFIED absence]**
- **Total row:** label left, amount right, both bold; larger than body text.
- **Payment block:** a bordered panel containing `SECURED BY` + the **airpay** wordmark (blue,
  lowercase) on the left, and the **gradient `Pay Now` pill** on the right.
- Header cart badge shows `1`, matching the single line item. **[VERIFIED]**

### Integration boundary
`Pay Now` is the **Airpay entry point**. Per `AGENTS.md` §16 and `CLAUDE.md` §9, during the
frontend-only phase this must call a mock `PaymentService` behind an interface. No merchant keys, no
provider SDK, no direct Airpay calls in components.

### States to implement  [INFERRED — only the populated state is captured]
Empty cart · loading · removing an item · payment pending · payment success · payment failure +
retry. Only the **populated** state is verified.

---

## Shared Components

Components that must be built once and reused:

| Component | Used by | Notes |
|---|---|---|
| `Header` | all pages | logo, search, cart+badge, hamburger |
| `Footer` | all pages | canonical reference: `contact-us` |
| `MobileNavDrawer` | all pages | opened by hamburger — **[INFERRED]**, never captured open |
| `EyebrowBadge` | every section | pill label |
| `SectionHeading` | every section | eyebrow + heading w/ gradient accent + sub-copy |
| `GradientText` | headings | `<span>` inside the heading |
| `ServiceCard` | Home, Services | icon, title, prose, muted CTA |
| `MicroServiceCard` | Home, Services | icon tile, title, violet subtitle, ✓ list, gradient CTA |
| `Button` | everywhere | variants: `primary` (gradient), `secondary` (outline), `cart` (muted) |
| `CartDrawer` | global overlay | dialog semantics + focus trap |
| `CartLineItem` | cart drawer | icon tile, title, price, delete |
| `ContactInfoRow` | Contact, Footer | icon tile + label + value |
| `SearchOverlay` | header | **[INFERRED]**, never captured open |

---

## Navigation Relationships

```
Header logo ─────────────► Home
Header hamburger ────────► Mobile nav drawer  [INFERRED contents]
Header search ───────────► Search overlay      [INFERRED]
Header cart ─────────────► Cart drawer (overlay, not a route)

Home  "See Our Services" ──────────► Services
Home  "Explore all 18 services →" ─► Services
Home  "Talk to Us" ────────────────► Contact

Footer Quick Links ──► Homepage · Services · About Us · Contact Us
                       Terms & Conditions · Privacy Policy · Refund & Cancellation
```

**Routes to implement:** `/`, `/services`, `/about`, `/contact`, plus legal pages
`/terms`, `/privacy`, `/refund` (linked from the footer, **never captured** — content unknown).

The cart is **not** a route.

---

## User Interaction Patterns

| Interaction | Behavior | Source |
|---|---|---|
| Add to Cart | Adds the service, increments the header badge, opens or signals the drawer | [INFERRED] |
| Cart badge | Shows live item count; `1` in all captures | [VERIFIED] |
| Open cart | Slide-over drawer from the right, page dimmed behind | [VERIFIED] |
| Close cart | `✕`, `Esc`, or backdrop click | [VERIFIED ✕; rest INFERRED] |
| Delete line item | Trash button removes it, total recalculates | [VERIFIED control] |
| Pay Now | Mock `PaymentService` during this phase | [VERIFIED control] |
| Hamburger | Opens mobile nav | [INFERRED] |
| Search | Opens search overlay | [INFERRED] |
| Scroll | Section reveal animations (the cause of the capture gaps) | [INFERRED, strongly implied] |
| Contact submit | Validate → loading → success/error | [INFERRED] |

---

## Future Implementation Notes

- **Cart state is global** (`AGENTS.md` §18 permits this) — badge, drawer, and every Add-to-Cart
  button share it. Everything else stays local or feature-scoped.
- **Prices are INR** and always render as `@₹NNN` inside button labels.
- The catalogue is **18 services**; only ~8 distinct ones are visible across the captures. Model the
  data so the list is extensible, and mark invented entries as placeholder mock data.
- Mock data belongs in `features/services/data/`, never inline in JSX (`AGENTS.md` §13).
- Home and Services **share** the core-services and micro-services sections — build them once as
  composable section components.
- Implement scroll-reveal so content is **visible without JS** and honours
  `prefers-reduced-motion`; the animation must never leave content invisible the way the captures did.
