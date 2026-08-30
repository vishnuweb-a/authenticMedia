import { Container } from '@/components/layout'
import { GradientText, SectionEyebrow } from '@/components/ui'
import { CONTACT_HERO } from '../data/contact.data'

/**
 * Contact page hero. **[VERIFIED against
 * inspiration/contact-us(screenshot).png]**
 *
 * The centred section pattern — eyebrow pill, gradient-accented heading, muted
 * sub-copy, short gradient rule — carrying the page's single <h1>.
 *
 * Measured geometry (CSS px, capture ÷ 3): eyebrow box 130×33 at y≈112–145;
 * H1 on one line, cap-height y≈181–214 (≈40px type); sub-copy four lines from
 * y≈246 to y≈355 on a measured ~30.7px pitch; gradient rule 40×1.5px at y≈400.
 *
 * The measure is capped so the reference's four-line wrap ("…in clear /
 * communication and quick support. Fill out the / form or reach out directly —
 * we'll get back to / you as soon as possible.") falls out naturally at the
 * 430px reference width instead of being forced with <br>.
 */
export function ContactHero() {
  return (
    <section className="pt-[46px] pb-[74px] md:pt-16 md:pb-20">
      <Container className="flex flex-col items-center gap-5 text-center">
        <SectionEyebrow>{CONTACT_HERO.eyebrow}</SectionEyebrow>

        <h1 className="text-[40px] sm:text-5xl lg:text-6xl">
          {CONTACT_HERO.title} <GradientText>{CONTACT_HERO.titleAccent}</GradientText>
        </h1>

        {/* ~356px is the longest measured line of the four. */}
        <p className="max-w-[356px] text-[17px] leading-[31px] text-text-muted sm:max-w-2xl sm:leading-[1.7]">
          {CONTACT_HERO.description}
        </p>

        <span aria-hidden="true" className="bg-gradient-primary mt-6 h-0.5 w-10 rounded-pill" />
      </Container>
    </section>
  )
}
