import { Link } from 'react-router-dom'

import { Container } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { HOME_CONTENT } from '../data/home.data'

/**
 * Home hero.
 *
 * Unlike the section headings further down the page, the hero is **left
 * aligned** and its eyebrow is a gradient rule followed by tracked uppercase
 * text — not the pill badge used by sections. Both are measured from
 * inspiration/home.png rather than taken from the generic section pattern.
 *
 * Measured geometry (CSS px, capture ÷ 3): eyebrow baseline ~250, H1 lines at
 * 296/329/362 (~33px line-height), body from 421, primary CTA 537–599 (62px
 * tall, 219px wide), social proof ~722.
 */
export function Hero() {
  const { hero } = HOME_CONTENT

  return (
    // The violet radial light is bounded: it resolves to the page background at
    // y≈932 in the reference, so it belongs to this section rather than being a
    // page-wide backdrop.
    <section className="bg-hero-glow relative isolate overflow-hidden">
      <Container className="flex flex-col items-start pt-[124px] pb-[88px] md:pt-[140px] md:pb-[120px] lg:pt-[168px]">
        <p className="flex items-center gap-4 text-xs font-semibold tracking-[0.18em] text-text-muted uppercase sm:text-[13px]">
          <span aria-hidden="true" className="bg-gradient-primary h-0.5 w-9 rounded-pill" />
          {hero.eyebrow}
        </p>

        <h1 className="mt-8 max-w-[19ch] text-[40px] leading-[0.82] sm:text-5xl lg:text-[64px]">
          {hero.headline}{' '}
          <GradientText className="italic">{hero.headlineAccent}</GradientText>
        </h1>

        <p className="mt-7 max-w-[46ch] text-[17px] text-text-muted lg:text-lg">
          {hero.description}
        </p>

        {/* Auto-width pills, stacked at mobile and side by side once there is
            room — the reference shows them stacked and left aligned. */}
        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Link
            to={hero.primaryCta.to}
            className="bg-gradient-primary shadow-glow-primary inline-flex h-[62px] items-center justify-center rounded-pill px-9 text-base font-bold text-text transition-[filter,transform] duration-150 hover:brightness-108 active:scale-[0.98]"
          >
            {hero.primaryCta.label}
          </Link>

          <Link
            to={hero.secondaryCta.to}
            className="inline-flex h-[62px] items-center justify-center rounded-pill border border-border-secondary px-9 text-base font-semibold text-text transition-[background-color,transform] duration-150 hover:bg-primary-start/10 active:scale-[0.98]"
          >
            {hero.secondaryCta.label}
          </Link>
        </div>

        <SocialProof />
      </Container>
    </section>
  )
}

function SocialProof() {
  const { avatars, highlight, rest } = HOME_CONTENT.hero.socialProof

  return (
    <div className="mt-14 flex items-center gap-4">
      {/* Decorative: the sentence beside it carries the meaning. */}
      <ul aria-hidden="true" className="flex items-center">
        {avatars.map((avatar, index) => (
          <li
            key={avatar.initials}
            className="bg-gradient-primary flex size-9 items-center justify-center rounded-pill text-[11px] font-bold text-text ring-2 ring-background"
            style={{ marginLeft: index === 0 ? 0 : '-10px' }}
          >
            {avatar.initials}
          </li>
        ))}
      </ul>

      <p className="text-[15px] text-text-muted">
        <span className="font-bold text-text">{highlight}</span> {rest}
      </p>
    </div>
  )
}
