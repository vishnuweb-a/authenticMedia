/**
 * Server-side ISGPay (In-Solutions Global, NG Redirection, non-PCI) configuration.
 *
 * Source of truth: ISGPay NG Redirection Non-PCI API Specification v1.6 and the
 * merchant onboarding email. See docs/ISGPAY-UAT-PHASE1.md and
 * docs/ISGPAY-PRODUCTION-READINESS.md (UAT vs production).
 *
 * Entirely separate from the Airpay configuration in config.ts: no variable,
 * type or function is shared, so nothing here can change an Airpay merchant.
 *
 * Every ISGPAY_* value is server-only. None may ever carry VITE_, NEXT_PUBLIC_
 * or REACT_APP_. Errors name the variable, never its value.
 *
 * Nothing loads .env automatically in api/: Vercel injects project variables,
 * `vercel dev` reads .env, and Vitest exposes only VITE_* (to import.meta.env).
 * Config is therefore read from process.env per call, and tests set fixtures.
 */
import { ConfigError } from './config.js'

export { ConfigError }

export type IsgpayEnv = 'uat' | 'production'

export interface IsgpayEndpoints {
  readonly sale: string
  /** null = not confirmed by ISGPay for this merchant → that env fails closed. */
  readonly status: string | null
}

/**
 * The only gateway URLs this code will ever talk to. Caller- or env-supplied
 * URLs must equal one of these exactly; they are never used to choose a host,
 * and nothing from a request ever selects an environment.
 *
 * Production Sale is the host recorded in the ISGPay production-migration
 * guide (PROPOSED, pending merchant confirmation). Production Status is null:
 * its URL and transport are unconfirmed, and settlement depends on it, so
 * ISGPAY_ENV=production cannot load until a reviewed code change sets it.
 * See docs/ISGPAY-PRODUCTION-READINESS.md.
 */
export const ISGPAY_ENDPOINTS: Readonly<Record<IsgpayEnv, IsgpayEndpoints>> = {
  uat: {
    sale: 'https://sandbox.isgpay.com/ISGPay-Genius/request.action',
    status: 'https://sandbox.isgpay.com/ISGPay-Genius/Status',
  },
  production: {
    sale: 'https://isgpay.com/ISGPay-Genius/request.action',
    status: null,
  },
}

/** Hosts our own ReturnURL / callback URL may point at. */
export const APPROVED_RETURN_HOSTS: readonly string[] = ['authenticmedia.fun', 'www.authenticmedia.fun']

/**
 * On a Vercel Preview deployment only, this deployment's own hostnames are
 * also approved (UAT runs there). VERCEL_ENV / VERCEL_BRANCH_URL / VERCEL_URL
 * are set by the platform, not by a request, so the URL is still always ours.
 */
function approvedReturnHosts(): readonly string[] {
  if (process.env['VERCEL_ENV'] !== 'preview') return APPROVED_RETURN_HOSTS
  const own = [process.env['VERCEL_BRANCH_URL'], process.env['VERCEL_URL']]
    .map((host) => host?.trim().toLowerCase())
    .filter((host): host is string => Boolean(host) && /^[a-z0-9-]+\.vercel\.app$/.test(host as string))
  return [...APPROVED_RETURN_HOSTS, ...own]
}

/** The existing Airpay callback path. ISGPay must never be pointed at it. */
const AIRPAY_CALLBACK_PATH = '/callback/cpm/arp_frontiva'

/**
 * The three credentials, held in private fields so that JSON.stringify,
 * console.log and object spreads of a config never reveal them.
 */
export class IsgpaySecrets {
  readonly #passCode: string
  readonly #secureSecret: string
  readonly #encKey: string

  constructor(passCode: string, secureSecret: string, encKey: string) {
    this.#passCode = passCode
    this.#secureSecret = secureSecret
    this.#encKey = encKey
  }

  get passCode(): string {
    return this.#passCode
  }
  get secureSecret(): string {
    return this.#secureSecret
  }
  get encKey(): string {
    return this.#encKey
  }

  toJSON(): string {
    return '[redacted]'
  }
}

export interface IsgpayConfig {
  readonly enabled: boolean
  readonly env: IsgpayEnv
  /** Strings, never numbers: BankId "000004" keeps its leading zeros. */
  readonly bankId: string
  readonly merchantId: string
  readonly terminalId: string
  readonly mcc: string
  readonly currency: '356'
  readonly saleUrl: string
  readonly statusUrl: string
  readonly returnUrl: string
  readonly callbackUrl: string | undefined
  readonly secrets: IsgpaySecrets
}

function read(name: string): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

function requiredMatching(name: string, pattern: RegExp, rule: string): string {
  const value = read(name)
  if (!value) throw new ConfigError(`Missing required environment variable: ${name}`)
  if (!pattern.test(value)) throw new ConfigError(`${name} is malformed (expected ${rule})`)
  return value
}

/** The env URL must be exactly the allowlisted endpoint: same origin, path, no query/fragment. */
function pinnedUrl(name: string, expected: string): string {
  const value = read(name)
  if (!value) throw new ConfigError(`Missing required environment variable: ${name}`)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ConfigError(`${name} is not a valid URL`)
  }
  const want = new URL(expected)
  if (url.protocol !== 'https:' || url.origin !== want.origin || url.pathname !== want.pathname || url.search || url.hash || url.username || url.password) {
    throw new ConfigError(`${name} must be the approved endpoint for this ISGPAY_ENV`)
  }
  return expected
}

function ownUrl(name: string, isRequired: boolean): string | undefined {
  const value = read(name)
  if (!value) {
    if (isRequired) throw new ConfigError(`Missing required environment variable: ${name}`)
    return undefined
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ConfigError(`${name} is not a valid URL`)
  }
  if (url.protocol !== 'https:') throw new ConfigError(`${name} must use https`)
  if (!approvedReturnHosts().includes(url.hostname) || url.port || url.username || url.password) {
    throw new ConfigError(`${name} must point at an approved Authentic Media host`)
  }
  // No query/fragment: keeps tokens (e.g. a Vercel protection bypass) out of gateway-held URLs.
  if (url.search || url.hash) throw new ConfigError(`${name} must not carry a query string or fragment`)
  if (url.pathname.startsWith(AIRPAY_CALLBACK_PATH)) {
    throw new ConfigError(`${name} must not point at the Airpay callback`)
  }
  // v1.6 §3.1.1: ReturnURL 1–255; '|' and '::' would corrupt EncData.
  if (value.length > 255 || value.includes('|') || value.includes('::')) {
    throw new ConfigError(`${name} is malformed`)
  }
  return value
}

function readEnabled(): boolean {
  const value = read('ISGPAY_ENABLED').toLowerCase()
  if (value === '' || value === 'false') return false
  if (value === 'true') return true
  throw new ConfigError('ISGPAY_ENABLED must be exactly "true" or "false"')
}

/**
 * Loads and validates the ISGPay configuration. Throws ConfigError naming only
 * the offending variable. Does NOT require ISGPAY_ENABLED=true — use
 * assertInitiationEnabled before starting a new payment.
 *
 * Field rules come from v1.6 §3.1.1 / §3.2.1 lengths and types.
 */
export function loadIsgpayConfig(endpointTable: Readonly<Record<IsgpayEnv, IsgpayEndpoints>> = ISGPAY_ENDPOINTS): IsgpayConfig {
  const enabled = readEnabled()

  const env = read('ISGPAY_ENV').toLowerCase()
  if (env !== 'uat' && env !== 'production') {
    throw new ConfigError('ISGPAY_ENV must be "uat" or "production"')
  }
  // Live credentials belong to the Production deployment only: a Preview or
  // local run that inherits them refuses to start rather than take real money.
  if (env === 'production' && process.env['VERCEL_ENV'] !== 'production') {
    throw new ConfigError('ISGPAY_ENV=production is allowed only on the Vercel Production deployment')
  }
  const endpoints = endpointTable[env]
  const statusEndpoint = endpoints.status
  if (statusEndpoint === null) {
    throw new ConfigError(`ISGPAY_ENV=${env}: the Status endpoint is not confirmed by ISGPay`)
  }

  requiredMatching('ISGPAY_CURRENCY', /^356$/, '356 (INR)')
  const returnUrl = ownUrl('ISGPAY_RETURN_URL', true)
  if (returnUrl === undefined) throw new ConfigError('Missing required environment variable: ISGPAY_RETURN_URL')

  return {
    enabled,
    env,
    bankId: requiredMatching('ISGPAY_BANK_ID', /^[A-Za-z0-9]{6}$/, '6 alphanumeric characters'),
    merchantId: requiredMatching('ISGPAY_MERCHANT_ID', /^[A-Za-z0-9]{1,16}$/, '1-16 alphanumeric characters'),
    terminalId: requiredMatching('ISGPAY_TERMINAL_ID', /^[A-Za-z0-9]{8}$/, '8 alphanumeric characters'),
    // The merchant email's MCC is used as given; it differs from the PDF sample (docs).
    mcc: requiredMatching('ISGPAY_MCC', /^\d{4}$/, '4 digits'),
    currency: '356',
    saleUrl: pinnedUrl('ISGPAY_SALE_URL', endpoints.sale),
    statusUrl: pinnedUrl('ISGPAY_STATUS_URL', statusEndpoint),
    returnUrl,
    callbackUrl: ownUrl('ISGPAY_CALLBACK_URL', false),
    secrets: new IsgpaySecrets(
      requiredMatching('ISGPAY_PASSCODE', /^[A-Za-z0-9]{8}$/, '8 alphanumeric characters'),
      requiredMatching('ISGPAY_SECURE_SECRET', /^[A-Za-z0-9]{16,128}$/, '16-128 alphanumeric characters'),
      // AES-256 key = the 32 characters' own bytes (legacy kit), so exactly 32 printable ASCII.
      requiredMatching('ISGPAY_ENC_KEY', /^[\x21-\x7e]{32}$/, '32 printable ASCII characters'),
    ),
  }
}

export class IsgpayDisabledError extends Error {
  constructor() {
    super('ISGPay payment initiation is disabled (ISGPAY_ENABLED is not "true")')
  }
}

/** Gate for NEW payment initiation only. Status checks and crypto do not need it. */
export function assertInitiationEnabled(config: IsgpayConfig): void {
  if (!config.enabled) throw new IsgpayDisabledError()
}
