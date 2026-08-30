import { ALL_SERVICES } from '@/features/services'
import { err, ok, type ServiceResult } from '@/services'
import type { Service } from '@/types'
import type { SearchResult } from '../types/search.types'

/**
 * The search boundary.
 *
 * Today this ranks the in-memory catalogue; later the same call becomes a
 * backend full-text query (Supabase `textSearch`, or a dedicated search index)
 * without the overlay changing. Everything provider-specific — ranking,
 * stemming, typo tolerance — belongs behind this interface, which is why the
 * UI receives scored `SearchResult`s rather than filtering a list itself
 * (CLAUDE.md §7).
 */
export interface SearchService {
  search(query: string): Promise<ServiceResult<readonly SearchResult[]>>
}

/** Queries shorter than this match too much of the catalogue to be useful. */
export const MIN_QUERY_LENGTH = 2

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Field weights. A title hit should always outrank a description hit for the
 * same term, and a hit at the *start* of a field outranks one buried in it —
 * typing "web" should surface "Website Health Check" above a service that
 * merely mentions websites in its prose.
 */
const FIELD_WEIGHTS = {
  title: 100,
  subtitle: 60,
  feature: 40,
  description: 20,
} as const

type MatchedField = keyof typeof FIELD_WEIGHTS

interface ScoredMatch {
  score: number
  matchedOn: MatchedField
  excerpt?: string
}

/** A short window of text around the hit, so the row can show why it matched. */
function excerptAround(text: string, index: number, termLength: number): string {
  const start = Math.max(0, index - 30)
  const end = Math.min(text.length, index + termLength + 40)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

function scoreField(
  value: string | undefined,
  field: MatchedField,
  term: string,
): ScoredMatch | undefined {
  if (!value) return undefined

  const index = value.toLowerCase().indexOf(term)
  if (index === -1) return undefined

  // A match at a word boundary is a stronger signal than one mid-word.
  const isWordStart = index === 0 || /\W/.test(value[index - 1] ?? '')
  const score = FIELD_WEIGHTS[field] + (isWordStart ? 15 : 0) + (index === 0 ? 10 : 0)

  return {
    score,
    matchedOn: field,
    // A title match needs no explanation — the title is already the row's headline.
    excerpt: field === 'title' ? undefined : excerptAround(value, index, term.length),
  }
}

/** The single best-scoring field hit for one service, or undefined if it misses. */
function matchService(service: Service, term: string): ScoredMatch | undefined {
  const candidates: (ScoredMatch | undefined)[] = [
    scoreField(service.title, 'title', term),
    scoreField(service.subtitle, 'subtitle', term),
    scoreField(service.description, 'description', term),
    ...(service.features ?? []).map((feature) => scoreField(feature, 'feature', term)),
  ]

  return candidates
    .filter((match): match is ScoredMatch => match !== undefined)
    .sort((a, b) => b.score - a.score)
    .at(0)
}

function createMockSearchService(): SearchService {
  return {
    async search(query: string) {
      const term = query.trim().toLowerCase()

      if (term.length < MIN_QUERY_LENGTH) {
        return err('query_too_short', `Type at least ${MIN_QUERY_LENGTH} characters to search.`)
      }

      // Stands in for network latency so the overlay's pending state is real
      // rather than a state that only exists in theory.
      await delay(220)

      const results = ALL_SERVICES.map((service) => {
        const match = matchService(service, term)
        return match ? { service, match } : undefined
      })
        .filter((entry): entry is { service: Service; match: ScoredMatch } => entry !== undefined)
        .sort((a, b) => b.match.score - a.match.score || a.service.title.localeCompare(b.service.title))
        .map(({ service, match }): SearchResult => ({
          service,
          matchedOn: match.matchedOn,
          excerpt: match.excerpt,
        }))

      return ok(results)
    },
  }
}

export const searchService = createMockSearchService()
