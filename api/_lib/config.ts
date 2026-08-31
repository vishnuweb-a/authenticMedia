/**
 * Server-side Airpay configuration (AIPAY-DOCS §2).
 *
 * Every value here is a secret held by the serverless function and nothing
 * else. No Airpay variable may ever carry a public build prefix (VITE_,
 * NEXT_PUBLIC_, REACT_APP_): this repository is a Vite app, so a prefixed
 * value is compiled into the browser bundle. All signing happens here; the
 * browser receives only opaque, already-signed fields (§2.3).
 */

/**
 * Which of the two Airpay merchant accounts a value belongs to (§2.4).
 *
 * `1` is the original, production-proven merchant and stays the default
 * everywhere. `2` is the second account, whose credentials live in the
 * `_2`-suffixed variables and whose callbacks Airpay delivers DIRECTLY to
 * KKChat rather than to this application.
 */
export type MerchantId = 1 | 2

export interface AirpayConfig {
  /** Which credential set this config was loaded from. */
  readonly merchant: MerchantId
  readonly mid: string
  readonly clientId: string
  /** OAuth2 client_secret. NOT the privatekey secret — see below. */
  readonly secretKey: string
  /** The `secret` in the privatekey derivation. NOT the OAuth secret. */
  readonly apiKey: string
  readonly username: string
  readonly password: string
  readonly env: 'live' | 'sandbox'
  readonly verifyUrl: string
}

export class ConfigError extends Error {}

/**
 * Reads a required variable.
 *
 * Throws naming only the variable, never its value, so a misconfiguration is
 * diagnosable from logs without leaking a credential (§9.8).
 */
function required(name: string): string {
  const raw = process.env[name]
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) throw new ConfigError(`Missing required environment variable: ${name}`)
  return value
}

/**
 * Reads an optional variable, normalising blank to undefined.
 *
 * Edge case 43: AIRPAY_VERIFY_URL defined-but-empty fails URL validation and
 * takes *all* payments down. An empty string must read as "not set".
 */
export function optional(name: string): string | undefined {
  const raw = process.env[name]
  const value = typeof raw === 'string' ? raw.trim() : ''
  return value === '' ? undefined : value
}

export const DEFAULT_VERIFY_URL = 'https://kraken.airpay.co.in/airpay/pay/v4/api/verify/'
export const OAUTH_URL = 'https://kraken.airpay.co.in/airpay/pay/v4/api/oauth2/'
export const HOSTED_PAYMENT_URL = 'https://payments.airpay.co.in/pay/v4/'

/**
 * The environment-variable suffix for a merchant (§2.4).
 *
 * Merchant 1 reads the ORIGINAL unsuffixed names and must keep doing so: those
 * variables are live in production for MID 368250 and are not ours to rename.
 * Merchant 2 reads the same names with `_2` appended. Nothing else differs —
 * both sets are read through the same `required()`, so a missing credential in
 * either fails closed and names only the variable, never its value.
 */
function suffix(merchant: MerchantId): string {
  return merchant === 1 ? '' : `_${merchant}`
}

/**
 * Loads and validates one merchant's Airpay credentials.
 *
 * ⚠ PROVEN (§2.2) — the two secrets are swapped relative to Airpay's own
 * onboarding. Against the live gateway:
 *
 *   client_secret = AIRPAY_API_KEY    -> "Invalid client id or secret"
 *   client_secret = AIRPAY_SECRET_KEY -> token issued ✓
 *
 * Each credential is used in exactly one role. Do not swap them back.
 *
 * AIRPAY_ENV is deliberately NOT suffixed: it states which Airpay world this
 * deployment talks to, and one deployment cannot be live for one merchant and
 * sandbox for the other. A single value keeps §10.3's live-MID guard
 * unambiguous for both.
 */
export function loadAirpayConfig(merchant: MerchantId = 1): AirpayConfig {
  const env = required('AIRPAY_ENV').toLowerCase()
  if (env !== 'live' && env !== 'sandbox') {
    throw new ConfigError('AIRPAY_ENV must be exactly "live" or "sandbox"')
  }

  const s = suffix(merchant)

  return {
    merchant,
    mid: required(`AIRPAY_MID${s}`),
    clientId: required(`AIRPAY_CLIENT_ID${s}`),
    secretKey: required(`AIRPAY_SECRET_KEY${s}`),
    apiKey: required(`AIRPAY_API_KEY${s}`),
    username: required(`AIRPAY_USERNAME${s}`),
    password: required(`AIRPAY_PASSWORD${s}`),
    env,
    // The verify URL override is shared: it points at Airpay's gateway, which
    // is the same host for every merchant.
    verifyUrl: optional('AIRPAY_VERIFY_URL') ?? DEFAULT_VERIFY_URL,
  }
}

/**
 * The merchant that takes NEW orders (§2.4).
 *
 * ⚠ Server-side only, and deliberately the ONLY input to the choice. It is
 * read from the environment and from nowhere else — never from a request body,
 * a query parameter, a header, a callback field, the basket, the amount, or
 * anything a browser can influence. A client cannot select a merchant.
 *
 * Unset, blank or unrecognised means merchant 1. That default is load-bearing:
 * a typo, a missing variable or a stray value must leave the production-proven
 * MID 368250 flow exactly as it is rather than diverting live traffic.
 *
 * This is a SWITCH, not a routing policy. It answers "which merchant takes
 * payments from now on"; if traffic must ever be divided between the two by a
 * business rule, that rule replaces this function and nothing else — every
 * other part of the integration derives the merchant from the order reference.
 */
export function activeMerchant(): MerchantId {
  return optional('AIRPAY_ACTIVE_MERCHANT') === '2' ? 2 : 1
}

/**
 * Order Confirmation works only against a live MID (§10.3). On sandbox the
 * trusted path is unavailable, so an order stays unsettled rather than being
 * marked paid on the strength of an untrusted signal.
 */
export function isLiveMid(config: AirpayConfig): boolean {
  return config.env === 'live'
}
