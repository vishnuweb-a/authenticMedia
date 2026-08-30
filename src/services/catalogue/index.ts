import { supabaseCatalogueRepository } from './supabase-catalogue-repository'
import type { CatalogueRepository } from './types'

export type { CatalogueRepository } from './types'

/** The active catalogue implementation. */
export const catalogueRepository: CatalogueRepository = supabaseCatalogueRepository
