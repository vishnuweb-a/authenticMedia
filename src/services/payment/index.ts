import { mockPaymentService } from './mock-payment-service'
import type { PaymentService } from './types'

export type {
  CreatePaymentInput,
  PaymentResult,
  PaymentService,
  PaymentStatus,
} from './types'

/**
 * The active payment implementation. The Airpay integration will replace this
 * binding — via a backend — without changing the cart UI.
 */
export const paymentService: PaymentService = mockPaymentService
