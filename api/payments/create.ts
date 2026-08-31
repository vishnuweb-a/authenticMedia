import { buildSignedEnvelope } from '../_lib/airpay-crypto.js'
import { getAccessToken } from '../_lib/airpay.js'
import { HOSTED_PAYMENT_URL, loadAirpayConfig } from '../_lib/config.js'
import { getServiceClient } from '../_lib/db.js'
import { noStore, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { logEvent } from '../_lib/log.js'
import { generateOrderRef } from '../_lib/order-ref.js'

/**
 * POST /api/payments/create  (AIPAY-DOCS §7)
 *
 * Creates an order at the server-computed price and hands the browser the
 * opaque, already-signed fields for the Airpay hosted page.
 *
 * ⚠ The request carries NO price, subtotal, shipping fee or total. There is
 * deliberately nowhere for the client to state what it thinks the order costs,
 * so there is nothing to accidentally trust later (§7.1, edge case 42).
 */

interface CreateBody {
  serviceSlugs?: unknown
  /**
   * The shopper's guest session id. public.orders requires exactly one owner
   * (user_id or guest_token), and this flow is guest checkout.
   *
   * It identifies a session for "my orders" reads only. It is NOT authorization
   * to settle: settlement is service-role-only and gated on Airpay Order
   * Confirmation, so a forged token cannot cause or claim a payment.
   */
  guestToken?: unknown
  contact?: {
    firstName?: unknown
    lastName?: unknown
    email?: unknown
    phone?: unknown
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseBody(raw: unknown): CreateBody | null {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as CreateBody
    } catch {
      return null
    }
  }
  if (raw !== null && typeof raw === 'object') return raw as CreateBody
  return null
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const body = parseBody(req.body)
  const slugs = Array.isArray(body?.serviceSlugs)
    ? body.serviceSlugs.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : []

  const guestToken = asString(body?.guestToken)

  if (slugs.length === 0 || !UUID_RE.test(guestToken)) {
    // Validation detail stays server-side (§7.2).
    res.status(400).json({ error: 'invalid_request' })
    return
  }

  let config
  try {
    config = loadAirpayConfig()
  } catch {
    // Names only — never the value, and never which credential (§9.8).
    logEvent('payment.create.misconfigured')
    res.status(503).json({ error: 'payments_unavailable' })
    return
  }

  const orderRef = generateOrderRef()
  const contact = body?.contact ?? {}

  try {
    const supabase = getServiceClient()

    // 2. Re-price the basket from the database. THIS IS THE SECURITY
    //    BOUNDARY: the amount is resolved from the catalogue, never sent by
    //    the browser.
    // 3. INSERT the order as pending with the server's amount — BEFORE the
    //    gateway is contacted, so an outage leaves a recorded order rather
    //    than a silent nothing (§7.2).
    const { data: created, error } = await supabase.rpc('create_airpay_order', {
      p_service_slugs: slugs,
      p_order_ref: orderRef,
      p_guest_token: guestToken,
      p_contact_name: `${asString(contact.firstName)} ${asString(contact.lastName)}`.trim() || null,
      p_contact_email: asString(contact.email) || null,
      p_contact_phone: asString(contact.phone) || null,
    })

    const order = Array.isArray(created) ? created[0] : created
    if (error || !order || typeof order !== 'object') {
      logEvent('payment.create.order_failed', { orderRef })
      res.status(502).json({ error: 'order_failed' })
      return
    }

    const row = order as { total_inr?: number; access_token?: string }
    const amount = typeof row.total_inr === 'number' ? row.total_inr : null
    const accessToken = typeof row.access_token === 'string' ? row.access_token : null

    if (amount === null || accessToken === null) {
      logEvent('payment.create.order_failed', { orderRef, reason: 'incomplete_row' })
      res.status(502).json({ error: 'order_failed' })
      return
    }

    logEvent('payment.initiated', { orderRef })

    // 4. THEN mint the token.
    const token = await getAccessToken(config)
    if (!token) {
      // The order is already recorded as pending; the sweep will resolve it if
      // the shopper somehow proceeds.
      res.status(502).json({ error: 'gateway_unavailable', orderRef })
      return
    }

    // 5. Build, encrypt and sign the payload. Airpay receives the reference,
    //    the amount and contact details — and nothing else. No SKUs, no line
    //    items, no shipping address (§7.3).
    const fields = buildSignedEnvelope(
      {
        orderid: orderRef,
        amount: amount.toFixed(2), // fixed two decimals
        currency_code: '356', // ISO 4217 numeric, INR
        iso_currency: 'inr',
        buyer_email: asString(contact.email),
        buyer_phone: asString(contact.phone),
        buyer_firstname: asString(contact.firstName),
        buyer_lastname: asString(contact.lastName),
      },
      config,
    )

    res.status(200).json({
      orderRef,
      accessToken,
      amount,
      actionUrl: `${HOSTED_PAYMENT_URL}?token=${encodeURIComponent(token)}`,
      fields,
    })
  } catch {
    logEvent('payment.create.error', { orderRef })
    res.status(500).json({ error: 'create_failed' })
  }
}
