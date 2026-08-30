import { err } from '@/services/result'
import type { CreatePaymentInput, PaymentResult, PaymentService } from './types'

const NOT_INTEGRATED =
  'Card payment is not available yet. Airpay integration is pending.'

/**
 * Airpay adapter — **not integrated**.
 *
 * This is the seam the real integration will fill, kept explicit so nobody has
 * to guess where it goes. It deliberately fails rather than pretending, because
 * a mock that reports success as if it were Airpay would be a lie about money.
 *
 * When it is implemented, the shape is:
 *
 *   Checkout → OrderService (order exists, total resolved server-side)
 *            → PaymentService.createPayment({ orderId })
 *            → this adapter → OUR backend → Airpay
 *            → Airpay webhook → OUR backend → settle_payment()
 *
 * The merchant ID, secret, and callback signing key belong to that backend.
 * None of them may ever appear in this frontend (AGENTS.md §16).
 */
export const airpayAdapter: PaymentService = {
  async createPayment(_input: CreatePaymentInput) {
    return err<PaymentResult>('not_integrated', NOT_INTEGRATED)
  },

  async getPaymentStatus(_orderId: string) {
    return err<PaymentResult>('not_integrated', NOT_INTEGRATED)
  },
}
