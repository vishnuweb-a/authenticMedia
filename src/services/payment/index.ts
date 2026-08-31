import { mockPaymentService } from './mock-payment-service'
import type { PaymentService } from './types'

export type {
  CreatePaymentInput,
  PaymentResult,
  PaymentService,
  PaymentStatus,
} from './types'
export {
  createAirpayPayment,
  fetchOrderStatus,
  submitToAirpay,
} from './airpay-adapter'
export type {
  AirpayHandoff,
  CreateAirpayPaymentInput,
  OrderPaymentState,
  OrderStatusResult,
} from './airpay-adapter'

/**
 * The active payment implementation.
 *
 * Bound to the development mock: payments are simulated and no money moves.
 * Switching to Airpay is a change to this binding only — see airpay-adapter.ts
 * for the intended topology.
 */
export const paymentService: PaymentService = mockPaymentService
