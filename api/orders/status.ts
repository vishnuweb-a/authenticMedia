import { findOrderByRef } from '../_lib/db.js'
import { noStore, safeEqual, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { isSettledOutcome, settleOrder } from '../_lib/settle.js'

/**
 * GET /api/orders/status?ref=<orderRef>&t=<access_token>   (AIPAY-DOCS §15)
 *
 * The authoritative status endpoint, and one of three triggers that reach
 * settlement.
 *
 * Self-healing: if the order is unsettled, settleOrder runs inline against
 * Order Confirmation. The shopper sitting on the success page drives
 * verification themselves when the callback never arrived or was delayed. Same
 * trusted path, different trigger.
 */

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const orderRef = single(req.query?.['ref']).trim()
  const token = single(req.query?.['t']).trim()

  // ONE indistinguishable 404 for "no such order" and "wrong token", so the
  // endpoint cannot be used to discover which references exist (edge case 38).
  const notFound = (): void => {
    res.status(404).json({ error: 'not_found' })
  }

  if (!orderRef || !token) {
    notFound()
    return
  }

  let order
  try {
    order = await findOrderByRef(orderRef)
  } catch {
    res.status(503).json({ error: 'unavailable' })
    return
  }

  if (!order) {
    notFound()
    return
  }

  // Auth by the opaque per-order UUID, compared in constant time. The order
  // reference alone is not enough: references appear in the Airpay dashboard
  // and in URLs, and the row holds contact details.
  //
  // The key is looked up SERVER-SIDE from the order row, never taken from the
  // request, so a crafted return URL cannot hand someone else's token back
  // (edge case 36).
  if (!safeEqual(order.accessToken, token)) {
    notFound()
    return
  }

  let status = order.status

  // Self-healing: an unsettled order is verified inline, right now.
  if (!isSettledOutcome(status) && order.paymentMethod === 'airpay') {
    try {
      const result = await settleOrder({ orderRef })
      if (result.paymentStatus) status = result.paymentStatus
    } catch {
      // An inconclusive settlement is not an error to report: the shopper is
      // simply still pending, and the sweep will try again (§11.3).
    }
  }

  // Deliberately thin: no contact details, no gateway detail, no internal ids.
  res.status(200).json({
    orderRef: order.reference,
    status,
    amount: order.totalInr,
    currency: 'INR',
    createdAt: order.createdAt,
    // Includes requires_review: the shopper should stop seeing a spinner even
    // though the order is not finished — it waits on a human, and no amount of
    // polling will change it (§15).
    settled: isSettledOutcome(status),
  })
}
