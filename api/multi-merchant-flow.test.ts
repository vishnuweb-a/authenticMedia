import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decrypt, encrypt } from './_lib/airpay-crypto.js'
import type { AirpayConfig } from './_lib/config.js'
import type { ApiRequest, ApiResponse } from './_lib/http.js'
import { KKCHAT_DEFAULT_URL, KKCHAT_MERCHANT_2_URL } from './_lib/relay.js'

/**
 * Multi-merchant FLOW regression tests (AIPAY-DOCS §2.4, AGENTS.md §30.9).
 *
 * Everything here runs against mocks and placeholder fixtures. No live MID is
 * contacted and no payment is created.
 *
 * The property that matters most: an order is verified and settled with the
 * credentials of the merchant that CREATED it — recovered from our own order
 * reference — and never with whichever merchant happens to be active now.
 */

const orders = vi.hoisted(() => ({ map: new Map<string, Record<string, unknown>>() }))
const settleRowCalls = vi.hoisted(() => ({ list: [] as Array<Record<string, unknown>> }))
const fetches = vi.hoisted(() => ({ list: [] as Array<{ url: string; init: RequestInit }> }))

vi.mock('./_lib/db.js', () => ({
  findOrderByRef: async (ref: string) => orders.map.get(ref) ?? null,
  findUnsettledOrders: async () => [],
  settleOrderRow: async (ref: string, status: string, apId: string | null) => {
    settleRowCalls.list.push({ ref, status, apId })
    return 'order-uuid'
  },
  getServiceClient: () => {
    throw new Error('these tests must not touch the database directly')
  },
}))

const { settleOrder } = await import('./_lib/settle.js')
const { handleAirpayCallback } = await import('./_lib/callback-flow.js')
const { getAccessToken, resetTokenCache } = await import('./_lib/airpay.js')
const { loadAirpayConfig } = await import('./_lib/config.js')

const MID_1 = '368250'
const MID_2 = '362380'

const M1: Record<string, string> = {
  AIRPAY_MID: MID_1,
  AIRPAY_CLIENT_ID: 'm1-client-placeholder',
  AIRPAY_SECRET_KEY: 'm1-oauth-secret-placeholder',
  AIRPAY_API_KEY: 'm1-api-key-placeholder',
  AIRPAY_USERNAME: 'm1-user-placeholder',
  AIRPAY_PASSWORD: 'm1-pass-placeholder',
}

const M2: Record<string, string> = {
  AIRPAY_MID_2: MID_2,
  AIRPAY_CLIENT_ID_2: 'm2-client-placeholder',
  AIRPAY_SECRET_KEY_2: 'm2-oauth-secret-placeholder',
  AIRPAY_API_KEY_2: 'm2-api-key-placeholder',
  AIRPAY_USERNAME_2: 'm2-user-placeholder',
  AIRPAY_PASSWORD_2: 'm2-pass-placeholder',
}

const REF_1 = 'AM-EMF8G-11111111'
const REF_2 = 'AM2-EMF8G-22222222'

beforeEach(() => {
  for (const [k, v] of Object.entries({ ...M1, ...M2 })) process.env[k] = v
  process.env['AIRPAY_ENV'] = 'live'
  delete process.env['AIRPAY_ACTIVE_MERCHANT']
  delete process.env['KKCHAT_CALLBACK_URL']
  orders.map.clear()
  settleRowCalls.list = []
  fetches.list = []
  resetTokenCache()
})

function seedOrder(ref: string, overrides: Record<string, unknown> = {}): void {
  orders.map.set(ref, {
    id: 'order-uuid',
    reference: ref,
    status: 'pending_payment',
    totalInr: 1499,
    accessToken: '11111111-1111-4111-8111-111111111111',
    paymentMethod: 'airpay',
    apTransactionId: null,
    createdAt: '2026-08-31T00:00:00Z',
    ...overrides,
  })
}

interface Captured {
  code: number
  body: unknown
  headers: Record<string, string>
}

function makeRes(): { res: ApiResponse; captured: Captured } {
  const captured: Captured = { code: 0, body: undefined, headers: {} }
  const res = {
    status(code: number) {
      captured.code = code
      return this
    },
    json(body: unknown) {
      captured.body = body
      return this
    },
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value
      return this
    },
    end() {
      return this
    },
  } as unknown as ApiResponse
  return { res, captured }
}

function makeReq(fields: Record<string, string>, headers: Record<string, string> = {}): ApiRequest {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    query: {},
    body: new URLSearchParams(fields).toString(),
  } as unknown as ApiRequest
}

describe('6/7. OAuth uses the selected merchant credentials', () => {
  async function captureOAuth(merchant: 1 | 2): Promise<Record<string, string>> {
    let sent: Record<string, string> = {}
    vi.stubGlobal(
      'fetch',
      async (_url: string, init: RequestInit) => {
        sent = Object.fromEntries(new URLSearchParams(String(init.body)))
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ data: { access_token: `token-m${merchant}` } }),
        } as unknown as Response
      },
    )
    const config = loadAirpayConfig(merchant)
    const token = await getAccessToken(config)
    expect(token).toBe(`token-m${merchant}`)
    vi.unstubAllGlobals()
    return sent
  }

  it('6. merchant 1 mints its token with the FIRST credential set', async () => {
    const sent = await captureOAuth(1)
    expect(sent['merchant_id']).toBe(MID_1)

    // The credentials travel inside encdata. Open it with merchant 1's key —
    // which only works if merchant 1's key sealed it.
    const plaintext = decrypt(sent['encdata'] as string, loadAirpayConfig(1))
    expect(plaintext).not.toBeNull()
    const payload = JSON.parse(plaintext as string) as Record<string, string>
    expect(payload['client_id']).toBe(M1['AIRPAY_CLIENT_ID'])
    // ⚠ PROVEN §2.2 — client_secret is SECRET_KEY, never API_KEY.
    expect(payload['client_secret']).toBe(M1['AIRPAY_SECRET_KEY'])
    expect(payload['merchant_id']).toBe(MID_1)
  })

  it('7. merchant 2 mints its token with the SECOND credential set', async () => {
    const sent = await captureOAuth(2)
    expect(sent['merchant_id']).toBe(MID_2)

    const plaintext = decrypt(sent['encdata'] as string, loadAirpayConfig(2))
    expect(plaintext).not.toBeNull()
    const payload = JSON.parse(plaintext as string) as Record<string, string>
    expect(payload['client_id']).toBe(M2['AIRPAY_CLIENT_ID_2'])
    expect(payload['client_secret']).toBe(M2['AIRPAY_SECRET_KEY_2'])
    expect(payload['merchant_id']).toBe(MID_2)

    // Merchant 1's key must NOT open merchant 2's envelope.
    expect(decrypt(sent['encdata'] as string, loadAirpayConfig(1))).toBeNull()
  })

  it('never serves merchant 2 a token minted for merchant 1 (cache is keyed)', async () => {
    const seen: string[] = []
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const body = Object.fromEntries(new URLSearchParams(String(init.body)))
      seen.push(body['merchant_id'] as string)
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () =>
          JSON.stringify({ data: { access_token: `token-${body['merchant_id']}` } }),
      } as unknown as Response
    })

    const t1 = await getAccessToken(loadAirpayConfig(1))
    const t2 = await getAccessToken(loadAirpayConfig(2))

    // A single shared cache slot would have handed merchant 2 token-368250.
    expect(t1).toBe(`token-${MID_1}`)
    expect(t2).toBe(`token-${MID_2}`)
    expect(seen).toEqual([MID_1, MID_2])

    // Each is then cached independently — no further round trips.
    expect(await getAccessToken(loadAirpayConfig(1))).toBe(`token-${MID_1}`)
    expect(await getAccessToken(loadAirpayConfig(2))).toBe(`token-${MID_2}`)
    expect(seen).toHaveLength(2)
    vi.unstubAllGlobals()
  })
})

describe('9/15. verification uses the credentials of the ORDER’s merchant', () => {
  it('9. an AM- order is verified against merchant 1', async () => {
    seedOrder(REF_1)
    const seen: AirpayConfig[] = []
    await settleOrder({ orderRef: REF_1 }, undefined, async (_ref, config) => {
      seen.push(config)
      return null
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.merchant).toBe(1)
    expect(seen[0]?.mid).toBe(MID_1)
  })

  it('9. an AM2- order is verified against merchant 2', async () => {
    seedOrder(REF_2)
    const seen: AirpayConfig[] = []
    await settleOrder({ orderRef: REF_2 }, undefined, async (_ref, config) => {
      seen.push(config)
      return null
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.merchant).toBe(2)
    expect(seen[0]?.mid).toBe(MID_2)
  })

  it('9. flipping the ACTIVE merchant does not change how a pending order settles', async () => {
    // The exact hazard: the switch is flipped to 2 while an AM- order is still
    // pending. That order must still be asked of merchant 1.
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    seedOrder(REF_1)
    const seen: AirpayConfig[] = []
    await settleOrder({ orderRef: REF_1 }, undefined, async (_ref, config) => {
      seen.push(config)
      return null
    })
    expect(seen[0]?.mid).toBe(MID_1)

    // And the reverse: an AM2- order still asks merchant 2 after a flip back.
    delete process.env['AIRPAY_ACTIVE_MERCHANT']
    seedOrder(REF_2)
    seen.length = 0
    await settleOrder({ orderRef: REF_2 }, undefined, async (_ref, config) => {
      seen.push(config)
      return null
    })
    expect(seen[0]?.mid).toBe(MID_2)
  })

  it('15. settlement for BOTH merchants still requires Order Confirmation', async () => {
    for (const ref of [REF_1, REF_2]) {
      seedOrder(ref)
      // Confirmation inconclusive -> pending, never paid.
      const result = await settleOrder({ orderRef: ref }, undefined, async () => null)
      expect(result.outcome).toBe('pending')
    }
    // Nothing was written for either merchant.
    expect(settleRowCalls.list).toEqual([])
  })

  it('15. a merchant-2 order is paid ONLY on a verified confirmation', async () => {
    seedOrder(REF_2)
    const result = await settleOrder({ orderRef: REF_2 }, undefined, async (ref, config) => {
      expect(config.mid).toBe(MID_2)
      return { orderRef: ref, status: 200, amount: 1499, apTransactionId: 'AP-2' }
    })
    expect(result.outcome).toBe('paid')
    expect(settleRowCalls.list).toEqual([{ ref: REF_2, status: 'succeeded', apId: 'AP-2' }])
  })

  it('15. a merchant-2 amount mismatch becomes requires_review, never paid (§10.5)', async () => {
    seedOrder(REF_2)
    const result = await settleOrder({ orderRef: REF_2 }, undefined, async (ref) => ({
      orderRef: ref,
      status: 200,
      amount: 1,
      apTransactionId: 'AP-2',
    }))
    expect(result.outcome).toBe('requires_review')
    expect(settleRowCalls.list[0]?.['status']).toBe('requires_review')
  })

  it('15. a statusless confirmation stays pending for merchant 2 too (⚠ PROVEN §10.4)', async () => {
    seedOrder(REF_2)
    const result = await settleOrder({ orderRef: REF_2 }, undefined, async (ref) => ({
      orderRef: ref,
      status: null as unknown as number,
      amount: 1499,
      apTransactionId: null,
    }))
    // null !== 200 must NOT become "failed". A genuine payment was destroyed
    // exactly that way once.
    expect(result.outcome).toBe('pending')
    expect(settleRowCalls.list).toEqual([])
  })

  it('16. a client-supplied MID in the payload cannot change the credentials used', async () => {
    seedOrder(REF_1)
    const seen: AirpayConfig[] = []
    await settleOrder(
      // Nothing a caller can put in the payload names a merchant; the shape
      // has no such field, and the reference is the sole selector.
      { orderRef: REF_1, transactionStatus: '200', amount: '999999' },
      undefined,
      async (_ref, config) => {
        seen.push(config)
        return null
      },
    )
    expect(seen[0]?.mid).toBe(MID_1)
  })
})

describe('10/11/12/13. callback routing and the relay', () => {
  /**
   * Relay calls ONLY.
   *
   * The stub below also catches the real settlement path's OAuth and Order
   * Confirmation calls to kraken.airpay.co.in, which are correct and expected.
   * The property under test is what reaches KKCHAT — asserting on the raw
   * fetch count would pass or fail for the wrong reasons.
   */
  function relayCalls(): Array<{ url: string; init: RequestInit }> {
    return fetches.list.filter((call) => call.url.includes('kkchat.in'))
  }

  function stubRelay(): void {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      fetches.list.push({ url: String(url), init })
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => 'success',
      } as unknown as Response
    })
  }

  it('11. the existing arp_frontiva callback still settles and relays merchant 1', async () => {
    stubRelay()
    seedOrder(REF_1)

    const config = loadAirpayConfig(1)
    const sealed = encrypt(
      JSON.stringify({ TRANSACTIONID: REF_1, APTRANSACTIONID: 'AP-1', TRANSACTIONSTATUS: '200' }),
      config,
    )

    const { res, captured } = makeRes()
    await handleAirpayCallback(
      makeReq({ merchant_id: MID_1, encdata: sealed }),
      res,
      { relay: true },
    )

    expect(captured.code).toBe(200)
    // Relayed, to merchant 1's confirmed segment — unchanged.
    expect(relayCalls()).toHaveLength(1)
    expect(relayCalls()[0]?.url).toBe(KKCHAT_DEFAULT_URL)
    expect(relayCalls()[0]?.url).toContain('arp_frontiva')
    vi.unstubAllGlobals()
  })

  it('10. a callback stating the OTHER merchant is rejected before decryption', async () => {
    stubRelay()
    seedOrder(REF_2)

    // Sealed with merchant 2's key and stating merchant 2's MID, delivered to
    // merchant 1's receiver.
    const sealed = encrypt(JSON.stringify({ TRANSACTIONID: REF_2 }), loadAirpayConfig(2))

    const { res, captured } = makeRes()
    await handleAirpayCallback(makeReq({ merchant_id: MID_2, encdata: sealed }), res, {
      relay: true,
    })

    expect(captured.code).toBe(200) // 2xx so Airpay does not retry (§8.3)
    expect(captured.body).toEqual({ received: true, outcome: 'unparseable' })
    // Never opened, never settled, never relayed.
    expect(settleRowCalls.list).toEqual([])
    expect(relayCalls()).toEqual([])
    vi.unstubAllGlobals()
  })

  it('12/13. a merchant-2 order is NEVER relayed onward — no loop is constructible', async () => {
    stubRelay()
    seedOrder(REF_2)

    // The hostile shape: a merchant-2 ORDER reference inside an envelope that
    // merchant 1's receiver can actually open. Even here the relay must not
    // fire, or KKChat -> AuthenticMedia -> KKChat becomes possible.
    const sealed = encrypt(
      JSON.stringify({ TRANSACTIONID: REF_2, TRANSACTIONSTATUS: '200' }),
      loadAirpayConfig(1),
    )

    const { res, captured } = makeRes()
    await handleAirpayCallback(makeReq({ merchant_id: MID_1, encdata: sealed }), res, {
      relay: true,
    })

    expect(captured.code).toBe(200)
    // The guard is on the ORDER REFERENCE, so it holds regardless of how the
    // delivery got here. Nothing was sent to KKChat at all — so no second
    // delivery, and no loop.
    expect(relayCalls()).toEqual([])
    // Specifically never to merchant 2's own URL, which Airpay already posts
    // to directly.
    expect(fetches.list.map((c) => c.url)).not.toContain(KKCHAT_MERCHANT_2_URL)
    vi.unstubAllGlobals()
  })

  it('13. nothing in the codebase ever POSTs to merchant 2’s KKChat URL', () => {
    // Airpay delivers there directly. A relay of ours would be a DUPLICATE
    // delivery, and pointing our relay at it is how a loop would start.
    expect(KKCHAT_MERCHANT_2_URL).toBe('https://kkchat.in/callback/cpm/arp/collection')
    expect(KKCHAT_DEFAULT_URL).toBe('https://kkchat.in/callback/cpm/arp_frontiva/collection')
    // The two must never be normalised into each other (§13.2).
    expect(KKCHAT_MERCHANT_2_URL).not.toBe(KKCHAT_DEFAULT_URL)
    expect(KKCHAT_MERCHANT_2_URL).not.toContain('arp_frontiva')
    expect(KKCHAT_DEFAULT_URL).toContain('arp_frontiva')
    // Both keep the trailing segment KKChat actually routes on.
    expect(KKCHAT_MERCHANT_2_URL.endsWith('/collection')).toBe(true)
    expect(KKCHAT_DEFAULT_URL.endsWith('/collection')).toBe(true)
  })

  it('14. duplicate merchant-2 callbacks remain idempotent', async () => {
    stubRelay()
    seedOrder(REF_2, { status: 'paid' })

    const sealed = encrypt(JSON.stringify({ TRANSACTIONID: REF_2 }), loadAirpayConfig(1))

    for (let i = 0; i < 3; i += 1) {
      const { res, captured } = makeRes()
      await handleAirpayCallback(makeReq({ merchant_id: MID_1, encdata: sealed }), res, {
        relay: true,
      })
      expect(captured.code).toBe(200)
    }

    // A terminal order short-circuits: no write, no relay, on any delivery.
    expect(settleRowCalls.list).toEqual([])
    expect(relayCalls()).toEqual([])
    vi.unstubAllGlobals()
  })

  it('a callback body claiming SUCCESS still cannot pay a merchant-2 order (§0)', async () => {
    stubRelay()
    seedOrder(REF_2)

    const sealed = encrypt(
      JSON.stringify({
        TRANSACTIONID: REF_2,
        TRANSACTIONSTATUS: '200',
        MESSAGE: 'SUCCESS',
        AMOUNT: '1499.00',
      }),
      loadAirpayConfig(1),
    )

    const { res } = makeRes()
    await handleAirpayCallback(makeReq({ merchant_id: MID_1, encdata: sealed }), res, {
      relay: true,
    })

    // Order Confirmation was never reachable here, so nothing was settled.
    // The callback said SUCCESS because someone typed SUCCESS.
    expect(settleRowCalls.list).toEqual([])
    vi.unstubAllGlobals()
  })
})

describe('an unknown Airpay status is merchant-agnostic (§11.4)', () => {
  /**
   * Regression for AM2-MAJUV-d7557745. The unknown-status guard must behave
   * identically for both merchants — it is keyed purely on the status code and
   * carries no merchant term — while merchant routing stays exactly as it was.
   */

  const CASES = [
    { ref: REF_1, merchant: 1, mid: MID_1, label: 'AM- / merchant 1' },
    { ref: REF_2, merchant: 2, mid: MID_2, label: 'AM2- / merchant 2' },
  ] as const

  for (const { ref, merchant, mid, label } of CASES) {
    it(`7/8/9. ${label}: status 503 stays pending, on the RIGHT credentials`, async () => {
      seedOrder(ref)
      const seen: AirpayConfig[] = []

      const result = await settleOrder({ orderRef: ref }, undefined, async (r, config) => {
        seen.push(config)
        return { orderRef: r, status: 503, amount: 1499, apTransactionId: null }
      })

      // The unknown status is pending for BOTH merchants, and nothing is written.
      expect(result.outcome).toBe('pending')
      expect(settleRowCalls.list).toEqual([])

      // 8/9. Routing is untouched: the order's OWN merchant was asked.
      expect(seen).toHaveLength(1)
      expect(seen[0]?.merchant).toBe(merchant)
      expect(seen[0]?.mid).toBe(mid)
    })

    it(`7. ${label}: status 400 still settles failed on the RIGHT credentials`, async () => {
      seedOrder(ref)
      const seen: AirpayConfig[] = []

      const result = await settleOrder({ orderRef: ref }, undefined, async (r, config) => {
        seen.push(config)
        return { orderRef: r, status: 400, amount: 1499, apTransactionId: 'AP-400' }
      })

      expect(result.outcome).toBe('failed')
      expect(settleRowCalls.list).toEqual([{ ref, status: 'failed', apId: 'AP-400' }])
      expect(seen[0]?.merchant).toBe(merchant)
      expect(seen[0]?.mid).toBe(mid)
    })

    it(`7. ${label}: status 200 still settles paid on the RIGHT credentials`, async () => {
      seedOrder(ref)
      const seen: AirpayConfig[] = []

      const result = await settleOrder({ orderRef: ref }, undefined, async (r, config) => {
        seen.push(config)
        return { orderRef: r, status: 200, amount: 1499, apTransactionId: 'AP-200' }
      })

      expect(result.outcome).toBe('paid')
      expect(settleRowCalls.list).toEqual([{ ref, status: 'succeeded', apId: 'AP-200' }])
      expect(seen[0]?.merchant).toBe(merchant)
      expect(seen[0]?.mid).toBe(mid)
    })

    it(`7. ${label}: status 211 still stays pending`, async () => {
      seedOrder(ref)
      const result = await settleOrder({ orderRef: ref }, undefined, async (r) => ({
        orderRef: r,
        status: 211,
        amount: 1499,
        apTransactionId: null,
      }))

      expect(result.outcome).toBe('pending')
      expect(settleRowCalls.list).toEqual([])
    })
  }

  it('MID 1 is entirely unaffected across the whole documented status set', async () => {
    // The property that matters for the existing production merchant: for
    // every code MID 1 has ever returned, the outcome is what it always was.
    const expected: ReadonlyArray<[number, string]> = [
      [200, 'paid'],
      [211, 'pending'],
      [400, 'failed'],
    ]

    for (const [status, outcome] of expected) {
      settleRowCalls.list = []
      seedOrder(REF_1)
      const result = await settleOrder({ orderRef: REF_1 }, undefined, async (r) => ({
        orderRef: r,
        status,
        amount: 1499,
        apTransactionId: 'AP-1',
      }))
      expect(result.outcome, `MID 1 status ${status}`).toBe(outcome)
    }
  })
})
