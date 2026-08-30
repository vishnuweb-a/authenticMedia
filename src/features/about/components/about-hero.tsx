import { Container } from '@/components/layout'
import { GradientText, SectionEyebrow } from '@/components/ui'
import { ABOUT_CONTENT } from '../data/about.data'

/**
 * About page hero. **[VERIFIED against inspiration/about-us(screenshot).png]**
 *
 * Centred section pattern — eyebrow pill, gradient-accented heading, muted
 * sub-copy, short gradient rule — and it carries the page's single <h1>.
 *
 * Measured geometry (CSS px, capture ÷ 3): eyebrow box 123×33 centred at
 * y≈112–145; H1 across two lines from y≈180, the accent "Authentic Media"
 * wrapping onto the second line; sub-copy three lines from y≈280; gradient rule
 * 40×2px at y≈413.
 *
 * The heading is capped near 8ch per line so the reference's two-line break
 * ("About Authentic" / "Media") falls out naturally at the 430px reference
 * width rather than being forced with a <br>.
 */
export function AboutHero() {
  const { hero } = ABOUT_CONTENT

  return (
    <section className="pt-[46px] pb-[74px] md:pt-16 md:pb-20">
      <Container className="flex flex-col items-center gap-5 text-center">
        <SectionEyebrow>{hero.eyebrow}</SectionEyebrow>

        <h1 className="max-w-[15ch] text-[44px] sm:max-w-3xl sm:text-5xl lg:text-6xl">
          {hero.title} <GradientText>{hero.titleAccent}</GradientText>
        </h1>

        {/* Three lines at the reference width; the cap sits just above the
            longest measured line (~343px). */}
        <p className="max-w-[352px] text-[17px] leading-[31px] text-text-muted sm:max-w-2xl">
          {hero.description}
        </p>

        <span aria-hidden="true" className="bg-gradient-primary mt-7 h-0.5 w-10 rounded-pill" />
      </Container>
    </section>
  )
}
