import { useEffect, useState } from 'react'

import { catalogueRepository } from '@/services'
import type { Service } from '@/types'

export interface UseServiceResult {
  /** null once loaded means no active service has this slug. */
  service: Service | null
  isLoading: boolean
  error: string | null
}

/** Reads one active service by slug through the catalogue boundary. */
export function useService(slug: string): UseServiceResult {
  const [state, setState] = useState<UseServiceResult & { slug: string }>({
    slug,
    service: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    void catalogueRepository.getService(slug).then((result) => {
      if (cancelled) return
      setState(
        result.ok
          ? { slug, service: result.data, isLoading: false, error: null }
          : { slug, service: null, isLoading: false, error: result.error.message },
      )
    })

    return () => {
      cancelled = true
    }
  }, [slug])

  // A slug change shows loading at once instead of the previous service.
  return state.slug === slug ? state : { service: null, isLoading: true, error: null }
}
