import { findOrderByRef } from '../../_lib/db.js'
import { noStore, type ApiRequest, type ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig } from '../../_lib/isgpay-config.js'
import { readForm, refFromGatewayPost } from '../../_lib/isgpay-http.js'
import { settleIsgpayOrder } from '../../_lib/isgpay-settle.js'
import { logEvent } from '../../_lib/log.js'

/**
 * POST /api/payments/isgpay/return — the shopper's browser, back from the
 * hosted page.
 *
 * The verified envelope supplies only the TxnRefNo. A Status Query settles (or
 * does not), then the browser gets 303 to the site's own /order-success page,
 * which asks /api/payments/isgpay/status for the authoritative answer. This
 * handler never settles on the strength of the redirect.
 *
 * The order's read key is looked up SERVER-SIDE from the row — never taken
 * from the request — and only for an ISGPay order named by an envelope that
 * decrypted and passed SecureHash. The Location is relative: same origin only.
 */

function redirect(res: ApiResponse, location: string): void {
  noStore(res)
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Location', location)
  res.status(303).end()
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    redirect(res, '/order-success')
    return
  }

  let config
  try {
    config = loadIsgpayConfig()
  } catch {
    logEvent('isgpay.return.unavailable')
    redirect(res, '/order-success?status=unverified')
    return
  }

  const ref = refFromGatewayPost(config, await readForm(req))
  if (ref.ok === false) {
    logEvent('isgpay.return.unreadable', { reason: ref.reason })
    redirect(res, '/order-success?status=unverified')
    return
  }
  const txnRefNo = ref.txnRefNo
  const refParam = encodeURIComponent(txnRefNo)

  // Best-effort prompt; the success page re-runs the same verification.
  try {
    const result = await settleIsgpayOrder(config, txnRefNo)
    logEvent('isgpay.return', { txnRefNo, outcome: result.outcome })
  } catch {
    logEvent('isgpay.return.settle_error', { txnRefNo })
  }

  let token: string | null = null
  try {
    const order = await findOrderByRef(txnRefNo)
    token = order?.paymentMethod === 'isgpay' ? order.accessToken : null
  } catch {
    token = null
  }

  redirect(
    res,
    token
      ? `/order-success?ref=${refParam}&t=${encodeURIComponent(token)}`
      : `/order-success?ref=${refParam}&status=unknown`,
  )
}
