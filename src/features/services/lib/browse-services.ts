import type { Service, ServiceTier } from '@/types'

export type TierFilter = 'all' | ServiceTier
export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name'

const SORTERS: Record<SortKey, ((a: Service, b: Service) => number) | null> = {
  featured: null, // catalogue position, as returned by the repository
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  name: (a, b) => a.title.localeCompare(b.title),
}

function matches(service: Service, term: string): boolean {
  return [service.title, service.subtitle, service.description, ...(service.features ?? [])]
    .some((field) => field?.toLowerCase().includes(term))
}

/** Pure, so the page and the unit test filter the catalogue the same way. */
export function browseServices(
  services: readonly Service[],
  { query, tier, sort }: { query: string; tier: TierFilter; sort: SortKey },
): Service[] {
  const term = query.trim().toLowerCase()
  const sorter = SORTERS[sort]
  const list = services.filter(
    (service) => (tier === 'all' || service.tier === tier) && (!term || matches(service, term)),
  )
  return sorter ? list.sort(sorter) : list
}

