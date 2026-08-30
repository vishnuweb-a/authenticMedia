import { useCallback, useMemo, useReducer, useState, type ReactNode } from 'react'

import type { CartItem } from '@/types'
import { CartContext, type CartContextValue } from './cart-context'

type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'remove'; serviceId: string }
  | { type: 'clear' }

function cartReducer(state: readonly CartItem[], action: CartAction): readonly CartItem[] {
  switch (action.type) {
    case 'add':
      // Services are single-purchase; re-adding one must not duplicate the line.
      return state.some((item) => item.serviceId === action.item.serviceId)
        ? state
        : [...state, action.item]
    case 'remove':
      return state.filter((item) => item.serviceId !== action.serviceId)
    case 'clear':
      return []
  }
}

/**
 * Cart state is the one genuinely global concern in the app: the header badge,
 * the drawer, and every Add-to-Cart button share it (AGENTS.md §18).
 *
 * Deliberately built on useReducer rather than a state library — the state is a
 * small list with three transitions, and a dependency would not earn its place
 * (CLAUDE.md §18). If server-synced carts arrive later, this provider is the
 * single seam to replace.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, [] as readonly CartItem[])
  const [isOpen, setIsOpen] = useState(false)

  const addItem = useCallback((item: CartItem) => dispatch({ type: 'add', item }), [])
  const removeItem = useCallback(
    (serviceId: string) => dispatch({ type: 'remove', serviceId }),
    [],
  )
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])
  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      total: items.reduce((sum, item) => sum + item.price, 0),
      itemCount: items.length,
      isOpen,
      addItem,
      removeItem,
      clear,
      hasItem: (serviceId: string) => items.some((item) => item.serviceId === serviceId),
      openCart,
      closeCart,
    }
  }, [items, isOpen, addItem, removeItem, clear, openCart, closeCart])

  return <CartContext value={value}>{children}</CartContext>
}
