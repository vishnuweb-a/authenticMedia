import type { CartItem } from '@/types'
import type { ServiceResult } from '@/services/result'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed'

export interface CreatePaymentInput {
  items: readonly CartItem[]
  /** Total in whole rupees; recomputed server-side once a backend exists. */
  amount: number
  currency: 'INR'
}

export interface PaymentResult {
  paymentId: string
  status: PaymentStatus
  amount: number
  currency: 'INR'
}

/**
 * The payment boundary — the Airpay entry point behind the cart's "Pay Now".
 *
 * The real flow will run through a backend that holds the merchant credentials.
 * No provider SDK, key, or callback secret may ever reach this frontend
 * (AGENTS.md §16, CLAUDE.md §9).
 */
export interface PaymentService {
  createPayment(input: CreatePaymentInput): Promise<ServiceResult<PaymentResult>>
  getPaymentStatus(paymentId: string): Promise<ServiceResult<PaymentResult>>
}
