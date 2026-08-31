/**
 * Buyer contact validation for the Airpay payload (AIPAY-DOCS §7.3).
 *
 * ⚠ PROVEN in production — Airpay's hosted page refuses the handoff with
 * "Either email or contact number is mandatory" when `buyer_email` and
 * `buyer_phone` both arrive empty. The payload previously carried both fields
 * with the correct names, but the browser sent an empty contact object, so the
 * gateway received two empty strings and rejected the payment at its own
 * checkout validation — after OAuth, after order creation, after the hosted
 * page had already loaded.
 *
 * This module is the single definition of "enough contact detail to pay".
 * Rejecting here — before a token is minted — turns that late gateway refusal
 * into an early, diagnosable 400.
 *
 * It holds NO personal data and logs nothing. Callers may log presence
 * (`emailPresent=true`), never a value (§9.8).
 */

/**
 * Deliberately permissive: it rejects the shapes that are certainly wrong
 * rather than deciding which addresses are real. Airpay does its own check.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Digits only, after stripping spaces, dashes, brackets and a leading +. */
const PHONE_DIGITS_MIN = 10
const PHONE_DIGITS_MAX = 15

export interface BuyerContact {
  readonly email: string
  readonly phone: string
  readonly firstName: string
  readonly lastName: string
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Normalises to the digits Airpay expects, or '' if it cannot be one. */
export function normalisePhone(value: unknown): string {
  const raw = asString(value)
  if (raw === '') return ''
  const digits = raw.replace(/[\s()\-.]/g, '').replace(/^\+/, '')
  if (!/^\d+$/.test(digits)) return ''
  if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX) return ''
  return digits
}

/** Returns the address unchanged when plausible, or '' when it is not. */
export function normaliseEmail(value: unknown): string {
  const raw = asString(value)
  return EMAIL_PATTERN.test(raw) ? raw : ''
}

/**
 * Normalises the client's contact block.
 *
 * Invalid values become empty rather than throwing, so `hasContact` is the one
 * place that decides whether the request may proceed.
 */
export function normaliseContact(raw: unknown): BuyerContact {
  const source = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    email: normaliseEmail(source['email']),
    phone: normalisePhone(source['phone']),
    firstName: asString(source['firstName']).slice(0, 60),
    lastName: asString(source['lastName']).slice(0, 60),
  }
}

/**
 * Airpay's own rule: EITHER an email OR a contact number is mandatory.
 *
 * Not both — requiring both would refuse payments Airpay would have accepted.
 */
export function hasContact(contact: BuyerContact): boolean {
  return contact.email !== '' || contact.phone !== ''
}
