/**
 * Server-side Airpay configuration (AIPAY-DOCS §2).
 *
 * Every value here is a secret held by the serverless function and nothing
 * else. No Airpay variable may ever carry a public build prefix (VITE_,
 * NEXT_PUBLIC_, REACT_APP_): this repository is a Vite app, so a prefixed
 * value is compiled into the browser bundle. All signing happens here; the
 * browser receives only opaque, already-signed fields (§2.3).
 */

export interface AirpayConfig {
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
 * Loads and validates the Airpay credentials.
 *
 * ⚠ PROVEN (§2.2) — the two secrets are swapped relative to Airpay's own
 * onboarding. Against the live gateway:
 *
 *   client_secret = AIRPAY_API_KEY    -> "Invalid client id or secret"
 *   client_secret = AIRPAY_SECRET_KEY -> token issued ✓
 *
 * Each credential is used in exactly one role. Do not swap them back.
 */
export function loadAirpayConfig(): AirpayConfig {
  const env = required('AIRPAY_ENV').toLowerCase()
  if (env !== 'live' && env !== 'sandbox') {
    throw new ConfigError('AIRPAY_ENV must be exactly "live" or "sandbox"')
  }

  return {
    mid: required('AIRPAY_MID'),
    clientId: required('AIRPAY_CLIENT_ID'),
    secretKey: required('AIRPAY_SECRET_KEY'),
    apiKey: required('AIRPAY_API_KEY'),
    username: required('AIRPAY_USERNAME'),
    password: required('AIRPAY_PASSWORD'),
    env,
    verifyUrl: optional('AIRPAY_VERIFY_URL') ?? DEFAULT_VERIFY_URL,
  }
}

/**
 * Order Confirmation works only against a live MID (§10.3). On sandbox the
 * trusted path is unavailable, so an order stays unsettled rather than being
 * marked paid on the strength of an untrusted signal.
 */
export function isLiveMid(config: AirpayConfig): boolean {
  return config.env === 'live'
}
