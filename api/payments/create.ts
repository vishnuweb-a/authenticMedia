import { buildSignedEnvelope } from '../_lib/airpay-crypto.js'
import { getAccessToken } from '../_lib/airpay.js'
import { hasContact, normaliseContact } from '../_lib/contact.js'
import { activeMerchant, HOSTED_PAYMENT_URL, loadAirpayConfig } from '../_lib/config.js'
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

  // ⚠ PROVEN in production — Airpay's hosted page answers "Either email or
  // contact number is mandatory" when buyer_email and buyer_phone both arrive
  // empty. That refusal lands AFTER the token is minted and the order is
  // recorded, so the shopper sees a gateway error page and the order strands as
  // pending_payment. Refuse here instead: before the order row, before OAuth.
  const contact = normaliseContact(body?.contact)
  if (!hasContact(contact)) {
    // Presence of the RAW fields, never their values (§9.8). Both are false
    // when the client omitted the block entirely; a true here with a rejection
    // means the value arrived but could not be normalised, which is a very
    // different bug and was indistinguishable while these were hardcoded.
    const raw = body?.contact
    const source = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    logEvent('payment.create.contact_missing', {
      emailPresent: asString(source['email']) !== '',
      contactPresent: asString(source['phone']) !== '',
    })
    res.status(400).json({ error: 'contact_required' })
    return
  }

  // ⚠ The merchant is chosen HERE and only here (§2.4), from a server-side
  // environment variable. Nothing in the request influences it: the browser
  // cannot name a merchant, cannot override one, and cannot supply a
  // credential. An unset or unrecognised value keeps the production-proven
  // merchant 1.
  const merchant = activeMerchant()

  let config
  try {
    config = loadAirpayConfig(merchant)
  } catch {
    // Names only — never the value, and never which credential (§9.8).
    logEvent('payment.create.misconfigured', { merchant })
    res.status(503).json({ error: 'payments_unavailable' })
    return
  }

  // The reference carries the merchant (§2.4). Generated with it, stored with
  // it, and decoded back out by every settlement path — so an order settles
  // against the merchant that created it even if the active merchant is
  // switched while the order is still pending.
  const orderRef = generateOrderRef(Date.now(), merchant)

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
      p_contact_name: `${contact.firstName} ${contact.lastName}`.trim() || null,
      p_contact_email: contact.email || null,
      p_contact_phone: contact.phone || null,
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

    // Presence only — never the address or the number (§9.8).
    logEvent('payment.initiated', {
      orderRef,
      merchant,
      emailPresent: contact.email !== '',
      contactPresent: contact.phone !== '',
    })

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
        // At least one of these two is non-empty — guaranteed by hasContact
        // above, which is what Airpay's hosted page actually requires (§7.3).
        buyer_email: contact.email,
        buyer_phone: contact.phone,
        buyer_firstname: contact.firstName,
        buyer_lastname: contact.lastName,
      },
      config,
    )

    res.status(200).json({
      orderRef,
      accessToken,
      amount,
      actionUrl: `${HOSTED_PAYMENT_URL}?token=${encodeURIComponent(token)}`,
      fields,
      // How the browser gets BACK here after the hosted page (§8.1, §14.3).
      //
      // Airpay resolves the Response URL per MID from its own DASHBOARD, never
      // from anything sent at transaction time — there is no return-URL field
      // in the payload above, by design. Merchant 2's dashboard points that
      // Response at KKChat, which is the client's requirement and is not ours
      // to change. So Airpay will not bring this browser home, and the client
      // must keep hold of the tab itself.
      //
      // ⚠ Derived from the merchant the SERVER just chose — never sent by the
      // client, never echoed back from the request. It carries NO claim about
      // any payment: it selects a navigation style and nothing else, so a
      // tampered value can at worst give the shopper a worse hand-off. What
      // decides whether an order is paid is Order Confirmation, always.
      returnsToSite: merchant === 1,
    })
  } catch {
    logEvent('payment.create.error', { orderRef })
    res.status(500).json({ error: 'create_failed' })
  }
}
