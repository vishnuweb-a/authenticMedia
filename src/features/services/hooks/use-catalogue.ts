import { useEffect, useState } from 'react'

import { catalogueRepository } from '@/services'
import type { Service, ServiceTier } from '@/types'

export interface UseCatalogueResult {
  services: readonly Service[]
  isLoading: boolean
  error: string | null
}

/**
 * Reads the catalogue through the repository boundary.
 *
 * Supabase is the source of truth; the repository falls back to the bundled
 * catalogue when the project is unconfigured, so this hook's consumers get a
 * populated list either way and the marketing pages never render empty.
 *
 * `tier` filters the shared list rather than issuing a second request — the
 * catalogue is small and both sections mount together on Services.
 */
export function useCatalogue(tier?: ServiceTier): UseCatalogueResult {
  const [services, setServices] = useState<readonly Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void catalogueRepository.listServices().then((result) => {
      if (cancelled) return

      if (result.ok) {
        setServices(result.data)
        setError(null)
      } else {
        setError(result.error.message)
      }

      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    services: tier ? services.filter((service) => service.tier === tier) : services,
    isLoading,
    error,
  }
}
