import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

import { encrypt } from './_lib/airpay-crypto.js'
import type { AirpayConfig } from './_lib/config.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { KKCHAT_DEFAULT_URL } from './_lib/relay.js'

/**
 * The Airpay callback receiver (AIPAY-DOCS §8, §9, §13).
 *
 * The load-bearing property under test throughout: a callback is a PROMPT TO
 * GO AND CHECK, never proof of payment (§0). No test here may pass by letting
 * a callback body decide anything about money.
 */

const orders = vi.hoisted(() => ({ map: new Map<string, Record<string, unknown>>() }))
const settleCalls = vi.hoisted(() => ({ list: [] as Array<Record<string, unknown>> }))
const settleRowCalls = vi.hoisted(() => ({ list: [] as Array<Record<string, unknown>> }))
const fetches = vi.hoisted(() => ({ list: [] as Array<{ url: string; init: RequestInit }> }))

vi.mock('./_lib/db.js', () => ({
  findOrderByRef: async (ref: string) => orders.map.get(ref) ?? null,
  findUnsettledOrders: async () => [],
  settleOrderRow: async (ref: string, status: string) => {
    settleRowCalls.list.push({ ref, status })
    return 'order-uuid'
  },
  getServiceClient: () => {
    throw new Error('the callback must not touch the database directly')
  },
}))

/**
 * settleOrder is SPIED, not reimplemented. The callback route must reuse the
 * one real settlement function; a second settlement path is forbidden (§10).
 */
vi.mock('./_lib/settle.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./_lib/settle.js')>()
  return {
    ...actual,
    settleOrder: async (payload: Record<string, unknown>) => {
      settleCalls.list.push(payload)
      return { outcome: 'pending' as const, orderRef: payload['orderRef'], paymentStatus: null }
    },
  }
})

const handler = (await import('./callback/cpm/arp_frontiva/collection.js')).default

const MID = '366950'
const ORDER_REF = 'AM-EMF8G-99999999'
const TOKEN = '11111111-1111-4111-8111-111111111111'

const CONFIG: AirpayConfig = {
  merchant: 1,
  mid: MID,
  clientId: 'client-id-placeholder',
  secretKey: 'oauth-secret-placeholder',
  apiKey: 'api-key-placeholder',
  username: 'username-placeholder',
  password: 'password-placeholder',
  env: 'live',
  verifyUrl: 'https://kraken.airpay.co.in/airpay/pay/v4/api/verify/',
}

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

/** The native v4 envelope Airpay's live gateway posts (§9.3). */
function sealedEnvelope(data: Record<string, string>): string {
  // ⚠ §9.5 — the plaintext is NOT flat: the transaction fields nest under
  // `data`, beneath a transport wrapper whose own status/message describe the
  // DELIVERY, not the transaction.
  return encrypt(
    JSON.stringify({
      status_code: 200,
      response_code: '00',
      status: 'success',
      message: 'Success',
      data,
    }),
    CONFIG,
  )
}

const PAYLOAD = {
  TRANSACTIONID: ORDER_REF,
  APTRANSACTIONID: 'AP123456',
  AMOUNT: '2.00',
  TRANSACTIONSTATUS: '200',
  MESSAGE: 'Success',
  CUSTOMERVPA: 'someone@upi',
}

const BROWSER = { 'sec-fetch-dest': 'document' }

beforeEach(() => {
  orders.map.clear()
  settleCalls.list = []
  settleRowCalls.list = []
  fetches.list = []

  orders.map.set(ORDER_REF, {
    id: 'order-uuid',
    reference: ORDER_REF,
    status: 'pending_payment',
    totalInr: 2,
    accessToken: TOKEN,
    paymentMethod: 'airpay',
    apTransactionId: null,
    createdAt: '2026-08-31T00:00:00Z',
  })

  process.env['AIRPAY_MID'] = MID
  process.env['AIRPAY_CLIENT_ID'] = CONFIG.clientId
  process.env['AIRPAY_SECRET_KEY'] = CONFIG.secretKey
  process.env['AIRPAY_API_KEY'] = CONFIG.apiKey
  process.env['AIRPAY_USERNAME'] = CONFIG.username
  process.env['AIRPAY_PASSWORD'] = CONFIG.password
  process.env['AIRPAY_ENV'] = 'live'
  process.env['PUBLIC_SITE_ORIGIN'] = 'https://authenticmedia.fun'
  delete process.env['KKCHAT_CALLBACK_URL']

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      fetches.list.push({ url: String(url), init })
      return new Response('success', { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('1. the route exists', () => {
  it('ships a handler at the dashboard-registered path', () => {
    expect(existsSync('api/callback/cpm/arp_frontiva/collection.ts')).toBe(true)
    expect(typeof handler).toBe('function')
  })

  it('answers POST rather than the 405 that stranded a real payment (§8.1)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(captured.code).not.toBe(405)
    expect(captured.code).toBe(200)
  })
})

describe('2. a valid documented callback parses', () => {
  it('opens the native v4 envelope on the IPN (JSON) leg', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(200)
    expect(settleCalls.list).toHaveLength(1)
    expect(settleCalls.list[0]?.['orderRef']).toBe(ORDER_REF)
  })

  it('reads the reference from the NESTED data object (§9.5, edge case 14)', async () => {
    // A flat top-level-scalars-only reader drops `data` because it is an
    // object and reports no_order_reference about fields it never looked at.
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list[0]?.['orderRef']).toBe(ORDER_REF)
  })

  it('prefers the payload MESSAGE over the wrapper message (§9.5, edge case 15)', async () => {
    // The wrapper's `message` describes the DELIVERY. Feeding it to
    // verifySecureHash instead of the transaction's own strands a genuine
    // payment.
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          merchant_id: MID,
          response: sealedEnvelope({ ...PAYLOAD, MESSAGE: 'Transaction Successful' }),
        },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list[0]?.['message']).toBe('Transaction Successful')
  })

  it('repairs the +→space corruption on the browser leg (§9.4)', async () => {
    const sealed = sealedEnvelope(PAYLOAD)
    // x-www-form-urlencoded spells a space with `+`; a sender that does not
    // percent-encode hands us a blob with every `+` turned into a space.
    const corrupted = sealed.replace(/\+/g, ' ')

    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...BROWSER },
        body: { merchant_id: MID, response: corrupted },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list[0]?.['orderRef']).toBe(ORDER_REF)
  })

  it('drains an unparsed multipart stream rather than seeing nothing (§9.1)', async () => {
    const sealed = sealedEnvelope(PAYLOAD)
    const boundary = '----AirpayBoundary'
    const raw =
      `--${boundary}\r\nContent-Disposition: form-data; name="merchant_id"\r\n\r\n${MID}\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="response"\r\n\r\n${sealed}\r\n` +
      `--${boundary}--\r\n`

    // Vercel leaves body undefined for an unrecognised content type, with the
    // stream unread.
    const req = {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body: undefined,
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(raw, 'utf8')
      },
    } as unknown as ApiRequest

    const { res, captured } = mockRes()
    await handler(req, res)

    expect(captured.code).toBe(200)
    expect(settleCalls.list[0]?.['orderRef']).toBe(ORDER_REF)
  })
})

describe('3. merchant mismatch is rejected', () => {
  it('stops before the envelope is ever opened (edge case 17)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: '999999', response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list).toEqual([])
    expect(fetches.list).toEqual([])
    // Still 2xx: a non-2xx would make Airpay retry (§8.3).
    expect(captured.code).toBe(200)
    expect((captured.body as Record<string, unknown>).outcome).toBe('unparseable')
  })
})

describe('4. an invalid SecureHash is rejected', () => {
  it('leaves the rejection to settleOrder, which owns the check', async () => {
    // The callback route must NOT implement its own hash check; it forwards
    // the claim and settleOrder rejects it (§10.1 step 3).
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          merchant_id: MID,
          response: sealedEnvelope({ ...PAYLOAD, ap_SecureHash: '123456789' }),
        },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list[0]?.['secureHash']).toBe('123456789')
  })

  it('a real settleOrder refuses a bad hash without calling Order Confirmation', async () => {
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')
    const verify = vi.fn()

    const result = await actual.settleOrder(
      {
        orderRef: ORDER_REF,
        secureHash: 'not-the-right-crc32',
        apTransactionId: 'AP123456',
        amount: '2.00',
        transactionStatus: '200',
        message: 'Success',
      },
      CONFIG,
      verify,
    )

    expect(result.outcome).toBe('hash_mismatch')
    expect(verify).not.toHaveBeenCalled()
    expect(settleRowCalls.list).toEqual([])
  })
})

describe('5. an invalid encrypted envelope is rejected', () => {
  it('ENDS the read rather than falling back to the outer fields (edge case 16)', async () => {
    // Falling through to the outer fields is precisely what would let a forger
    // pair a captured envelope with plaintext of their own.
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          merchant_id: MID,
          response: 'abcdef0123456789' + Buffer.from('not-ciphertext').toString('base64'),
          TRANSACTIONID: ORDER_REF,
          TRANSACTIONSTATUS: '200',
        },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list).toEqual([])
    expect(captured.code).toBe(200)
  })
})

describe('6. a missing order reference is rejected', () => {
  it('settles nothing when the plaintext names no order', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope({ TRANSACTIONSTATUS: '200' }) },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list).toEqual([])
    expect(captured.code).toBe(200)
  })

  it('settles nothing for an empty body', async () => {
    const { res, captured } = mockRes()
    await handler({ method: 'POST', headers: {}, body: '' } as ApiRequest, res)

    expect(settleCalls.list).toEqual([])
    expect(captured.code).toBe(200)
  })
})

describe('7. an invalid amount is rejected', () => {
  it('a mismatched amount becomes requires_review — never paid, never failed (§10.5)', async () => {
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')

    const result = await actual.settleOrder(
      { orderRef: ORDER_REF },
      CONFIG,
      async () => ({ status: 200, amount: 500, apTransactionId: 'AP1', orderId: ORDER_REF }) as never,
    )

    expect(result.outcome).toBe('requires_review')
    expect(settleRowCalls.list).toEqual([{ ref: ORDER_REF, status: 'requires_review' }])
  })

  it('the callback cannot supply the amount that decides settlement', async () => {
    // The callback states 999999.00; the order is worth 2. Nothing in the
    // callback body reaches the comparison — settleOrder compares Airpay's
    // CONFIRMED figure against the server-computed total.
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope({ ...PAYLOAD, AMOUNT: '999999.00' }) },
      } as ApiRequest,
      res,
    )

    expect(settleRowCalls.list).toEqual([])
  })
})

describe('8. a callback never directly marks a payment paid', () => {
  it('a SUCCESS callback writes nothing without Order Confirmation (§0)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          merchant_id: MID,
          response: sealedEnvelope({
            ...PAYLOAD,
            TRANSACTIONSTATUS: '200',
            MESSAGE: 'Success',
          }),
        },
      } as ApiRequest,
      res,
    )

    // It says SUCCESS because someone typed SUCCESS.
    expect(settleRowCalls.list).toEqual([])
    expect((captured.body as Record<string, unknown>).outcome).toBe('pending')
  })

  it('a real settleOrder refuses to settle when verification is inconclusive', async () => {
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')

    const result = await actual.settleOrder({ orderRef: ORDER_REF }, CONFIG, async () => null)

    expect(result.outcome).toBe('pending')
    expect(settleRowCalls.list).toEqual([])
  })

  it('a statusless confirmation is pending, NOT failed (§10.4, edge case 23)', async () => {
    // A genuine ₹81 payment was terminally marked failed because null !== 200,
    // and terminal states cannot be recovered by the running system.
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')

    const result = await actual.settleOrder(
      { orderRef: ORDER_REF },
      CONFIG,
      async () => ({ status: null, amount: 2, apTransactionId: null, orderId: null }) as never,
    )

    expect(result.outcome).toBe('pending')
    expect(settleRowCalls.list).toEqual([])
  })

  it('a sandbox MID refuses to settle (§10.3, edge case 22)', async () => {
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')
    const verify = vi.fn()

    const result = await actual.settleOrder(
      { orderRef: ORDER_REF },
      { ...CONFIG, env: 'sandbox' },
      verify,
    )

    expect(result.outcome).toBe('unverifiable')
    expect(verify).not.toHaveBeenCalled()
    expect(settleRowCalls.list).toEqual([])
  })
})

describe('9. the existing settleOrder is reused', () => {
  it('the route calls settleOrder with the parsed fields and writes nothing itself', async () => {
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list).toHaveLength(1)
    expect(settleCalls.list[0]).toMatchObject({
      orderRef: ORDER_REF,
      apTransactionId: 'AP123456',
      transactionStatus: '200',
      customerVpa: 'someone@upi',
    })
    // No callback-specific database write.
    expect(settleRowCalls.list).toEqual([])
  })

  it('defines no settlement of its own', () => {
    const route = readFileSync('api/callback/cpm/arp_frontiva/collection.ts', 'utf8')
    const flow = readFileSync('api/_lib/callback-flow.ts', 'utf8')

    for (const source of [route, flow]) {
      expect(source).not.toContain('settleOrderRow')
      expect(source).not.toContain('verifyTransaction')
      expect(source).not.toContain('getServiceClient')
    }
  })
})

describe('10. the browser Response redirects correctly', () => {
  it('303s to /order-success?ref=…&t=… (§14.1)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...BROWSER },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    // 303 so a POSTed return becomes a GET.
    expect(captured.code).toBe(303)
    expect(captured.headers['Location']).toBe(
      `https://authenticmedia.fun/order-success?ref=${ORDER_REF}&t=${TOKEN}`,
    )
    expect(captured.headers['Cache-Control']).toBe('no-store')
  })

  it('looks the token up SERVER-SIDE, ignoring one supplied in the request (edge case 36)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...BROWSER },
        query: { t: 'attacker-supplied-token' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(captured.headers['Location']).toContain(TOKEN)
    expect(captured.headers['Location']).not.toContain('attacker-supplied-token')
  })

  it('sends an unknown reference to ?status=unknown rather than inventing a token', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...BROWSER },
        body: {
          merchant_id: MID,
          response: sealedEnvelope({ ...PAYLOAD, TRANSACTIONID: 'AM-NOPE-00000000' }),
        },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(303)
    expect(captured.headers['Location']).toContain('status=unknown')
  })

  it('redirects even when the body is unparseable, never 405 or 500', async () => {
    const { res, captured } = mockRes()
    await handler(
      { method: 'POST', headers: { ...BROWSER }, body: 'garbage' } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(303)
    expect(captured.headers['Location']).toContain('/order-success')
  })

  it('detects the browser by Accept when Sec-Fetch-Dest is absent (§8.2)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(303)
  })
})

describe('11. the machine IPN returns a safe 2xx', () => {
  it('answers 200 with the outcome in the body, never a redirect (§8.3)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(200)
    expect(captured.headers['Location']).toBeUndefined()
    expect(captured.body).toEqual({ received: true, outcome: 'pending' })
  })

  it('answers 200 even to an unparseable body — a retry storm is worse', async () => {
    const { res, captured } = mockRes()
    await handler(
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'nonsense' } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(200)
  })

  it('answers 2xx when settlement throws, and exposes no internals', async () => {
    const settle = await import('./_lib/settle.js')
    const spy = vi.spyOn(settle, 'settleOrder').mockRejectedValueOnce(new Error('db down'))

    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(200)
    expect(JSON.stringify(captured.body)).not.toContain('db down')
    spy.mockRestore()
  })
})

describe('12. sensitive values never appear in logs', () => {
  it('logs field NAMES and categories, never values, blobs or tokens (§9.8)', async () => {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(String(line))
    })

    const sealed = sealedEnvelope(PAYLOAD)
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...BROWSER },
        body: { merchant_id: MID, response: sealed },
      } as ApiRequest,
      res,
    )

    const output = lines.join('\n')
    spy.mockRestore()

    // Never: the encrypted blob, a credential, the order's read key, or a
    // customer's VPA.
    expect(output).not.toContain(sealed)
    expect(output).not.toContain(CONFIG.password)
    expect(output).not.toContain(CONFIG.apiKey)
    expect(output).not.toContain(CONFIG.secretKey)
    expect(output).not.toContain(TOKEN)
    expect(output).not.toContain('someone@upi')
    // But the diagnosable shape IS present.
    expect(output).toContain('payment.callback.received')
  })

  it('logs the failure CATEGORY for an unparseable body, with no blob', async () => {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(String(line))
    })

    const blob = 'abcdef0123456789' + Buffer.from('not-ciphertext').toString('base64')
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: blob },
      } as ApiRequest,
      res,
    )

    const output = lines.join('\n')
    spy.mockRestore()

    expect(output).toContain('payment.callback.unparseable')
    expect(output).toContain('envelope_unreadable')
    expect(output).not.toContain(blob)
  })
})

describe('13. the KKChat destination is exact', () => {
  it('⚠ PROVEN §13.2 — the middle segment is arp_frontiva, not arp', () => {
    expect(KKCHAT_DEFAULT_URL).toBe('https://kkchat.in/callback/cpm/arp_frontiva/collection')
    // KKChat answers 200 "success" to ANY middle segment and silently discards
    // what it does not recognise, so this mistake is invisible in every log.
    expect(KKCHAT_DEFAULT_URL).not.toBe('https://kkchat.in/callback/cpm/arp/collection')
  })

  it('relays to that URL as a JSON OBJECT, stringified exactly once (§13.1)', async () => {
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(fetches.list).toHaveLength(1)
    const call = fetches.list[0]
    if (!call) throw new Error('expected a relay call')

    expect(call.url).toBe('https://kkchat.in/callback/cpm/arp_frontiva/collection')
    expect(call.init.method).toBe('POST')
    expect((call.init.headers as Record<string, string>)['Content-Type']).toBe('application/json')

    // NOT a JSON string containing JSON (edge case 30).
    const parsed = JSON.parse(String(call.init.body)) as Record<string, unknown>
    expect(typeof parsed).toBe('object')
    // Values arrive as strings and STAY strings, with original casing.
    expect(parsed['TRANSACTIONID']).toBe(ORDER_REF)
    expect(parsed['TRANSACTIONSTATUS']).toBe('200')
  })

  it('relays the OPENED fields, never the sealed envelope', async () => {
    const sealed = sealedEnvelope(PAYLOAD)
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealed },
      } as ApiRequest,
      res,
    )

    expect(String(fetches.list[0]?.init.body)).not.toContain(sealed.slice(0, 32))
  })

  it('relays on BOTH legs (§13.6)', async () => {
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...BROWSER },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    // Relaying only the IPN leg fails silently and completely when Airpay
    // sends the browser leg alone.
    expect(fetches.list).toHaveLength(1)
  })

  it('relays only AFTER settlement, and never instead of it (§13.7)', async () => {
    const order: string[] = []
    const settle = await import('./_lib/settle.js')
    const spy = vi.spyOn(settle, 'settleOrder').mockImplementation(async () => {
      order.push('settle')
      return { outcome: 'pending' as const, orderRef: ORDER_REF, paymentStatus: null }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        order.push('relay')
        return new Response('success', { status: 200 })
      }),
    )

    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(order).toEqual(['settle', 'relay'])
    spy.mockRestore()
  })

  it('a KKChat outage never affects settlement or the reply (§13.3)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )

    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(settleCalls.list).toHaveLength(1)
    expect(captured.code).toBe(200)
  })

  it('never relays a callback that failed the merchant check', async () => {
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: '999999', response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(fetches.list).toEqual([])
  })

  it('KKCHAT_CALLBACK_URL=off opts out entirely (§13.3)', async () => {
    process.env['KKCHAT_CALLBACK_URL'] = 'off'

    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(PAYLOAD) },
      } as ApiRequest,
      res,
    )

    expect(fetches.list).toEqual([])
    // Settlement still happened: the relay is auxiliary.
    expect(settleCalls.list).toHaveLength(1)
  })

  it('bounds abuse at 64 fields and 1024 chars (§13.5)', async () => {
    const many: Record<string, string> = { TRANSACTIONID: ORDER_REF }
    for (let i = 0; i < 200; i += 1) many[`FIELD${i}`] = 'x'.repeat(5000)

    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealedEnvelope(many) },
      } as ApiRequest,
      res,
    )

    const parsed = JSON.parse(String(fetches.list[0]?.init.body)) as Record<string, string>
    expect(Object.keys(parsed).length).toBeLessThanOrEqual(64)
    for (const value of Object.values(parsed)) {
      expect(value.length).toBeLessThanOrEqual(1024)
    }
  })
})

describe('14/15. duplicate callbacks are idempotent', () => {
  it('a re-delivery settles through the same path without a second write', async () => {
    const body = { merchant_id: MID, response: sealedEnvelope(PAYLOAD) }

    for (let i = 0; i < 3; i += 1) {
      const { res, captured } = mockRes()
      await handler(
        { method: 'POST', headers: { 'content-type': 'application/json' }, body } as ApiRequest,
        res,
      )
      expect(captured.code).toBe(200)
    }

    // Every delivery goes through the one settleOrder; none writes directly.
    expect(settleCalls.list).toHaveLength(3)
    expect(settleRowCalls.list).toEqual([])
  })

  it('a terminal order short-circuits before Order Confirmation (§10.2, idempotency #1)', async () => {
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')
    orders.map.set(ORDER_REF, {
      ...(orders.map.get(ORDER_REF) as Record<string, unknown>),
      status: 'paid',
    })
    const verify = vi.fn()

    const result = await actual.settleOrder({ orderRef: ORDER_REF }, CONFIG, verify)

    expect(result.outcome).toBe('already_settled')
    expect(verify).not.toHaveBeenCalled()
    expect(settleRowCalls.list).toEqual([])
  })

  it('requires_review is terminal, so a later callback cannot overwrite it (edge case 45)', async () => {
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')
    orders.map.set(ORDER_REF, {
      ...(orders.map.get(ORDER_REF) as Record<string, unknown>),
      status: 'requires_review',
    })

    const result = await actual.settleOrder({ orderRef: ORDER_REF }, CONFIG, vi.fn())

    expect(result.outcome).toBe('already_settled')
    expect(settleRowCalls.list).toEqual([])
  })

  it('an unknown order is a stale retry or a probe, not an error', async () => {
    const actual = await vi.importActual<typeof import('./_lib/settle.js')>('./_lib/settle.js')

    const result = await actual.settleOrder({ orderRef: 'AM-NOPE-00000000' }, CONFIG, vi.fn())

    expect(result.outcome).toBe('unknown_order')
    expect(settleRowCalls.list).toEqual([])
  })
})
