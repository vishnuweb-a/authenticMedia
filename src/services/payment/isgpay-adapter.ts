import { getGuestToken } from '@/lib/supabase'
import { err, ok } from '@/services/result'
import type { ServiceResult } from '@/services/result'
import { submitToAirpay, type OrderPaymentState, type OrderStatusResult } from './airpay-adapter'

/**
 * The ISGPay (UAT sandbox) frontend seam. Holds no credential and performs no
 * cryptography: /api/payments/isgpay/create prices the basket, creates the
 * order and returns already-encrypted fields, which are posted verbatim.
 */

/** The only page this browser will ever post ISGPay fields to. */
export const ISGPAY_SANDBOX_URL = 'https://sandbox.isgpay.com/ISGPay-Genius/request.action'

/** ISGPay order references (server-generated): ISG + 24 upper-case chars. */
export const ISGPAY_REF_RE = /^ISG[0-9A-Z]{8}[0-9A-F]{16}$/

export interface IsgpayHandoff {
  readonly orderRef: string
  readonly accessToken: string
  readonly amount: number
  readonly actionUrl: typeof ISGPAY_SANDBOX_URL
  readonly fields: Readonly<Record<string, string>>
}

export interface CreateIsgpayPaymentInput {
  readonly serviceSlugs: readonly string[]
  readonly contact: {
    readonly firstName?: string
    readonly lastName?: string
    readonly email?: string
    readonly phone?: string
  }
}

const UNAVAILABLE = 'The ISGPay sandbox is unavailable right now. Please try again shortly.'

/** Whether the server offers ISGPay to THIS browser. Any failure means no. */
export async function fetchIsgpayAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/payments/isgpay/create', { headers: { Accept: 'application/json' } })
    if (!response.ok) return false
    const data = (await response.json()) as { available?: unknown }
    return data.available === true
  } catch {
    return false
  }
}

/** Creates the UAT order server-side. No amount is sent. */
export async function createIsgpayPayment(
  input: CreateIsgpayPaymentInput,
): Promise<ServiceResult<IsgpayHandoff>> {
  try {
    const response = await fetch('/api/payments/isgpay/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceSlugs: input.serviceSlugs,
        guestToken: getGuestToken(),
        contact: input.contact,
      }),
    })
    if (!response.ok) return err<IsgpayHandoff>('create_failed', UNAVAILABLE)

    const data = (await response.json()) as Partial<Record<keyof IsgpayHandoff, unknown>>
    const fields = data.fields
    if (
      typeof data.orderRef !== 'string' ||
      !ISGPAY_REF_RE.test(data.orderRef) ||
      typeof data.accessToken !== 'string' ||
      typeof data.amount !== 'number' ||
      // Never post to a host the server did not pin, even if a response says so.
      data.actionUrl !== ISGPAY_SANDBOX_URL ||
      fields === null ||
      typeof fields !== 'object' ||
      !Object.values(fields).every((v) => typeof v === 'string')
    ) {
      return err<IsgpayHandoff>('create_failed', UNAVAILABLE)
    }

    return ok<IsgpayHandoff>({
      orderRef: data.orderRef,
      accessToken: data.accessToken,
      amount: data.amount,
      actionUrl: ISGPAY_SANDBOX_URL,
      fields: fields as Record<string, string>,
    })
  } catch {
    return err<IsgpayHandoff>('offline', UNAVAILABLE)
  }
}

/**
 * Full-tab POST to the ISGPay hosted page. ISGPay returns this browser to our
 * own ReturnURL, which lands on /order-success, so no separate window is used.
 */
export function submitToIsgpay(handoff: IsgpayHandoff, doc: Document = document): void {
  submitToAirpay(handoff, doc)
}

/**
 * Asks /api/payments/isgpay/status, which re-verifies with a Sale Status Query
 * and settles inline. This function decides nothing itself.
 */
export async function fetchIsgpayOrderStatus(
  orderRef: string,
  accessToken: string,
): Promise<OrderStatusResult | null> {
  const query = new URLSearchParams({ ref: orderRef, t: accessToken })
  const response = await fetch(`/api/payments/isgpay/status?${query.toString()}`)
  if (response.status === 404) return { orderRef, state: 'not-found', amount: 0, settled: true, testMode: true }
  if (!response.ok) return null

  const data = (await response.json()) as {
    status?: string
    amountInr?: number
    settled?: boolean
    verification?: { outcome?: string } | null
  }
  const declined = data.verification?.outcome === 'declined_pending'
  const state: OrderPaymentState =
    data.status === 'paid'
      ? 'paid'
      : data.status === 'failed' || data.status === 'cancelled'
        ? 'failed'
        : data.status === 'requires_review'
          ? 'requires-review'
          : declined
            ? 'declined'
            : 'checking'

  return {
    orderRef,
    state,
    amount: typeof data.amountInr === 'number' ? data.amountInr : 0,
    // A verified decline stops the spinner; the row itself stays pending.
    settled: Boolean(data.settled) || declined,
    testMode: true,
  }
}
