import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { encrypt } from './_lib/airpay-crypto.js'
import type { AirpayConfig } from './_lib/config.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { KKCHAT_DEFAULT_URL } from './_lib/relay.js'

/**
 * Forwarding eligibility is decided by the PARSE, never by the database
 * (AIPAY-DOCS §13; AGENTS.md §30.9).
 *
 * The receiver at
 *
 *     https://authenticmedia.fun/callback/cpm/arp_frontiva/collection
 *
 * shares an Airpay MID with another system. Callbacks for payments this
 * application never created therefore arrive here, and they belong to KKChat
 * exactly as much as our own do. Whether we hold a matching order row decides
 * only whether WE settle something — it must never decide whether KKChat is
 * told.
 *
 * The regression this file pins: `relayFields` was populated only inside the
 * `if (sealed)` branch of the parser, so a callback that legitimately arrived
 * with NO envelope produced zero relay fields and the relay's "nothing to
 * send" guard skipped it silently. Such a delivery parsed, settled and was
 * answered 200 while never reaching KKChat, and no log line said so.
 *
 * The opposite failure is guarded just as hard: a delivery that failed the
 * merchant check or whose envelope would not open must relay NOTHING. This
 * endpoint is public and unauthenticated, so "forward everything that hits the
 * URL" would turn it into an open outbound POST relay.
 *
 * No live MID is contacted, no database is touched, and no payment is created.
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
 * Order Confirmation is stubbed to "inconclusive". Settlement therefore never
 * marks anything, which is the point: these tests are about FORWARDING, and no
 * assertion here may depend on an order becoming paid.
 */
vi.mock('./_lib/airpay.js', () => ({
  verifyTransaction: async () => null,
}))

/**
 * settleOrder is the REAL one, wrapped only to record its calls. The unknown-
 * order path under test lives inside it, so reimplementing it would test a
 * fiction.
 */
vi.mock('./_lib/settle.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./_lib/settle.js')>()
  return {
    ...actual,
    settleOrder: async (...args: Parameters<typeof actual.settleOrder>) => {
      const result = await actual.settleOrder(...args)
      settleCalls.list.push({ orderRef: args[0].orderRef, outcome: result.outcome })
      return result
    },
  }
})

const handler = (await import('./callback/cpm/arp_frontiva/collection.js')).default

const MID = '366950'

/** An order this application created. */
const KNOWN_REF = 'AM-RXF3Q-e01ed83e'
/** The reference from the real unforwarded delivery — not ours, and not AM-*. */
const FOREIGN_REF = '65844338940176261'

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

/** The native v4 envelope Airpay's live gateway posts (§9.3, §9.5). */
function sealedEnvelope(data: Record<string, string>): string {
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

function payloadFor(ref: string): Record<string, string> {
  return {
    TRANSACTIONID: ref,
    APTRANSACTIONID: 'AP123456',
    AMOUNT: '2.00',
    TRANSACTIONSTATUS: '200',
    MESSAGE: 'Success',
    CUSTOMERVPA: 'someone@upi',
  }
}

/** An enveloped IPN delivery, exactly as the live gateway posts it. */
function enveloped(ref: string): ApiRequest {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { merchant_id: MID, response: sealedEnvelope(payloadFor(ref)) },
  } as ApiRequest
}

/**
 * A form-urlencoded delivery carrying the fields in the CLEAR — no envelope.
 * `envelope: absent` is a documented, legitimate parse state (§9.6, §9.8), and
 * this is the shape of the delivery that was silently never forwarded.
 */
function plain(ref: string, extra: Record<string, string> = {}): ApiRequest {
  const params = new URLSearchParams({ merchant_id: MID, ...payloadFor(ref), ...extra })
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  } as ApiRequest
}

function relayBodies(): Array<Record<string, string>> {
  return fetches.list
    .filter((call) => call.url === KKCHAT_DEFAULT_URL)
    .map((call) => JSON.parse(String(call.init.body)) as Record<string, string>)
}

beforeEach(() => {
  orders.map.clear()
  settleCalls.list = []
  settleRowCalls.list = []
  fetches.list = []

  orders.map.set(KNOWN_REF, {
    id: 'order-uuid',
    reference: KNOWN_REF,
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

describe('1. a valid callback for a KNOWN order settles AND forwards', () => {
  it('forwards the enveloped delivery for an order we created', async () => {
    const { res, captured } = mockRes()
    await handler(enveloped(KNOWN_REF), res)

    expect(captured.code).toBe(200)
    expect(settleCalls.list).toHaveLength(1)
    expect(settleCalls.list[0]?.['orderRef']).toBe(KNOWN_REF)

    const bodies = relayBodies()
    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.['TRANSACTIONID']).toBe(KNOWN_REF)
  })

  it('the existing AM-* website flow is unchanged end to end', async () => {
    const { res, captured } = mockRes()
    await handler(enveloped(KNOWN_REF), res)

    // Settlement was attempted through the one settleOrder…
    expect(settleCalls.list).toHaveLength(1)
    // …Order Confirmation was inconclusive here, so nothing was written. The
    // point is that the pipeline ran, not that this stub says paid.
    expect(settleRowCalls.list).toEqual([])
    expect(captured.code).toBe(200)
    expect(relayBodies()).toHaveLength(1)
  })
})

describe('2. ⚠ a valid callback for an UNKNOWN order forwards anyway', () => {
  it('forwards an ENVELOPED callback whose reference we have never seen', async () => {
    const { res, captured } = mockRes()
    await handler(enveloped(FOREIGN_REF), res)

    // No local order: nothing settled, nothing written.
    expect(captured.body).toEqual({ received: true, outcome: 'unknown_order' })
    expect(settleRowCalls.list).toEqual([])

    // …and KKChat was told regardless.
    const bodies = relayBodies()
    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.['TRANSACTIONID']).toBe(FOREIGN_REF)
  })

  it('⚠ REGRESSION — forwards a valid callback carrying NO envelope', async () => {
    // The delivery that was silently dropped: `envelope: absent`, a real
    // reference, an ap_SecureHash present. It parsed, it settled to
    // unknown_order, it was answered 200 — and it never reached KKChat,
    // because relayFields was only ever filled on the decrypted path.
    const { res, captured } = mockRes()
    await handler(plain(FOREIGN_REF, { ap_SecureHash: '1234567890' }), res)

    expect(captured.body).toEqual({ received: true, outcome: 'unknown_order' })
    expect(settleRowCalls.list).toEqual([])

    const bodies = relayBodies()
    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.['TRANSACTIONID']).toBe(FOREIGN_REF)
  })

  it('forwards an unknown-order callback on the BROWSER leg too (§13.6)', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'sec-fetch-dest': 'document' },
        body: { merchant_id: MID, response: sealedEnvelope(payloadFor(FOREIGN_REF)) },
      } as ApiRequest,
      res,
    )

    expect(captured.code).toBe(303)
    expect(relayBodies()).toHaveLength(1)
  })

  it('a KKChat outage on an unknown-order callback still answers Airpay 2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )

    const { res, captured } = mockRes()
    await handler(enveloped(FOREIGN_REF), res)

    expect(captured.code).toBe(200)
  })
})

describe('3. duplicates forward, and settle exactly once', () => {
  it('a re-delivery for a TERMINAL order forwards again but never re-settles', async () => {
    orders.map.set(KNOWN_REF, {
      id: 'order-uuid',
      reference: KNOWN_REF,
      status: 'paid',
      totalInr: 2,
      accessToken: TOKEN,
      paymentMethod: 'airpay',
      apTransactionId: 'AP123456',
      createdAt: '2026-08-31T00:00:00Z',
    })

    const { res: res1, captured: c1 } = mockRes()
    await handler(enveloped(KNOWN_REF), res1)
    const { res: res2, captured: c2 } = mockRes()
    await handler(enveloped(KNOWN_REF), res2)

    // Idempotency #1: terminal short-circuits before Order Confirmation, and
    // NOTHING is written on either delivery.
    expect(c1.body).toEqual({ received: true, outcome: 'already_settled' })
    expect(c2.body).toEqual({ received: true, outcome: 'already_settled' })
    expect(settleRowCalls.list).toEqual([])

    // Forwarding follows the delivery, not the settlement. KKChat already saw
    // both deliveries under the previous integration, where its own endpoint
    // was registered as the Response AND IPN URL — suppressing the second here
    // would be a behaviour change, not a fix.
    expect(relayBodies()).toHaveLength(2)
  })

  it('two deliveries of an UNKNOWN reference forward twice and settle nothing', async () => {
    const { res: res1 } = mockRes()
    await handler(enveloped(FOREIGN_REF), res1)
    const { res: res2 } = mockRes()
    await handler(enveloped(FOREIGN_REF), res2)

    expect(settleRowCalls.list).toEqual([])
    expect(relayBodies()).toHaveLength(2)
  })
})

describe('4. rejected deliveries forward NOTHING', () => {
  it('a merchant MISMATCH is never opened and never forwarded', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: '999999', response: sealedEnvelope(payloadFor(FOREIGN_REF)) },
      } as ApiRequest,
      res,
    )

    expect(captured.body).toEqual({ received: true, outcome: 'unparseable' })
    expect(fetches.list).toEqual([])
  })

  it('a plaintext delivery stating another merchant is not forwarded either', async () => {
    // Without the envelope there is nothing to decrypt, so the merchant check
    // is the ONLY thing standing between a hand-written POST and an outbound
    // relay. It must hold on this path exactly as on the sealed one.
    const params = new URLSearchParams({
      merchant_id: '999999',
      ...payloadFor(FOREIGN_REF),
    })
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      } as ApiRequest,
      res,
    )

    expect(captured.body).toEqual({ received: true, outcome: 'unparseable' })
    expect(fetches.list).toEqual([])
  })

  it('an UNREADABLE envelope ends the read and forwards nothing', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
      } as ApiRequest,
      res,
    )

    expect(captured.body).toEqual({ received: true, outcome: 'unparseable' })
    expect(fetches.list).toEqual([])
  })

  it('an unreadable envelope does not fall back to forwarding the OUTER fields', async () => {
    // Edge case 16, in relay form: pairing a captured envelope with plaintext
    // of one's own must not become a way to push chosen fields to KKChat.
    const params = new URLSearchParams({
      merchant_id: MID,
      response: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      TRANSACTIONID: FOREIGN_REF,
      TRANSACTIONSTATUS: '200',
    })
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      } as ApiRequest,
      res,
    )

    expect(fetches.list).toEqual([])
  })

  it('a body with no order reference at all is not forwarded', async () => {
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'merchant_id=' + MID + '&hello=world',
      } as ApiRequest,
      res,
    )

    expect(captured.body).toEqual({ received: true, outcome: 'unparseable' })
    expect(fetches.list).toEqual([])
  })

  it('an empty body is not forwarded', async () => {
    const { res, captured } = mockRes()
    await handler({ method: 'POST', headers: {}, body: '' } as ApiRequest, res)

    expect(captured.body).toEqual({ received: true, outcome: 'unparseable' })
    expect(fetches.list).toEqual([])
  })
})

describe('5. SecureHash rejects a settlement, never a forward', () => {
  it('a WRONG ap_SecureHash blocks settlement while the delivery still forwards', async () => {
    // ap_SecureHash is CRC32 — unkeyed, so anyone who can reach the endpoint
    // can compute a valid one. It may only ever ADD a rejection to settlement
    // (§10.3) and can never be treated as authentication. It therefore does
    // not gate the relay: a hash it cannot check is not grounds to withhold a
    // delivery from KKChat, and it is not grounds to pay anyone either.
    const { res, captured } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          merchant_id: MID,
          response: sealedEnvelope({
            ...payloadFor(KNOWN_REF),
            ap_SecureHash: '999999999',
          }),
        },
      } as ApiRequest,
      res,
    )

    // Settlement refused, and nothing written.
    expect(captured.body).toEqual({ received: true, outcome: 'hash_mismatch' })
    expect(settleRowCalls.list).toEqual([])

    expect(relayBodies()).toHaveLength(1)
  })
})

describe('6. the forwarded payload format is unchanged', () => {
  it('one JSON object, original casing, values still strings (§13.1)', async () => {
    const { res } = mockRes()
    await handler(enveloped(FOREIGN_REF), res)

    const call = fetches.list[0]
    if (!call) throw new Error('expected a relay call')

    expect(call.url).toBe('https://kkchat.in/callback/cpm/arp_frontiva/collection')
    expect(call.init.method).toBe('POST')
    expect((call.init.headers as Record<string, string>)['Content-Type']).toBe('application/json')

    // NOT a JSON string containing JSON (edge case 30).
    const parsed = JSON.parse(String(call.init.body)) as Record<string, unknown>
    expect(typeof parsed).toBe('object')
    expect(Array.isArray(parsed)).toBe(false)

    expect(parsed['TRANSACTIONID']).toBe(FOREIGN_REF)
    expect(parsed['APTRANSACTIONID']).toBe('AP123456')
    expect(parsed['AMOUNT']).toBe('2.00')
    expect(parsed['TRANSACTIONSTATUS']).toBe('200')
    expect(parsed['MESSAGE']).toBe('Success')
    expect(parsed['CUSTOMERVPA']).toBe('someone@upi')

    for (const value of Object.values(parsed)) expect(typeof value).toBe('string')
  })

  it('the SEALED envelope is never forwarded, on either path', async () => {
    const sealed = sealedEnvelope(payloadFor(FOREIGN_REF))
    const { res } = mockRes()
    await handler(
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { merchant_id: MID, response: sealed },
      } as ApiRequest,
      res,
    )

    const body = String(fetches.list[0]?.init.body)
    expect(body).not.toContain(sealed.slice(0, 32))
    expect(body).not.toContain('"response"')
  })

  it('the envelope-less path forwards the fields as received', async () => {
    const { res } = mockRes()
    await handler(plain(FOREIGN_REF), res)

    const parsed = relayBodies()[0]
    if (!parsed) throw new Error('expected a relay call')
    expect(parsed['TRANSACTIONID']).toBe(FOREIGN_REF)
    expect(parsed['TRANSACTIONSTATUS']).toBe('200')
    for (const value of Object.values(parsed)) expect(typeof value).toBe('string')
  })

  it('abuse bounds still apply to the envelope-less path (§13.5)', async () => {
    // This path forwards fields that were never inside an envelope, so the
    // caps are the only thing bounding an outbound POST anyone can trigger.
    const many: Record<string, string> = {}
    for (let i = 0; i < 200; i += 1) many[`FIELD${i}`] = 'x'.repeat(5000)

    const { res } = mockRes()
    await handler(plain(FOREIGN_REF, many), res)

    const parsed = relayBodies()[0]
    if (!parsed) throw new Error('expected a relay call')
    expect(Object.keys(parsed).length).toBeLessThanOrEqual(64)
    for (const value of Object.values(parsed)) expect(value.length).toBeLessThanOrEqual(1024)
  })
})

describe('7. the destination and the receiver are unchanged', () => {
  it('⚠ PROVEN §13.2 — the middle segment stays arp_frontiva', () => {
    expect(KKCHAT_DEFAULT_URL).toBe('https://kkchat.in/callback/cpm/arp_frontiva/collection')
  })

  it('every forward in this file went to exactly that URL', async () => {
    const { res } = mockRes()
    await handler(enveloped(FOREIGN_REF), res)
    await handler(plain(FOREIGN_REF), mockRes().res)

    expect(fetches.list.map((call) => call.url)).toEqual([
      KKCHAT_DEFAULT_URL,
      KKCHAT_DEFAULT_URL,
    ])
  })

  it('KKCHAT_CALLBACK_URL=off still opts out, unknown order included (§13.3)', async () => {
    process.env['KKCHAT_CALLBACK_URL'] = 'off'

    const { res, captured } = mockRes()
    await handler(enveloped(FOREIGN_REF), res)

    expect(fetches.list).toEqual([])
    // The pipeline still ran; the relay is auxiliary.
    expect(captured.code).toBe(200)
  })
})

describe('8. forwarding never touches settlement', () => {
  it('no order row is written for any unknown-order delivery in this file', async () => {
    await handler(enveloped(FOREIGN_REF), mockRes().res)
    await handler(plain(FOREIGN_REF), mockRes().res)
    await handler(plain(FOREIGN_REF, { TRANSACTIONSTATUS: '200' }), mockRes().res)

    expect(settleRowCalls.list).toEqual([])
    expect(relayBodies()).toHaveLength(3)
  })

  it('an unknown reference is never invented as an order', async () => {
    await handler(enveloped(FOREIGN_REF), mockRes().res)

    expect(orders.map.has(FOREIGN_REF)).toBe(false)
  })
})
