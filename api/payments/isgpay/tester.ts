import { safeEqual, type ApiRequest, type ApiResponse } from '../../_lib/http.js'
import { testerCookie, uatAccessKey } from '../../_lib/isgpay-checkout.js'
import { readForm, sendPage } from '../../_lib/isgpay-http.js'
import { logEvent } from '../../_lib/log.js'

/**
 * GET/POST /api/payments/isgpay/tester — one-time tester unlock for this browser.
 *
 * A tester enters ISGPAY_UAT_ACCESS_KEY once; the response sets an HttpOnly,
 * HMAC-signed, 12-hour cookie. With ISGPAY_CHECKOUT_ENABLED=true, that cookie
 * is what shows "ISGPay — Sandbox Test" in the normal checkout on Production.
 * The key is posted in a body, never a URL, and is never stored in the cookie.
 *
 * Not linked from the site. 404 when no key (≥ 24 chars) is configured.
 */

const FORM = `<form method="post">
<label for="key">UAT tester access key</label><input id="key" name="key" type="password" autocomplete="off" required>
<button type="submit">Enable sandbox checkout in this browser</button></form>`

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const key = uatAccessKey()
  if (key === null) {
    sendPage(res, 404, 'Not found', '<p>Not found.</p>')
    return
  }
  if (req.method === 'GET') {
    sendPage(res, 200, 'ISGPay sandbox tester access', FORM, "'self'")
    return
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    sendPage(res, 405, 'Method not allowed', '<p>Method not allowed.</p>')
    return
  }

  const form = await readForm(req)
  if (!safeEqual(form['key'] ?? '', key)) {
    logEvent('isgpay.tester.denied')
    sendPage(res, 403, 'Access denied', '<p>Access denied.</p>')
    return
  }

  logEvent('isgpay.tester.granted')
  res.setHeader('Set-Cookie', testerCookie(key))
  sendPage(
    res,
    200,
    'Sandbox checkout enabled',
    '<p>For the next 12 hours, this browser sees <strong>ISGPay — Sandbox Test</strong> in the website checkout. Test payments only; nothing is delivered.</p><p><a href="/services">Go to services</a></p>',
  )
}
