import { supabase } from '@/lib/supabase'
import type { ServiceRow } from '@/lib/supabase'
import { err, ok } from '@/services/result'
import type { Service, ServiceTier } from '@/types'
import { ALL_SERVICES } from '@/features/services/data/catalogue.data'
import type { CatalogueRepository } from './types'

const SERVICE_COLUMNS =
  'slug, title, description, subtitle, features, price_inr, icon, badge, position, service_categories!inner(tier)'

/** A joined row: PostgREST nests the category under its table name. */
interface JoinedServiceRow extends Omit<ServiceRow, 'tier'> {
  service_categories: { tier: string } | { tier: string }[]
}

function readTier(row: JoinedServiceRow): ServiceTier {
  const category = Array.isArray(row.service_categories)
    ? row.service_categories[0]
    : row.service_categories
  return category?.tier === 'micro' ? 'micro' : 'core'
}

/** Maps a database row onto the Service shape the UI already renders. */
function toService(row: JoinedServiceRow): Service {
  return {
    id: row.slug,
    title: row.title,
    description: row.description,
    ...(row.subtitle ? { subtitle: row.subtitle } : {}),
    ...(row.features.length > 0 ? { features: row.features } : {}),
    price: row.price_inr,
    tier: readTier(row),
    icon: row.icon,
    ...(row.badge ? { badge: row.badge } : {}),
  }
}

/**
 * Reads the catalogue from Supabase, falling back to the bundled copy.
 *
 * The fallback exists so the site still renders without a configured project;
 * it is never used to *write*, so the two can never diverge in a way that
 * affects a purchase — prices are re-resolved server-side at order time.
 */
export const supabaseCatalogueRepository: CatalogueRepository = {
  async listServices() {
    if (!supabase) return ok(ALL_SERVICES)

    const { data, error } = await supabase
      .from('services')
      .select(SERVICE_COLUMNS)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (error) {
      return err('catalogue_unavailable', 'We could not load the services right now.')
    }

    const rows = (data ?? []) as unknown as JoinedServiceRow[]

    // An empty catalogue means the project is configured but unseeded — render
    // the bundled copy rather than an empty page.
    if (rows.length === 0) return ok(ALL_SERVICES)

    return ok(rows.map(toService))
  },

  async getService(slug: string) {
    if (!supabase) {
      return ok(ALL_SERVICES.find((service) => service.id === slug) ?? null)
    }

    const { data, error } = await supabase
      .from('services')
      .select(SERVICE_COLUMNS)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      return err('catalogue_unavailable', 'We could not load that service right now.')
    }

    return ok(data ? toService(data as unknown as JoinedServiceRow) : null)
  },
}
