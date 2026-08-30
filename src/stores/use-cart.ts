import { use } from 'react'

import { CartContext, type CartContextValue } from './cart-context'

/** Read and mutate the shared cart. Throws outside a CartProvider. */
export function useCart(): CartContextValue {
  const context = use(CartContext)

  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }

  return context
}
