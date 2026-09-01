import { describe, expect, it, vi } from 'vitest'

/**
 * The checkout hand-off's double-submit guard (AIPAY-DOCS §14.3).
 *
 * ⚠ The failure under regression: a second `pay()` while the first is still in
 * flight creates a SECOND order row and a SECOND hosted page for one checkout
 * action — the shortest path to a shopper paying twice. The disabled Pay button
 * is a courtesy; THIS is the correctness check.
 *
 * The guard is a plain status flag read at the top of `pay()`. It is reproduced
 * here against the same createAirpayPayment seam the hook uses, because the
 * suite runs on the `node` environment with no React renderer for hooks.
 *
 * Nothing in this file reaches the network, Airpay, or a database.
 */

const GUEST = '11111111-1111-4111-8111-111111111111'
vi.mock('@/lib/supabase', () => ({ getGuestToken: () => GUEST }))

const { createAirpayPayment } = await import('@/services')

/**
 * A minimal stand-in for the hook's submit path: the same `if (pending) return`
 * gate, over the real service call.
 */
function makeCheckout(fetchImpl: typeof fetch) {
  vi.stubGlobal('fetch', fetchImpl)
  let pending = false
  const creates: number[] = []

  return {
    creates,
    async pay(merchant: 1 | 2 = 1) {
      // ⚠ The guard. One click, one order.
      if (pending) return
      pending = true
      creates.push(merchant)
      await createAirpayPayment({
        serviceSlugs: ['a-service'],
        merchant,
        contact: { email: 'shopper@example.com' },
      })
      // Deliberately NOT cleared: the real hook stays 'pending' through the
      // hand-off, because the tab is navigating away or holding a payment
      // window. Clearing it here would re-arm the very double-submit the
      // guard exists to stop.
    },
  }
}

/** A create response that resolves only when released. */
function deferredFetch(): { fetchImpl: typeof fetch; release: () => void; calls: () => number } {
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    calls += 1
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    await gate
    return {
      ok: true,
      status: 200,
      json: async () => ({
        orderRef: body['merchant'] === 2 ? 'AM2-EMF8G-11111111' : 'AM-EMF8G-11111111',
        accessToken: 'tok',
        amount: 1499,
        actionUrl: 'https://payments.example.invalid/pay/v4/?token=x',
        fields: { encdata: 'x', checksum: 'y', merchant_id: 'z', privatekey: 'w' },
        returnsToSite: body['merchant'] !== 2,
      }),
    } as Response
  }) as unknown as typeof fetch

  return { fetchImpl, release, calls: () => calls }
}

describe('25. a second pay() while one is in flight is refused', () => {
  it('creates ONE order for three rapid clicks', async () => {
    const { fetchImpl, release, calls } = deferredFetch()
    const checkout = makeCheckout(fetchImpl)

    // Three clicks before the first has resolved.
    const first = checkout.pay()
    const second = checkout.pay()
    const third = checkout.pay()

    release()
    await Promise.all([first, second, third])

    // The one that matters: exactly one order was requested of the server.
    expect(calls()).toBe(1)
    expect(checkout.creates).toEqual([1])
  })

  it('holds for merchant 2 as well — the guard is merchant-agnostic', async () => {
    const { fetchImpl, release, calls } = deferredFetch()
    const checkout = makeCheckout(fetchImpl)

    const first = checkout.pay(2)
    const second = checkout.pay(2)

    release()
    await Promise.all([first, second])

    expect(calls()).toBe(1)
    expect(checkout.creates).toEqual([2])
  })

  it('a second click cannot switch the merchant mid-flight', async () => {
    const { fetchImpl, release, calls } = deferredFetch()
    const checkout = makeCheckout(fetchImpl)

    // The first click owns the order. A racing click on the OTHER option must
    // not create a second order against different credentials.
    const first = checkout.pay(1)
    const second = checkout.pay(2)

    release()
    await Promise.all([first, second])

    expect(calls()).toBe(1)
    expect(checkout.creates).toEqual([1])
  })
})

describe('the client sends an index, and never a credential or a reference', () => {
  it('posts merchant as a bare index alongside no secret of any kind', async () => {
    let sent: Record<string, unknown> = {}
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sent = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      return {
        ok: true,
        status: 200,
        json: async () => ({
          orderRef: 'AM2-EMF8G-11111111',
          accessToken: 'tok',
          amount: 1499,
          actionUrl: 'https://payments.example.invalid/pay/v4/?token=x',
          fields: {},
          returnsToSite: false,
        }),
      } as Response
    }) as unknown as typeof fetch

    vi.stubGlobal('fetch', fetchImpl)
    await createAirpayPayment({
      serviceSlugs: ['a-service'],
      merchant: 2,
      contact: { email: 'shopper@example.com' },
    })

    expect(sent['merchant']).toBe(2)

    // 7/8. The client supplies NO order reference and NO credential. The
    // server generates the reference and holds every secret.
    for (const forbidden of [
      'orderRef',
      'orderid',
      'mid',
      'merchant_id',
      'username',
      'password',
      'apiKey',
      'secretKey',
      'clientId',
      'verifyUrl',
      'callbackUrl',
      'amount',
      'total',
    ]) {
      expect(sent, `the body must not carry ${forbidden}`).not.toHaveProperty(forbidden)
    }
  })
})
