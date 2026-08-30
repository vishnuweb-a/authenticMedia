import { getGuestToken, supabase } from '@/lib/supabase'
import { err, ok } from '@/services/result'
import { orderService } from '@/services/orders'
import type { CreatePaymentInput, PaymentResult, PaymentService, PaymentStatus } from './types'

function delay(ms = 900): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Development payment adapter.
 *
 * IMPORTANT: this is NOT a real payment. No money moves, no gateway is
 * contacted, and no card details are collected. It exists so the checkout can
 * exercise its pending / success / failure states before Airpay is integrated.
 *
 * It settles the order through the `settle_payment` RPC, so the order and
 * payment rows follow exactly the same lifecycle a real gateway will drive —
 * when the Airpay adapter replaces this binding, the only change is who calls
 * settle_payment (a trusted backend webhook, not the browser).
 */
function createMockPaymentService(): PaymentService {
  return {
    async createPayment({ orderId }: CreatePaymentInput) {
      if (!supabase) {
        return err<PaymentResult>('offline', 'Payments are unavailable right now.')
      }

      // Stand-in for the redirect/handshake latency of a real gateway.
      await delay()

      const { data, error } = await supabase.rpc('settle_payment', {
        p_order_id: orderId,
        p_succeeded: true,
        p_provider_payment_id: `mock_${Date.now().toString(36)}`,
        p_guest_token: getGuestToken(),
      })

      if (error || typeof data !== 'string') {
        return err<PaymentResult>('payment_failed', 'We could not complete that payment.')
      }

      return this.getPaymentStatus(orderId)
    },

    async getPaymentStatus(orderId: string) {
      const result = await orderService.getOrder(orderId)

      if (!result.ok) return err<PaymentResult>(result.error.code, result.error.message)
      if (!result.data) return err<PaymentResult>('not_found', 'We could not find that payment.')

      const order = result.data
      const status: PaymentStatus =
        order.paymentStatus === 'succeeded'
          ? 'succeeded'
          : order.paymentStatus === 'failed'
            ? 'failed'
            : 'pending'

      return ok<PaymentResult>({
        paymentId: order.reference,
        orderId: order.id,
        status,
        amount: order.total,
        currency: 'INR',
        provider: 'mock',
      })
    },
  }
}

export const mockPaymentService = createMockPaymentService()
