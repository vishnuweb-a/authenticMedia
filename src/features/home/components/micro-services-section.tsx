import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { MICRO_SERVICES, MicroServiceCard } from '@/features/services'
import { HOME_CONTENT } from '../data/home.data'

/**
 * "Website & Digital Micro-Services".
 *
 * In the reference the accent fragment wraps onto its own line at mobile width;
 * that falls out of the heading's natural wrapping rather than being forced, so
 * wider viewports set it on one line without a hard break.
 */
export function MicroServicesSection() {
  const { microServices } = HOME_CONTENT

  return (
    <Section className="pt-0">
      <SectionHeading
        eyebrow={microServices.eyebrow}
        title={
          <>
            {microServices.title} <GradientText>{microServices.titleAccent}</GradientText>
          </>
        }
        description={microServices.description}
      />

      <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MICRO_SERVICES.map((service) => (
          <li key={service.id} className="flex">
            <MicroServiceCard service={service} />
          </li>
        ))}
      </ul>
    </Section>
  )
}
