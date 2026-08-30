import type { CartItem } from '@/types'

/**
 * The checkout lifecycle rendered by the drawer footer.
 *
 * `idle` is the captured state; the rest are the inferred states the mock
 * PaymentService already exercises (SCREEN-MAP.md → Cart → States).
 */
export type CheckoutStatus = 'idle' | 'pending' | 'succeeded' | 'failed'

export interface CartLineItemProps {
  item: CartItem
  onRemove: (serviceId: string) => void
}
