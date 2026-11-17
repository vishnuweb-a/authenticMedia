import { findOrderByRef } from '../../_lib/db.js'
import { noStore, safeEqual, type ApiRequest, type ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig } from '../../_lib/isgpay-config.js'
import { settleIsgpayOrder, type IsgpaySettleResult } from '../../_lib/isgpay-settle.js'

/**
 * GET /api/payments/isgpay/status?ref=<TxnRefNo>&t=<access_token>
 *
 * Authoritative check: an unsettled ISGPay order is re-verified inline with a
 * Sale Status Query (same settleIsgpayOrder as return/callback). One
 * indistinguishable 404 for unknown order, wrong token or non-ISGPay order.
 */

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const ref = single(req.query?.['ref'])
  const token = single(req.query?.['t'])
  if (!ref || !token) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  let order
  try {
    order = await findOrderByRef(ref)
  } catch {
    res.status(503).json({ error: 'unavailable' })
    return
  }
  if (!order || order.paymentMethod !== 'isgpay' || !safeEqual(order.accessToken, token)) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  let result: IsgpaySettleResult | null = null
  try {
    result = await settleIsgpayOrder(loadIsgpayConfig(), ref)
  } catch {
    // Config or DB failure: report the stored status, unverified.
  }

  const status = result?.status ?? order.status
  res.status(200).json({
    orderRef: order.reference,
    status,
    amountInr: order.totalInr,
    currency: 'INR',
    createdAt: order.createdAt,
    verification: result ? { outcome: result.outcome, reason: result.reason, gateway: result.gateway } : null,
    settled: ['paid', 'failed', 'cancelled', 'delivered', 'requires_review'].includes(status),
    // Every ISGPay order is UAT (loadIsgpayConfig accepts only ISGPAY_ENV=uat).
    testMode: true,
  })
}
