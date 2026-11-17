import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../../_lib/http.js'
import { loadIsgpayConfig, type IsgpayConfig } from '../../_lib/isgpay-config.js'
import { computeSecureHash, encryptEncData, serializeEncData, verifyFields, type VerifiedIsgpayFields } from '../../_lib/isgpay-crypto.js'
import { installIsgpayEnv } from '../../_lib/isgpay-test-fixture.js'
import type { StatusResult } from '../../_lib/isgpay.js'

const db = vi.hoisted(() => ({
  orders: new Map<string, Record<string, unknown>>(),
  rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
}))

vi.mock('../../_lib/db.js', () => ({
  findOrderByRef: async (ref: string) => db.orders.get(ref) ?? null,
  getServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      db.rpc.push({ fn, args })
      if (fn === 'create_isgpay_order') return { data: [{ total_inr: 149, access_token: 'tok-uuid' }], error: null }
      return { data: 'order-uuid', error: null }
    },
  }),
}))

const airpaySettle = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock('../../_lib/settle.js', () => ({
  isSettledOutcome: (s: string) => ['paid', 'failed', 'cancelled', 'delivered', 'requires_review'].includes(s),
  settleOrder: async ({ orderRef }: { orderRef: string }) => {
    airpaySettle.calls.push(orderRef)
    return { outcome: 'paid', orderRef, paymentStatus: 'paid' }
  },
}))

const { settleIsgpayOrder } = await import('../../_lib/isgpay-settle.js')
const airpayOrderStatus = (await import('../../orders/status.js')).default
const uat = (await import('./uat.js')).default
const ret = (await import('./return.js')).default
const callback = (await import('./callback.js')).default
const status = (await import('./status.js')).default

installIsgpayEnv()

const REF = 'ISG0MABCDEF0123456789ABCDEF'

function order(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'o1', reference: REF, status: 'pending_payment', totalInr: 149, accessToken: 'tok-uuid', paymentMethod: 'isgpay', createdAt: 'now', ...overrides }
}

function gateway(config: IsgpayConfig, overrides: Record<string, string> = {}): Record<string, string> {
  const fields: Record<string, string> = {
    BankId: config.bankId, MerchantId: config.merchantId, TerminalId: config.terminalId,
    TxnRefNo: REF, Amount: '14900', Currency: '356', ResponseCode: '00', Message: 'Approved', pgTxnId: 'PG123', ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) if (v === '') delete fields[k]
  return { ...fields, SecureHash: computeSecureHash(fields, config.secrets.secureSecret) }
}

function verifiedStatus(config: IsgpayConfig, overrides: Record<string, string> = {}): StatusResult {
  const r = verifyFields(gateway(config, overrides), config.secrets.secureSecret)
  if (!r.ok) throw new Error('fixture')
  return { kind: 'verified', fields: r.fields as VerifiedIsgpayFields }
}

function envelope(config: IsgpayConfig, overrides: Record<string, string> = {}): string {
  return encryptEncData(serializeEncData(Object.entries(gateway(config, overrides))), config.secrets.encKey)
}

function mockRes() {
  const out = { code: 0, body: '' as unknown, headers: {} as Record<string, string> }
  const res: ApiResponse = {
    status(c) { out.code = c; return res },
    setHeader(n, v) { out.headers[n] = v; return res },
    json(b) { out.body = b },
    send(b) { out.body = b },
    end() {},
  }
  return { res, out }
}

const req = (r: Partial<ApiRequest>): ApiRequest => ({ headers: {}, ...r })

beforeEach(() => {
  db.orders.clear()
  db.rpc.length = 0
  delete process.env['VERCEL_ENV']
  delete process.env['ISGPAY_UAT_ACCESS_KEY']
  delete process.env['ISGPAY_UAT_WEBSITE_TEST_ENABLED']
})

describe('settleIsgpayOrder', () => {
  it('marks paid only on a verified 00 with matching amount', async () => {
    const config = loadIsgpayConfig()
    db.orders.set(REF, order())
    const settleRow = vi.fn(async () => 'id')
    const r = await settleIsgpayOrder(config, REF, { query: async () => verifiedStatus(config), settleRow })
    expect(r.outcome).toBe('paid')
    expect(settleRow).toHaveBeenCalledWith(REF, 'succeeded', 'PG123')
  })

  it('amount mismatch → requires_review, never paid', async () => {
    const config = loadIsgpayConfig()
    db.orders.set(REF, order())
    const settleRow = vi.fn(async () => 'id')
    const r = await settleIsgpayOrder(config, REF, { query: async () => verifiedStatus(config, { Amount: '100' }), settleRow })
    expect(r.outcome).toBe('requires_review')
    expect(settleRow).toHaveBeenCalledWith(REF, 'requires_review', 'PG123')
  })

  it.each([
    ['declined', (c: IsgpayConfig) => verifiedStatus(c, { ResponseCode: '05' }), 'declined_pending'],
    ['inconclusive', () => ({ kind: 'inconclusive', reason: 'timeout' }) as StatusResult, 'pending'],
    ['00 without amount', (c: IsgpayConfig) => verifiedStatus(c, { Amount: '' }), 'pending'],
  ])('%s → no write', async (_name, make, expected) => {
    const config = loadIsgpayConfig()
    db.orders.set(REF, order())
    const settleRow = vi.fn(async () => 'id')
    const r = await settleIsgpayOrder(config, REF, { query: async () => make(config), settleRow })
    expect(r.outcome).toBe(expected)
    expect(settleRow).not.toHaveBeenCalled()
  })

  it('ignores Airpay orders and terminal orders without querying', async () => {
    const config = loadIsgpayConfig()
    const query = vi.fn()
    db.orders.set(REF, order({ paymentMethod: 'airpay' }))
    expect((await settleIsgpayOrder(config, REF, { query })).outcome).toBe('unknown_order')
    db.orders.set(REF, order({ status: 'paid' }))
    expect((await settleIsgpayOrder(config, REF, { query })).outcome).toBe('already_settled')
    expect(query).not.toHaveBeenCalled()
  })
})

describe('UAT checkout', () => {
  it('is 404 without an access key or on production', async () => {
    const a = mockRes()
    await uat(req({ method: 'GET' }), a.res)
    expect(a.out.code).toBe(404)
    process.env['ISGPAY_UAT_ACCESS_KEY'] = 'k'.repeat(32)
    process.env['VERCEL_ENV'] = 'production'
    const b = mockRes()
    await uat(req({ method: 'GET' }), b.res)
    expect(b.out.code).toBe(404)
  })

  it('allows production UAT page only with the separate site-test flag and access key', async () => {
    process.env['VERCEL_ENV'] = 'production'
    process.env['ISGPAY_UAT_ACCESS_KEY'] = 'k'.repeat(32)

    const blocked = mockRes()
    await uat(req({ method: 'GET' }), blocked.res)
    expect(blocked.out.code).toBe(404)

    process.env['ISGPAY_UAT_WEBSITE_TEST_ENABLED'] = 'true'
    const allowed = mockRes()
    await uat(req({ method: 'GET' }), allowed.res)
    expect(allowed.out.code).toBe(200)
    expect(String(allowed.out.body)).toContain('ISGPay UAT checkout')
    expect(db.rpc).toHaveLength(0)
  })

  it('rejects a wrong key and creates nothing', async () => {
    process.env['ISGPAY_UAT_ACCESS_KEY'] = 'k'.repeat(32)
    const { res, out } = mockRes()
    await uat(req({ method: 'POST', body: { key: 'wrong', slug: 'x' } }), res)
    expect(out.code).toBe(403)
    expect(db.rpc).toHaveLength(0)
  })

  it('creates a catalogue-priced order and hands off to the pinned sandbox', async () => {
    process.env['ISGPAY_UAT_ACCESS_KEY'] = 'k'.repeat(32)
    process.env['ISGPAY_ENABLED'] = 'true'
    const { res, out } = mockRes()
    await uat(req({ method: 'POST', body: { key: 'k'.repeat(32), slug: 'website-security-audit', amount: '1' } }), res)
    expect(out.code).toBe(200)
    expect(db.rpc[0]?.fn).toBe('create_isgpay_order')
    expect(Object.keys(db.rpc[0]?.args ?? {})).not.toContain('amount')
    const html = String(out.body)
    expect(html).toContain('action="https://sandbox.isgpay.com/ISGPay-Genius/request.action"')
    expect(html).toContain('14900 paise')
    expect(html).not.toContain(process.env['ISGPAY_PASSCODE'])
    expect(html).not.toContain(process.env['ISGPAY_SECURE_SECRET'])
  })
})

describe('return / callback', () => {
  it('unverifiable envelope settles nothing and lands on an unverified page', async () => {
    const { res, out } = mockRes()
    await ret(req({ method: 'POST', body: { EncData: 'bm90LXZhbGlk' } }), res)
    expect(out.code).toBe(303)
    expect(out.headers['Location']).toBe('/order-success?status=unverified')
    expect(db.rpc).toHaveLength(0)
  })

  it('verified return → status query, then /order-success with the server-held token', async () => {
    const config = loadIsgpayConfig()
    db.orders.set(REF, order())
    // The gateway is unreachable: the envelope's "00" must NOT settle anything.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const { res, out } = mockRes()
    await ret(req({ method: 'POST', body: { EncData: envelope(config) } }), res)
    expect(fetchSpy).toHaveBeenCalledTimes(1) // the Sale Status Query
    fetchSpy.mockRestore()
    expect(out.code).toBe(303)
    expect(out.headers['Location']).toBe(`/order-success?ref=${REF}&t=tok-uuid`)
    expect(db.rpc.filter((c) => c.fn === 'settle_isgpay_order')).toHaveLength(0)
  })

  it('never hands out the token of a non-ISGPay order', async () => {
    const config = loadIsgpayConfig()
    db.orders.set(REF, order({ paymentMethod: 'airpay' }))
    const { res, out } = mockRes()
    await ret(req({ method: 'POST', body: { EncData: envelope(config) } }), res)
    expect(out.headers['Location']).toBe(`/order-success?ref=${REF}&status=unknown`)
  })

  it('a callback claiming success does not settle without a status query', async () => {
    const config = loadIsgpayConfig()
    db.orders.set(REF, order())
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const { res, out } = mockRes()
    // '+' form-decoded to ' ' must still open.
    await callback(req({ method: 'POST', body: { EncData: envelope(config).replace(/\+/g, ' ') } }), res)
    fetchSpy.mockRestore()
    expect(out.code).toBe(200)
    expect(String(out.body)).toContain('Acknowledgement=Received')
    expect(db.rpc.filter((c) => c.fn === 'settle_isgpay_order')).toHaveLength(0)
  })
})

describe('status endpoint', () => {
  it('one 404 for wrong token and non-ISGPay orders', async () => {
    db.orders.set(REF, order())
    const a = mockRes()
    await status(req({ method: 'GET', query: { ref: REF, t: 'nope' } }), a.res)
    expect(a.out.code).toBe(404)
    db.orders.set(REF, order({ paymentMethod: 'airpay' }))
    const b = mockRes()
    await status(req({ method: 'GET', query: { ref: REF, t: 'tok-uuid' } }), b.res)
    expect(b.out.code).toBe(404)
  })
})

describe('sandbox isolation', () => {
  it('the Airpay status/settlement path never touches an ISGPay (test) order', async () => {
    airpaySettle.calls.length = 0
    db.orders.set(REF, order())
    const { res, out } = mockRes()
    await airpayOrderStatus(req({ method: 'GET', query: { ref: REF, t: 'tok-uuid' } }), res)
    expect(airpaySettle.calls).toHaveLength(0)
    expect((out.body as { status: string }).status).toBe('pending_payment')
  })

  it('ISGPay status always flags its orders as test mode', async () => {
    db.orders.set(REF, order({ status: 'paid' }))
    const { res, out } = mockRes()
    await status(req({ method: 'GET', query: { ref: REF, t: 'tok-uuid' } }), res)
    expect(out.body).toMatchObject({ status: 'paid', testMode: true })
  })
})

describe('preview return host', () => {
  it('accepts this deployment’s own vercel.app host only on preview', () => {
    process.env['ISGPAY_RETURN_URL'] = 'https://authentic-media-git-x-team.vercel.app/api/payments/isgpay/return'
    process.env['VERCEL_BRANCH_URL'] = 'authentic-media-git-x-team.vercel.app'
    expect(() => loadIsgpayConfig()).toThrow()
    process.env['VERCEL_ENV'] = 'preview'
    expect(loadIsgpayConfig().returnUrl).toContain('vercel.app')
    process.env['VERCEL_BRANCH_URL'] = 'other.vercel.app'
    expect(() => loadIsgpayConfig()).toThrow()
    delete process.env['VERCEL_BRANCH_URL']
  })
})
