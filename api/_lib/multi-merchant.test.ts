import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { aesKey, privateKey } from './airpay-crypto.js'
import { loadAirpayConfig, parseMerchantSelection } from './config.js'
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

  it('is unaffected by which merchant a shopper just selected', () => {
    // A selection chooses which merchant takes ONE new order. It must never
    // rewrite what merchant 1 IS — otherwise pending 368250 orders would
    // settle against the wrong credentials.
    expect(parseMerchantSelection(2)).toBe(2)
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

describe('16. the merchant selection is an allowlisted index, never a config', () => {
  it('1/2. accepts exactly 1 and 2, as a number or its decimal string', () => {
    expect(parseMerchantSelection(1)).toBe(1)
    expect(parseMerchantSelection(2)).toBe(2)
    expect(parseMerchantSelection('1')).toBe(1)
    expect(parseMerchantSelection('2')).toBe(2)
  })

  it('5. rejects a MISSING selection rather than guessing one', () => {
    // Documented behaviour: no default. A payment must never be signed by a
    // merchant nobody chose, and silently picking one is how that happens.
    for (const missing of [undefined, null, '']) {
      expect(parseMerchantSelection(missing)).toBeNull()
    }
  })

  it('6/7. rejects 0 and 3 — the allowlist is exhaustive, not a range', () => {
    expect(parseMerchantSelection(0)).toBeNull()
    expect(parseMerchantSelection('0')).toBeNull()
    expect(parseMerchantSelection(3)).toBeNull()
    expect(parseMerchantSelection('3')).toBeNull()
  })

  it('8. rejects an arbitrary MID string, including the two real ones', () => {
    // A client naming a MID is the whole attack this allowlist exists to stop.
    for (const mid of ['368250', '362380', 'MID368250', '000000', '99999']) {
      expect(parseMerchantSelection(mid)).toBeNull()
    }
  })

  it('9/10. rejects anything shaped like a credential or a configuration', () => {
    for (const hostile of [
      { mid: '368250', username: 'u', password: 'p' },
      { merchant: 1, secretKey: 's' },
      { clientId: 'c', apiKey: 'k' },
      { verifyUrl: 'https://attacker.example/verify/' },
      ['1'],
      [1],
      true,
      1.0000001,
      ' 1 ',
      '01',
      '1e0',
      'one',
      NaN,
      Infinity,
      () => 1,
    ]) {
      expect(parseMerchantSelection(hostile)).toBeNull()
    }
  })

  it('9. a rejected selection cannot smuggle a value into a loaded config', () => {
    // Even the closest near-miss returns null, so loadAirpayConfig is never
    // reached with anything but the literal 1 or 2 this function produced.
    const chosen = parseMerchantSelection({ merchant: 2, mid: '362380' })
    expect(chosen).toBeNull()
    // And what a VALID selection produces is a plain index — nothing the caller
    // sent travels with it.
    expect(parseMerchantSelection('2')).toBe(2)
    expect(loadAirpayConfig(2).mid).toBe('362380')
  })

  it('reads ONLY its argument — no environment switch remains', () => {
    const source = readFileSync('api/_lib/config.ts', 'utf8')
    const fn = source.slice(source.indexOf('export function parseMerchantSelection'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    // The whole function is one allowlist over its own argument. If it ever
    // read process.env again, two conflicting selection mechanisms would exist.
    expect(body).not.toContain('process.env')
    expect(body).not.toContain('AIRPAY_')
  })

  it('AIRPAY_ACTIVE_MERCHANT is gone and nothing reads it', () => {
    // The old global switch routed EVERY new payment to one merchant. It is
    // removed rather than left dormant, so there is exactly one mechanism that
    // chooses a merchant for a new order: the shopper's validated selection.
    // Tests are excluded deliberately: two of them NAME the variable in order
    // to prove it is inert. What must hold is that no shipping code reads it.
    const offenders = [...walkFiles('api', /\.(ts|js)$/), ...walkFiles('src', /\.(ts|tsx)$/)]
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes('AIRPAY_ACTIVE_MERCHANT'))
    expect(offenders).toEqual([])
  })

  it('setting AIRPAY_ACTIVE_MERCHANT has no effect on anything', () => {
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    // It cannot select a merchant, and it cannot rewrite what either one IS.
    expect(parseMerchantSelection(undefined)).toBeNull()
    expect(loadAirpayConfig(1).mid).toBe('368250')
    expect(loadAirpayConfig(2).mid).toBe('362380')
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
