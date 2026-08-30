import { Link } from 'react-router-dom'

import { Container } from '@/components/layout'
import { ABOUT_CONTENT } from '../data/about.data'

/**
 * Closing CTA band. **[VERIFIED against
 * inspiration/about-us(screenshot).png]**
 *
 * The one full-bleed banded surface in the system — everywhere else, sections
 * are separated by whitespace alone. It sits directly above the footer, with a
 * hard top edge (no radius, no fade) and a hairline at its base.
 *
 * Measured (CSS px, capture ÷ 3): band y=3400–3835, so **435px tall**, running
 * edge to edge. Fill `#1C0D43` at the left, cooling to `#1D0C37` at the right —
 * a subtle horizontal gradient, not a flat block. A faint lighter grid overlays
 * it on a **60px** pitch (180px @3x). Heading is white with *no* gradient
 * accent and *no* eyebrow — the only major heading on the page without one.
 * The gradient pill measures 179px wide and the outlined pill 195px; both are
 * auto-width from their labels and stacked centred.
 */
export function ClosingCtaSection() {
  const { closing } = ABOUT_CONTENT

  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(90deg,#1C0D43_0%,#1D0C37_100%)]">
      {/* The measured 60px grid. Decorative texture only. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[length:60px_60px] bg-[linear-gradient(to_right,rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.022)_1px,transparent_1px)]"
      />

      <Container className="flex flex-col items-center gap-6 py-[74px] text-center md:py-24">
        <h2 className="max-w-[16ch] text-[36px] sm:max-w-3xl sm:text-[42px] lg:text-5xl">
          {closing.title}
        </h2>

        <p className="max-w-[368px] text-[17px] leading-[31px] text-text-muted sm:max-w-xl">
          {closing.description}
        </p>

        {/* Stacked and centred in the reference; side by side once there is room. */}
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            to={closing.primaryCta.to}
            className="bg-gradient-primary shadow-glow-primary inline-flex h-[62px] items-center justify-center rounded-pill px-11 text-base font-bold text-text transition-[filter,transform] duration-150 hover:brightness-108 active:scale-[0.98]"
          >
            {closing.primaryCta.label}
          </Link>

          <Link
            to={closing.secondaryCta.to}
            className="inline-flex h-[62px] items-center justify-center rounded-pill border border-border-secondary px-11 text-base font-semibold text-text transition-[background-color,transform] duration-150 hover:bg-primary-start/10 active:scale-[0.98]"
          >
            {closing.secondaryCta.label}
          </Link>
        </div>
      </Container>
    </section>
  )
}
