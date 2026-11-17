import { randomUUID } from 'node:crypto'

import { getServiceClient } from '../../_lib/db.js'
import { safeEqual, type ApiRequest, type ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig } from '../../_lib/isgpay-config.js'
import { esc, readForm, sendPage } from '../../_lib/isgpay-http.js'
import { buildSaleRequest, generateTxnRefNo, inrToPaise } from '../../_lib/isgpay.js'
import { logEvent } from '../../_lib/log.js'

/**
 * GET/POST /api/payments/isgpay/uat — isolated, access-controlled UAT checkout.
 *
 * Not linked from the site. Refuses to run on the Production deployment and
 * unless ISGPAY_UAT_ACCESS_KEY (≥ 24 chars) is set and supplied. The amount is
 * resolved by create_isgpay_order from the catalogue; the form carries only a
 * service slug, never a price.
 */

const DEFAULT_SLUG = 'website-security-audit'
const SLUG_RE = /^[a-z0-9-]{1,80}$/

function accessKey(): string | null {
  const key = process.env['ISGPAY_UAT_ACCESS_KEY']?.trim() ?? ''
  return key.length >= 24 ? key : null
}

const FORM = `<form method="post">
<label for="key">UAT access key</label><input id="key" name="key" type="password" autocomplete="off" required>
<label for="slug">Catalogue service slug (priced server-side)</label><input id="slug" name="slug" value="${DEFAULT_SLUG}" pattern="[a-z0-9-]+" required>
<button type="submit">Create UAT order</button></form>`

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const key = accessKey()
  // Production can serve the sandbox test only when a separate, explicit
  // website-test flag is enabled. The high-entropy access key is still
  // mandatory, and loadIsgpayConfig() still pins the gateway to UAT.
  const productionTestDisabled =
    process.env['VERCEL_ENV'] === 'production' &&
    process.env['ISGPAY_UAT_WEBSITE_TEST_ENABLED'] !== 'true'
  if (productionTestDisabled || key === null) {
    sendPage(res, 404, 'Not found', '<p>Not found.</p>')
    return
  }

  if (req.method === 'GET') {
    sendPage(res, 200, 'ISGPay UAT checkout', FORM, "'self'")
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    sendPage(res, 405, 'Method not allowed', '<p>Method not allowed.</p>')
    return
  }

  const form = await readForm(req)
  if (!safeEqual(form['key'] ?? '', key)) {
    logEvent('isgpay.uat.denied')
    sendPage(res, 403, 'Access denied', '<p>Access denied.</p>')
    return
  }
  const slug = (form['slug'] ?? '').trim()
  if (!SLUG_RE.test(slug)) {
    sendPage(res, 400, 'Invalid request', '<p>Invalid service slug.</p>')
    return
  }

  let config
  try {
    config = loadIsgpayConfig()
    if (!config.enabled) throw new Error('disabled')
  } catch {
    logEvent('isgpay.uat.unavailable')
    sendPage(res, 503, 'ISGPay unavailable', '<p>ISGPay is not configured or not enabled on this deployment.</p>')
    return
  }

  const txnRefNo = generateTxnRefNo()
  const { data, error } = await getServiceClient().rpc('create_isgpay_order', {
    p_service_slugs: [slug],
    p_order_ref: txnRefNo,
    p_guest_token: randomUUID(),
  })
  const row = (Array.isArray(data) ? data[0] : data) as { total_inr?: unknown; access_token?: unknown } | null
  if (error || typeof row?.total_inr !== 'number' || typeof row.access_token !== 'string') {
    logEvent('isgpay.uat.order_failed', { txnRefNo, code: error?.code })
    sendPage(res, 502, 'Order not created', '<p>The order could not be created (unknown or inactive service?).</p>')
    return
  }

  const handoff = buildSaleRequest(config, { txnRefNo, amountPaise: inrToPaise(row.total_inr) })
  logEvent('isgpay.uat.initiated', { txnRefNo, amountPaise: handoff.amountPaise })

  const statusUrl = `/api/payments/isgpay/status?ref=${encodeURIComponent(txnRefNo)}&t=${encodeURIComponent(row.access_token)}`
  const hidden = Object.entries(handoff.fields)
    .map(([name, value]) => `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`)
    .join('')
  sendPage(
    res,
    200,
    'UAT order created',
    `<dl><dt>TxnRefNo</dt><dd>${esc(txnRefNo)}</dd><dt>Amount</dt><dd>₹${esc(row.total_inr)} (${esc(handoff.amountPaise)} paise)</dd>
<dt>Status</dt><dd><a href="${esc(statusUrl)}">${esc(statusUrl)}</a></dd></dl>
<p>Keep the status link: it is the only way to check this order later.</p>
<form method="post" action="${esc(handoff.action)}">${hidden}<button type="submit">Continue to ISGPay sandbox</button></form>`,
    // Not just the sandbox origin: Chrome applies form-action to the redirects
    // that follow the POST (e.g. to a 3-D Secure ACS on another host).
    'https:',
  )
}
