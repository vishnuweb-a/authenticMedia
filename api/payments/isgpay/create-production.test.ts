import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import { CONFIRMED_TEST_ENDPOINTS, installIsgpayEnv, PRODUCTION_FIXTURE_SECRETS, setProductionEnv } from '../../_lib/isgpay-test-fixture.js'

/**
 * POST /api/payments/isgpay/create under ISGPAY_ENV=production, as it will
 * behave once ISGPay confirms the production Status URL (stand-in table).
 * Synthetic credentials; no network, no database, no payment.
 */

vi.mock('../../_lib/isgpay-config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../_lib/isgpay-config.js')>()
  return { ...actual, loadIsgpayConfig: () => actual.loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS) }
})

const db = vi.hoisted(() => ({ rpc: [] as Array<{ fn: string; args: Record<string, unknown> }> }))

vi.mock('../../_lib/db.js', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({
        in: (_col: string, slugs: string[]) => ({ eq: async () => ({ data: slugs.map((slug) => ({ slug })), error: null }) }),
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpc.push({ fn, args })
      return { data: [{ total_inr: 149, access_token: 'tok-uuid' }], error: null }
    },
  }),
}))

const handler = (await import('./create.js')).default
const { testerCookie } = await import('../../_lib/isgpay-checkout.js')

installIsgpayEnv()

const KEY = 'a-long-random-uat-tester-key-0123456789'
const GUEST = '11111111-1111-4111-8111-111111111111'

async function call(r: Partial<ApiRequest>) {
  const out = { code: 0, body: undefined as unknown }
  const res: ApiResponse = {
    status(c) { out.code = c; return res },
    setHeader() { return res },
    json(b) { out.body = b },
    send(b) { out.body = b },
    end() {},
  }
  await handler({ headers: {}, ...r }, res)
  return out
}

const body = {
  serviceSlugs: ['website-security-audit'],
  guestToken: GUEST,
  contact: { firstName: 'Test', lastName: 'Customer', email: 'test@example.com', phone: '9999999999' },
}

beforeEach(() => {
  db.rpc.length = 0
  setProductionEnv()
  process.env['ISGPAY_ENABLED'] = 'true'
  process.env['ISGPAY_CHECKOUT_ENABLED'] = 'true'
  process.env['ISGPAY_UAT_ACCESS_KEY'] = KEY
  delete process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED']
})

describe('production launch gate', () => {
  it('is closed by default: hidden, and POST creates nothing', async () => {
    expect((await call({ method: 'GET' })).body).toEqual({ available: false, testMode: true })
    expect((await call({ method: 'POST', body })).code).toBe(404)
    expect(db.rpc).toHaveLength(0)
  })

  it('a sandbox tester cookie never unlocks live payments', async () => {
    const cookie = testerCookie(KEY).split(';')[0] as string
    expect((await call({ method: 'GET', headers: { cookie } })).body).toMatchObject({ available: false })
    expect((await call({ method: 'POST', headers: { cookie }, body })).code).toBe(404)
  })

  it.each(['TRUE', '1', 'yes', ''])('only the exact string "true" opens it (got %j)', async (value) => {
    process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED'] = value
    expect((await call({ method: 'GET' })).body).toMatchObject({ available: false })
  })

  it('stays closed when ISGPAY_ENABLED or ISGPAY_CHECKOUT_ENABLED is off (independent rollbacks)', async () => {
    process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED'] = 'true'
    process.env['ISGPAY_ENABLED'] = 'false'
    expect((await call({ method: 'GET' })).body).toMatchObject({ available: false })
    process.env['ISGPAY_ENABLED'] = 'true'
    process.env['ISGPAY_CHECKOUT_ENABLED'] = 'false'
    expect((await call({ method: 'GET' })).body).toMatchObject({ available: false })
  })
})

describe('approved production release', () => {
  beforeEach(() => {
    process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED'] = 'true'
  })

  it('is offered to every shopper as live (testMode false)', async () => {
    expect((await call({ method: 'GET' })).body).toEqual({ available: true, testMode: false })
  })

  it('creates a production-stamped order with contact details and hands off to the live Sale URL', async () => {
    const out = await call({ method: 'POST', body })
    expect(out.code).toBe(200)
    const res = out.body as Record<string, unknown>
    expect(res['testMode']).toBe(false)
    expect(res['actionUrl']).toBe('https://isgpay.com/ISGPay-Genius/request.action')
    expect(Object.keys(res['fields'] as object).sort()).toEqual(['BankId', 'EncData', 'MerchantId', 'TerminalId'])
    expect(db.rpc[0]?.args).toMatchObject({
      p_gateway_environment: 'production',
      p_contact_name: 'Test Customer',
      p_contact_email: 'test@example.com',
      p_contact_phone: '9999999999',
    })
    const text = JSON.stringify(out.body)
    for (const secret of PRODUCTION_FIXTURE_SECRETS) expect(text).not.toContain(secret)
  })

  it('logs no credential, customer contact or EncData', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const out = await call({ method: 'POST', body })
    const lines = log.mock.calls.map((c) => c.join(' ')).join(' | ')
    log.mockRestore()
    expect(lines).toContain('isgpay.checkout.initiated')
    for (const value of [...PRODUCTION_FIXTURE_SECRETS, 'test@example.com', '9999999999', (out.body as { fields: { EncData: string } }).fields.EncData]) {
      expect(lines).not.toContain(value)
    }
  })

  it('the client cannot choose the environment or the gateway URL', async () => {
    await call({ method: 'POST', body: { ...body, environment: 'uat', gatewayEnvironment: 'uat', actionUrl: 'https://evil.example/' } })
    expect(db.rpc[0]?.args['p_gateway_environment']).toBe('production')
  })
})
