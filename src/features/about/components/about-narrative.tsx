import { Section } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { ABOUT_CONTENT } from '../data/about.data'

/**
 * The "About Us" narrative. **[VERIFIED against
 * inspiration/about-us(screenshot).png]**
 *
 * The one section on the page that breaks the centred pattern: no eyebrow pill,
 * and both the heading and the prose are **left aligned** at the 24px page
 * gutter. It therefore does not use SectionHeading, which is centred by design.
 *
 * Measured geometry (CSS px, capture ÷ 3): heading cap-height from y≈543 with
 * "Us" gradient-filled; body left edge x=26 (the 24px gutter); paragraph line
 * pitch ~29px; longest measured line ~350px of the 430px viewport, so the
 * mobile measure is capped there and only opens up once there is room.
 */
export function AboutNarrative() {
  const { narrative } = ABOUT_CONTENT

  return (
    <Section className="py-0">
      <div className="max-w-[352px] sm:max-w-[68ch]">
        <h2 className="text-[32px] sm:text-4xl lg:text-[40px]">
          {narrative.title} <GradientText>{narrative.titleAccent}</GradientText>
        </h2>

        <div className="mt-7 flex flex-col gap-6 text-[17px] leading-[29px] text-text-muted">
          {narrative.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
      </div>
    </Section>
  )
}
