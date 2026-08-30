import { useCallback } from 'react'

import { useCart } from '@/stores'
import type { Service } from '@/types'

export interface UseAddToCartResult {
  /** True once this service is in the cart — services are single-purchase. */
  isAdded: boolean
  add: () => void
}

/**
 * Bridges a service card to the shared cart.
 *
 * Both card variants go through this one hook so there is a single place where
 * a Service becomes a CartItem. It holds no state of its own: the cart store is
 * the only source of truth, so the header badge and the drawer stay in sync
 * (CLAUDE.md §19 — no second cart implementation).
 */
export function useAddToCart(service: Service): UseAddToCartResult {
  const { addItem, hasItem } = useCart()

  const add = useCallback(() => {
    addItem({
      serviceId: service.id,
      title: service.title,
      price: service.price,
      icon: service.icon,
    })
  }, [addItem, service.id, service.title, service.price, service.icon])

  return { isAdded: hasItem(service.id), add }
}
