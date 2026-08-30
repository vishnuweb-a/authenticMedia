import { err, ok } from '@/services/result'
import type { CreatePaymentInput, PaymentResult, PaymentService } from './types'

function delay(ms = 900): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Simulates the future Airpay-backed workflow so the cart can exercise its
 * pending / success / failure states without any integration.
 */
function createMockPaymentService(): PaymentService {
  const payments = new Map<string, PaymentResult>()

  return {
    async createPayment({ items, amount, currency }: CreatePaymentInput) {
      await delay()

      if (items.length === 0) {
        return err('empty_cart', 'Your cart is empty.')
      }

      if (amount <= 0) {
        return err('invalid_amount', 'This order total is not valid.')
      }

      const payment: PaymentResult = {
        paymentId: `mock_${Date.now().toString(36)}`,
        status: 'succeeded',
        amount,
        currency,
      }

      payments.set(payment.paymentId, payment)
      return ok(payment)
    },

    async getPaymentStatus(paymentId: string) {
      await delay(300)

      const payment = payments.get(paymentId)

      if (!payment) {
        return err('not_found', 'We could not find that payment.')
      }

      return ok(payment)
    },
  }
}

export const mockPaymentService = createMockPaymentService()
