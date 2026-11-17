import { hydrateBody } from './callback-payload.js'
import { noStore, type ApiRequest, type ApiResponse } from './http.js'
import type { IsgpayConfig } from './isgpay-config.js'
import { openGatewayResponse } from './isgpay.js'

/** Form fields from a POST body (platform-parsed object, or raw urlencoded string). */
export async function readForm(req: ApiRequest): Promise<Record<string, string>> {
  await hydrateBody(req)
  const body = req.body
  const out: Record<string, string> = {}
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    for (const [k, v] of new URLSearchParams(body.toString())) out[k] ??= v
  } else if (body && typeof body === 'object') {
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      const first = Array.isArray(v) ? v[0] : v
      if (typeof first === 'string') out[k] = first
    }
  }
  return out
}

export type EnvelopeRef = { readonly ok: true; readonly txnRefNo: string } | { readonly ok: false; readonly reason: string }

/**
 * The TxnRefNo from a gateway POST (browser return or push callback). Only a
 * prompt to run a Status Query: nothing else in the envelope is acted on.
 */
export function refFromGatewayPost(config: IsgpayConfig, form: Record<string, string>): EnvelopeRef {
  // Base64 never contains spaces; a raw '+' that was form-decoded becomes one.
  const encData = form['EncData']?.replace(/ /g, '+')
  if (!encData) return { ok: false, reason: 'missing_encdata' }
  const opened = openGatewayResponse(config, encData)
  if (opened.ok === false) return { ok: false, reason: opened.reason }
  const ref = opened.fields['TxnRefNo']
  return ref ? { ok: true, txnRefNo: ref } : { ok: false, reason: 'missing_txn_ref' }
}

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

/** A minimal, self-contained HTML page. `body` must already be escaped. */
export function sendPage(res: ApiResponse, code: number, title: string, body: string, formAction = "'none'"): void {
  noStore(res)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`)
  res.status(code).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#111;background:#fff}
label{display:block;margin:.75rem 0 .25rem;font-weight:600}input,select,button{font:inherit;padding:.5rem;width:100%;box-sizing:border-box}
button{margin-top:1rem;background:#111;color:#fff;border:0;border-radius:.375rem;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:.25rem 1rem}dt{font-weight:600}dd{margin:0;word-break:break-all}
.note{padding:.75rem;border-radius:.375rem;background:#fef3c7}</style></head>
<body><main><p class="note">ISGPay UAT sandbox: test transactions only.</p><h1>${esc(title)}</h1>${body}</main></body></html>`)
}
