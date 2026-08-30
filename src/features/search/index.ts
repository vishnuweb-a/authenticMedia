/**
 * Search feature.
 *
 * [INFERRED] — SCREEN-MAP.md lists a `SearchOverlay` behind the header's search
 * button but no capture shows it open, so it borrows the cart drawer's surfaces
 * and geometry rather than inventing a second visual language.
 *
 * Like the cart it is an overlay, not a route. Queries go through the
 * SearchService interface, which ranks the local catalogue today and becomes a
 * backend full-text query later — the overlay does not change either way.
 */
export { SearchOverlay } from './components'
export { searchService, MIN_QUERY_LENGTH } from './services/search.service'
export type { SearchService } from './services/search.service'
export { useSearch } from './hooks/use-search'
export type * from './types/search.types'
