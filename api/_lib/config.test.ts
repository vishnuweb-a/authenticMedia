import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_VERIFY_URL, isLiveMid, loadAirpayConfig, optional } from './config.js'
import { generateOrderRef } from './order-ref.js'

/** Placeholder values only. Never a real credential. */
const FIXTURE: Record<string, string> = {
  AIRPAY_MID: '366950',
  AIRPAY_CLIENT_ID: 'client-placeholder',
  AIRPAY_SECRET_KEY: 'oauth-secret-placeholder',
  AIRPAY_API_KEY: 'api-key-placeholder',
  AIRPAY_USERNAME: 'user-placeholder',
  AIRPAY_PASSWORD: 'pass-placeholder',
  AIRPAY_ENV: 'live',
}

const KEYS = [...Object.keys(FIXTURE), 'AIRPAY_VERIFY_URL']
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(FIXTURE)) process.env[key] = value
})

afterEach(() => {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('environment configuration (§2)', () => {
  it('loads a complete environment', () => {
    const config = loadAirpayConfig()
    expect(config.mid).toBe('366950')
    expect(config.env).toBe('live')
    expect(config.verifyUrl).toBe(DEFAULT_VERIFY_URL)
  })

  it('keeps the two secrets in distinct roles (⚠ PROVEN §2.2)', () => {
    const config = loadAirpayConfig()
    // secretKey is the OAuth client_secret; apiKey is the privatekey secret.
    expect(config.secretKey).toBe('oauth-secret-placeholder')
    expect(config.apiKey).toBe('api-key-placeholder')
    expect(config.secretKey).not.toBe(config.apiKey)
  })

  it('fails closed on a missing variable, naming it without its value', () => {
    delete process.env['AIRPAY_PASSWORD']
    expect(() => loadAirpayConfig()).toThrow(/AIRPAY_PASSWORD/)
  })

  it('rejects an AIRPAY_ENV that is neither live nor sandbox', () => {
    process.env['AIRPAY_ENV'] = 'staging'
    expect(() => loadAirpayConfig()).toThrow(/AIRPAY_ENV/)
  })

  it('edge case 43 — a blank AIRPAY_VERIFY_URL reads as unset, not as ""', () => {
    process.env['AIRPAY_VERIFY_URL'] = '   '
    expect(optional('AIRPAY_VERIFY_URL')).toBeUndefined()
    // Defined-but-empty would otherwise fail URL validation and take ALL
    // payments down.
    expect(loadAirpayConfig().verifyUrl).toBe(DEFAULT_VERIFY_URL)
  })

  it('honours an explicit AIRPAY_VERIFY_URL override', () => {
    process.env['AIRPAY_VERIFY_URL'] = 'https://example.invalid/custom/'
    expect(loadAirpayConfig().verifyUrl).toBe('https://example.invalid/custom/')
  })

  it('uses /verify/, never the 404-ing /orderconfirmation/ (edge case 6)', () => {
    expect(DEFAULT_VERIFY_URL).toMatch(/\/verify\/$/)
    expect(DEFAULT_VERIFY_URL).not.toContain('orderconfirmation')
  })

  it('treats only a live MID as verifiable (§10.3)', () => {
    expect(isLiveMid(loadAirpayConfig())).toBe(true)
    process.env['AIRPAY_ENV'] = 'sandbox'
    expect(isLiveMid(loadAirpayConfig())).toBe(false)
  })
})

describe('order references (§7.5)', () => {
  it('uses the AM- prefix and a hex CSPRNG suffix', () => {
    expect(generateOrderRef()).toMatch(/^AM-[0-9A-Z]{5}-[0-9a-f]{8}$/)
  })

  it('does not repeat within the same millisecond', () => {
    const now = Date.now()
    const refs = new Set(Array.from({ length: 500 }, () => generateOrderRef(now)))
    // A Math.random()-based or time-only reference would collide here.
    expect(refs.size).toBe(500)
  })
})
