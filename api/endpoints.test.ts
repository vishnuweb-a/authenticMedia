import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

import type { ApiRequest, ApiResponse } from './_lib/http'

/**
 * Endpoint tests: authorization, indistinguishable 404s, and the callback
 * configuration this integration depends on.
 */

const orders = vi.hoisted(() => ({ map: new Map<string, Record<string, unknown>>() }))
const settled = vi.hoisted(() => ({ calls: [] as string[] }))

vi.mock('./_lib/db', () => ({
  findOrderByRef: async (ref: string) => orders.map.get(ref) ?? null,
  findUnsettledOrders: async () => [],
  settleOrderRow: async () => 'order-uuid',
  getServiceClient: () => {
    throw new Error('db should not be reached for a rejected request')
  },
}))

vi.mock('./_lib/settle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./_lib/settle')>()
  return {
    ...actual,
    settleOrder: async ({ orderRef }: { orderRef: string }) => {
      settled.calls.push(orderRef)
      return { outcome: 'pending' as const, orderRef, paymentStatus: null }
    },
  }
})

const statusHandler = (await import('./orders/status')).default
const reconcileHandler = (await import('./payments/reconcile')).default
const createHandler = (await import('./payments/create')).default

interface Captured {
  code: number
  body: unknown
  headers: Record<string, string>
}

function mockRes(): { res: ApiResponse; captured: Captured } {
  const captured: Captured = { code: 0, body: null, headers: {} }
  const res: ApiResponse = {
    status(code) {
      captured.code = code
      return res
    },
    setHeader(name, value) {
      captured.headers[name] = value
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

const ORDER_REF = 'AM-1234-abcdef01'
const TOKEN = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  orders.map.clear()
  settled.calls = []
  orders.map.set(ORDER_REF, {
    id: 'order-uuid',
    reference: ORDER_REF,
    status: 'pending_payment',
    totalInr: 1499,
    accessToken: TOKEN,
    paymentMethod: 'airpay',
    apTransactionId: null,
    createdAt: '2026-08-31T00:00:00Z',
  })
})

describe('GET /api/orders/status (§15)', () => {
  it('returns a thin status for a correct reference and token', async () => {
    const { res, captured } = mockRes()
    await statusHandler(
      { method: 'GET', headers: {}, query: { ref: ORDER_REF, t: TOKEN } } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(200)
    const body = captured.body as Record<string, unknown>
    expect(body.orderRef).toBe(ORDER_REF)
    expect(body.settled).toBe(false)
    // Deliberately thin: no contact details, no gateway detail, no internal id.
    expect(body).not.toHaveProperty('id')
    expect(body).not.toHaveProperty('contact_email')
    expect(captured.headers['Cache-Control']).toBe('no-store')
  })

  it('self-heals: an unsettled order triggers settleOrder inline', async () => {
    const { res } = mockRes()
    await statusHandler(
      { method: 'GET', headers: {}, query: { ref: ORDER_REF, t: TOKEN } } as ApiRequest,
      res,
    )

    // This is the PRIMARY settlement trigger in this integration, because the
    // Airpay callback goes to KKChat rather than to us.
    expect(settled.calls).toEqual([ORDER_REF])
  })

  it('does not re-settle an order already terminal', async () => {
    orders.map.set(ORDER_REF, {
      ...(orders.map.get(ORDER_REF) as Record<string, unknown>),
      status: 'paid',
    })

    const { res, captured } = mockRes()
    await statusHandler(
      { method: 'GET', headers: {}, query: { ref: ORDER_REF, t: TOKEN } } as ApiRequest,
      res,
    )

    expect(settled.calls).toEqual([])
    expect((captured.body as Record<string, unknown>).settled).toBe(true)
  })

  it('reports requires_review as settled so the spinner stops (§15)', async () => {
    orders.map.set(ORDER_REF, {
      ...(orders.map.get(ORDER_REF) as Record<string, unknown>),
      status: 'requires_review',
    })

    const { res, captured } = mockRes()
    await statusHandler(
      { method: 'GET', headers: {}, query: { ref: ORDER_REF, t: TOKEN } } as ApiRequest,
      res,
    )

    expect((captured.body as Record<string, unknown>).settled).toBe(true)
  })

  it('edge case 38 — identical 404s for a wrong token and an unknown order', async () => {
    const wrongToken = mockRes()
    await statusHandler(
      {
        method: 'GET',
        headers: {},
        query: { ref: ORDER_REF, t: '22222222-2222-4222-8222-222222222222' },
      } as ApiRequest,
      wrongToken.res,
    )

    const unknown = mockRes()
    await statusHandler(
      { method: 'GET', headers: {}, query: { ref: 'AM-none-00000000', t: TOKEN } } as ApiRequest,
      unknown.res,
    )

    expect(wrongToken.captured.code).toBe(404)
    expect(unknown.captured.code).toBe(404)
    // Indistinguishable, so the endpoint cannot enumerate references.
    expect(wrongToken.captured.body).toEqual(unknown.captured.body)
    expect(settled.calls).toEqual([])
  })

  it('rejects a missing token without consulting the order', async () => {
    const { res, captured } = mockRes()
    await statusHandler(
      { method: 'GET', headers: {}, query: { ref: ORDER_REF } } as ApiRequest,
      res,
    )
    expect(captured.code).toBe(404)
  })
})

describe('GET /api/payments/reconcile (§16)', () => {
  it('edge case 41 — answers 404, not 401, without a valid bearer', async () => {
    process.env['CRON_SECRET'] = 'cron-secret-placeholder'

    const missing = mockRes()
    await reconcileHandler({ method: 'GET', headers: {} } as ApiRequest, missing.res)
    expect(missing.captured.code).toBe(404)

    const wrong = mockRes()
    await reconcileHandler(
      { method: 'GET', headers: { authorization: 'Bearer nope' } } as ApiRequest,
      wrong.res,
    )
    expect(wrong.captured.code).toBe(404)
  })

  it('runs the sweep with a valid bearer', async () => {
    process.env['CRON_SECRET'] = 'cron-secret-placeholder'

    const { res, captured } = mockRes()
    await reconcileHandler(
      {
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-placeholder' },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(200)
    expect((captured.body as Record<string, unknown>).scanned).toBe(0)
  })

  it('refuses when CRON_SECRET is unset, rather than running unauthenticated', async () => {
    delete process.env['CRON_SECRET']

    const { res, captured } = mockRes()
    await reconcileHandler(
      { method: 'GET', headers: { authorization: 'Bearer anything' } } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(404)
  })
})

describe('callback configuration', () => {
  const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    rewrites: Array<{ source: string; destination: string }>
    crons: Array<{ path: string }>
  }

  it('exposes no Airpay callback receiver: the callback goes directly to KKChat', () => {
    // ⚠ Topology, confirmed by the client. Airpay's Response and IPN URLs both
    // point at https://kkchat.in/callback/cpm/arp/collection. This application
    // deliberately hosts NO /callback/... route, and settles by pulling Order
    // Confirmation instead (§11, §15, §16).
    const sources = vercelConfig.rewrites.map((r) => r.source)
    expect(sources.some((s) => s.includes('/callback/'))).toBe(false)
  })

  it('routes /api/* to functions and everything else to the SPA', () => {
    const spa = vercelConfig.rewrites.at(-1)
    expect(spa?.destination).toBe('/index.html')
    // The catch-all must exclude api/, or every endpoint would serve
    // index.html — the failure that stranded a real payment (§8.1).
    expect(spa?.source).toContain('?!api/')
  })

  it('schedules the reconciliation sweep, the backstop path', () => {
    expect(vercelConfig.crons.some((c) => c.path === '/api/payments/reconcile')).toBe(true)
  })

  it('ships no Airpay variable under a public build prefix (§2.3)', () => {
    const example = readFileSync('.env.example', 'utf8')
    const leaked = example
      .split('\n')
      .filter((line) => /^(VITE_|NEXT_PUBLIC_|REACT_APP_)/.test(line.trim()))
      .filter((line) => /AIRPAY|CRON|SERVICE_ROLE/i.test(line))

    expect(leaked).toEqual([])
  })
})

describe('POST /api/payments/create — request validation', () => {
  it('rejects a request with no guest token', async () => {
    // public.orders enforces CHECK (num_nonnulls(user_id, guest_token) = 1),
    // so an order without an owner cannot be inserted. Caught by a live smoke
    // test against the real schema, not by a unit test.
    const { res, captured } = mockRes()
    await createHandler(
      {
        method: 'POST',
        headers: {},
        body: { serviceSlugs: ['some-service'] },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(400)
    expect(captured.body).toEqual({ error: 'invalid_request' })
  })

  it('rejects a malformed guest token', async () => {
    const { res, captured } = mockRes()
    await createHandler(
      {
        method: 'POST',
        headers: {},
        body: { serviceSlugs: ['some-service'], guestToken: 'not-a-uuid' },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(400)
  })

  it('rejects an empty basket', async () => {
    const { res, captured } = mockRes()
    await createHandler(
      {
        method: 'POST',
        headers: {},
        body: {
          serviceSlugs: [],
          guestToken: '11111111-1111-4111-8111-111111111111',
        },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(400)
  })

  it('accepts no price field of any kind (edge case 42)', async () => {
    // The handler reads serviceSlugs, guestToken and contact only. There is
    // deliberately nowhere for a client to state an amount.
    const source = readFileSync('api/payments/create.ts', 'utf8')
    for (const field of ['body.amount', 'body.total', 'body.price', 'body.subtotal']) {
      expect(source).not.toContain(field)
    }
  })

  it('rejects a non-POST method', async () => {
    const { res, captured } = mockRes()
    await createHandler({ method: 'GET', headers: {} } as ApiRequest, res)
    expect(captured.code).toBe(405)
  })
})
