import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import {
  CatalogueError,
  CatalogueSkeleton,
  MicroServiceCard,
  useCatalogue,
} from '@/features/services'
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
  const { services, isLoading, error } = useCatalogue('micro')

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

      {isLoading ? (
        <CatalogueSkeleton count={3} />
      ) : error ? (
        <CatalogueError message={error} />
      ) : (
        <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
