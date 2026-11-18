import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig } from '../../_lib/isgpay-config.js'
import { openEnvelope } from '../../_lib/isgpay-crypto.js'
import { FIXTURE_SECRETS, installIsgpayEnv } from '../../_lib/isgpay-test-fixture.js'

/**
 * POST /api/payments/isgpay/create — normal-checkout ISGPay (UAT) hand-off.
 * Synthetic fixture credentials only; no network, no database, no payment.
 */

const PRICES: Record<string, number> = { 'website-security-audit': 149, 'seo-audit': 499, 'retired-thing': 99 }
const ACTIVE = new Set(['website-security-audit', 'seo-audit'])

const db = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  lookups: 0,
}))

vi.mock('../../_lib/db.js', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({
        in: (_col: string, slugs: string[]) => ({
          eq: async () => {
            db.lookups += 1
            return { data: slugs.filter((s) => ACTIVE.has(s)).map((slug) => ({ slug })), error: null }
          },
        }),
      }),
    }),
    // Priced like create_isgpay_order: the catalogue sum of ACTIVE slugs.
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpc.push({ fn, args })
      const slugs = args['p_service_slugs'] as string[]
      const total = slugs.filter((s) => ACTIVE.has(s)).reduce((sum, s) => sum + (PRICES[s] ?? 0), 0)
      return { data: [{ total_inr: total, access_token: 'tok-uuid' }], error: null }
    },
  }),
}))

const handler = (await import('./create.js')).default
const tester = (await import('./tester.js')).default
const { testerCookie, TESTER_COOKIE } = await import('../../_lib/isgpay-checkout.js')

installIsgpayEnv()

const GUEST = '11111111-1111-4111-8111-111111111111'
const KEY = 'a-long-random-uat-tester-key-0123456789'

function mockRes() {
  const out = { code: 0, body: undefined as unknown, headers: {} as Record<string, string> }
  const res: ApiResponse = {
    status(c) { out.code = c; return res },
    setHeader(n, v) { out.headers[n] = v; return res },
    json(b) { out.body = b },
    send(b) { out.body = b },
    end() {},
  }
  return { res, out }
}

async function call(r: Partial<ApiRequest>) {
  const { res, out } = mockRes()
  await handler({ headers: {}, ...r }, res)
  return out
}

const post = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  call({ method: 'POST', headers, body })

const validBody = (overrides: Record<string, unknown> = {}) => ({
  serviceSlugs: ['website-security-audit'],
  guestToken: GUEST,
  contact: { firstName: 'Test', lastName: 'Customer', email: 'test@example.com', phone: '9999999999' },
  ...overrides,
})

beforeEach(() => {
  db.rpc.length = 0
  db.lookups = 0
  process.env['ISGPAY_ENABLED'] = 'true'
  process.env['ISGPAY_CHECKOUT_ENABLED'] = 'true'
  process.env['ISGPAY_UAT_ACCESS_KEY'] = KEY
  delete process.env['VERCEL_ENV']
})

describe('availability (GET)', () => {
  it('is offered on preview/dev when the checkout flag is on', async () => {
    expect((await call({ method: 'GET' })).body).toEqual({ available: true, testMode: true })
  })

  it('is hidden when the checkout flag is off, or ISGPAY_ENABLED is off', async () => {
    process.env['ISGPAY_CHECKOUT_ENABLED'] = 'false'
    expect((await call({ method: 'GET' })).body).toMatchObject({ available: false })
    process.env['ISGPAY_CHECKOUT_ENABLED'] = 'true'
    process.env['ISGPAY_ENABLED'] = 'false'
    expect((await call({ method: 'GET' })).body).toMatchObject({ available: false })
  })

  it('on production, is offered only to a browser holding a valid tester cookie', async () => {
    process.env['VERCEL_ENV'] = 'production'
    expect((await call({ method: 'GET' })).body).toMatchObject({ available: false })

    const cookie = testerCookie(KEY).split(';')[0] as string
    expect((await call({ method: 'GET', headers: { cookie } })).body).toMatchObject({ available: true })

    // Forged, expired, or signed with a rotated key → no.
    const forged = `${TESTER_COOKIE}=9999999999.${'A'.repeat(43)}`
    expect((await call({ method: 'GET', headers: { cookie: forged } })).body).toMatchObject({ available: false })
    const expired = testerCookie(KEY, Date.now() - 13 * 3600_000).split(';')[0] as string
    expect((await call({ method: 'GET', headers: { cookie: expired } })).body).toMatchObject({ available: false })
    process.env['ISGPAY_UAT_ACCESS_KEY'] = 'a-different-rotated-key-9876543210'
    expect((await call({ method: 'GET', headers: { cookie } })).body).toMatchObject({ available: false })
  })

  it('the tester cookie never contains the key', () => {
    const value = testerCookie(KEY)
    expect(value).not.toContain(KEY)
    expect(value).toMatch(/HttpOnly; Secure; SameSite=Lax/)
  })
})

describe('create (POST)', () => {
  it('is 404 and creates nothing when testing is not open to this request', async () => {
    process.env['VERCEL_ENV'] = 'production'
    const out = await post(validBody())
    expect(out.code).toBe(404)
    expect(db.rpc).toHaveLength(0)
  })

  it('creates a catalogue-priced ISG order and returns the sandbox hand-off', async () => {
    const out = await post(validBody())
    expect(out.code).toBe(200)
    const body = out.body as Record<string, unknown>
    expect(body['orderRef']).toMatch(/^ISG[0-9A-Z]{8}[0-9A-F]{16}$/)
    expect(body['accessToken']).toBe('tok-uuid')
    expect(body['amount']).toBe(149)
    expect(body['testMode']).toBe(true)
    expect(body['actionUrl']).toBe('https://sandbox.isgpay.com/ISGPay-Genius/request.action')
    expect(Object.keys(body['fields'] as object).sort()).toEqual(['BankId', 'EncData', 'MerchantId', 'TerminalId'])

    const call0 = db.rpc[0]
    expect(call0?.fn).toBe('create_isgpay_order')
    expect(call0?.args['p_order_ref']).toBe(body['orderRef'])
    expect(call0?.args['p_guest_token']).toBe(GUEST)
    expect(call0?.args['p_gateway_environment']).toBe('uat')
    expect(call0?.args['p_contact_email']).toBe('test@example.com')
  })

  it('the production launch flag does not open the UAT sandbox to non-testers', async () => {
    process.env['VERCEL_ENV'] = 'production'
    process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED'] = 'true'
    expect((await call({ method: 'GET' })).body).toMatchObject({ available: false })
    expect((await post(validBody())).code).toBe(404)
  })

  it('prices from the database, ignoring any client amount', async () => {
    const out = await post(validBody({ amount: 1, price: 1, total: 1 }))
    const body = out.body as { amount: number; orderRef: string; fields: { EncData: string } }
    expect(body.amount).toBe(149)
    const opened = openEnvelope(body.fields.EncData, loadIsgpayConfig().secrets)
    if (!opened.ok) throw new Error('envelope did not open')
    expect(opened.fields['Amount']).toBe('14900')
    expect(opened.fields['TxnRefNo']).toBe(body.orderRef)
    expect(Object.keys(db.rpc[0]?.args ?? {})).not.toContain('p_amount')
  })

  it('totals multiple services, deduplicating repeats', async () => {
    const out = await post(validBody({ serviceSlugs: ['website-security-audit', 'seo-audit', 'seo-audit'] }))
    const body = out.body as { amount: number; fields: { EncData: string } }
    expect(body.amount).toBe(648)
    expect(db.rpc[0]?.args['p_service_slugs']).toEqual(['website-security-audit', 'seo-audit'])
    const opened = openEnvelope(body.fields.EncData, loadIsgpayConfig().secrets)
    expect(opened.ok && opened.fields['Amount']).toBe('64800')
  })

  it('refuses a basket with an unknown or inactive service rather than charge a subset', async () => {
    const out = await post(validBody({ serviceSlugs: ['website-security-audit', 'retired-thing'] }))
    expect(out.code).toBe(400)
    expect(out.body).toEqual({ error: 'invalid_services' })
    expect(db.rpc).toHaveLength(0)
  })

  it('validates slugs, guest token and contact before touching the database', async () => {
    for (const body of [
      validBody({ serviceSlugs: [] }),
      validBody({ serviceSlugs: ['../etc'] }),
      validBody({ serviceSlugs: 'website-security-audit' }),
      validBody({ guestToken: 'nope' }),
      validBody({ contact: {} }),
    ]) {
      expect((await post(body)).code).toBe(400)
    }
    expect(db.lookups).toBe(0)
    expect(db.rpc).toHaveLength(0)
  })

  it('never puts a credential in the response', async () => {
    const out = await post(validBody())
    const text = JSON.stringify(out.body)
    for (const secret of FIXTURE_SECRETS) expect(text).not.toContain(secret)
  })

  it('each request is a fresh order reference (no client-supplied reference)', async () => {
    const a = (await post(validBody({ orderRef: 'ISG00000000AAAAAAAAAAAAAAAA' }))).body as { orderRef: string }
    const b = (await post(validBody())).body as { orderRef: string }
    expect(a.orderRef).not.toBe('ISG00000000AAAAAAAAAAAAAAAA')
    expect(a.orderRef).not.toBe(b.orderRef)
  })
})

describe('tester unlock', () => {
  async function unlock(r: Partial<ApiRequest>) {
    const { res, out } = mockRes()
    await tester({ headers: {}, ...r }, res)
    return out
  }

  it('is 404 when no access key is configured', async () => {
    delete process.env['ISGPAY_UAT_ACCESS_KEY']
    expect((await unlock({ method: 'GET' })).code).toBe(404)
  })

  it('a wrong key sets no cookie', async () => {
    const out = await unlock({ method: 'POST', body: { key: 'wrong' } })
    expect(out.code).toBe(403)
    expect(out.headers['Set-Cookie']).toBeUndefined()
  })

  it('the right key sets a cookie that opens production checkout', async () => {
    const out = await unlock({ method: 'POST', body: { key: KEY } })
    expect(out.code).toBe(200)
    const cookie = (out.headers['Set-Cookie'] ?? '').split(';')[0] as string
    expect(cookie.startsWith(`${TESTER_COOKIE}=`)).toBe(true)
    process.env['VERCEL_ENV'] = 'production'
    expect((await call({ method: 'GET', headers: { cookie } })).body).toMatchObject({ available: true })
  })
})
