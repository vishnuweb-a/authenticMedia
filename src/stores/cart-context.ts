import { createContext } from 'react'

import type { CartItem } from '@/types'

export interface CartContextValue {
  items: readonly CartItem[]
  /** Total in whole rupees. */
  total: number
  itemCount: number
  isOpen: boolean
  /** Adding a service already in the cart is a no-op — there is no quantity. */
  addItem: (item: CartItem) => void
  removeItem: (serviceId: string) => void
  clear: () => void
  hasItem: (serviceId: string) => boolean
  openCart: () => void
  closeCart: () => void
}

/**
 * Undefined until a CartProvider is mounted, so useCart can fail loudly rather
 * than silently handing back an empty cart.
 */
export const CartContext = createContext<CartContextValue | undefined>(undefined)
