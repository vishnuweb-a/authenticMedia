import { isBrowserLeg, parseCallback } from './callback-payload.js'
import { optional, type MerchantId } from './config.js'
import { header, noStore, type ApiRequest, type ApiResponse } from './http.js'
import { logEvent } from './log.js'
import { forwardCallback } from './relay.js'
import { settleOrder, type SettleOutcome } from './settle.js'
import { findOrderByRef } from './db.js'

/**
 * The Airpay callback pipeline (AIPAY-DOCS §8, §13.7).
 *
 *     parse -> settle -> relay
 *
 * The order is load-bearing: settlement COMPLETES before the relay is
 * attempted, so a KKChat outage can never delay, corrupt or roll back a
 * verified payment.
 *
 * ⚠ A callback is a PROMPT TO GO AND CHECK, never proof of payment (§0). This
 * module extracts an order reference and then hands it to settleOrder, which
 * asks Airpay's Order Confirmation server-to-server. Nothing in the callback
 * body — not its transaction status, not its ap_SecureHash — can mark an order
 * paid. There is no callback-specific settlement, verification or database
 * write anywhere in this file.
 */

/**
 * The merchants whose callbacks this receiver accepts (§2.4).
 *
 * Both MIDs register the SAME URL in their own Airpay dashboards, so both
 * arrive here. This is the accepted SET, not a merchant assignment: each
 * delivery is still matched to exactly one of these by its stated MID (checked
 * against the server's own environment) or, absent that, by which credential
 * set actually opens its envelope. A MID outside this set is rejected.
 */
const ACCEPTED_MERCHANTS: readonly MerchantId[] = [1, 2]

/**
 * §14.2 — PUBLIC_SITE_ORIGIN is authoritative. x-forwarded-host is used only
 * to build a redirect back to this same deployment, NEVER as a trust signal.
 *
 * The URL is built by concatenation, not `new URL`, which throws on the bare
 * relative path an unresolvable origin leaves behind.
 */
function siteOrigin(req: ApiRequest): string {
  const configured = optional('PUBLIC_SITE_ORIGIN')
  if (configured) return configured.replace(/\/+$/, '')

  const host = header(req, 'x-forwarded-host') ?? header(req, 'host')
  if (host) {
    const proto = header(req, 'x-forwarded-proto') ?? 'https'
    return `${proto}://${host}`
  }

  return ''
}

/**
 * The browser return target (§14.1).
 *
 * It carries the order reference and the order's opaque read key — and NO
 * claim about whether the payment succeeded. The success page then asks the
 * server what actually happened.
 *
 * The read key is looked up SERVER-SIDE from the order row, never taken from
 * the request, so a crafted return URL cannot hand someone else's token back
 * (edge case 36).
 */
async function successUrl(req: ApiRequest, orderRef: string | null): Promise<string> {
  const origin = siteOrigin(req)

  if (!orderRef) return `${origin}/order-success?status=unknown`

  let token: string | null = null
  try {
    const order = await findOrderByRef(orderRef)
    token = order?.accessToken ?? null
  } catch {
    token = null
  }

  // Unknown reference → ?status=unknown. The page asks the server anyway.
  if (!token) {
    return `${origin}/order-success?ref=${encodeURIComponent(orderRef)}&status=unknown`
  }

  return `${origin}/order-success?ref=${encodeURIComponent(orderRef)}&t=${encodeURIComponent(token)}`
}

/**
 * Handles one delivery of the Airpay callback, on either leg.
 *
 * Both legs settle identically and unconditionally; only the REPLY SHAPE
 * differs (§8.2):
 *
 *   - a browser gets 303 to the order-success page;
 *   - a machine gets 200 {"received": true, outcome}.
 *
 * ⚠ Machines always get 2xx (§8.3). Airpay retries a non-2xx, so an endpoint
 * working correctly but reporting "I could not settle this yet" would trigger a
 * retry storm. The outcome is carried in the body and the logs, never in the
 * status code. Even an unparseable body gets 200 — it will not become parseable
 * on retry.
 */
export async function handleAirpayCallback(
  req: ApiRequest,
  res: ApiResponse,
  options: { readonly relay: boolean; readonly merchant?: MerchantId } = { relay: true },
): Promise<void> {
  noStore(res)

  const browser = isBrowserLeg(req)

  // Which merchant(s) this receiver accepts — stated by the ROUTE (§2.4), never
  // taken as an instruction from the payload. BOTH Airpay merchants now
  // register this same URL in their own dashboards, so one receiver serves
  // both: MID 368250 as it always has, and MID 362380 which previously
  // delivered straight to KKChat.
  //
  // A caller may still pin a single merchant via `options.merchant`. The
  // parser matches the stated MID against the server's OWN environment to pick
  // which accepted credential set applies, and rejects a MID belonging to
  // neither — so widening the set never weakens the check, it only makes the
  // second legitimate merchant recognisable instead of rejected.
  const accepted: readonly MerchantId[] =
    options.merchant !== undefined ? [options.merchant] : ACCEPTED_MERCHANTS

  // 1. PARSE. The parser checks the stated merchant against the accepted MIDs
  //    before it opens anything.
  const parsed = await parseCallback(req, accepted)

  if (!parsed.ok || !parsed.fields) {
    // Diagnostics are NAMES and CATEGORIES only, never values (§9.8). Each
    // failure below needs a different fix, and on a live gateway each wrong
    // guess costs another real payment to observe.
    logEvent('payment.callback.unparseable', {
      envelope: parsed.envelope,
      merchantCheck: parsed.merchantCheck,
      parserFailure: parsed.parserFailure,
      contentType: parsed.contentType,
      bodyType: parsed.bodyType,
      bodyLength: parsed.bodyLength,
      decodedFieldCount: parsed.decodedFieldCount,
      decodedKeys: parsed.decodedKeys.join(','),
      queryKeys: parsed.queryKeys.join(','),
    })

    if (browser) {
      res.status(303).setHeader('Location', await successUrl(req, null)).end()
      return
    }

    res.status(200).json({ received: true, outcome: 'unparseable' })
    return
  }

  const { fields } = parsed

  logEvent('payment.callback.received', {
    orderRef: fields.orderRef,
    envelope: parsed.envelope,
    merchantCheck: parsed.merchantCheck,
    hasHash: Boolean(fields.secureHash),
  })

  // 2. SETTLE — the existing, single settleOrder. It runs the integrity check,
  //    requires a live MID, and decides SOLELY on Airpay Order Confirmation.
  //    The transaction status in the callback body is passed only as an
  //    ap_SecureHash input; it can never itself mark an order paid.
  let outcome: SettleOutcome | 'error' = 'error'
  try {
    const result = await settleOrder({
      orderRef: fields.orderRef,
      secureHash: fields.secureHash,
      apTransactionId: fields.apTransactionId,
      amount: fields.amount,
      transactionStatus: fields.transactionStatus,
      message: fields.message,
      customerVpa: fields.customerVpa,
    })
    outcome = result.outcome
  } catch {
    // An inconclusive settlement is not something to report to Airpay as a
    // failure: it would only provoke a retry of a callback that was never the
    // problem (§11.3). The sweep will try again.
    logEvent('payment.callback.settle_error', { orderRef: fields.orderRef })
  }

  // 3. RELAY — strictly after settlement has completed, and never able to
  //    affect it. Awaited because a serverless instance may be frozen the
  //    moment the response is written (§13.4).
  //
  //    ⚠ The SETTLEMENT OUTCOME IS NOT CONSULTED. A callback for an order this
  //    application has never heard of settles to `unknown_order` and is
  //    forwarded anyway: the same Airpay MID is used by another system, whose
  //    callbacks arrive here and belong to KKChat regardless of what our
  //    database contains. Forwarding eligibility is decided ENTIRELY by the
  //    parse above — a delivery that failed the merchant check or whose
  //    envelope would not open returned long before this line, and one that is
  //    settled, unsettled, duplicate or unknown reaches it identically.
  //
  //    ⚠ BOTH merchants are relayed, to the SAME confirmed destination
  //    (§13.2). MID 362380 now registers THIS URL in its own Airpay dashboard
  //    rather than posting to KKChat directly, so this application is the sole
  //    receiver for both merchants and a forward here is the ONLY delivery
  //    KKChat gets — not a duplicate. Suppressing it, as this pipeline did
  //    while merchant 2 delivered directly, would now silently drop every
  //    merchant-2 callback.
  //
  //    ⚠ The guard is deliberately NOT on the order reference. Forwarding
  //    eligibility is decided ENTIRELY by the parse above, which accepted this
  //    delivery for one of the two configured merchants after checking the
  //    stated MID against the server's own environment and, where an envelope
  //    was present, actually opening it. An external payment made on either MID
  //    by another portal carries a reference in that portal's own format — not
  //    AM-/AM2- — and belongs to KKChat exactly as much as one of ours does.
  //    Deciding relay on the reference PREFIX would drop precisely those,
  //    which is the whole point of this receiver.
  //
  //    The settlement outcome is likewise not consulted: settled, unsettled,
  //    duplicate, legacy and unknown_order all reach this line identically.
  if (options.relay && Object.keys(parsed.relayFields).length > 0) {
    await forwardCallback(parsed.relayFields)
  } else if (options.relay) {
    logEvent('payment.callback.forward.skipped', {
      orderRef: fields.orderRef,
      reason: 'no_relay_fields',
    })
  }

  // 4. REPLY.
  if (browser) {
    // 303 so a POSTed return becomes a GET (§14.1). The redirect carries no
    // claim about the payment.
    res.status(303).setHeader('Location', await successUrl(req, fields.orderRef)).end()
    return
  }

  res.status(200).json({ received: true, outcome })
}
