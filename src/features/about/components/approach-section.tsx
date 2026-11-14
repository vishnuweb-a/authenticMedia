import { Section, SectionHeading } from '@/components/layout'
import { Card, GradientText } from '@/components/ui'
import { ABOUT_APPROACH_STEPS, ABOUT_CONTENT } from '../data/about.data'

/**
 * "How It Works" — the order-to-delivery workflow. Rendered on About and on
 * Services, so both pages describe the engagement identically.
 *
 * The index is decorative ordering, so the list order carries the meaning for
 * assistive tech rather than the numeral being read as part of each heading.
 */
export function ApproachSection() {
  const { approach } = ABOUT_CONTENT

  return (
    <Section className="pt-0">
      <SectionHeading
        eyebrow={approach.eyebrow}
        title={
          <>
            {approach.title} <GradientText>{approach.titleAccent}</GradientText>
          </>
        }
        description={approach.description}
      />

      <ol className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {ABOUT_APPROACH_STEPS.map((step) => (
          <li key={step.id} className="flex">
            <Card className="flex w-full flex-col items-start">
              <span aria-hidden="true" className="gradient-text text-[32px] font-bold">
                {step.step}
              </span>

              <h3 className="mt-3 text-xl">{step.title}</h3>

              <p className="mt-3 text-base text-text-muted">{step.description}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  )
}
