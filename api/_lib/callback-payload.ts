import { decrypt } from './airpay-crypto.js'
import { loadAirpayConfig, type MerchantId } from './config.js'
import { header, type ApiRequest } from './http.js'
import { FIELD_ALIASES, walkFields } from './walk.js'

/**
 * Reading the Airpay callback body (AIPAY-DOCS §9) — the hard part.
 *
 * This is where real payments were lost. The body arrives in ANY of several
 * shapes, and a naive reader fails SILENTLY rather than loudly: it logs a
 * successfully parsed callback carrying no order reference, and the payment
 * goes unsettled.
 *
 * This module NEVER throws. A malformed callback is an expected outcome on a
 * public, unauthenticated endpoint, not an exception.
 *
 * ⚠ Nothing this module returns is evidence of payment (§0). The fields it
 * extracts are a prompt to go and ask Order Confirmation.
 */

/** §9.1 — cap the stream drain. */
const MAX_BODY_BYTES = 512 * 1024

export type EnvelopeState = 'absent' | 'decrypted' | 'unreadable'
export type MerchantCheck = 'absent' | 'match' | 'mismatch' | 'unavailable'
export type ParserFailure =
  | 'none'
  | 'merchant_mismatch'
  | 'envelope_unreadable'
  | 'no_order_reference'

export interface CallbackFields {
  readonly orderRef: string
  readonly apTransactionId: string | undefined
  readonly amount: string | undefined
  readonly transactionStatus: string | undefined
  readonly message: string | undefined
  readonly secureHash: string | undefined
  readonly customerVpa: string | undefined
}

export interface CallbackParse {
  readonly ok: boolean
  readonly fields: CallbackFields | null
  /**
   * The decoded fields with their ORIGINAL casing, for the relay (§13.1).
   *
   * The plaintext fields when an envelope was opened; the outer fields when
   * the callback legitimately carried no envelope (`envelope: absent`, §9.6).
   * Empty whenever the read was REJECTED — merchant mismatch or an unreadable
   * envelope — so a rejected delivery can never be forwarded.
   */
  readonly relayFields: Readonly<Record<string, string>>
  /** Diagnostics — names and categories only, never values (§9.8). */
  readonly envelope: EnvelopeState
  readonly merchantCheck: MerchantCheck
  readonly parserFailure: ParserFailure
  readonly contentType: string
  readonly bodyType: string
  readonly bodyLength: number
  readonly decodedFieldCount: number
  readonly decodedKeys: readonly string[]
  readonly queryKeys: readonly string[]
}

/**
 * §9.1 — Vercel's Node runtime parses only content types it RECOGNISES. Every
 * other type returns `undefined` with the request stream left unread, so
 * `multipart/form-data` — the one such type a gateway plausibly posts — yields
 * nothing at all. Drain the stream ourselves.
 *
 * Never throws; never overwrites a body the platform already parsed. Without
 * this the callback is logged unparseable and the payment goes unsettled: a
 * silent money bug.
 */
export async function hydrateBody(req: ApiRequest): Promise<void> {
  const existing = req.body
  const isEmpty =
    existing === undefined ||
    existing === null ||
    (typeof existing === 'string' && existing === '') ||
    (typeof existing === 'object' &&
      !Buffer.isBuffer(existing) &&
      Object.keys(existing).length === 0)

  if (!isEmpty) return

  const stream = req as unknown as Partial<AsyncIterable<Buffer | string>>
  if (typeof stream[Symbol.asyncIterator] !== 'function') return

  try {
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
      total += buf.length
      if (total > MAX_BODY_BYTES) break
      chunks.push(buf)
    }
    if (chunks.length > 0) req.body = Buffer.concat(chunks).toString('utf8')
  } catch {
    // An unreadable stream is simply an unparseable callback, not an error.
  }
}

/**
 * Minimal multipart decoding: simple named text fields only — no files, no
 * nesting. The boundary is recovered from the header, or from the body's own
 * first line when the header is absent (§9.2).
 */
function decodeMultipart(text: string, contentType: string): Record<string, string> | null {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  let boundary = (match?.[1] ?? match?.[2])?.trim()

  if (!boundary) {
    const firstLine = text.slice(0, 200).split(/\r?\n/)[0]?.trim()
    if (firstLine?.startsWith('--')) boundary = firstLine.slice(2)
  }
  if (!boundary) return null

  const out: Record<string, string> = {}

  for (const part of text.split(`--${boundary}`)) {
    const name = /name="([^"]*)"/i.exec(part)?.[1]
    if (!name) continue

    const crlf = part.indexOf('\r\n\r\n')
    const lf = part.indexOf('\n\n')
    const start = crlf >= 0 ? crlf + 4 : lf >= 0 ? lf + 2 : -1
    if (start < 0) continue

    out[name] = part.slice(start).replace(/\r?\n-*$/, '')
  }

  return Object.keys(out).length > 0 ? out : null
}

/**
 * §9.2 — the decode order matters.
 *
 *   1. Starts `{` or `[` → JSON.
 *   2. Multipart content type, or the text contains `name="…"` → multipart
 *      BEFORE URLSearchParams. A multipart body run through URLSearchParams
 *      does not fail — it silently yields one nonsense key, which looks like a
 *      successfully parsed callback carrying no order reference (edge case 12).
 *   3. Otherwise → URLSearchParams.
 */
export function decodeBody(body: unknown, contentType: string): Record<string, unknown> {
  if (body === undefined || body === null) return {}

  if (Buffer.isBuffer(body)) return decodeBody(body.toString('utf8'), contentType)

  if (typeof body === 'object') return body as Record<string, unknown>

  if (typeof body !== 'string') return {}

  const text = body.trim()
  if (text === '') return {}

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
    } catch {
      // Fall through to the remaining decoders.
    }
  }

  if (/multipart\/form-data/i.test(contentType) || /name="[^"]*"/.test(text)) {
    const parts = decodeMultipart(text, contentType)
    if (parts) return parts
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of new URLSearchParams(text)) out[key] = value
  return out
}

/** Envelope field names, in precedence order (§9.3). */
const ENVELOPE_KEYS = ['encdata', 'encresponse', 'response'] as const

function findEnvelope(fields: Readonly<Record<string, unknown>>): string | null {
  for (const wanted of ENVELOPE_KEYS) {
    for (const [key, value] of Object.entries(fields)) {
      if (key.toLowerCase() === wanted && typeof value === 'string' && value.length > 16) {
        return value
      }
    }
  }
  return null
}

/** Case-insensitive lookup across the documented aliases (§9.7). */
function lookup(
  fields: Readonly<Record<string, unknown>>,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    for (const [key, value] of Object.entries(fields)) {
      if (key.toLowerCase() === alias.toLowerCase() && value != null && value !== '') {
        return String(value)
      }
    }
  }
  return undefined
}

function readMid(merchant: MerchantId): string | null {
  try {
    return loadAirpayConfig(merchant).mid
  } catch {
    // §9.6 — an incomplete environment reports `unavailable` rather than
    // throwing. It cannot become a way in: with no environment there is no
    // verification and no database, so settlement fails closed a step later
    // regardless (edge case 44).
    return null
  }
}

/**
 * Parses one callback request into trustworthy-SHAPED fields.
 *
 * The checks run in the exact order of §9.6:
 *
 *   1. merge query + body       (body wins — harder to forge into a link)
 *   2. merchant check           → mismatch: STOP, never even open the envelope
 *   3. open envelope            → unreadable: STOP
 *   4. order reference present? → no: STOP
 */
export async function parseCallback(
  req: ApiRequest,
  /**
   * Which merchant's receiver this is (§2.4).
   *
   * ⚠ Fixed by the ROUTE, never inferred from the payload. Each Airpay
   * merchant registers its own callback URL in its own dashboard, so the URL
   * a delivery arrived at is what states the merchant — and it is the one
   * piece of that statement a forger cannot alter by editing a field.
   *
   * The merchant must be known BEFORE decryption, because the key is derived
   * from that merchant's credentials and the order reference is sealed inside
   * the envelope. Taking it from the body instead would mean choosing a
   * decryption key from the very bytes being authenticated.
   */
  merchant: MerchantId = 1,
): Promise<CallbackParse> {
  await hydrateBody(req)

  const contentType = header(req, 'content-type') ?? ''
  const rawBody = req.body
  const bodyType = Buffer.isBuffer(rawBody)
    ? 'buffer'
    : rawBody === undefined
      ? 'undefined'
      : typeof rawBody
  const bodyLength =
    typeof rawBody === 'string'
      ? rawBody.length
      : Buffer.isBuffer(rawBody)
        ? rawBody.length
        : rawBody && typeof rawBody === 'object'
          ? Object.keys(rawBody).length
          : 0

  const query: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(req.query ?? {})) {
    query[key] = Array.isArray(value) ? value[0] : value
  }

  const decodedBody = decodeBody(rawBody, contentType)

  // 1. Body wins over query: a query string is far easier to forge into a
  //    clickable link than a POST body.
  const outer: Record<string, unknown> = { ...query, ...decodedBody }

  const base = {
    contentType,
    bodyType,
    bodyLength,
    decodedFieldCount: Object.keys(decodedBody).length,
    decodedKeys: Object.keys(decodedBody).slice(0, 40),
    queryKeys: Object.keys(query).slice(0, 20),
  }

  // 2. Merchant check — BEFORE decryption (edge case 17). A callback stating
  //    any merchant other than ours is never opened at all.
  //
  //    ⚠ The expected MID comes from the server's own environment, for the
  //    merchant THIS ROUTE serves. It is never read from the payload, so a
  //    delivery cannot nominate the credentials it is checked against, and one
  //    claiming a different merchant is rejected outright.
  //
  //    MERCID is a field of the PAYLOAD, not of the envelope, and is
  //    deliberately absent from these aliases (§9.7).
  const statedMerchant = lookup(outer, FIELD_ALIASES.merchantId)
  let merchantCheck: MerchantCheck = 'absent'

  if (statedMerchant) {
    const expected = readMid(merchant)
    merchantCheck =
      expected === null ? 'unavailable' : statedMerchant === expected ? 'match' : 'mismatch'
  }

  if (merchantCheck === 'mismatch') {
    return {
      ...base,
      relayFields: {},
      ok: false,
      fields: null,
      envelope: 'absent',
      merchantCheck,
      parserFailure: 'merchant_mismatch',
    }
  }

  // 3. Open the envelope.
  const sealed = findEnvelope(outer)
  let envelope: EnvelopeState = 'absent'
  let effective: Record<string, unknown> = outer

  if (sealed) {
    const config = (() => {
      try {
        return loadAirpayConfig(merchant)
      } catch {
        return null
      }
    })()

    // §9.4 ⚠ PROVEN — the base64 half contains `+`, and `+` is how
    // x-www-form-urlencoded spells a SPACE. Node's base64 decoder skips
    // whitespace rather than rejecting it, quietly shortening the ciphertext,
    // and decryption fails with nothing to show for it.
    //
    // The repair runs ONLY after an attempt on the bytes exactly as received
    // has failed. This repairs the transport; it does not guess at the
    // cryptography.
    const plaintext = config
      ? (decrypt(sealed, config) ??
        (sealed.includes(' ') ? decrypt(sealed.replace(/ /g, '+'), config) : null))
      : null

    if (plaintext === null) {
      // ⚠ An unreadable envelope ENDS the read — it does not fall back to the
      // outer fields. Falling through is precisely what would let a forger
      // pair a captured envelope with plaintext of their own (edge case 16).
      return {
        ...base,
        relayFields: {},
        ok: false,
        fields: null,
        envelope: 'unreadable',
        merchantCheck,
        parserFailure: 'envelope_unreadable',
      }
    }

    envelope = 'decrypted'

    let structure: unknown
    try {
      structure = JSON.parse(plaintext) as unknown
    } catch {
      structure = Object.fromEntries(new URLSearchParams(plaintext))
    }

    // §9.5 — the plaintext is NOT flat. Walk it breadth-first, letting a
    // NESTED statement of a name win over a shallower one: the outer object is
    // the transport wrapper, whose `status` and `message` describe the DELIVERY
    // rather than the transaction. Reading the wrapper's `message` as the
    // transaction's feeds the wrong string to verifySecureHash and strands a
    // genuine payment (edge case 15).
    const walked = walkFields(structure)

    // ⚠ REPLACE, do not merge (§9.6): the plaintext fields replace the outer
    // ones entirely.
    const replaced: Record<string, unknown> = {}
    for (const { key, value } of walked.values()) {
      replaced[key] = value
    }
    effective = replaced
  }

  // The relay payload is the EFFECTIVE fields — the plaintext when an envelope
  // was opened, the outer fields when there was none (§13.1).
  //
  // ⚠ Derived here rather than inside the `if (sealed)` branch above. While it
  // was populated only on the decrypted path, a callback that legitimately
  // arrived WITHOUT an envelope produced zero relay fields, and the relay's
  // "nothing to send" guard in callback-flow silently skipped it. Such a
  // callback parsed, settled and was answered 200 — it simply never reached
  // KKChat, and no log line said so. `envelope: absent` is a documented,
  // legitimate parse state (§9.6, §9.8), not a rejection.
  //
  // This changes only WHICH validated callbacks are forwarded. Every rejection
  // above — merchant mismatch, unreadable envelope — returns before this point
  // and still relays nothing, and the sealed path still forwards the OPENED
  // plaintext and never the envelope, because `effective` was replaced.
  const relayFields: Record<string, string> = {}
  for (const [key, value] of Object.entries(effective)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'object') continue
    relayFields[key] = String(value)
  }

  const orderRef = lookup(effective, FIELD_ALIASES.orderRef)

  if (!orderRef) {
    return {
      ...base,
      relayFields,
      ok: false,
      fields: null,
      envelope,
      merchantCheck,
      parserFailure: 'no_order_reference',
    }
  }

  return {
    ...base,
    relayFields,
    ok: true,
    envelope,
    merchantCheck,
    parserFailure: 'none',
    fields: {
      orderRef,
      apTransactionId: lookup(effective, FIELD_ALIASES.apTransactionId),
      amount: lookup(effective, FIELD_ALIASES.amount),
      transactionStatus: lookup(effective, FIELD_ALIASES.status),
      message: lookup(effective, FIELD_ALIASES.message),
      secureHash: lookup(effective, FIELD_ALIASES.secureHash),
      customerVpa: lookup(effective, FIELD_ALIASES.customerVpa),
    },
  }
}

/**
 * §8.2 — one URL, two kinds of caller.
 *
 * Every current browser sends Sec-Fetch-Dest on a top-level navigation and no
 * server-to-server client sends it at all. Spoofing it changes which RESPONSE
 * is returned and nothing whatsoever about whether an order is paid: both legs
 * have already been through settleOrder.
 */
export function isBrowserLeg(req: ApiRequest): boolean {
  const dest = header(req, 'sec-fetch-dest')?.toLowerCase()
  if (dest) return dest === 'document' || dest === 'iframe' || dest === 'frame'
  return (header(req, 'accept') ?? '').toLowerCase().includes('text/html')
}
