import { useCallback, useEffect, useRef, useState } from 'react'

import { MIN_QUERY_LENGTH, searchService } from '../services/search.service'
import type { SearchState } from '../types/search.types'

const DEBOUNCE_MS = 200

const IDLE: SearchState = { status: 'idle', results: [] }

/** A resolved result, tagged with the query that produced it. */
interface ResolvedSearch {
  query: string
  state: SearchState
}

/** A query shorter than the minimum is a resting box, not a failed search. */
function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH
}

/**
 * Drives the search overlay: debounced query → service call → render state.
 *
 * Two things make this more than a `useEffect` around a filter. Keystrokes are
 * debounced so a fast typist issues one request rather than one per character,
 * and every in-flight request is tagged so a slow early response cannot
 * overwrite a newer one — the classic race that makes a search box show results
 * for a query the user has already moved past.
 *
 * Only the *resolved* request lives in state. Whether the overlay is idle or
 * pending is derived during render from the query itself, so clearing the box
 * does not have to round-trip through an effect to get back to idle.
 */
export function useSearch() {
  const [query, setQuery] = useState('')
  const [resolved, setResolved] = useState<ResolvedSearch | undefined>(undefined)

  // Monotonic request id; only the newest request may commit its result.
  const requestId = useRef(0)

  const reset = useCallback(() => {
    requestId.current += 1
    setQuery('')
    setResolved(undefined)
  }, [])

  useEffect(() => {
    if (!isSearchable(query)) {
      // Abandon any in-flight request so its result cannot land later.
      requestId.current += 1
      return
    }

    const id = ++requestId.current

    const term = query.trim()

    const timer = setTimeout(async () => {
      const result = await searchService.search(term)

      // A newer keystroke has already superseded this request.
      if (id !== requestId.current) return

      setResolved({
        query: term,
        state: result.ok
          ? { status: 'success', results: result.data }
          : { status: 'error', results: [], error: result.error.message },
      })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  // An empty box is idle; a typed query is searching until the resolved result
  // on screen is the one that query produced. Tagging the result with its query
  // is what makes the *second* and later searches show a pending state too.
  const state: SearchState = !isSearchable(query)
    ? IDLE
    : resolved?.query === query.trim()
      ? resolved.state
      : { status: 'searching', results: [] }

  return { query, setQuery, reset, ...state }
}
