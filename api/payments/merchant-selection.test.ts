import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../_lib/http.js'

/**
 * POST /api/payments/create — the SHOPPER'S merchant selection (AIPAY-DOCS §2.4).
 *
 * The checkout now offers both Airpay merchants side by side and the shopper
 * picks one. This file covers what that selection may and may not do.
 *
 * The properties under test:
 *
 *   - a valid selection creates ONE order, for exactly the chosen merchant,
 *     signed with only that merchant's credentials;
 *   - an absent, malformed or out-of-range selection is REFUSED, never guessed,
 *     and creates nothing;
 *   - nothing else in the request body can name, describe, override or reach
 *     inside a merchant configuration.
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

const oauth = vi.hoisted(() => ({ configs: [] as Array<{ mid: string; merchant: number }> }))

vi.mock('../_lib/db.js', () => ({
  getServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc.calls.push({ fn, args })
      return rpc.result
    },
  }),
}))

vi.mock('../_lib/airpay.js', () => ({
  getAccessToken: async (config: { mid: string; merchant: number }) => {
    // Records WHICH credential set actually reached the gateway.
    oauth.configs.push({ mid: config.mid, merchant: config.merchant })
    return 'oauth-token'
  },
}))

const handler = (await import('./create.js')).default
const { decrypt } = await import('../_lib/airpay-crypto.js')
const { loadAirpayConfig } = await import('../_lib/config.js')

const GUEST = '11111111-1111-4111-8111-111111111111'
const MID_1 = '368250'
const MID_2 = '362380'

/** Placeholder values only. Never a real credential. */
const ENV: Record<string, string> = {
  AIRPAY_ENV: 'live',
  AIRPAY_MID: MID_1,
  AIRPAY_CLIENT_ID: 'm1-client-placeholder',
  AIRPAY_SECRET_KEY: 'm1-oauth-secret-placeholder',
  AIRPAY_API_KEY: 'm1-api-key-placeholder',
  AIRPAY_USERNAME: 'm1-user-placeholder',
  AIRPAY_PASSWORD: 'm1-pass-placeholder',
  AIRPAY_MID_2: MID_2,
  AIRPAY_CLIENT_ID_2: 'm2-client-placeholder',
  AIRPAY_SECRET_KEY_2: 'm2-oauth-secret-placeholder',
  AIRPAY_API_KEY_2: 'm2-api-key-placeholder',
  AIRPAY_USERNAME_2: 'm2-user-placeholder',
  AIRPAY_PASSWORD_2: 'm2-pass-placeholder',
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

/** A well-formed checkout for the named merchant, plus anything hostile. */
function checkout(merchant: unknown, extra: Record<string, unknown> = {}): ApiRequest {
  return post({
    serviceSlugs: ['a-service'],
    guestToken: GUEST,
    contact: CONTACT,
    merchant,
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
  delete process.env['AIRPAY_ACTIVE_MERCHANT']
})

/** The order reference the handler actually recorded on the row. */
function recordedRef(): string {
  return String(rpc.calls[0]?.args['p_order_ref'] ?? '')
}

describe('1/2. the selection decides the order reference', () => {
  it('1. merchant=1 creates an AM- order', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(1), res)

    expect(captured.code).toBe(200)
    expect((captured.body as { orderRef: string }).orderRef).toMatch(/^AM-/)
    // And it is the reference actually persisted, not just the one returned.
    expect(recordedRef()).toMatch(/^AM-/)
  })

  it('2. merchant=2 creates an AM2- order', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(2), res)

    expect(captured.code).toBe(200)
    expect((captured.body as { orderRef: string }).orderRef).toMatch(/^AM2-/)
    expect(recordedRef()).toMatch(/^AM2-/)
  })

  it('accepts the decimal STRING form a JSON body may carry', async () => {
    const { res, captured } = mockRes()
    await handler(checkout('2'), res)

    expect(captured.code).toBe(200)
    expect(recordedRef()).toMatch(/^AM2-/)
  })
})

describe('3/4. the selection loads ONLY that merchant credential set', () => {
  it('3. merchant=1 signs with the FIRST credential set and no other', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(1), res)

    // The token was minted for MID 368250.
    expect(oauth.configs).toEqual([{ mid: MID_1, merchant: 1 }])

    // And the envelope opens with merchant 1's key — which only works if
    // merchant 1's key sealed it. Merchant 2's must NOT open it.
    const fields = (captured.body as { fields: Record<string, string> }).fields
    expect(decrypt(fields['encdata'] as string, loadAirpayConfig(1))).not.toBeNull()
    expect(decrypt(fields['encdata'] as string, loadAirpayConfig(2))).toBeNull()
    expect(fields['merchant_id']).toBe(MID_1)
  })

  it('4. merchant=2 signs with the SECOND credential set and no other', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(2), res)

    expect(oauth.configs).toEqual([{ mid: MID_2, merchant: 2 }])

    const fields = (captured.body as { fields: Record<string, string> }).fields
    expect(decrypt(fields['encdata'] as string, loadAirpayConfig(2))).not.toBeNull()
    expect(decrypt(fields['encdata'] as string, loadAirpayConfig(1))).toBeNull()
    expect(fields['merchant_id']).toBe(MID_2)
  })

  it('never contacts BOTH merchants for one checkout action', async () => {
    for (const merchant of [1, 2] as const) {
      oauth.configs = []
      const { res } = mockRes()
      await handler(checkout(merchant), res)
      // Exactly one gateway conversation, with exactly one credential set.
      expect(oauth.configs).toHaveLength(1)
      expect(oauth.configs[0]?.merchant).toBe(merchant)
    }
  })
})

describe('5/6/7/8. an unusable selection is refused, never guessed', () => {
  /**
   * Documented behaviour: there is NO default. A missing selection is a 400.
   * The alternative — quietly picking one — signs a real payment with a
   * merchant nobody chose, which is exactly what this change removed.
   */
  const REFUSED: Array<[string, unknown]> = [
    ['5. missing entirely', undefined],
    ['5. explicitly null', null],
    ['5. an empty string', ''],
    ['6. zero', 0],
    ['6. the string "0"', '0'],
    ['7. three', 3],
    ['7. the string "3"', '3'],
    ['8. the real MID of merchant 1', MID_1],
    ['8. the real MID of merchant 2', MID_2],
    ['8. an arbitrary MID string', '999999'],
    ['a padded index', '01'],
    ['a whitespace-padded index', ' 1 '],
    ['a boolean', true],
    ['an array', [1]],
    ['an object', { merchant: 1 }],
    ['a negative index', -1],
    ['a float', 1.5],
  ]

  for (const [label, value] of REFUSED) {
    it(`refuses ${label} with 400 and creates NOTHING`, async () => {
      const { res, captured } = mockRes()
      await handler(checkout(value), res)

      expect(captured.code).toBe(400)
      expect(captured.body).toEqual({ error: 'invalid_request' })
      // Fail closed and fail early: no order row, no OAuth token, no payment.
      expect(rpc.calls).toEqual([])
      expect(oauth.configs).toEqual([])
    })
  }

  it('says nothing about WHY — validation detail stays server-side (§7.2)', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(3), res)

    const serialised = JSON.stringify(captured.body)
    expect(serialised).not.toContain('merchant')
    expect(serialised).not.toContain(MID_1)
    expect(serialised).not.toContain(MID_2)
  })
})

describe('9/10. the client cannot supply or override a merchant configuration', () => {
  /**
   * The hostile body: a client sending its own credentials, its own MID, its
   * own gateway and its own callback URL alongside a valid selection.
   *
   * None of these is read anywhere in the handler, so the assertion is that
   * the payment is signed exactly as if they had not been sent at all.
   */
  const HOSTILE = {
    mid: '999999',
    mercid: '999999',
    AIRPAY_MID: '999999',
    username: 'attacker',
    password: 'attacker',
    clientId: 'attacker-client',
    client_id: 'attacker-client',
    secretKey: 'attacker-secret',
    apiKey: 'attacker-api-key',
    verifyUrl: 'https://attacker.example/verify/',
    callbackUrl: 'https://attacker.example/callback',
    config: { mid: '999999', username: 'attacker' },
    env: 'sandbox',
  }

  it('9. ignores credentials sent beside a VALID selection', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(1, HOSTILE), res)

    expect(captured.code).toBe(200)
    // Signed with the server's merchant 1, exactly as an ordinary checkout.
    expect(oauth.configs).toEqual([{ mid: MID_1, merchant: 1 }])

    const fields = (captured.body as { fields: Record<string, string> }).fields
    expect(fields['merchant_id']).toBe(MID_1)

    // Nothing the attacker sent reached the gateway payload.
    const plaintext = decrypt(fields['encdata'] as string, loadAirpayConfig(1))
    expect(plaintext).not.toBeNull()
    for (const value of ['attacker', '999999', 'attacker.example']) {
      expect(plaintext as string).not.toContain(value)
    }
    expect(JSON.stringify(captured.body)).not.toContain('attacker')
  })

  it('10. a hostile config cannot redirect merchant 2 either', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(2, HOSTILE), res)

    expect(oauth.configs).toEqual([{ mid: MID_2, merchant: 2 }])
    const fields = (captured.body as { fields: Record<string, string> }).fields
    expect(fields['merchant_id']).toBe(MID_2)
    expect(recordedRef()).toMatch(/^AM2-/)
  })

  it('10. cannot forge an order reference for the other merchant', async () => {
    // A reference sent by a client is ignored: it is generated from the
    // VALIDATED selection, so it can never disagree with the credentials that
    // signed the payment — which is what settlement later reads it for.
    const { res } = mockRes()
    await handler(
      checkout(2, { orderRef: 'AM-FORGED-11111111', reference: 'AM-FORGED-11111111' }),
      res,
    )

    expect(recordedRef()).toMatch(/^AM2-/)
    expect(recordedRef()).not.toContain('FORGED')
  })

  it('9. reads no credential from the body — proven at the source', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('api/payments/create.ts', 'utf8')
    // Every credential-shaped read from the request body, in one assertion.
    for (const field of [
      'body.mid',
      'body.mercid',
      'body.username',
      'body.password',
      'body.clientId',
      'body.secretKey',
      'body.apiKey',
      'body.config',
      'body.verifyUrl',
      'body.callbackUrl',
      'body.orderRef',
    ]) {
      expect(source).not.toContain(field)
    }
    // The ONLY merchant-shaped read is the index, and it goes through the
    // allowlist rather than into a config.
    expect(source).toContain('parseMerchantSelection(body?.merchant)')
  })
})

describe('14. one checkout action creates exactly one payment', () => {
  it('inserts exactly ONE order row per request', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(2), res)

    expect(captured.code).toBe(200)
    expect(rpc.calls).toHaveLength(1)
    expect(rpc.calls[0]?.fn).toBe('create_airpay_order')
    expect(oauth.configs).toHaveLength(1)
  })

  it('gives two separate requests two INDEPENDENT orders', async () => {
    // The two merchants' attempts share nothing: different references,
    // different credentials, and neither is aware of the other.
    const first = mockRes()
    await handler(checkout(1), first.res)
    const firstRef = (first.captured.body as { orderRef: string }).orderRef

    rpc.calls = []
    const second = mockRes()
    await handler(checkout(2), second.res)
    const secondRef = (second.captured.body as { orderRef: string }).orderRef

    expect(firstRef).toMatch(/^AM-/)
    expect(secondRef).toMatch(/^AM2-/)
    expect(firstRef).not.toBe(secondRef)
    expect(oauth.configs).toEqual([
      { mid: MID_1, merchant: 1 },
      { mid: MID_2, merchant: 2 },
    ])
  })
})

describe('a selected merchant that is unconfigured fails closed', () => {
  it('refuses rather than falling back to the other credential set', async () => {
    delete process.env['AIRPAY_SECRET_KEY_2']

    const { res, captured } = mockRes()
    await handler(checkout(2), res)

    expect(captured.code).toBe(503)
    expect(captured.body).toEqual({ error: 'payments_unavailable' })
    // The dangerous failure would be signing a merchant-2 checkout with
    // merchant 1's credentials. Nothing was created and nothing was signed.
    expect(rpc.calls).toEqual([])
    expect(oauth.configs).toEqual([])
  })

  it('leaves merchant 1 working while merchant 2 is unconfigured', async () => {
    for (const name of Object.keys(ENV).filter((n) => n.endsWith('_2'))) {
      delete process.env[name]
    }

    const { res, captured } = mockRes()
    await handler(checkout(1), res)

    expect(captured.code).toBe(200)
    expect(oauth.configs).toEqual([{ mid: MID_1, merchant: 1 }])
  })
})
