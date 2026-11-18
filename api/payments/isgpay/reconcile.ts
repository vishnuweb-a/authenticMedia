import { findUnsettledIsgpayOrders } from '../../_lib/db.js'
import { header, noStore, safeEqual, type ApiRequest, type ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig } from '../../_lib/isgpay-config.js'
import { settleIsgpayOrder, type IsgpaySettleOutcome } from '../../_lib/isgpay-settle.js'
import { logEvent } from '../../_lib/log.js'

/**
 * GET|POST /api/payments/isgpay/reconcile — the ISGPay sweep. NOT scheduled
 * (absent from vercel.json) and OFF unless ISGPAY_RECONCILE_ENABLED=true.
 *
 * It only asks settleIsgpayOrder to re-verify: every order goes through the
 * same fresh, SecureHash-verified Sale Status Query with the merchant, TxnRefNo,
 * amount and currency checks, and the same one idempotent conditional update.
 * Nothing here can mark an order paid. Rows are selected for the configured
 * environment only, so UAT rows are never queried with live keys or the reverse,
 * and Airpay rows are never selected. Unverified or ambiguous → stays pending.
 *
 * Production stays unreachable until ISGPay confirms the production Status API:
 * loadIsgpayConfig refuses ISGPAY_ENV=production while that endpoint is null.
 */

const MIN_AGE_MS = 5 * 60 * 1000
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 25

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)

  const secret = process.env['CRON_SECRET']?.trim()
  const provided = header(req, 'authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''
  if (!secret || !provided || !safeEqual(secret, provided)) {
    res.status(404).json({ error: 'not_found' })
    return
  }
  if (process.env['ISGPAY_RECONCILE_ENABLED'] !== 'true') {
    res.status(200).json({ enabled: false })
    return
  }

  let config
  let orders
  try {
    config = loadIsgpayConfig()
    orders = await findUnsettledIsgpayOrders(config.env, MIN_AGE_MS, MAX_AGE_MS, BATCH_SIZE)
  } catch {
    res.status(503).json({ error: 'unavailable' })
    return
  }

  const counts: Partial<Record<IsgpaySettleOutcome, number>> = {}
  for (const order of orders) {
    try {
      const result = await settleIsgpayOrder(config, order.reference)
      counts[result.outcome] = (counts[result.outcome] ?? 0) + 1
    } catch {
      counts.pending = (counts.pending ?? 0) + 1
    }
  }

  logEvent('isgpay.reconcile.swept', { env: config.env, scanned: orders.length, ...counts })
  res.status(200).json({ enabled: true, env: config.env, scanned: orders.length, outcomes: counts })
}
