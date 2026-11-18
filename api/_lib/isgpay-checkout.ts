import { createHmac } from 'node:crypto'

import { hashToken, readSessionToken } from './auth.js'
import { findSessionUser } from './auth-store.js'
import { header, safeEqual, type ApiRequest } from './http.js'

/**
 * Who may see and use ISGPay in the NORMAL website checkout.
 *
 * Always required: ISGPAY_CHECKOUT_ENABLED=true (the option exists at all),
 * separate from ISGPAY_ENABLED, which gates every new ISGPay payment.
 *
 * ISGPAY_ENV=uat (sandbox):
 *   On the Production deployment only, also a tester cookie, minted by
 *   /api/payments/isgpay/tester after the ISGPAY_UAT_ACCESS_KEY was entered
 *   once. Ordinary shoppers on authenticmedia.fun never see the option.
 *   Previews and local dev need only the flag: no real customer pays there.
 *
 * ISGPAY_ENV=production (live money), on the Vercel Production deployment only,
 * and then exactly one of two independent switches, both off by default:
 *   - ISGPAY_PRODUCTION_LAUNCH_ENABLED=true — public launch, every shopper; or
 *   - ISGPAY_LIVE_PRIVATE_TEST_ENABLED=true — private test: only a signed-in,
 *     VERIFIED account whose id is in ISGPAY_LIVE_TESTER_USER_IDS. The account
 *     comes from the server-side session (HttpOnly cookie → auth RPC), never
 *     from a client flag or profile field. Unverified self-registered accounts
 *     can never qualify, whatever id they hold.
 * The sandbox tester cookie / ISGPAY_UAT_ACCESS_KEY never authorise live money.
 */

/** `__Host-`: Secure, Path=/, no Domain — cannot be planted by a subdomain. */
export const TESTER_COOKIE = '__Host-isgpay_tester'
const TESTER_TTL_S = 12 * 60 * 60

/** The UAT tester key, or null when unset/too weak (then nobody is a tester). */
export function uatAccessKey(): string | null {
  const key = process.env['ISGPAY_UAT_ACCESS_KEY']?.trim() ?? ''
  return key.length >= 24 ? key : null
}

function sign(key: string, expiry: number): string {
  return createHmac('sha256', key).update(`isgpay-tester:v1:${expiry}`).digest('base64url')
}

/** Set-Cookie value for a tester. Holds an expiry + HMAC, never the key. */
export function testerCookie(key: string, now: number = Date.now()): string {
  const expiry = Math.floor(now / 1000) + TESTER_TTL_S
  return `${TESTER_COOKIE}=${expiry}.${sign(key, expiry)}; Max-Age=${TESTER_TTL_S}; Path=/; HttpOnly; Secure; SameSite=Lax`
}

function readCookie(req: ApiRequest, name: string): string {
  for (const part of (header(req, 'cookie') ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return ''
}

/** Valid, unexpired tester cookie signed with the CURRENT key (rotating the key revokes all). */
export function isTester(req: ApiRequest, now: number = Date.now()): boolean {
  const key = uatAccessKey()
  if (key === null) return false
  const match = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(readCookie(req, TESTER_COOKIE))
  if (!match) return false
  const expiry = Number(match[1])
  if (expiry * 1000 <= now) return false
  return safeEqual(match[2] as string, sign(key, expiry))
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The allowlisted live tester ids. Malformed entries are dropped, never matched. */
function liveTesterIds(): ReadonlySet<string> {
  const raw = process.env['ISGPAY_LIVE_TESTER_USER_IDS'] ?? ''
  return new Set(raw.split(',').map((id) => id.trim().toLowerCase()).filter((id) => UUID_RE.test(id)))
}

/** The verified, allowlisted account behind this request, or null. Fails closed on any error. */
export async function liveTesterId(req: ApiRequest): Promise<string | null> {
  if (process.env['ISGPAY_LIVE_PRIVATE_TEST_ENABLED'] !== 'true') return null
  const allowed = liveTesterIds()
  const token = readSessionToken(req)
  if (allowed.size === 0 || token === null) return null
  try {
    const user = await findSessionUser(hashToken(token))
    return user !== null && user.email_verified_at !== null && allowed.has(user.id.toLowerCase()) ? user.id : null
  } catch {
    return null
  }
}

export interface CheckoutAccess {
  readonly open: boolean
  /** Set only when access came from the private live-test allowlist (for the audit log). */
  readonly liveTesterId?: string
}

/** Whether this request may be offered / may create an ISGPay checkout order. */
export async function isgpayCheckoutAccess(req: ApiRequest, now: number = Date.now()): Promise<CheckoutAccess> {
  if (process.env['ISGPAY_CHECKOUT_ENABLED'] !== 'true') return { open: false }
  if (process.env['ISGPAY_ENV']?.trim().toLowerCase() === 'production') {
    if (process.env['VERCEL_ENV'] !== 'production') return { open: false }
    if (process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED'] === 'true') return { open: true }
    const id = await liveTesterId(req)
    return id === null ? { open: false } : { open: true, liveTesterId: id }
  }
  return { open: process.env['VERCEL_ENV'] !== 'production' || isTester(req, now) }
}
