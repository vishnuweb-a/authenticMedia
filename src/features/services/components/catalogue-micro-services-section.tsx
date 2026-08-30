import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { SERVICES_CONTENT } from '../data/services.data'
import { useCatalogue } from '../hooks/use-catalogue'
import { CatalogueEmpty, CatalogueError, CatalogueSkeleton } from './catalogue-states'
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
  const { services, isLoading, error } = useCatalogue('micro')

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

      {isLoading ? (
        <CatalogueSkeleton count={3} />
      ) : error ? (
        <CatalogueError message={error} />
      ) : services.length === 0 ? (
        <CatalogueEmpty />
      ) : (
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.id} className="flex">
              <MicroServiceCard service={service} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
