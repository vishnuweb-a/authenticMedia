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
  openPaymentWindow,
  PAYMENT_WINDOW_NAME,
  submitToAirpay,
} from './airpay-adapter'
export type {
  AirpayHandoff,
  AirpayMerchantChoice,
  CreateAirpayPaymentInput,
  OrderPaymentState,
  OrderStatusResult,
} from './airpay-adapter'
export {
  createIsgpayPayment,
  fetchIsgpayAvailability,
  fetchIsgpayOrderStatus,
  ISGPAY_REF_RE,
  ISGPAY_SANDBOX_URL,
  submitToIsgpay,
} from './isgpay-adapter'
export type { CreateIsgpayPaymentInput, IsgpayHandoff } from './isgpay-adapter'

/**
 * The active payment implementation.
 *
 * Bound to the development mock: payments are simulated and no money moves.
 * Switching to Airpay is a change to this binding only — see airpay-adapter.ts
 * for the intended topology.
 */
export const paymentService: PaymentService = mockPaymentService
