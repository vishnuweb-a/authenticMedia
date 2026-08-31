import { useCallback, useState } from 'react'

import { createAirpayPayment, submitToAirpay } from '@/services'
import { useCart } from '@/stores'
import type { CheckoutStatus } from '../types/cart.types'

export interface UseCheckoutResult {
  status: CheckoutStatus
  /** Human-readable failure message, set only when status is 'failed'. */
  error: string | null
  pay: () => Promise<void>
  reset: () => void
}

/**
 * The cart's checkout seam: create the order server-side, then hand the
 * browser off to Airpay's hosted payment page.
 *
 * The browser sends only service slugs — no price, subtotal or total. The
 * server re-prices the basket from the catalogue, so there is deliberately
 * nowhere for a tampered client to state what it thinks the order costs
 * (AIPAY-DOCS §7.1).
 *
 * ⚠ This hook never reports a payment as succeeded. It ends at the redirect;
 * whether money actually moved is decided by the server against Airpay's Order
 * Confirmation, and reported on the /order-success page. A redirect proves only
 * that a browser was pointed at a URL (§14.1).
 *
 * The cart is deliberately NOT cleared here. The shopper has not paid yet, and
 * clearing it would lose their basket if they abandoned the gateway or the
 * payment failed.
 */
export function useCheckout(): UseCheckoutResult {
  const { items } = useCart()
  const [status, setStatus] = useState<CheckoutStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  const pay = useCallback(async () => {
    setStatus('pending')
    setError(null)

    const created = await createAirpayPayment({
      serviceSlugs: items.map((item) => item.serviceId),
      contact: {},
    })

    if (!created.ok) {
      setError(created.error.message)
      setStatus('failed')
      return
    }

    // Hand off to the hosted page. The fields are forwarded verbatim; the
    // browser performs no cryptography and holds no credential (§7.6).
    // Navigation ends this hook's involvement — status stays 'pending' so the
    // pill keeps its loading state until the page unloads.
    submitToAirpay(created.data)
  }, [items])

  return { status, error, pay, reset }
}
