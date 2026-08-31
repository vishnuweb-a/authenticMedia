import { findUnsettledOrders } from '../_lib/db'
import { header, noStore, safeEqual, type ApiRequest, type ApiResponse } from '../_lib/http'
import { logEvent } from '../_lib/log'
import { settleOrder, type SettleOutcome } from '../_lib/settle'

/**
 * GET|POST /api/payments/reconcile   (AIPAY-DOCS §16)
 *
 * The reconciliation sweep. Airpay's Order Confirmation is a PULL interface
 * keyed by orderid — a value we generate and own — so settlement never
 * actually depends on being told.
 *
 * ⚠ In this integration that property is load-bearing rather than merely
 * convenient: Airpay posts its callback to KKChat, so this sweep and the
 * success-page poll are the only two paths that reach settlement. This one
 * covers the shopper who paid and then closed the tab.
 */

/** Give the success-page poll a chance first. */
const MIN_AGE_MS = 5 * 60 * 1000

/**
 * ⚠ Must comfortably exceed the cron interval. Sized at exactly one interval
 * it is a hole: at a daily cadence an order created shortly after one run
 * passes 24 h before the next, drops out of the window, and is never settled
 * at all — the precise failure this endpoint exists to prevent. Seven days
 * gives six spare runs (edge case 40).
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** One Order Confirmation round trip each; bounds runtime under the ceiling. */
const BATCH_SIZE = 50

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)

  // Authorization is REQUIRED, not optional: this endpoint triggers outbound
  // calls against the live MID. Answer 404 (not 401) on mismatch so its
  // existence is not advertised (edge case 41).
  const secret = process.env['CRON_SECRET']?.trim()
  const provided = header(req, 'authorization')?.replace(/^Bearer\s+/i, '').trim() ?? ''

  if (!secret || !provided || !safeEqual(secret, provided)) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  let orders
  try {
    orders = await findUnsettledOrders(MIN_AGE_MS, MAX_AGE_MS, BATCH_SIZE)
  } catch {
    res.status(503).json({ error: 'unavailable' })
    return
  }

  const counts: Partial<Record<SettleOutcome, number>> = {}

  for (const order of orders) {
    try {
      // A SYNTHETIC payload carrying only the reference — every other field
      // absent. settleOrder then skips the integrity check and decides purely
      // from Order Confirmation, which is the only authority anyway. Nothing
      // here asserts a status or an amount.
      const result = await settleOrder({ orderRef: order.reference })
      counts[result.outcome] = (counts[result.outcome] ?? 0) + 1
    } catch {
      counts.pending = (counts.pending ?? 0) + 1
    }
  }

  logEvent('payment.reconcile.swept', {
    scanned: orders.length,
    paid: counts.paid ?? 0,
    failed: counts.failed ?? 0,
    pending: counts.pending ?? 0,
    requires_review: counts.requires_review ?? 0,
    already_settled: counts.already_settled ?? 0,
  })

  res.status(200).json({ scanned: orders.length, outcomes: counts })
}
