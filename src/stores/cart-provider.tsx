import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'

import { cartService } from '@/services'
import type { CartItem } from '@/types'
import { CartContext, type CartContextValue } from './cart-context'

type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'remove'; serviceId: string }
  | { type: 'clear' }
  /** Replace local state with the server's authoritative list. */
  | { type: 'sync'; items: readonly CartItem[] }

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
    case 'sync':
      return action.items
  }
}

/**
 * Cart state is the one genuinely global concern in the app: the header badge,
 * the drawer, and every Add-to-Cart button share it (AGENTS.md §18).
 *
 * Writes are optimistic — the reducer updates immediately so the UI stays
 * instant — and then reconciled against the CartService, which persists to
 * Supabase and returns the authoritative list. If persistence fails the local
 * cart keeps working and an error is surfaced; the cart never becomes unusable
 * because the network did.
 *
 * Prices held here are for display only. The order total is re-resolved from
 * the catalogue server-side at checkout, so a stale local price cannot affect
 * what is charged.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, [] as readonly CartItem[])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Hydrate the persisted cart once on mount.
  useEffect(() => {
    let cancelled = false

    void cartService.getCart().then((result) => {
      if (cancelled) return

      if (result.ok) {
        dispatch({ type: 'sync', items: result.data })
      }
      // A failed hydration is not surfaced: an empty cart is the correct
      // starting state, and an error banner before any user action would be
      // noise. Failures on user-initiated writes below are surfaced.

      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  /** Runs a persistence call and reconciles, keeping the optimistic state on failure. */
  const reconcile = useCallback(
    async (operation: () => ReturnType<typeof cartService.getCart>) => {
      const result = await operation()

      if (result.ok) {
        dispatch({ type: 'sync', items: result.data })
        setError(null)
        return
      }

      setError(result.error.message)
    },
    [],
  )

  const addItem = useCallback(
    (item: CartItem) => {
      dispatch({ type: 'add', item })
      void reconcile(() => cartService.addItem(item.serviceId))
    },
    [reconcile],
  )

  const removeItem = useCallback(
    (serviceId: string) => {
      dispatch({ type: 'remove', serviceId })
      void reconcile(() => cartService.removeItem(serviceId))
    },
    [reconcile],
  )

  const clear = useCallback(() => {
    dispatch({ type: 'clear' })
    void reconcile(() => cartService.clear())
  }, [reconcile])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      total: items.reduce((sum, item) => sum + item.price, 0),
      itemCount: items.length,
      isOpen,
      isLoading,
      error,
      addItem,
      removeItem,
      clear,
      hasItem: (serviceId: string) => items.some((item) => item.serviceId === serviceId),
      openCart,
      closeCart,
    }
  }, [items, isOpen, isLoading, error, addItem, removeItem, clear, openCart, closeCart])

  return <CartContext value={value}>{children}</CartContext>
}
