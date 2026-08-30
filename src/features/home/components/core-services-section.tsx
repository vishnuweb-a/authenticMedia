import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { CatalogueError, CatalogueSkeleton, ServiceCard, useCatalogue } from '@/features/services'
import { HOME_CONTENT } from '../data/home.data'

/**
 * "Our Core Services" — the first six catalogue entries, one column at the
 * measured mobile width and
 * two/three up once there is room (the multi-column arrangement is inferred; no
 * desktop reference exists).
 *
 * Below the grid sits a centered link to the full catalogue, framed by hairline
 * rules — measured at y≈3367 in the capture.
 */
export function CoreServicesSection() {
  const { coreServices, catalogueLink } = HOME_CONTENT
  const { services, isLoading, error } = useCatalogue('core')

  // Home shows a curated six-entry subset; Services renders the tier in full.
  const featured = services.slice(0, 6)

  return (
    <Section>
      <SectionHeading
        eyebrow={coreServices.eyebrow}
        title={
          <>
            {coreServices.title} <GradientText>{coreServices.titleAccent}</GradientText>
          </>
        }
        description={coreServices.description}
      />

      {isLoading ? (
        <CatalogueSkeleton count={6} />
      ) : error ? (
        <CatalogueError message={error} />
      ) : (
        <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((service) => (
            <li key={service.id} className="flex">
              <ServiceCard service={service} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-14 border-y border-border/60 py-7 text-center">
        <Link
          to={catalogueLink.to}
          className="inline-flex items-center gap-2 rounded-pill text-[15px] font-semibold text-primary-mid transition-colors hover:text-primary-end"
        >
          {catalogueLink.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </Section>
  )
}
