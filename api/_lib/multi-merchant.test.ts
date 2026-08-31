import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { aesKey, privateKey } from './airpay-crypto.js'
import { activeMerchant, loadAirpayConfig } from './config.js'
import { generateOrderRef, merchantForOrderRef } from './order-ref.js'

/**
 * Multi-merchant regression tests (AIPAY-DOCS §2.4, AGENTS.md §30.9).
 *
 * Every value below is a PLACEHOLDER. No real credential appears in this file,
 * no live MID is contacted, and no payment is created.
 *
 * The load-bearing properties under test:
 *
 *   - merchant 1 (the production-proven account) is never displaced;
 *   - an order settles against the merchant that CREATED it, forever;
 *   - no client input can select or override a merchant;
 *   - merchant 2 is never relayed, so no callback loop can be constructed.
 */

/** Placeholder values only. Never a real credential. */
const M1: Record<string, string> = {
  AIRPAY_MID: '368250',
  AIRPAY_CLIENT_ID: 'm1-client-placeholder',
  AIRPAY_SECRET_KEY: 'm1-oauth-secret-placeholder',
  AIRPAY_API_KEY: 'm1-api-key-placeholder',
  AIRPAY_USERNAME: 'm1-user-placeholder',
  AIRPAY_PASSWORD: 'm1-pass-placeholder',
}

const M2: Record<string, string> = {
  AIRPAY_MID_2: '362380',
  AIRPAY_CLIENT_ID_2: 'm2-client-placeholder',
  AIRPAY_SECRET_KEY_2: 'm2-oauth-secret-placeholder',
  AIRPAY_API_KEY_2: 'm2-api-key-placeholder',
  AIRPAY_USERNAME_2: 'm2-user-placeholder',
  AIRPAY_PASSWORD_2: 'm2-pass-placeholder',
}

const KEYS = [...Object.keys(M1), ...Object.keys(M2), 'AIRPAY_ENV', 'AIRPAY_ACTIVE_MERCHANT']
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  for (const [k, v] of Object.entries({ ...M1, ...M2 })) process.env[k] = v
  process.env['AIRPAY_ENV'] = 'live'
})

afterEach(() => {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

function walkFiles(dir: string, match: RegExp, out: string[] = []): string[] {
  let entries: Array<{ name: string; isDirectory: () => boolean }>
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`
    if (entry.isDirectory()) walkFiles(full, match, out)
    else if (match.test(entry.name)) out.push(full)
  }
  return out
}

describe('1/2. both credential sets load from their own variables (§2.4)', () => {
  it('1. merchant 1 still loads from the ORIGINAL unsuffixed names', () => {
    const config = loadAirpayConfig(1)
    expect(config.merchant).toBe(1)
    expect(config.mid).toBe('368250')
    expect(config.username).toBe(M1['AIRPAY_USERNAME'])
    // The PROVEN §2.2 secret roles survive per merchant.
    expect(config.secretKey).toBe(M1['AIRPAY_SECRET_KEY'])
    expect(config.apiKey).toBe(M1['AIRPAY_API_KEY'])
  })

  it('1. defaults to merchant 1 when called with no argument', () => {
    // Every pre-existing call site is unsuffixed and must stay so.
    expect(loadAirpayConfig().mid).toBe('368250')
    expect(loadAirpayConfig().merchant).toBe(1)
  })

  it('2. merchant 2 loads from the _2 variables', () => {
    const config = loadAirpayConfig(2)
    expect(config.merchant).toBe(2)
    expect(config.mid).toBe('362380')
    expect(config.username).toBe(M2['AIRPAY_USERNAME_2'])
    expect(config.secretKey).toBe(M2['AIRPAY_SECRET_KEY_2'])
    expect(config.apiKey).toBe(M2['AIRPAY_API_KEY_2'])
  })

  it('shares AIRPAY_ENV, so the live-MID guard is unambiguous for both (§10.3)', () => {
    process.env['AIRPAY_ENV'] = 'sandbox'
    expect(loadAirpayConfig(1).env).toBe('sandbox')
    expect(loadAirpayConfig(2).env).toBe('sandbox')
  })
})

describe('3. a missing _2 credential fails closed', () => {
  for (const name of Object.keys(M2)) {
    it(`refuses to load merchant 2 without ${name}, naming it without its value`, () => {
      const value = process.env[name] ?? ''
      delete process.env[name]
      expect(() => loadAirpayConfig(2)).toThrow(new RegExp(name))
      // Names the variable, never the value (§9.8).
      try {
        loadAirpayConfig(2)
      } catch (error) {
        expect(String((error as Error).message)).not.toContain(value)
      }
    })
  }

  it('does NOT silently fall back to merchant 1 when _2 is absent', () => {
    delete process.env['AIRPAY_MID_2']
    // The dangerous failure would be returning MID 368250 here: merchant 2
    // traffic would then be signed with merchant 1's credentials.
    expect(() => loadAirpayConfig(2)).toThrow()
  })

  it('merchant 1 keeps working when merchant 2 is entirely unconfigured', () => {
    for (const name of Object.keys(M2)) delete process.env[name]
    expect(loadAirpayConfig(1).mid).toBe('368250')
  })
})

describe('4. merchant 1 credentials are never replaced by the _2 set', () => {
  it('holds every field distinct across the two configs', () => {
    const a = loadAirpayConfig(1)
    const b = loadAirpayConfig(2)

    expect(a.mid).not.toBe(b.mid)
    expect(a.clientId).not.toBe(b.clientId)
    expect(a.secretKey).not.toBe(b.secretKey)
    expect(a.apiKey).not.toBe(b.apiKey)
    expect(a.username).not.toBe(b.username)
    expect(a.password).not.toBe(b.password)
  })

  it('is unaffected by AIRPAY_ACTIVE_MERCHANT being set to 2', () => {
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    // The switch chooses which merchant takes NEW orders. It must never
    // rewrite what merchant 1 IS — otherwise pending 368250 orders would
    // settle against the wrong credentials.
    expect(loadAirpayConfig(1).mid).toBe('368250')
    expect(loadAirpayConfig(1).username).toBe(M1['AIRPAY_USERNAME'])
  })

  it('8. derives DIFFERENT crypto material per merchant (§3.1, §3.2)', () => {
    const a = loadAirpayConfig(1)
    const b = loadAirpayConfig(2)
    // If these ever collided, one merchant could open the other's envelope.
    expect(privateKey(a)).not.toBe(privateKey(b))
    expect(aesKey(a).equals(aesKey(b))).toBe(false)
  })
})

describe('5/17. no merchant credential reaches the browser', () => {
  it('5. no Airpay variable carries a public build prefix', () => {
    const text = readFileSync('.env.example', 'utf8')
    // A VITE_/NEXT_PUBLIC_/REACT_APP_ prefix compiles the value into the
    // bundle (§2.3). This must hold for the _2 set exactly as for the first.
    expect(text).not.toMatch(/(VITE_|NEXT_PUBLIC_|REACT_APP_)AIRPAY/)
  })

  it('5. .env.example documents the _2 names as empty placeholders', () => {
    const text = readFileSync('.env.example', 'utf8')
    for (const name of Object.keys(M2)) {
      expect(text).toMatch(new RegExp(`^${name}=\\s*$`, 'm'))
    }
  })

  it('17. nothing under src/ reads an Airpay credential or the merchant switch', () => {
    const offenders = walkFiles('src', /\.(ts|tsx|js|jsx)$/).filter((file) =>
      /AIRPAY_[A-Z0-9_]+/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('17. the built client bundle contains no merchant credential', () => {
    if (!existsSync('dist')) return
    const secrets = [...Object.values(M1), ...Object.values(M2)].filter((v) =>
      v.includes('placeholder'),
    )
    const offenders = walkFiles('dist', /\.(js|mjs|css|html)$/).filter((file) => {
      const text = readFileSync(file, 'utf8')
      if (/AIRPAY_(SECRET_KEY|API_KEY|PASSWORD|USERNAME|CLIENT_ID|MID)/.test(text)) return true
      return secrets.some((value) => text.includes(value))
    })
    expect(offenders).toEqual([])
  })
})

describe('16. the merchant switch is server-side and unforgeable', () => {
  it('defaults to merchant 1 when unset', () => {
    expect(activeMerchant()).toBe(1)
  })

  it('selects merchant 2 only on exactly "2"', () => {
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    expect(activeMerchant()).toBe(2)
  })

  it('falls back to merchant 1 on any unrecognised value', () => {
    // A typo must never divert live traffic away from the proven merchant.
    for (const bad of ['', '  ', '0', '3', 'two', 'true', '02', '362380', 'M362380']) {
      process.env['AIRPAY_ACTIVE_MERCHANT'] = bad
      expect(activeMerchant()).toBe(1)
    }
  })

  it('reads ONLY the environment — no request can influence it', () => {
    const source = readFileSync('api/_lib/config.ts', 'utf8')
    const fn = source.slice(source.indexOf('export function activeMerchant'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    // The whole function is one environment read. If a request, body, query,
    // header or callback field ever appears here, a client could choose the
    // merchant that signs its payment.
    expect(body).toContain("optional('AIRPAY_ACTIVE_MERCHANT')")
    expect(body).not.toMatch(/\breq\b|request|query|header|body|params/i)
  })
})

describe('the order reference carries the merchant (§2.4)', () => {
  it('keeps merchant 1 on the UNCHANGED AM- prefix', () => {
    // Every reference already in production carries this exact shape.
    expect(generateOrderRef(Date.now(), 1)).toMatch(/^AM-[0-9A-Z]{5}-[0-9a-f]{8}$/)
    expect(generateOrderRef()).toMatch(/^AM-[0-9A-Z]{5}-[0-9a-f]{8}$/)
  })

  it('gives merchant 2 its own AM2- prefix', () => {
    expect(generateOrderRef(Date.now(), 2)).toMatch(/^AM2-[0-9A-Z]{5}-[0-9a-f]{8}$/)
  })

  it('round-trips the merchant through the reference', () => {
    for (const merchant of [1, 2] as const) {
      expect(merchantForOrderRef(generateOrderRef(Date.now(), merchant))).toBe(merchant)
    }
  })

  it('resolves anything unrecognised to merchant 1, never merchant 2', () => {
    for (const ref of ['', 'AM-1-2', 'XX-1-2', 'am2-1-2', 'AM3-1-2', 'nonsense', 'AM', 'AM2']) {
      expect(merchantForOrderRef(ref)).toBe(1)
    }
  })

  it('stays unguessable for both merchants (§7.5)', () => {
    const now = Date.now()
    const refs = new Set(Array.from({ length: 500 }, () => generateOrderRef(now, 2)))
    expect(refs.size).toBe(500)
  })
})
