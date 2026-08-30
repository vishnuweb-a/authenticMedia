import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { MICRO_SERVICES } from '../data/catalogue.data'
import { SERVICES_CONTENT } from '../data/services.data'
import { MicroServiceCard } from './micro-service-card'

/**
 * "Website & Digital Micro-Services" on the catalogue page.
 *
 * The same tier and copy as Home's section, but the Services capture puts a
 * hairline rule between the last core card and this section's eyebrow —
 * measured at y≈5159 CSS, roughly 64px below the final card. It is the only
 * section divider on the page and separates the two catalogue tiers, so it is
 * rendered here rather than added to the shared Section primitive.
 */
export function CatalogueMicroServicesSection() {
  const { microServices } = SERVICES_CONTENT

  return (
    <Section className="pt-0">
      <hr className="mb-16 border-0 border-t border-border" />

      <SectionHeading
        eyebrow={microServices.eyebrow}
        title={
          <>
            {microServices.title} <GradientText>{microServices.titleAccent}</GradientText>
          </>
        }
        description={microServices.description}
      />

      <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MICRO_SERVICES.map((service) => (
          <li key={service.id} className="flex">
            <MicroServiceCard service={service} />
          </li>
        ))}
      </ul>
    </Section>
  )
}
