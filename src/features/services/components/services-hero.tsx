import { Container } from '@/components/layout'
import { GradientText, SectionEyebrow } from '@/components/ui'
import { SERVICES_CONTENT } from '../data/services.data'

/**
 * Services page hero.
 *
 * Unlike Home's left-aligned hero, this one uses the standard **centered**
 * section pattern — eyebrow pill, gradient-accented heading, muted sub-copy,
 * then the short gradient rule — but carries the page's single <h1>.
 *
 * Measured geometry (CSS px, capture ÷ 3): eyebrow box 262×33 at y=112, H1
 * cap-height y=181–210, sub-copy y=276–351, gradient rule 40×2px at y=400, and
 * the first card top at y=782.
 */
export function ServicesHero() {
  const { hero } = SERVICES_CONTENT

  return (
    <section className="pt-[46px] pb-[121px] md:pt-16 md:pb-28">
      <Container className="flex flex-col items-center gap-5 text-center">
        <SectionEyebrow>{hero.eyebrow}</SectionEyebrow>

        <h1 className="max-w-3xl text-[44px] sm:text-5xl lg:text-6xl">
          {hero.title} <GradientText>{hero.titleAccent}</GradientText>
        </h1>

        {/* Measured from the capture: 31px line pitch, longest line ~335px, three
            lines at the 430px reference width. The cap is set just above that
            longest line so the same break falls out naturally in Outfit. */}
        <p className="max-w-[344px] text-[17px] leading-[31px] text-text-muted sm:max-w-2xl">
          {hero.description}
        </p>

        <span aria-hidden="true" className="bg-gradient-primary mt-7 h-0.5 w-10 rounded-pill" />
      </Container>
    </section>
  )
}
