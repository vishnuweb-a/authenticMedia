import type { Service } from '@/types'

/**
 * The search request lifecycle rendered by the overlay body.
 *
 * `idle` is the resting state (no query typed yet); the rest map one-to-one
 * onto what SearchService can return, so the overlay never has to infer which
 * panel to show from a combination of flags.
 */
export type SearchStatus = 'idle' | 'searching' | 'success' | 'error'

/**
 * A catalogue hit, carrying the whole Service so the result row can render a
 * price and hand the record straight to the cart without a second lookup.
 */
export interface SearchResult {
  service: Service
  /**
   * Which field matched, so the row can explain *why* it surfaced — a hit on a
   * deliverable is not obvious from a title the user never typed.
   */
  matchedOn: 'title' | 'subtitle' | 'description' | 'feature'
  /** The matched fragment, shown as context on non-title matches. */
  excerpt?: string
}

export interface SearchState {
  status: SearchStatus
  results: readonly SearchResult[]
  /** Human-readable failure text; only set when status is 'error'. */
  error?: string
}
