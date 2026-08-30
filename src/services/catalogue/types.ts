import type { Service } from '@/types'
import type { ServiceResult } from '@/services/result'

/**
 * The catalogue boundary.
 *
 * Supabase is the source of truth for services; the bundled TypeScript
 * catalogue is a development fallback used only when the project is
 * unconfigured (CLAUDE.md §20).
 */
export interface CatalogueRepository {
  listServices(): Promise<ServiceResult<readonly Service[]>>
  getService(slug: string): Promise<ServiceResult<Service | null>>
}
