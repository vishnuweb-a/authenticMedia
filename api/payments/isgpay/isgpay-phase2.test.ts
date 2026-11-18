import { beforeEach, describe, expect, it, vi } from 'vitest'

import { hashToken } from '../../_lib/auth.js'
import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import { CONFIRMED_TEST_ENDPOINTS, installIsgpayEnv, PRODUCTION_FIXTURE_SECRETS, setProductionEnv } from '../../_lib/isgpay-test-fixture.js'

/**
 * Phase 2: private live-test authorisation, duplicate-payment protection and the
 * ISGPay reconcile sweep. Synthetic credentials; no network, database or payment.
 */

vi.mock('../../_lib/isgpay-config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../_lib/isgpay-config.js')>()
  return { ...actual, loadIsgpayConfig: () => actual.loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS) }
})

const state = vi.hoisted(() => ({
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  unresolved: null as null | { reference: string },
  unresolvedThrows: false,
  sessions: new Map<string, { id: string; email_verified_at: string | null }>(),
  sessionThrows: false,
  settle: (async () => ({ outcome: 'pending' })) as (ref: string) => Promise<{ outcome: string }>,
  settled: [] as string[],
  sweep: [] as Array<{ reference: string }>,
  sweepArgs: [] as unknown[][],
}))

vi.mock('../../_lib/db.js', () => ({
  getServiceClient: () => ({
    from: () => ({
      select: () => ({
        in: (_c: string, slugs: string[]) => ({ eq: async () => ({ data: slugs.map((slug) => ({ slug })), error: null }) }),
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpc.push({ fn, args })
      return { data: [{ total_inr: 149, access_token: 'tok-uuid' }], error: null }
    },
  }),
  findUnresolvedIsgpayOrder: async () => {
    if (state.unresolvedThrows) throw new Error('db down')
    return state.unresolved
  },
  findUnsettledIsgpayOrders: async (...args: unknown[]) => {
    state.sweepArgs.push(args)
    return state.sweep
  },
}))

vi.mock('../../_lib/auth-store.js', () => ({
  findSessionUser: async (tokenHash: string) => {
    if (state.sessionThrows) throw new Error('db down')
    return state.sessions.get(tokenHash) ?? null
  },
}))

vi.mock('../../_lib/isgpay-settle.js', () => ({
  settleIsgpayOrder: async (_config: unknown, ref: string) => {
    state.settled.push(ref)
    return state.settle(ref)
  },
}))

const create = (await import('./create.js')).default
const reconcile = (await import('./reconcile.js')).default

installIsgpayEnv()

const GUEST = '11111111-1111-4111-8111-111111111111'
const TESTER = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'
const SESSION = 'a'.repeat(43)
const cookie = { cookie: `__Host-am_session=${SESSION}` }
const body = {
  serviceSlugs: ['website-security-audit'],
  guestToken: GUEST,
  contact: { firstName: 'Test', lastName: 'Customer', email: 'test@example.com', phone: '9999999999' },
}

async function call(handler: (q: ApiRequest, r: ApiResponse) => Promise<void>, r: Partial<ApiRequest>) {
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

beforeEach(() => {
  Object.assign(state, { unresolved: null, unresolvedThrows: false, sessionThrows: false, sweep: [] })
  state.rpc.length = 0
  state.settled.length = 0
  state.sweepArgs.length = 0
  state.sessions.clear()
  state.settle = async () => ({ outcome: 'pending' })
  setProductionEnv()
  process.env['ISGPAY_ENABLED'] = 'true'
  process.env['ISGPAY_CHECKOUT_ENABLED'] = 'true'
  process.env['ISGPAY_UAT_ACCESS_KEY'] = 'a-long-random-uat-tester-key-0123456789'
  delete process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED']
  process.env['ISGPAY_LIVE_PRIVATE_TEST_ENABLED'] = 'true'
  process.env['ISGPAY_LIVE_TESTER_USER_IDS'] = ` ${TESTER.toUpperCase()}, not-a-uuid`
  state.sessions.set(hashToken(SESSION), { id: TESTER, email_verified_at: '2026-11-01T00:00:00Z' })
})

describe('private live test (separate from public launch)', () => {
  it('an allowlisted, verified, signed-in account sees live checkout and can create a production order', async () => {
    expect((await call(create, { method: 'GET', headers: cookie })).body).toEqual({ available: true, testMode: false })
    const out = await call(create, { method: 'POST', headers: cookie, body })
    expect(out.code).toBe(200)
    expect(state.rpc[0]?.args['p_gateway_environment']).toBe('production')
    for (const secret of PRODUCTION_FIXTURE_SECRETS) expect(JSON.stringify(out.body)).not.toContain(secret)
  })

  it('a guest, or any other shopper, gets nothing: hidden on GET, 404 on POST, no order', async () => {
    expect((await call(create, { method: 'GET' })).body).toMatchObject({ available: false })
    expect((await call(create, { method: 'POST', body })).code).toBe(404)
    state.sessions.set(hashToken(SESSION), { id: OTHER, email_verified_at: '2026-11-01T00:00:00Z' })
    expect((await call(create, { method: 'POST', headers: cookie, body })).code).toBe(404)
    expect(state.rpc).toHaveLength(0)
  })

  it('an allowlisted id that is NOT a verified account is refused', async () => {
    state.sessions.set(hashToken(SESSION), { id: TESTER, email_verified_at: null })
    expect((await call(create, { method: 'POST', headers: cookie, body })).code).toBe(404)
  })

  it('fails closed: private-test flag off, empty or invalid allowlist, session lookup error', async () => {
    process.env['ISGPAY_LIVE_PRIVATE_TEST_ENABLED'] = 'TRUE'
    expect((await call(create, { method: 'POST', headers: cookie, body })).code).toBe(404)
    process.env['ISGPAY_LIVE_PRIVATE_TEST_ENABLED'] = 'true'
    process.env['ISGPAY_LIVE_TESTER_USER_IDS'] = 'not-a-uuid'
    expect((await call(create, { method: 'POST', headers: cookie, body })).code).toBe(404)
    process.env['ISGPAY_LIVE_TESTER_USER_IDS'] = TESTER
    state.sessionThrows = true
    expect((await call(create, { method: 'POST', headers: cookie, body })).code).toBe(404)
    expect(state.rpc).toHaveLength(0)
  })

  it('the UAT access key, the sandbox tester cookie and client-sent flags never authorise live money', async () => {
    const { testerCookie } = await import('../../_lib/isgpay-checkout.js')
    const tester = testerCookie(process.env['ISGPAY_UAT_ACCESS_KEY'] as string).split(';')[0] as string
    const out = await call(create, {
      method: 'POST',
      headers: { cookie: tester },
      body: { ...body, liveTester: true, isTester: true, userId: TESTER },
    })
    expect(out.code).toBe(404)
    expect(state.rpc).toHaveLength(0)
  })

  it('is closed on Preview even for an allowlisted tester, and when the master flags are off', async () => {
    process.env['VERCEL_ENV'] = 'preview'
    expect((await call(create, { method: 'GET', headers: cookie })).body).toMatchObject({ available: false })
    process.env['VERCEL_ENV'] = 'production'
    process.env['ISGPAY_CHECKOUT_ENABLED'] = 'false'
    expect((await call(create, { method: 'GET', headers: cookie })).body).toMatchObject({ available: false })
  })
})

describe('duplicate-payment protection (live)', () => {
  beforeEach(() => {
    process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED'] = 'true'
    state.unresolved = { reference: 'ISG0MABCDEF0123456789ABCDEF' }
  })

  it('an unresolved earlier attempt blocks a new charge, after one fresh verification', async () => {
    const out = await call(create, { method: 'POST', body })
    expect(out.code).toBe(409)
    expect(out.body).toEqual({ error: 'payment_unresolved' })
    expect(state.settled).toEqual(['ISG0MABCDEF0123456789ABCDEF'])
    expect(state.rpc).toHaveLength(0)
  })

  it.each(['pending', 'declined_pending', 'unknown_order'])('a %s verdict is never taken to mean "failed"', async (outcome) => {
    state.settle = async () => ({ outcome })
    expect((await call(create, { method: 'POST', body })).code).toBe(409)
    expect(state.rpc).toHaveLength(0)
  })

  it('an unreadable verification (timeout / throw) still blocks', async () => {
    state.settle = async () => { throw new Error('timeout') }
    expect((await call(create, { method: 'POST', body })).code).toBe(409)
    expect(state.rpc).toHaveLength(0)
  })

  it('if the earlier attempt turns out paid, the shopper may buy again', async () => {
    state.settle = async () => ({ outcome: 'paid' })
    expect((await call(create, { method: 'POST', body })).code).toBe(200)
    expect(state.rpc).toHaveLength(1)
  })

  it('an unreadable duplicate check refuses to charge rather than guess', async () => {
    state.unresolvedThrows = true
    expect((await call(create, { method: 'POST', body })).code).toBe(502)
    expect(state.rpc).toHaveLength(0)
  })

  it('no earlier attempt: creates normally, without a status query', async () => {
    state.unresolved = null
    expect((await call(create, { method: 'POST', body })).code).toBe(200)
    expect(state.settled).toHaveLength(0)
  })

  it('does not apply to the UAT sandbox', async () => {
    Object.assign(process.env, {
      ISGPAY_ENV: 'uat',
      VERCEL_ENV: 'preview',
      ISGPAY_SALE_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/request.action',
      ISGPAY_STATUS_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/Status',
    })
    expect((await call(create, { method: 'POST', body })).code).toBe(200)
    expect(state.settled).toHaveLength(0)
  })
})

describe('ISGPay reconcile sweep', () => {
  const auth = { authorization: 'Bearer cron-secret-for-tests' }
  beforeEach(() => {
    process.env['CRON_SECRET'] = 'cron-secret-for-tests'
    process.env['ISGPAY_RECONCILE_ENABLED'] = 'true'
    state.sweep = [{ reference: 'ISG0MAAAAAA0123456789ABCDEF' }, { reference: 'ISG0MBBBBBB0123456789ABCDEF' }]
  })

  it('answers 404 without the cron secret and does nothing', async () => {
    expect((await call(reconcile, { method: 'GET' })).code).toBe(404)
    expect((await call(reconcile, { method: 'GET', headers: { authorization: 'Bearer wrong' } })).code).toBe(404)
    expect(state.settled).toHaveLength(0)
  })

  it('is off by default: authorised but inert', async () => {
    delete process.env['ISGPAY_RECONCILE_ENABLED']
    const out = await call(reconcile, { method: 'GET', headers: auth })
    expect(out.body).toEqual({ enabled: false })
    expect(state.sweepArgs).toHaveLength(0)
  })

  it('selects only the configured environment and verifies each order through the one settle path', async () => {
    state.settle = async (ref) => ({ outcome: ref.includes('AAAA') ? 'paid' : 'pending' })
    const out = await call(reconcile, { method: 'GET', headers: auth })
    expect(state.sweepArgs[0]?.[0]).toBe('production')
    expect(state.settled).toEqual(['ISG0MAAAAAA0123456789ABCDEF', 'ISG0MBBBBBB0123456789ABCDEF'])
    expect(out.body).toMatchObject({ enabled: true, env: 'production', scanned: 2, outcomes: { paid: 1, pending: 1 } })
    expect(state.rpc).toHaveLength(0) // the sweep itself never writes
  })

  it('one failing verification leaves that order pending and does not stop the sweep', async () => {
    state.settle = async (ref) => {
      if (ref.includes('AAAA')) throw new Error('timeout')
      return { outcome: 'paid' }
    }
    const out = await call(reconcile, { method: 'GET', headers: auth })
    expect(out.body).toMatchObject({ scanned: 2, outcomes: { pending: 1, paid: 1 } })
  })

  it('reports unavailable when the config cannot load (e.g. production on Preview)', async () => {
    process.env['VERCEL_ENV'] = 'preview'
    expect((await call(reconcile, { method: 'GET', headers: auth })).code).toBe(503)
    expect(state.settled).toHaveLength(0)
  })
})
