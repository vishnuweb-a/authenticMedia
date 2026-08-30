import type { ServiceResult } from '@/services/result'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed'

/**
 * A payment is created against an order, never against a cart: the order
 * already holds the server-resolved authoritative total, so no amount crosses
 * the boundary from the browser.
 */
export interface CreatePaymentInput {
  orderId: string
}

export interface PaymentResult {
  paymentId: string
  orderId: string
  status: PaymentStatus
  amount: number
  currency: 'INR'
  /** The adapter that produced this result — 'mock' until Airpay is live. */
  provider: 'mock' | 'airpay'
}

/**
 * The payment boundary — the Airpay entry point behind the cart's "Pay Now".
 *
 * The real flow will run through a backend that holds the merchant credentials
 * and settles via webhook. No provider SDK, key, or callback secret may ever
 * reach this frontend (AGENTS.md §16, CLAUDE.md §9).
 */
export interface PaymentService {
  createPayment(input: CreatePaymentInput): Promise<ServiceResult<PaymentResult>>
  getPaymentStatus(orderId: string): Promise<ServiceResult<PaymentResult>>
}
