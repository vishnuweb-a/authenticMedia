import { beforeEach, describe, expect, it, vi } from 'vitest'

import { hashToken } from '../_lib/auth.js'
import type { ApiRequest, ApiResponse } from '../_lib/http.js'
import { installIsgpayEnv } from '../_lib/isgpay-test-fixture.js'

/**
 * Checkout requires a signed-in account (feat/checkout-only-auth). Calling a
 * payment-creation endpoint directly without a live session must be refused
 * before any order row, OAuth token or gateway hand-off exists.
 * Every dependency is mocked: no database, no network, no payment.
 */

const state = vi.hoisted(() => ({
  db: 0,
  oauth: 0,
  sessions: new Map<string, { id: string; email_verified_at: string | null }>(),
  sessionThrows: false,
}))

vi.mock('../_lib/auth-store.js', () => ({
  findSessionUser: async (tokenHash: string) => {
    if (state.sessionThrows) throw new Error('db down')
    return state.sessions.get(tokenHash) ?? null
  },
}))

vi.mock('../_lib/db.js', () => ({
  getServiceClient: () => {
    state.db += 1
    return {
      from: () => ({ select: () => ({ in: (_c: string, slugs: string[]) => ({ eq: async () => ({ data: slugs.map((slug) => ({ slug })), error: null }) }) }) }),
      rpc: async () => ({ data: [{ total_inr: 149, access_token: 'tok' }], error: null }),
    }
  },
  findUnresolvedIsgpayOrder: async () => null,
}))

vi.mock('../_lib/airpay.js', () => ({
  getAccessToken: async () => {
    state.oauth += 1
    return 'oauth-token'
  },
}))

const airpay = (await import('./create.js')).default
const isgpay = (await import('./isgpay/create.js')).default

installIsgpayEnv()

const SESSION = 'a'.repeat(43)
const signedIn = { cookie: `__Host-am_session=${SESSION}` }
const body = {
  serviceSlugs: ['website-security-audit'],
  merchant: 1,
  guestToken: '11111111-1111-4111-8111-111111111111',
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
  Object.assign(state, { db: 0, oauth: 0, sessionThrows: false })
  state.sessions.clear()
  // An unverified, self-registered account is enough: verification is not required.
  state.sessions.set(hashToken(SESSION), { id: '22222222-2222-4222-8222-222222222222', email_verified_at: null })
  Object.assign(process.env, {
    AIRPAY_ENV: 'sandbox', AIRPAY_MID: '000000', AIRPAY_CLIENT_ID: 'test-client-id', AIRPAY_SECRET_KEY: 'test-secret-key',
    AIRPAY_API_KEY: 'test-api-key', AIRPAY_USERNAME: 'test-username', AIRPAY_PASSWORD: 'test-password',
    ISGPAY_ENABLED: 'true', ISGPAY_CHECKOUT_ENABLED: 'true',
  })
  delete process.env['VERCEL_ENV']
})

describe.each([
  ['POST /api/payments/create', airpay],
  ['POST /api/payments/isgpay/create', isgpay],
])('%s requires a signed-in session', (_name, handler) => {
  const refusals: Array<[string, Record<string, string>]> = [
    ['no cookie', {}],
    ['a malformed cookie', { cookie: '__Host-am_session=short' }],
    ['an unknown or expired session', { cookie: `__Host-am_session=${'z'.repeat(43)}` }],
    ['only a sandbox tester / other cookie', { cookie: '__Host-isgpay_tester=1.abc; other=1' }],
  ]

  it.each(refusals)('refuses %s with 401 before any order or gateway work', async (_label, headers) => {
    const out = await call(handler, { method: 'POST', headers, body })
    expect(out.code).toBe(401)
    expect(out.body).toEqual({ error: 'unauthenticated' })
    expect(state.db).toBe(0)
    expect(state.oauth).toBe(0)
  })

  it('fails closed (502) when the session cannot be read', async () => {
    state.sessionThrows = true
    const out = await call(handler, { method: 'POST', headers: signedIn, body })
    expect(out.code).toBe(502)
    expect(state.db).toBe(0)
    expect(state.oauth).toBe(0)
  })

  it('a client-sent user or auth flag never substitutes for the session', async () => {
    const forged = { ...body, userId: 'x', authenticated: true, session: SESSION }
    expect((await call(handler, { method: 'POST', body: forged })).code).toBe(401)
  })

  it('a signed-in (unverified) account proceeds to the unchanged checkout', async () => {
    const out = await call(handler, { method: 'POST', headers: signedIn, body })
    expect(out.code).toBe(200)
    expect(out.body).toMatchObject({ orderRef: expect.any(String), actionUrl: expect.any(String) })
  })
})

describe('what stays public', () => {
  it('ISGPay availability (GET) is answered without a session, by its existing rules', async () => {
    expect((await call(isgpay, { method: 'GET' })).body).toEqual({ available: true, testMode: true })
    process.env['ISGPAY_CHECKOUT_ENABLED'] = 'false'
    expect((await call(isgpay, { method: 'GET' })).body).toMatchObject({ available: false })
  })

  it('ISGPay still answers 404 (not 401) when it is not offered, revealing nothing new', async () => {
    process.env['ISGPAY_CHECKOUT_ENABLED'] = 'false'
    expect((await call(isgpay, { method: 'POST', body })).code).toBe(404)
  })
})
