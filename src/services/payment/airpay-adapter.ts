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
  /**
   * Whether Airpay will bring this browser back to THIS site (§8.1, §14.3).
   *
   * Stated by the SERVER from the merchant it validated and loaded; a value
   * sent by a client is ignored. Airpay resolves its Response URL per MID from its own
   * dashboard, so for merchant 2 — whose dashboard points at KKChat, as the
   * client requires — the answer is no, and this tab must not be navigated away
   * or the shopper never comes back.
   *
   * ⚠ It carries NO claim about any payment. It selects a navigation style.
   */
  readonly returnsToSite: boolean
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

/**
 * Which Airpay payment option the shopper chose at checkout.
 *
 * An INDEX into two server-held credential sets — never a MID, a credential or
 * any part of a merchant configuration, none of which exists in the browser at
 * all. The server validates it against an exhaustive 1|2 allowlist and does the
 * mapping itself, so this value selects BETWEEN two merchants the server
 * defines and can neither describe nor reach inside either one.
 */
export type AirpayMerchantChoice = 1 | 2

export interface CreateAirpayPaymentInput {
  readonly serviceSlugs: readonly string[]
  /** Required. The server refuses the request rather than guessing one. */
  readonly merchant: AirpayMerchantChoice
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
        // The shopper's choice of payment option, as an index only (§2.4).
        merchant: input.merchant,
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
      // Absent means "the old, proven behaviour": a full-tab hand-off that
      // Airpay returns to this site. An older deployment of the API omits the
      // field entirely, and that must keep working exactly as before.
      returnsToSite: data.returnsToSite !== false,
    })
  } catch {
    return err<AirpayHandoff>('offline', UNAVAILABLE)
  }
}

/**
 * Hands the browser off to Airpay's hosted page.
 *
 * Builds a hidden form and POSTs it, forwarding the fields verbatim. The
 * browser performs no cryptography and holds no credential (§7.6).
 *
 * `target` names the browsing context the form POSTs into. The default is this
 * tab, which is the original, production-proven behaviour and stays the default
 * for merchant 1.
 */
export function submitToAirpay(
  handoff: AirpayHandoff,
  doc: Document = document,
  target?: string,
): void {
  const form = doc.createElement('form')
  form.method = 'POST'
  form.action = handoff.actionUrl
  form.style.display = 'none'
  if (target) form.target = target

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
 * The name of the payment window (§14.3).
 *
 * A fixed name, so a second hand-off REUSES the same window rather than opening
 * another. Two windows would mean two hosted pages open on the same order — the
 * shortest path to a shopper paying twice.
 */
export const PAYMENT_WINDOW_NAME = 'authenticmedia-airpay'

/**
 * Opens the window that will hold the Airpay hosted page (§14.3).
 *
 * ⚠ Must be called SYNCHRONOUSLY inside the click handler, before any `await`.
 * Popup blockers allow a window opened during a user gesture and refuse one
 * opened after the call stack has yielded — so this cannot wait for
 * createAirpayPayment to resolve. It therefore opens `about:blank` first and is
 * pointed at the gateway once the fields arrive.
 *
 * Returns null when the browser refused, which is an expected outcome and not
 * an error: the caller falls back to the full-tab hand-off.
 */
export function openPaymentWindow(win: Window = window): Window | null {
  try {
    return win.open('', PAYMENT_WINDOW_NAME)
  } catch {
    return null
  }
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
