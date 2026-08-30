import { supabaseCartService } from './supabase-cart-service'
import type { CartService } from './types'

export type { CartService } from './types'

/** The active cart persistence implementation. */
export const cartService: CartService = supabaseCartService
