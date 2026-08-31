import { isBrowserLeg, parseCallback } from './callback-payload.js'
import { optional, type MerchantId } from './config.js'
import { header, noStore, type ApiRequest, type ApiResponse } from './http.js'
import { logEvent } from './log.js'
import { forwardCallback } from './relay.js'
import { settleOrder, type SettleOutcome } from './settle.js'
import { findOrderByRef } from './db.js'
import { merchantForOrderRef } from './order-ref.js'

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

  // Which merchant's receiver this is — stated by the ROUTE (§2.4). Merchant 2
  // does not have a receiver here at all: Airpay delivers its callbacks
  // straight to KKChat, so nothing should ever reach this pipeline claiming to
  // be merchant 2, and the merchant check below rejects it if it does.
  const merchant: MerchantId = options.merchant ?? 1

  // 1. PARSE.
  const parsed = await parseCallback(req, merchant)

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
  //    ⚠ Merchant 2 is NEVER relayed from here (§2.4, §13.8). Airpay posts its
  //    callbacks for that merchant directly to KKChat at
  //    .../cpm/arp/collection, so a relay of ours would be a SECOND delivery of
  //    a callback KKChat already has — not a missing one. The guard is on the
  //    ORDER REFERENCE rather than on the route, so it holds even if a
  //    merchant-2 callback somehow reaches a merchant-1 receiver.
  const relayMerchant = merchantForOrderRef(fields.orderRef)

  if (options.relay && relayMerchant === 1 && Object.keys(parsed.relayFields).length > 0) {
    await forwardCallback(parsed.relayFields)
  } else if (options.relay && relayMerchant !== 1) {
    logEvent('payment.callback.forward.skipped', {
      orderRef: fields.orderRef,
      merchant: relayMerchant,
      reason: 'direct_to_kkchat',
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
