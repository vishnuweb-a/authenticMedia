import { Search } from 'lucide-react'
import { useId, useState } from 'react'

import { Section, SectionHeading } from '@/components/layout'
import { GradientText } from '@/components/ui'
import { cn } from '@/lib/cn'
import { browseServices, type SortKey, type TierFilter } from '../lib/browse-services'
import { SERVICES_CONTENT } from '../data/services.data'
import { useCatalogue } from '../hooks/use-catalogue'
import { CatalogueEmpty, CatalogueError, CatalogueSkeleton } from './catalogue-states'
import { MicroServiceCard } from './micro-service-card'
import { ServiceCard } from './service-card'

const TIERS: readonly { value: TierFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core services' },
  { value: 'micro', label: 'Micro-services' },
]

/**
 * The full catalogue with search, category and sort controls. One catalogue
 * read feeds both tier groups. Nothing is paginated: every active service is
 * listed, because the catalogue is small enough to scan.
 */
export function ServicesBrowser() {
  const { services, isLoading, error } = useCatalogue()
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<TierFilter>('all')
  const [sort, setSort] = useState<SortKey>('featured')
  const searchId = useId()
  const sortId = useId()

  const visible = browseServices(services, { query, tier, sort })
  const groups = [
    { tier: 'core' as const, content: SERVICES_CONTENT.coreOfferings, items: visible.filter((s) => s.tier === 'core') },
    { tier: 'micro' as const, content: SERVICES_CONTENT.microServices, items: visible.filter((s) => s.tier === 'micro') },
  ].filter((group) => group.items.length > 0)

  function reset() {
    setQuery('')
    setTier('all')
    setSort('featured')
  }

  return (
    <Section className="py-0 pb-16 md:pb-20 lg:pb-24">
      <div
        role="search"
        aria-label="Filter services"
        className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-5 lg:flex-row lg:items-end"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label htmlFor={searchId} className="text-sm font-semibold text-text">
            Search the catalogue
          </label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-subtle" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. SEO, security, hosting"
              className="h-12 w-full rounded-input border border-border bg-surface pr-4 pl-11 text-base text-text placeholder:text-text-subtle focus-visible:border-primary-mid"
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-text">Category</legend>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'inline-flex h-12 cursor-pointer items-center rounded-pill border px-4 text-[15px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-mid',
                  tier === option.value
                    ? 'border-primary-mid bg-surface-badge text-primary-start'
                    : 'border-border text-text-muted hover:text-text',
                )}
              >
                <input
                  type="radio"
                  name="service-tier"
                  value={option.value}
                  checked={tier === option.value}
                  onChange={() => setTier(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor={sortId} className="text-sm font-semibold text-text">
            Sort by
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-12 rounded-input border border-border bg-surface px-4 text-base text-text focus-visible:border-primary-mid"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <CatalogueSkeleton count={6} />
      ) : error ? (
        <CatalogueError message={error} />
      ) : services.length === 0 ? (
        <CatalogueEmpty />
      ) : (
        <>
          <p role="status" className="mt-6 text-[15px] text-text-muted">
            Showing {visible.length} of {services.length} services
          </p>

          {groups.length === 0 ? (
            <div className="mt-8 rounded-card border border-border/60 bg-surface/60 px-6 py-14 text-center">
              <p className="text-[17px] font-bold text-text">No services match your filters</p>
              <p className="mt-2 text-[15px] text-text-muted">Try another search term or category.</p>
              <button
                type="button"
                onClick={reset}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-pill border border-border-secondary px-6 text-[15px] font-semibold text-text transition-colors hover:bg-primary-start/10"
              >
                Clear filters
              </button>
            </div>
          ) : (
            groups.map((group, index) => {
              const Card = group.tier === 'core' ? ServiceCard : MicroServiceCard
              return (
                <section key={group.tier} aria-labelledby={`tier-${group.tier}`} className="mt-16">
                  {index > 0 && <hr className="mb-16 border-0 border-t border-border" />}
                  <SectionHeading
                    eyebrow={group.content.eyebrow}
                    title={
                      <span id={`tier-${group.tier}`}>
                        {group.content.title} <GradientText>{group.content.titleAccent}</GradientText>
                      </span>
                    }
                    description={group.content.description}
                  />
                  <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((service) => (
                      <li key={service.id} className="flex">
                        <Card service={service} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })
          )}
        </>
      )}
    </Section>
  )
}
