/**
 * Checkout contact validation.
 *
 * ⚠ Airpay's hosted page requires EITHER an email OR a contact number
 * (`buyer_email` / `buyer_phone`, AIPAY-DOCS §7.3). A handoff carrying neither
 * is refused at the gateway with "Either email or contact number is mandatory"
 * — after the order has been recorded, so the shopper hits an error page and
 * the order strands as pending.
 *
 * This mirrors api/_lib/contact.ts so the shopper is told what is missing here,
 * in the drawer, instead of on Airpay's error page. The server rule is the
 * authoritative one; this is a courtesy, never a substitute for it.
 */

/**
 * Deliberately permissive: it rejects the shapes that are certainly wrong
 * rather than deciding which addresses are real.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const PHONE_DIGITS_MIN = 10
const PHONE_DIGITS_MAX = 15

export interface CheckoutContactValues {
  name: string
  email: string
  phone: string
}

export interface CheckoutContactErrors {
  email?: string
  phone?: string
}

export const EMPTY_CONTACT: CheckoutContactValues = { name: '', email: '', phone: '' }

/** Normalises to digits, or '' when the value cannot be a phone number. */
export function normalisePhone(value: string): string {
  const raw = value.trim()
  if (raw === '') return ''
  const digits = raw.replace(/[\s()\-.]/g, '').replace(/^\+/, '')
  if (!/^\d+$/.test(digits)) return ''
  if (digits.length < PHONE_DIGITS_MIN || digits.length > PHONE_DIGITS_MAX) return ''
  return digits
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

/**
 * Both fields are optional individually; at least one must be usable.
 *
 * A field that has been typed into but is malformed always reports its own
 * problem, so "invalid email + valid phone" still tells the shopper the email
 * is wrong rather than silently discarding it.
 */
export function validateCheckoutContact(values: CheckoutContactValues): CheckoutContactErrors {
  const errors: CheckoutContactErrors = {}
  const email = values.email.trim()
  const phone = values.phone.trim()

  if (email !== '' && !isValidEmail(email)) {
    errors.email = 'Please enter a valid email address.'
  }
  if (phone !== '' && normalisePhone(phone) === '') {
    errors.phone = 'Please enter a valid phone number.'
  }

  if (email === '' && phone === '') {
    errors.email = 'Enter an email address or a phone number to continue.'
  }

  return errors
}

export function isCheckoutContactValid(values: CheckoutContactValues): boolean {
  return Object.keys(validateCheckoutContact(values)).length === 0
}

/** Splits a single free-text name into the two fields Airpay's payload takes. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  return {
    firstName: parts[0] as string,
    lastName: parts.slice(1).join(' '),
  }
}
