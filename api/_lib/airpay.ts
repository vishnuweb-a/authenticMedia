import { buildEnvelope, buildSignedEnvelope, decrypt } from './airpay-crypto.js'
import { OAUTH_URL, type AirpayConfig } from './config.js'
import { logEvent } from './log.js'
import { FIELD_ALIASES, pick, walkFields } from './walk.js'

/**
 * The Airpay gateway client (AIPAY-DOCS §6, §11).
 *
 * Every inconclusive path returns null. Callers treat null as "not paid yet,
 * ask again later" — never as a failure to report to the customer.
 */

/**
 * ⚠ §12 — must sit BELOW the platform's 10 s function ceiling. At the ceiling
 * the abort never fires: the platform kills the function, producing a bare 502
 * and no logs at all, because the catch block never runs.
 */
const AIRPAY_TIMEOUT_MS = 8_000

/**
 * Node's fetch sends no User-Agent, and a WAF refusing an anonymous client
 * looks exactly like a credential error (§11).
 */
const USER_AGENT = 'AuthenticMedia/1.0 (+https://authenticmedia.fun)'

async function postForm(
  url: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; status: number; text: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AIRPAY_TIMEOUT_MS)
  try {
    // Form-urlencoded, always. A JSON body to Order Confirmation returns
    // 403 "Parameters are required" — every field present, none of them
    // visible to the server (§4).
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams(fields).toString(),
      signal: controller.signal,
    })
    return { ok: response.ok, status: response.status, text: await response.text() }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

interface CachedToken {
  token: string
  expiresAt: number
}

/**
 * Tokens live 300 s; cache with a 60 s safety margin so one cannot expire in
 * flight (§6). On serverless a warm instance reuses it and a cold start mints
 * a new one — no shared infrastructure needed.
 */
let cached: CachedToken | null = null
const TOKEN_TTL_MS = 300_000
const TOKEN_MARGIN_MS = 60_000

/** Exposed for tests; never called in request paths. */
export function resetTokenCache(): void {
  cached = null
}

/**
 * Mints an OAuth2 access token, or returns null.
 *
 * ⚠ §6.1 — the outer envelope is not the verdict. A REJECTED grant still
 * returns status_code 200 / response_code "00" / status "success". Those four
 * outer fields describe the transport; the verdict is data.success and the
 * reason is data.msg. Reading only the envelope makes a refusal look like an
 * authenticated success.
 */
export async function getAccessToken(config: AirpayConfig): Promise<string | null> {
  const now = Date.now()
  if (cached && cached.expiresAt > now) return cached.token

  // The credentials travel INSIDE encdata, not as plain form fields (§6).
  const envelope = buildEnvelope(
    {
      client_id: config.clientId,
      client_secret: config.secretKey, // ⚠ PROVEN §2.2 — NOT apiKey
      merchant_id: config.mid,
      grant_type: 'client_credentials',
    },
    config,
  )

  const response = await postForm(OAUTH_URL, envelope)
  if (!response) {
    logEvent('airpay.oauth.unreachable')
    return null
  }
  if (!response.ok) {
    logEvent('airpay.oauth.http_error', { status: response.status })
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(response.text) as unknown
  } catch {
    logEvent('airpay.oauth.no_token', { reason: 'unparseable' })
    return null
  }

  // Walk the structure: `data` may arrive as a JSON string (§6.2), and the
  // token appears under several aliases.
  const fields = walkFields(parsed)

  const success = pick(fields, ['success'])
  if (success !== undefined && /^(false|0)$/i.test(success)) {
    // The reason lives in data.msg. It is not logged: it is a gateway string
    // about our own credentials, and the category is what diagnoses this.
    logEvent('airpay.oauth.no_token', { reason: 'rejected' })
    return null
  }

  const token = pick(fields, ['access_token', 'accessToken', 'access-token', 'token'])
  if (!token) {
    logEvent('airpay.oauth.no_token', { reason: 'absent' })
    return null
  }

  cached = { token, expiresAt: now + TOKEN_TTL_MS - TOKEN_MARGIN_MS }
  logEvent('airpay.oauth.issued')
  return token
}

export interface VerifiedTransaction {
  readonly orderRef: string
  /** 200 SUCCESS | 211 IN_PROCESS | 400 FAILED (§11.4). */
  readonly status: number
  readonly amount: number | null
  readonly apTransactionId: string | null
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Order Confirmation — the SOLE basis on which an order may be marked paid.
 *
 * Keyed on OUR order reference and nothing else: no amount, no Airpay
 * transaction id. That is exactly what lets settlement proceed for an order
 * whose callback never arrived — which, in this integration, is every order,
 * because Airpay delivers callbacks to KKChat rather than to us.
 *
 * Returns null for every inconclusive outcome (§11.3): unreachable gateway,
 * non-2xx, unreadable envelope, inner failure, an answer about another order,
 * or an answer with no status. NEVER throws.
 */
export async function verifyTransaction(
  orderRef: string,
  config: AirpayConfig,
): Promise<VerifiedTransaction | null> {
  // If the token cannot be minted, return null rather than letting an error
  // escape and turn a settlement into a 500 (§11.3).
  const token = await getAccessToken(config)
  if (!token) return null

  // merchant_id travels TWICE — once in the clear so the gateway can route,
  // once inside encdata where the checksum commits to it (§11).
  const envelope = buildSignedEnvelope({ merchant_id: config.mid, orderid: orderRef }, config)

  const url = `${config.verifyUrl}?token=${encodeURIComponent(token)}`
  const response = await postForm(url, envelope)

  if (!response) {
    logEvent('airpay.verify.unreachable', { orderRef })
    return null
  }
  if (!response.ok) {
    logEvent('airpay.verify.http_error', { orderRef, status: response.status })
    return null
  }

  let record: unknown
  try {
    record = JSON.parse(response.text) as unknown
  } catch {
    logEvent('airpay.verify.unparseable', { orderRef, envelope: 'absent' })
    return null
  }

  // §11.1 — the docs contradict themselves about whether this response is
  // encrypted, so detect the envelope and decrypt only when present. Record
  // which of the three happened: "sent nothing we recognise" and "sent
  // something we cannot decrypt" need opposite fixes and are otherwise
  // indistinguishable from the body alone.
  let envelopeState: 'absent' | 'decrypted' | 'unreadable' = 'absent'
  if (record !== null && typeof record === 'object') {
    const sealed = (record as Record<string, unknown>)['response']
    if (typeof sealed === 'string' && sealed.length > 16) {
      const plaintext = decrypt(sealed, config)
      if (plaintext === null) {
        logEvent('airpay.verify.unparseable', { orderRef, envelope: 'unreadable' })
        return null
      }
      try {
        record = JSON.parse(plaintext) as unknown
        envelopeState = 'decrypted'
      } catch {
        logEvent('airpay.verify.unparseable', { orderRef, envelope: 'unreadable' })
        return null
      }
    }
  }

  const fields = walkFields(record)

  // §11.2 fail-closed cross-checks.
  const success = pick(fields, ['success'])
  if (success !== undefined && /^(false|0)$/i.test(success)) {
    logEvent('airpay.verify.inner_failure', { orderRef, envelope: envelopeState })
    return null
  }

  // Airpay is not known to echo orderid/merchant_id back, so each is checked
  // only when actually stated: silence is not a mismatch, and a mismatch is
  // never settled.
  const statedOrder = pick(fields, FIELD_ALIASES.orderRef)
  if (statedOrder !== undefined && statedOrder !== orderRef) {
    logEvent('airpay.verify.order_mismatch', { orderRef, envelope: envelopeState })
    return null
  }

  const statedMerchant = pick(fields, FIELD_ALIASES.merchantId)
  if (statedMerchant !== undefined && statedMerchant !== config.mid) {
    logEvent('airpay.verify.merchant_mismatch', { orderRef, envelope: envelopeState })
    return null
  }

  const status = toNumber(pick(fields, FIELD_ALIASES.status))

  // ⚠ PROVEN §10.4 — "no status" is an UNKNOWN, not a failure. Guarded here
  // AND in settleOrder. A confirmation whose fields were all null was once
  // recorded as a definitive failure (because null !== 200) and a genuine ₹81
  // UPI payment was terminally marked failed, unrecoverable by the running
  // system. Refuse to return a statusless confirmation.
  if (status === null) {
    logEvent('airpay.verify.no_status', { orderRef, envelope: envelopeState })
    return null
  }

  // Deliberately narrow: fires only when Airpay states a success and then
  // contradicts it. An absent field is silence, and any value beginning
  // "success" is accepted, so a wording change cannot strand a real payment.
  if (status === 200) {
    const paymentStatus = pick(fields, ['transaction_payment_status', 'transactionpaymentstatus'])
    if (paymentStatus !== undefined && !/^success/i.test(paymentStatus)) {
      logEvent('airpay.verify.status_conflict', { orderRef, envelope: envelopeState })
      return null
    }
  }

  return {
    orderRef,
    status,
    amount: toNumber(pick(fields, FIELD_ALIASES.amount)),
    apTransactionId: pick(fields, FIELD_ALIASES.apTransactionId) ?? null,
  }
}
