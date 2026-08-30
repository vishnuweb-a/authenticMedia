import { useCallback, useState } from 'react'

import { paymentService } from '@/services'
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
 * The cart's single payment seam.
 *
 * The drawer never imports a provider: it calls PaymentService, which is bound
 * to a mock during this phase. When Airpay arrives it will be reached through a
 * backend and swapped in at that binding, leaving this hook and the UI intact
 * (AGENTS.md §16, CLAUDE.md §9). No merchant key, signature, or callback secret
 * exists anywhere in the frontend.
 */
export function useCheckout(): UseCheckoutResult {
  const { items, total, clear } = useCart()
  const [status, setStatus] = useState<CheckoutStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  const pay = useCallback(async () => {
    setStatus('pending')
    setError(null)

    const result = await paymentService.createPayment({
      items,
      amount: total,
      currency: 'INR',
    })

    if (!result.ok) {
      setError(result.error.message)
      setStatus('failed')
      return
    }

    setStatus('succeeded')
    clear()
  }, [items, total, clear])

  return { status, error, pay, reset }
}
