/**
 * Services feature — owner of the service catalogue presentation.
 *
 * Reference: inspiration/services(iPhone 14 Pro Max).png (truncated at the
 * 16384px capture ceiling mid micro-services section — no footer captured; the
 * global footer comes from AppShell).
 *
 * Composition: hero → Core Services → Website & Digital Micro-Services.
 *
 * The catalogue itself now lives in Supabase and is read through
 * CatalogueRepository (src/services/catalogue). The arrays in data/ remain as a
 * development fallback for an unconfigured checkout — they are never the write
 * path, and order prices are always re-resolved server-side (CLAUDE.md §20).
 *
 * Both card components and the add-to-cart hook live here rather than in Home
 * because they render this catalogue: Services shows the full list, Home a
 * six-entry subset, through the same components and the same cart store.
 */
export {
  CatalogueEmpty,
  CatalogueError,
  CatalogueMicroServicesSection,
  CatalogueSkeleton,
  CoreOfferingsSection,
  MicroServiceCard,
  ServiceCard,
  ServicesHero,
} from './components'
export {
  ALL_SERVICES,
  CATALOGUE_SIZE,
  CORE_SERVICES,
  HOME_CORE_SERVICES,
  MICRO_SERVICES,
} from './data/catalogue.data'
export { SERVICES_CONTENT } from './data/services.data'
export { useAddToCart } from './hooks/use-add-to-cart'
export { useCatalogue } from './hooks/use-catalogue'
export type * from './types/services.types'
