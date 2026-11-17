import { createHmac } from 'node:crypto'

import { header, safeEqual, type ApiRequest } from './http.js'

/**
 * Who may see and use ISGPay (UAT sandbox) in the NORMAL website checkout.
 *
 * Two server-held controls, both required:
 *   1. ISGPAY_CHECKOUT_ENABLED=true — the checkout option exists at all.
 *      Separate from ISGPAY_ENABLED, which gates every new ISGPay payment.
 *   2. On the Production deployment only: a tester cookie, minted by
 *      /api/payments/isgpay/tester after the ISGPAY_UAT_ACCESS_KEY was entered
 *      once. Ordinary shoppers on authenticmedia.fun never see the option.
 *
 * Previews and local dev need only (1): no real customer pays there.
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

/** Whether this request may be offered / may create an ISGPay checkout order. */
export function isgpayCheckoutOpen(req: ApiRequest, now: number = Date.now()): boolean {
  if (process.env['ISGPAY_CHECKOUT_ENABLED'] !== 'true') return false
  return process.env['VERCEL_ENV'] !== 'production' || isTester(req, now)
}
