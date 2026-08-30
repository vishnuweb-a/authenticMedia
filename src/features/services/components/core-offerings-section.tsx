import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { SERVICES_CONTENT } from '../data/services.data'
import { useCatalogue } from '../hooks/use-catalogue'
import { CatalogueEmpty, CatalogueError, CatalogueSkeleton } from './catalogue-states'
import { ServiceCard } from './service-card'

/**
 * "Core Services" — the full core tier.
 *
 * The capture shows one continuous list of twelve cards under a single heading,
 * not a core block followed by a separate "additional catalogue" section, so
 * this renders CORE_SERVICES whole. Home renders the first six of the same
 * array through the same card.
 *
 * The measured mobile gap between cards here is **24px** (card centres sampled
 * at x=400: bottoms and tops 24px apart), tighter than Home's 32px rhythm — the
 * catalogue is a denser list. Multi-column arrangement at wider viewports is
 * inferred; no desktop reference exists.
 */
export function CoreOfferingsSection() {
  const { coreOfferings } = SERVICES_CONTENT
  const { services, isLoading, error } = useCatalogue('core')

  return (
    <Section className="py-0 pb-16 md:pb-20 lg:pb-24">
      <SectionHeading
        eyebrow={coreOfferings.eyebrow}
        title={
          <>
            {coreOfferings.title} <GradientText>{coreOfferings.titleAccent}</GradientText>
          </>
        }
        description={coreOfferings.description}
      />

      {isLoading ? (
        <CatalogueSkeleton count={6} />
      ) : error ? (
        <CatalogueError message={error} />
      ) : services.length === 0 ? (
        <CatalogueEmpty />
      ) : (
        <ul className="mt-[74px] grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.id} className="flex">
              <ServiceCard service={service} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
