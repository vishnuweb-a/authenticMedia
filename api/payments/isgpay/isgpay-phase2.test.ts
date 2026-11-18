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
  unresolvedArgs: [] as unknown[][],
  /** Stands in for create_isgpay_order's answer; default = order created. */
  rpcAnswer: null as null | ((args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>),
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
      if (state.rpcAnswer) return state.rpcAnswer(args)
      return { data: [{ total_inr: 149, access_token: 'tok-uuid' }], error: null }
    },
  }),
  findUnresolvedIsgpayOrder: async (...args: unknown[]) => {
    state.unresolvedArgs.push(args)
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
/** An ordinary (unverified, not allowlisted) signed-in shopper: checkout now requires a session. */
const SHOPPER_SESSION = 'b'.repeat(43)
const shopper = { cookie: `__Host-am_session=${SHOPPER_SESSION}` }
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
  Object.assign(state, { unresolved: null, unresolvedThrows: false, sessionThrows: false, sweep: [], rpcAnswer: null })
  state.rpc.length = 0
  state.unresolvedArgs.length = 0
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
  state.sessions.set(hashToken(SHOPPER_SESSION), { id: OTHER, email_verified_at: null })
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
    const out = await call(create, { method: 'POST', headers: shopper, body })
    expect(out.code).toBe(409)
    expect(out.body).toEqual({ error: 'payment_unresolved' })
    expect(state.settled).toEqual(['ISG0MABCDEF0123456789ABCDEF'])
    expect(state.rpc).toHaveLength(0)
  })

  it.each(['pending', 'declined_pending', 'unknown_order'])('a %s verdict is never taken to mean "failed"', async (outcome) => {
    state.settle = async () => ({ outcome })
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(409)
    expect(state.rpc).toHaveLength(0)
  })

  it('an unreadable verification (timeout / throw) still blocks', async () => {
    state.settle = async () => { throw new Error('timeout') }
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(409)
    expect(state.rpc).toHaveLength(0)
  })

  it('if the earlier attempt turns out paid, the shopper may buy again', async () => {
    state.settle = async () => ({ outcome: 'paid' })
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(200)
    expect(state.rpc).toHaveLength(1)
  })

  it('an unreadable duplicate check refuses to charge rather than guess', async () => {
    state.unresolvedThrows = true
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(502)
    expect(state.rpc).toHaveLength(0)
  })

  it('no earlier attempt: creates normally, without a status query', async () => {
    state.unresolved = null
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(200)
    expect(state.settled).toHaveLength(0)
  })

  it('does not apply to the UAT sandbox', async () => {
    Object.assign(process.env, {
      ISGPAY_ENV: 'uat',
      VERCEL_ENV: 'preview',
      ISGPAY_SALE_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/request.action',
      ISGPAY_STATUS_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/Status',
    })
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(200)
    expect(state.settled).toHaveLength(0)
  })
})

describe('atomic duplicate-payment guard (Phase 3)', () => {
  const EARLIER = 'ISG0MABCDEF0123456789ABCDEF'
  const OTHER_DEVICE_GUEST = '44444444-4444-4444-8444-444444444444'
  const blocked = { data: null, error: { code: 'IG409', message: 'create_isgpay_order: unresolved live payment', details: EARLIER } }

  /** Models create_isgpay_order: one pending live order per guest token / account. */
  function databaseGuard() {
    const pending: Array<{ guest: unknown; user: unknown }> = []
    state.rpcAnswer = async (args) => {
      await new Promise((r) => setTimeout(r, 5)) // both requests are in flight together
      const user = args['p_app_user_id']
      if (pending.some((p) => p.guest === args['p_guest_token'] || (user !== null && p.user === user))) return blocked
      pending.push({ guest: args['p_guest_token'], user })
      return { data: [{ total_inr: 149, access_token: 'tok-uuid' }], error: null }
    }
  }

  beforeEach(() => {
    process.env['ISGPAY_PRODUCTION_LAUNCH_ENABLED'] = 'true'
  })

  it('two concurrent requests that both pass the pre-check: exactly one order, the other gets 409', async () => {
    databaseGuard()
    const [a, b] = await Promise.all([call(create, { method: 'POST', headers: shopper, body }), call(create, { method: 'POST', headers: shopper, body })])
    expect([a.code, b.code].sort()).toEqual([200, 409])
    expect([a, b].filter((o) => (o.body as { actionUrl?: string }).actionUrl !== undefined)).toHaveLength(1)
    expect([a, b].find((o) => o.code === 409)?.body).toEqual({ error: 'payment_unresolved' })
  })

  it('the same signed-in account on two devices (different guest tokens) cannot hold two live charges', async () => {
    databaseGuard()
    const other = { ...body, guestToken: OTHER_DEVICE_GUEST }
    const [a, b] = await Promise.all([
      call(create, { method: 'POST', headers: cookie, body }),
      call(create, { method: 'POST', headers: cookie, body: other }),
    ])
    expect([a.code, b.code].sort()).toEqual([200, 409])
    expect(state.rpc.map((r) => r.args['p_app_user_id'])).toEqual([TESTER, TESTER])
    expect(state.unresolvedArgs).toContainEqual([OTHER_DEVICE_GUEST, TESTER, 'production'])
  })

  it('the account comes from the server session, never the request body', async () => {
    await call(create, { method: 'POST', headers: shopper, body: { ...body, appUserId: TESTER, userId: TESTER } })
    expect(state.rpc[0]?.args['p_app_user_id']).toBe(OTHER)
  })

  it('the pre-check has no time window: an attempt of any age is re-verified, and still blocks while unresolved', async () => {
    state.unresolved = { reference: EARLIER }
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(409)
    expect(state.unresolvedArgs).toEqual([[GUEST, OTHER, 'production']]) // no age argument exists any more
    expect(state.settled).toEqual([EARLIER])
  })

  it('a database refusal preserves the earlier order: no new hand-off, nothing else written', async () => {
    state.rpcAnswer = async () => blocked
    const out = await call(create, { method: 'POST', headers: shopper, body })
    expect(out.code).toBe(409)
    expect(state.rpc).toHaveLength(1) // only the refused create; no settle/cancel of the earlier row
  })

  it('fails closed when the session cannot be read or the database errors', async () => {
    state.sessionThrows = true
    expect((await call(create, { method: 'POST', headers: cookie, body })).code).toBe(502) // a cookie we cannot resolve = unknown shopper
    expect(state.rpc).toHaveLength(0)
    state.sessionThrows = false
    state.rpcAnswer = async () => ({ data: null, error: { code: '40P01', message: 'deadlock detected' } })
    expect((await call(create, { method: 'POST', headers: shopper, body })).code).toBe(502)
  })

  // Checkout now needs a session even in the sandbox, so the session IS read; the
  // guard and the account still never apply to sandbox orders.
  it('sandbox (UAT) orders are never guarded and never pass an account', async () => {
    Object.assign(process.env, {
      ISGPAY_ENV: 'uat',
      VERCEL_ENV: 'preview',
      ISGPAY_SALE_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/request.action',
      ISGPAY_STATUS_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/Status',
    })
    const out = await call(create, { method: 'POST', headers: cookie, body })
    expect(out.code).toBe(200)
    expect(state.rpc[0]?.args).toMatchObject({ p_gateway_environment: 'uat', p_app_user_id: null })
    expect(state.unresolvedArgs).toHaveLength(0)
    state.rpc.length = 0
    state.sessionThrows = true
    expect((await call(create, { method: 'POST', headers: cookie, body })).code).toBe(502)
    expect(state.rpc).toHaveLength(0)
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
