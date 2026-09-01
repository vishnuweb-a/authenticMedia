import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../_lib/http.js'

/**
 * POST /api/payments/create — the SINGLE-MERCHANT architecture.
 *
 * This application standardises on ONE Airpay merchant, MID 368250, read from
 * the ORIGINAL unsuffixed environment variables. There is no merchant index,
 * no `_2` credential set and no AIRPAY_ACTIVE_MERCHANT switch anywhere.
 *
 * The properties under test:
 *
 *   - every order is created for MID 368250 and signed with those credentials;
 *   - every reference generated is AM-, and never AM2-;
 *   - a `merchant` field in the request body is inert — it is neither required
 *     nor read, and its value changes nothing;
 *   - no `_2` variable and no AIRPAY_ACTIVE_MERCHANT is ever consulted;
 *   - nothing in the request body can name, describe, override or reach inside
 *     the merchant configuration.
 *
 * Every credential below is a placeholder. No live MID is contacted, no
 * database is touched, and no payment is created.
 */

const rpc = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  result: {
    data: [{ id: 'order-uuid', total_inr: 1499, access_token: 'tok' }],
    error: null as unknown,
  },
}))

const oauth = vi.hoisted(() => ({ configs: [] as Array<{ mid: string }> }))

vi.mock('../_lib/db.js', () => ({
  getServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc.calls.push({ fn, args })
      return rpc.result
    },
  }),
}))

vi.mock('../_lib/airpay.js', () => ({
  getAccessToken: async (config: { mid: string }) => {
    // Records WHICH credential set actually reached the gateway.
    oauth.configs.push({ mid: config.mid })
    return 'oauth-token'
  },
}))

const handler = (await import('./create.js')).default
const { decrypt } = await import('../_lib/airpay-crypto.js')
const { loadAirpayConfig } = await import('../_lib/config.js')

const GUEST = '11111111-1111-4111-8111-111111111111'

/** The one merchant. */
const MID = '368250'

/** The merchant that no longer exists in this application. */
const RETIRED_MID = '362380'

/** Placeholder values only. Never a real credential. */
const ENV: Record<string, string> = {
  AIRPAY_ENV: 'live',
  AIRPAY_MID: MID,
  AIRPAY_CLIENT_ID: 'client-placeholder',
  AIRPAY_SECRET_KEY: 'oauth-secret-placeholder',
  AIRPAY_API_KEY: 'api-key-placeholder',
  AIRPAY_USERNAME: 'user-placeholder',
  AIRPAY_PASSWORD: 'pass-placeholder',
}

/**
 * The variables that must never be read again. They are SET to obviously wrong
 * values in most tests below, so any code that still consults one shows up as a
 * failed assertion rather than as silence.
 */
const RETIRED_ENV: Record<string, string> = {
  AIRPAY_MID_2: RETIRED_MID,
  AIRPAY_CLIENT_ID_2: 'retired-client-placeholder',
  AIRPAY_SECRET_KEY_2: 'retired-oauth-secret-placeholder',
  AIRPAY_API_KEY_2: 'retired-api-key-placeholder',
  AIRPAY_USERNAME_2: 'retired-user-placeholder',
  AIRPAY_PASSWORD_2: 'retired-pass-placeholder',
  AIRPAY_ACTIVE_MERCHANT: '2',
}

interface Captured {
  code: number
  body: unknown
}

function mockRes(): { res: ApiResponse; captured: Captured } {
  const captured: Captured = { code: 0, body: null }
  const res: ApiResponse = {
    status(code) {
      captured.code = code
      return res
    },
    setHeader() {
      return res
    },
    json(body) {
      captured.body = body
    },
    send(body) {
      captured.body = body
    },
    end() {},
  }
  return { res, captured }
}

const CONTACT = { email: 'shopper@example.com', firstName: 'Ada', lastName: 'L' }

function post(body: Record<string, unknown>): ApiRequest {
  return { method: 'POST', headers: {}, body } as ApiRequest
}

/** A well-formed checkout, plus anything hostile. */
function checkout(extra: Record<string, unknown> = {}): ApiRequest {
  return post({
    serviceSlugs: ['a-service'],
    guestToken: GUEST,
    contact: CONTACT,
    ...extra,
  })
}

beforeEach(() => {
  rpc.calls = []
  rpc.result = {
    data: [{ id: 'order-uuid', total_inr: 1499, access_token: 'tok' }],
    error: null,
  }
  oauth.configs = []
  for (const [name, value] of Object.entries(ENV)) process.env[name] = value
  for (const [name, value] of Object.entries(RETIRED_ENV)) process.env[name] = value
})

/** The order reference the handler actually recorded on the row. */
function recordedRef(): string {
  return String(rpc.calls[0]?.args['p_order_ref'] ?? '')
}

describe('1. every order belongs to the single merchant', () => {
  it('creates an AM- order with no merchant field in the request at all', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(), res)

    expect(captured.code).toBe(200)
    expect(recordedRef()).toMatch(/^AM-/)
    expect(recordedRef()).not.toMatch(/^AM2-/)
  })

  it('signs with MID 368250 and contacts exactly one merchant', async () => {
    const { res } = mockRes()
    await handler(checkout(), res)

    expect(oauth.configs).toEqual([{ mid: MID }])
  })

  it('addresses the envelope to the single merchant, and encrypts under its key', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(), res)

    const body = captured.body as { fields: Record<string, string> }

    // The MID travels as the outer envelope field; the payload inside carries
    // the order, and is readable only under this merchant's key.
    expect(body.fields['merchant_id']).toBe(MID)
    expect(body.fields['merchant_id']).not.toBe(RETIRED_MID)

    const plaintext = decrypt(body.fields['encdata'] ?? '', loadAirpayConfig())
    expect(plaintext).not.toBeNull()
    expect(plaintext).toContain('AM-')
    expect(plaintext).not.toContain(RETIRED_MID)
  })

  it('never generates an AM2- reference, over many orders', async () => {
    for (let i = 0; i < 40; i += 1) {
      rpc.calls = []
      const { res } = mockRes()
      await handler(checkout(), res)
      expect(recordedRef()).toMatch(/^AM-[0-9A-Z]{1,5}-[0-9a-f]{8}$/)
    }
  })
})

describe('2. the request body cannot select a merchant', () => {
  /**
   * The endpoint no longer accepts a merchant selection. A body carrying one
   * must not be refused for lacking a valid selection, and must not be diverted
   * by the value it carries: the field is simply not read.
   */
  const IGNORED: ReadonlyArray<readonly [string, unknown]> = [
    ['merchant=1', 1],
    ['merchant=2', 2],
    ['merchant as the string "2"', '2'],
    ['merchant=99', 99],
    ['merchant=null', null],
    ['merchant as an object', { mid: RETIRED_MID }],
    ['merchant as an array', [2]],
  ]

  for (const [label, value] of IGNORED) {
    it(`ignores ${label} — one AM- order for MID 368250 either way`, async () => {
      const { res, captured } = mockRes()
      await handler(checkout({ merchant: value }), res)

      expect(captured.code).toBe(200)
      expect(recordedRef()).toMatch(/^AM-/)
      expect(oauth.configs).toEqual([{ mid: MID }])
    })
  }

  it('succeeds with NO merchant field — it is never required', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(), res)

    expect(captured.code).toBe(200)
    expect(rpc.calls).toHaveLength(1)
  })

  it('does not echo a returnsToSite or merchant field back to the browser', async () => {
    const { res, captured } = mockRes()
    await handler(checkout({ merchant: 2, returnsToSite: false }), res)

    const body = captured.body as Record<string, unknown>
    expect(body['returnsToSite']).toBeUndefined()
    expect(body['merchant']).toBeUndefined()
  })
})

describe('3. the client cannot supply or override a merchant configuration', () => {
  const HOSTILE: Record<string, unknown> = {
    mid: RETIRED_MID,
    merchant_id: RETIRED_MID,
    AIRPAY_MID: RETIRED_MID,
    AIRPAY_MID_2: RETIRED_MID,
    username: 'attacker',
    password: 'attacker',
    clientId: 'attacker',
    secretKey: 'attacker',
    apiKey: 'attacker',
    verifyUrl: 'https://attacker.example/verify/',
    callbackUrl: 'https://attacker.example/callback',
    config: { mid: RETIRED_MID },
  }

  it('ignores credentials and MIDs sent in the body', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(HOSTILE), res)

    expect(captured.code).toBe(200)
    expect(oauth.configs).toEqual([{ mid: MID }])

    const body = captured.body as { fields: Record<string, string> }
    expect(body.fields['merchant_id']).toBe(MID)

    const plaintext = decrypt(body.fields['encdata'] ?? '', loadAirpayConfig())
    expect(plaintext).not.toBeNull()
    expect(plaintext).not.toContain('attacker')
    expect(plaintext).not.toContain(RETIRED_MID)
  })

  it('cannot forge an AM2- order reference', async () => {
    const { res } = mockRes()
    await handler(
      checkout({ orderRef: 'AM2-FORGE-deadbeef', p_order_ref: 'AM2-FORGE-deadbeef' }),
      res,
    )

    expect(recordedRef()).toMatch(/^AM-/)
  })

  it('reads no merchant selection from the body — proven at the source', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('./create.ts', import.meta.url), 'utf8')

    for (const forbidden of [
      'body?.merchant',
      'body.merchant',
      'body?.mid',
      'body?.config',
      'parseMerchantSelection',
      'returnsToSite',
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})

describe('4. the retired merchant-2 environment is never consulted', () => {
  it('loads MID 368250 even while every _2 variable is set to something else', () => {
    const config = loadAirpayConfig()

    expect(config.mid).toBe(MID)
    expect(config.clientId).toBe(ENV['AIRPAY_CLIENT_ID'])
    expect(config.secretKey).toBe(ENV['AIRPAY_SECRET_KEY'])
    expect(config.apiKey).toBe(ENV['AIRPAY_API_KEY'])
    expect(config.username).toBe(ENV['AIRPAY_USERNAME'])
    expect(config.password).toBe(ENV['AIRPAY_PASSWORD'])
  })

  it('still works when NO _2 variable exists at all', async () => {
    for (const name of Object.keys(RETIRED_ENV)) delete process.env[name]

    const { res, captured } = mockRes()
    await handler(checkout(), res)

    expect(captured.code).toBe(200)
    expect(loadAirpayConfig().mid).toBe(MID)
    expect(oauth.configs).toEqual([{ mid: MID }])
  })

  it('never reads a _2 variable or AIRPAY_ACTIVE_MERCHANT — proven at the source', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs')

    const root = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`
        if (statSync(full).isDirectory()) walk(full)
        else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) files.push(full)
      }
    }
    walk(root)

    expect(files.length).toBeGreaterThan(5)

    for (const file of files) {
      // Comments are stripped: what matters is that no CODE reads these, and a
      // note recording that they were retired is not a read.
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')

      expect(code).not.toMatch(/AIRPAY_(MID|USERNAME|PASSWORD|CLIENT_ID|SECRET_KEY|API_KEY)_2/)
      expect(code).not.toContain('AIRPAY_ACTIVE_MERCHANT')
      expect(code).not.toContain('AM2-')
      expect(code).not.toContain('parseMerchantSelection')
      expect(code).not.toContain('merchantForOrderRef')
    }
  })

  it('fails closed when the single merchant is unconfigured', async () => {
    delete process.env['AIRPAY_MID']

    const { res, captured } = mockRes()
    await handler(checkout(), res)

    // No silent fallback to any other credential set, and no order created.
    expect(captured.code).toBe(503)
    expect(rpc.calls).toHaveLength(0)
  })
})

describe('5. one checkout action creates exactly one payment', () => {
  it('inserts exactly ONE order row per request', async () => {
    const { res } = mockRes()
    await handler(checkout(), res)

    expect(rpc.calls).toHaveLength(1)
    expect(rpc.calls[0]?.fn).toBe('create_airpay_order')
  })

  it('gives two separate requests two independent AM- orders', async () => {
    const first = mockRes()
    await handler(checkout(), first.res)
    const firstRef = recordedRef()

    rpc.calls = []
    const second = mockRes()
    await handler(checkout(), second.res)
    const secondRef = recordedRef()

    expect(firstRef).toMatch(/^AM-/)
    expect(secondRef).toMatch(/^AM-/)
    expect(firstRef).not.toBe(secondRef)
  })
})
