import { getGuestToken } from '@/lib/supabase'
import { err, ok } from '@/services/result'
import type { ServiceResult } from '@/services/result'

/**
 * The Airpay frontend seam.
 *
 * This module holds NO credential and performs NO cryptography. It calls our
 * own serverless endpoints, which hold the merchant credentials and do all
 * signing, and it forwards the returned fields to Airpay's hosted page
 * verbatim — without inspecting or reordering them (AIPAY-DOCS §7.6).
 *
 * ⚠ Nothing in this file — and nothing anywhere in the browser — may treat
 * the return from the hosted page as evidence of payment. Airpay's Response
 * and IPN callbacks are received server-side at
 * /callback/cpm/arp_frontiva/collection, and even there a callback only
 * prompts a check. The success page asks the server, which asks Airpay (§14.1).
 */

export interface AirpayHandoff {
  readonly orderRef: string
  readonly accessToken: string
  readonly amount: number
  readonly actionUrl: string
  readonly fields: Readonly<Record<string, string>>
}

export type OrderPaymentState =
  | 'checking'
  | 'paid'
  | 'failed'
  | 'requires-review'
  | 'unresolved'
  | 'not-found'

export interface OrderStatusResult {
  readonly orderRef: string
  readonly state: OrderPaymentState
  readonly amount: number
  readonly settled: boolean
}

const UNAVAILABLE = 'Payments are unavailable right now. Please try again shortly.'

export interface CreateAirpayPaymentInput {
  readonly serviceSlugs: readonly string[]
  readonly contact: {
    readonly firstName?: string
    readonly lastName?: string
    readonly email?: string
    readonly phone?: string
  }
}

/**
 * Creates the order server-side and returns the hosted-page hand-off.
 *
 * No amount is sent. The server re-prices the basket from the catalogue, so
 * there is nowhere for this client to state what it thinks the order costs
 * (§7.1).
 */
export async function createAirpayPayment(
  input: CreateAirpayPaymentInput,
): Promise<ServiceResult<AirpayHandoff>> {
  try {
    const response = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceSlugs: input.serviceSlugs,
        // public.orders requires exactly one owner; this flow is guest
        // checkout. The token identifies a session for "my orders" reads —
        // it is never authorization to settle.
        guestToken: getGuestToken(),
        contact: input.contact,
      }),
    })

    if (!response.ok) {
      return err<AirpayHandoff>('create_failed', UNAVAILABLE)
    }

    const data = (await response.json()) as Partial<AirpayHandoff>

    if (!data.orderRef || !data.actionUrl || !data.fields || !data.accessToken) {
      return err<AirpayHandoff>('create_failed', UNAVAILABLE)
    }

    return ok<AirpayHandoff>({
      orderRef: data.orderRef,
      accessToken: data.accessToken,
      amount: typeof data.amount === 'number' ? data.amount : 0,
      actionUrl: data.actionUrl,
      fields: data.fields,
    })
  } catch {
    return err<AirpayHandoff>('offline', UNAVAILABLE)
  }
}

/**
 * Hands the browser off to Airpay's hosted page.
 *
 * Builds a hidden form and POSTs it into THIS tab, forwarding the fields
 * verbatim. The browser performs no cryptography and holds no credential
 * (§7.6).
 *
 * The full-tab hand-off is the original, production-proven behaviour: Airpay's
 * dashboard Response URL for this MID points back at this site, so Airpay
 * itself brings the shopper home to /order-success (§8.1, §14.3).
 */
export function submitToAirpay(handoff: AirpayHandoff, doc: Document = document): void {
  const form = doc.createElement('form')
  form.method = 'POST'
  form.action = handoff.actionUrl
  form.style.display = 'none'

  for (const [name, value] of Object.entries(handoff.fields)) {
    const input = doc.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  doc.body.appendChild(form)
  form.submit()
}

/**
 * Asks the server what actually happened to an order.
 *
 * The server verifies against Airpay Order Confirmation and settles inline if
 * needed. This function never decides anything itself.
 */
export async function fetchOrderStatus(
  orderRef: string,
  accessToken: string,
): Promise<OrderStatusResult | null> {
  const query = new URLSearchParams({ ref: orderRef, t: accessToken })
  const response = await fetch(`/api/orders/status?${query.toString()}`)

  if (response.status === 404) {
    return { orderRef, state: 'not-found', amount: 0, settled: true }
  }
  if (!response.ok) return null

  const data = (await response.json()) as {
    status?: string
    amount?: number
    settled?: boolean
  }

  const state: OrderPaymentState =
    data.status === 'paid'
      ? 'paid'
      : data.status === 'failed' || data.status === 'cancelled'
        ? 'failed'
        : data.status === 'requires_review'
          ? 'requires-review'
          : 'checking'

  return {
    orderRef,
    state,
    amount: typeof data.amount === 'number' ? data.amount : 0,
    settled: Boolean(data.settled),
  }
}
