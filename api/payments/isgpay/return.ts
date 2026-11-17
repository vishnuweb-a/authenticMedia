import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig } from '../../_lib/isgpay-config.js'
import { esc, readForm, refFromGatewayPost, sendPage } from '../../_lib/isgpay-http.js'
import { settleIsgpayOrder } from '../../_lib/isgpay-settle.js'
import { logEvent } from '../../_lib/log.js'

/**
 * POST /api/payments/isgpay/return — the shopper's browser, back from the
 * hosted page. The envelope supplies only the TxnRefNo; the outcome shown is
 * whatever a fresh Status Query + our own row say. This page never settles on
 * the strength of the redirect.
 */

const HEADLINE: Record<string, string> = {
  paid: 'Payment verified',
  already_settled: 'Order already settled',
  requires_review: 'Payment needs review',
  declined_pending: 'Payment not approved',
  pending: 'Payment not yet verified',
  unknown_order: 'Order not found',
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendPage(res, 405, 'Nothing to show', '<p>This page is reached only from the ISGPay sandbox.</p>')
    return
  }

  let config
  try {
    config = loadIsgpayConfig()
  } catch {
    sendPage(res, 503, 'ISGPay unavailable', '<p>ISGPay is not configured on this deployment.</p>')
    return
  }

  const ref = refFromGatewayPost(config, await readForm(req))
  if (ref.ok === false) {
    logEvent('isgpay.return.unreadable', { reason: ref.reason })
    sendPage(res, 400, 'Response could not be verified', `<p>The gateway response could not be verified (${esc(ref.reason)}). Nothing was settled.</p>`)
    return
  }

  let result
  try {
    result = await settleIsgpayOrder(config, ref.txnRefNo)
  } catch {
    logEvent('isgpay.return.settle_error', { txnRefNo: ref.txnRefNo })
    sendPage(res, 503, 'Verification unavailable', '<p>We could not verify the payment right now. Nothing was settled.</p>')
    return
  }
  logEvent('isgpay.return', { txnRefNo: result.orderRef, outcome: result.outcome })

  const g = result.gateway
  sendPage(
    res,
    200,
    HEADLINE[result.outcome] ?? 'Payment status',
    `<dl><dt>TxnRefNo</dt><dd>${esc(result.orderRef)}</dd><dt>Order status</dt><dd>${esc(result.status ?? 'unknown')}</dd>
<dt>Outcome</dt><dd>${esc(result.outcome)}${result.reason ? ` (${esc(result.reason)})` : ''}</dd>
${g ? `<dt>ResponseCode</dt><dd>${esc(g.responseCode)}</dd><dt>Message</dt><dd>${esc(g.message)}</dd><dt>Gateway amount</dt><dd>${esc(g.amountPaise)} paise</dd>` : ''}</dl>`,
  )
}
