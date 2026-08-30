import { useCallback, useState } from 'react'

import { orderService, paymentService } from '@/services'
import type { Order } from '@/services'
import { useCart } from '@/stores'
import type { CheckoutStatus } from '../types/cart.types'

export interface UseCheckoutResult {
  status: CheckoutStatus
  /** Human-readable failure message, set only when status is 'failed'. */
  error: string | null
  /** The created order, available once status is 'succeeded'. */
  order: Order | null
  pay: () => Promise<void>
  reset: () => void
}

/**
 * The cart's checkout seam: create an order, then pay it.
 *
 * The two steps are deliberately separate. The order is created first so the
 * database can resolve every price from the catalogue and snapshot it onto the
 * order lines — the browser sends only service slugs, so a tampered client
 * cannot influence the amount (CLAUDE.md §11). Payment then settles that
 * order's server-side total.
 *
 * The drawer never imports a provider: it calls PaymentService, bound during
 * this phase to a development mock that moves no money. When Airpay arrives it
 * will be reached through a backend and swapped in at that binding, leaving
 * this hook and the UI intact (AGENTS.md §16, CLAUDE.md §9). No merchant key,
 * signature, or callback secret exists anywhere in the frontend.
 */
export function useCheckout(): UseCheckoutResult {
  const { items, clear } = useCart()
  const [status, setStatus] = useState<CheckoutStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<Order | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setOrder(null)
  }, [])

  const pay = useCallback(async () => {
    setStatus('pending')
    setError(null)

    const created = await orderService.createOrder({
      serviceSlugs: items.map((item) => item.serviceId),
    })

    if (!created.ok) {
      setError(created.error.message)
      setStatus('failed')
      return
    }

    const payment = await paymentService.createPayment({ orderId: created.data.id })

    if (!payment.ok) {
      setError(payment.error.message)
      setStatus('failed')
      return
    }

    if (payment.data.status !== 'succeeded') {
      setError('That payment did not go through. Please try again.')
      setStatus('failed')
      return
    }

    // Read the order back so the confirmation shows settled status, not the
    // pending snapshot taken before payment.
    const settled = await orderService.getOrder(created.data.id)
    setOrder(settled.ok && settled.data ? settled.data : created.data)

    setStatus('succeeded')
    clear()
  }, [items, clear])

  return { status, error, order, pay, reset }
}
