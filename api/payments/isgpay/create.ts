import { hasContact, normaliseContact } from '../../_lib/contact.js'
import { getServiceClient } from '../../_lib/db.js'
import { noStore, type ApiRequest, type ApiResponse } from '../../_lib/http.js'
import { isgpayCheckoutOpen } from '../../_lib/isgpay-checkout.js'
import { loadIsgpayConfig, type IsgpayConfig } from '../../_lib/isgpay-config.js'
import { buildSaleRequest, generateTxnRefNo, inrToPaise } from '../../_lib/isgpay.js'
import { logEvent } from '../../_lib/log.js'

/**
 * GET  /api/payments/isgpay/create → { available, testMode } for the checkout.
 * POST /api/payments/isgpay/create → a catalogue-priced UAT order + the
 *      encrypted hand-off the browser auto-posts to the ISGPay sandbox.
 *
 * Same contract as /api/payments/create for Airpay: the body carries service
 * slugs, the guest token and contact details — never an amount, a credential
 * or a gateway URL. Every order made here is a SANDBOX order (ISGPAY_ENV is
 * UAT-only in loadIsgpayConfig), and the response says so (`testMode`).
 *
 * Contact details are validated for parity with Airpay but not stored:
 * create_isgpay_order has no contact columns, and a sandbox order is never
 * fulfilled.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9-]{1,80}$/
const MAX_SERVICES = 25

function enabledConfig(): IsgpayConfig | null {
  try {
    const config = loadIsgpayConfig()
    return config.enabled ? config : null
  } catch {
    return null
  }
}

function parseBody(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
}

/** Unique, well-formed slugs, or null if any entry is not. */
function parseSlugs(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SERVICES) return null
  if (!value.every((s): s is string => typeof s === 'string' && SLUG_RE.test(s))) return null
  return [...new Set(value)]
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)
  const config = isgpayCheckoutOpen(req) ? enabledConfig() : null

  if (req.method === 'GET') {
    res.status(200).json({ available: config !== null, testMode: true })
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  // One answer for "flag off", "not a tester" and "misconfigured".
  if (config === null) {
    res.status(404).json({ error: 'not_found' })
    return
  }

  const body = parseBody(req.body)
  const slugs = parseSlugs(body?.['serviceSlugs'])
  const guestToken = typeof body?.['guestToken'] === 'string' ? body['guestToken'].trim() : ''
  if (slugs === null || !UUID_RE.test(guestToken)) {
    res.status(400).json({ error: 'invalid_request' })
    return
  }
  if (!hasContact(normaliseContact(body?.['contact']))) {
    res.status(400).json({ error: 'contact_required' })
    return
  }

  const supabase = getServiceClient()

  // Every requested service must exist and be active. create_isgpay_order would
  // silently price only the matching ones; refuse instead of charging a subset.
  const { data: active, error: lookupError } = await supabase
    .from('services')
    .select('slug')
    .in('slug', slugs)
    .eq('is_active', true)
  if (lookupError || !Array.isArray(active)) {
    logEvent('isgpay.checkout.lookup_failed', { code: lookupError?.code })
    res.status(502).json({ error: 'order_failed' })
    return
  }
  if (active.length !== slugs.length) {
    res.status(400).json({ error: 'invalid_services' })
    return
  }

  // Server-generated; the client has nowhere to send a reference.
  const txnRefNo = generateTxnRefNo()
  const { data, error } = await supabase.rpc('create_isgpay_order', {
    p_service_slugs: slugs,
    p_order_ref: txnRefNo,
    p_guest_token: guestToken,
  })
  const row = (Array.isArray(data) ? data[0] : data) as { total_inr?: unknown; access_token?: unknown } | null
  if (error || typeof row?.total_inr !== 'number' || typeof row.access_token !== 'string') {
    logEvent('isgpay.checkout.order_failed', { txnRefNo, code: error?.code })
    res.status(502).json({ error: 'order_failed' })
    return
  }

  let handoff
  try {
    handoff = buildSaleRequest(config, { txnRefNo, amountPaise: inrToPaise(row.total_inr) })
  } catch {
    // The row stays pending_payment and unpaid, like an abandoned checkout.
    logEvent('isgpay.checkout.build_failed', { txnRefNo })
    res.status(502).json({ error: 'order_failed' })
    return
  }
  logEvent('isgpay.checkout.initiated', { txnRefNo, amountPaise: handoff.amountPaise, services: slugs.length })

  res.status(200).json({
    orderRef: txnRefNo,
    accessToken: row.access_token,
    amount: row.total_inr,
    actionUrl: handoff.action,
    fields: handoff.fields,
    testMode: true,
  })
}
