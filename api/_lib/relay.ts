import { logEvent } from './log.js'

/**
 * The KKChat relay (AIPAY-DOCS §13).
 *
 * ⚠ The relay is AUXILIARY. Notifying KKChat is not part of taking a payment,
 * and nothing here may influence whether an order settles. This function never
 * throws, never retries, and returns nothing to branch on — every failure mode
 * (DNS, TLS, timeout, reset, 4xx, 5xx, an HTML error page) resolves to "log it
 * and carry on" (§13.3).
 *
 * It runs AFTER settlement has completed, so a KKChat outage can never delay,
 * corrupt or roll back a verified payment (§13.7).
 */

/**
 * ⚠ PROVEN (§13.2) — the path segment IS the whole integration.
 *
 * KKChat routes only on the trailing `/collection` and answers 200 "success"
 * to ANY middle segment, including nonsense ones. An unrecognised segment is
 * accepted and DISCARDED: every relay sent to `…/cpm/arp/collection` was
 * answered 200, logged as a forwarding success, and nothing reached the
 * merchant.
 *
 * `arp_frontiva` is the client-confirmed segment for this integration. Do not
 * "normalise" it to `arp` — a 200 from this host is not evidence of delivery,
 * so the mistake would be invisible in every log.
 */
export const KKCHAT_DEFAULT_URL = 'https://kkchat.in/callback/cpm/arp_frontiva/collection'

/**
 * A DIFFERENT KKChat integration's URL — RECORDED HERE, NEVER POSTED TO.
 *
 * ⚠ This is NOT merchant 2's destination. MID 362380 now delivers its
 * callbacks to this application, which forwards them to KKCHAT_DEFAULT_URL
 * (`arp_frontiva`) exactly like merchant 1 — one confirmed destination for
 * both merchants.
 *
 * The string is kept, and still never posted to, because §13.2's trap is
 * permanent: KKChat answers 200 to ANY middle segment and SILENTLY DISCARDS
 * what it does not recognise. Every relay once sent to `…/cpm/arp/collection`
 * was answered 200, logged as a success, and never reached the merchant. It is
 * exported so the regression tests can assert the exact string and, more
 * importantly, assert that forwardCallback is never called with it — so the
 * two are never "normalised" into each other.
 */
export const KKCHAT_MERCHANT_2_URL = 'https://kkchat.in/callback/cpm/arp/collection'

/** Pure added latency; settlement is already done (§12). */
const RELAY_TIMEOUT_MS = 5_000

/**
 * Abuse bounds (§13.5). The inbound endpoint is public and unauthenticated, so
 * anyone can cause an outbound POST. These caps sit far above any real Airpay
 * callback, so a legitimate payload passes untouched and only abuse is trimmed.
 */
const MAX_FIELDS = 64
const MAX_VALUE_CHARS = 1024

/**
 * Resolves the destination.
 *
 * Read from process.env DIRECTLY, not through the validated payment-credential
 * schema, so a misconfiguration on either side cannot take the other down
 * (§13.3). `off`/`disabled` opts out entirely.
 */
export function relayDestination(): string | null {
  const raw = process.env['KKCHAT_CALLBACK_URL']?.trim()
  if (raw === undefined || raw === '') return KKCHAT_DEFAULT_URL
  const lowered = raw.toLowerCase()
  if (lowered === 'off' || lowered === 'disabled') return null
  return raw
}

/**
 * Forwards the Airpay fields to KKChat.
 *
 * Contract (§13.1): POST, `Content-Type: application/json`, and a JSON OBJECT
 * of the Airpay fields. Not form-urlencoded, not query parameters, and NOT a
 * JSON string containing JSON — JSON.stringify is applied exactly once, so the
 * body is `{"MERCID":"…"}` rather than a quoted, escaped string of the same
 * thing. The receiving end parses those very differently (edge case 30).
 *
 * Values arrive as strings and STAY strings. Nothing is re-encrypted, renamed,
 * re-cased, coerced to a number, or dropped — the fields are forwarded exactly
 * as received, with their original casing, after the envelope was opened.
 *
 * ⚠ Must be AWAITED (§13.4). On a serverless runtime the instance may be
 * frozen the moment the response is written, silently dropping an un-awaited
 * request — the relay would appear to work locally and never fire in
 * production. Awaiting is safe: it cannot throw and is bounded by its own
 * timeout.
 */
export async function forwardCallback(
  fields: Readonly<Record<string, string>>,
): Promise<void> {
  const destination = relayDestination()
  if (!destination) return

  const entries = Object.entries(fields).slice(0, MAX_FIELDS)
  if (entries.length === 0) return

  const body: Record<string, string> = {}
  for (const [key, value] of entries) body[key] = value.slice(0, MAX_VALUE_CHARS)

  // Field COUNT is safe to log. The values beside these names are a customer's
  // phone, email and VPA (§9.8).
  logEvent('payment.callback.forward.start', { fieldCount: entries.length })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS)

  try {
    const response = await fetch(destination, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (response.ok) {
      // ⚠ NOT proof of delivery (§13.2). KKChat answers 200 "success" to any
      // middle path segment, including one it does not recognise and silently
      // discards.
      logEvent('payment.callback.forward.success', { status: response.status })
    } else {
      logEvent('payment.callback.forward.rejected', { status: response.status })
    }
  } catch {
    // No retry: Airpay re-delivers on its own schedule if it did not get a 200
    // from us, and retrying here would multiply that (§13.3).
    logEvent('payment.callback.forward.failed', {})
  } finally {
    clearTimeout(timer)
  }
}
