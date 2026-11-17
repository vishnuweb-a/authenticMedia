import type { AirpayMerchantChoice } from '@/services'
import type { CartItem } from '@/types'

/**
 * The ONE gateway a checkout action pays through. ISGPay is its own variant,
 * never "Airpay merchant 3": the Airpay index allowlist stays 1 | 2.
 */
export type CheckoutGateway =
  | { readonly kind: 'airpay'; readonly merchant: AirpayMerchantChoice }
  | { readonly kind: 'isgpay' }

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
