import { Section, SectionHeading } from '@/components/layout'
import { ServiceIcon } from '@/components/shared'
import { Card, GradientText } from '@/components/ui'
import { ABOUT_CAPABILITIES, ABOUT_CONTENT } from '../data/about.data'

/**
 * "What We Do". **[RECONSTRUCTED — no reference exists for this region]**
 *
 * Fills part of the blank band at y≈3060–10430 of the capture
 * (REFERENCE-LIMITATIONS.md → About Blank Region). Nothing here is invented
 * about the company: the six areas are precisely the ones the *verified*
 * narrative enumerates, and each already exists in the service catalogue.
 *
 * It is built entirely from the established language — centred eyebrow →
 * gradient-accent heading → muted sub-copy, then the shared Card at its
 * standard 24px radius and 28px padding. No new visual pattern is introduced.
 */
export function CapabilitiesSection() {
  const { capabilities } = ABOUT_CONTENT

  return (
    <Section>
      <SectionHeading
        eyebrow={capabilities.eyebrow}
        title={
          <>
            {capabilities.title} <GradientText>{capabilities.titleAccent}</GradientText>
          </>
        }
        description={capabilities.description}
      />

      <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {ABOUT_CAPABILITIES.map((capability) => (
          <li key={capability.id} className="flex">
            <Card interactive className="flex w-full flex-col items-start">
              <ServiceIcon name={capability.icon} tile />

              <h3 className="mt-6 text-xl">{capability.title}</h3>

              <p className="mt-3 text-base text-text-muted">{capability.description}</p>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  )
}
