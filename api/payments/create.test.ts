import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../_lib/http.js'

/**
 * POST /api/payments/create — the Airpay payload contract.
 *
 * ⚠ Regression cover for the production failure: the hosted page loaded and
 * then refused with "Either email or contact number is mandatory", because the
 * browser sent `contact: {}` and the payload carried two empty strings.
 *
 * Every Airpay HTTP call is mocked. No live payment is created, and no
 * credential value appears anywhere in this file — the placeholders below are
 * fake and exist only to satisfy loadAirpayConfig.
 */

const rpc = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  result: {
    data: [{ id: 'order-uuid', reference: '', total_inr: 1499, access_token: 'tok' }],
    error: null as unknown,
  },
}))

const oauth = vi.hoisted(() => ({ calls: 0, token: 'oauth-token' as string | null }))

vi.mock('../_lib/db.js', () => ({
  getServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc.calls.push({ fn, args })
      return rpc.result
    },
  }),
}))

vi.mock('../_lib/airpay.js', () => ({
  getAccessToken: async () => {
    oauth.calls += 1
    return oauth.token
  },
}))

const handler = (await import('./create.js')).default
const { decrypt } = await import('../_lib/airpay-crypto.js')
const { loadAirpayConfig } = await import('../_lib/config.js')

const GUEST = '11111111-1111-4111-8111-111111111111'

interface Captured {
  code: number
  body: unknown
}

function mockRes(): { res: ApiResponse; captured: Captured } {
  const captured: Captured = { code: 0, body: null }
  const res: ApiResponse = {
    status(code) {
      captured.code = code
      return res
    },
    setHeader() {
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

/**
 * A POST to the create endpoint.
 *
 * Every request carries an explicit merchant selection, because the server
 * requires one and refuses the request otherwise (§2.4). These cases are all
 * about the REST of the flow — pricing, contact, signing — so they select
 * merchant 1 and hold it constant. Merchant selection itself is covered in
 * api/payments/merchant-selection.test.ts.
 */
function post(body: unknown): ApiRequest {
  const withMerchant =
    body !== null && typeof body === 'object' && !Array.isArray(body)
      ? { merchant: 1, ...(body as Record<string, unknown>) }
      : body
  return { method: 'POST', headers: {}, body: withMerchant } as ApiRequest
}

function fieldsOf(body: unknown): Record<string, string> {
  return (body as { fields: Record<string, string> }).fields
}

/** Reads back the plaintext the gateway would receive. */
function decodePayload(fields: Record<string, string>): Record<string, unknown> {
  const plaintext = decrypt(fields['encdata'] as string, loadAirpayConfig())
  expect(plaintext).not.toBeNull()
  return JSON.parse(plaintext as string) as Record<string, unknown>
}

beforeEach(() => {
  rpc.calls = []
  rpc.result = {
    data: [{ id: 'order-uuid', reference: '', total_inr: 1499, access_token: 'tok' }],
    error: null,
  }
  oauth.calls = 0
  oauth.token = 'oauth-token'

  // Fake, non-secret placeholders. These are not credentials.
  process.env['AIRPAY_ENV'] = 'sandbox'
  process.env['AIRPAY_MID'] = '000000'
  process.env['AIRPAY_CLIENT_ID'] = 'test-client-id'
  process.env['AIRPAY_SECRET_KEY'] = 'test-secret-key'
  process.env['AIRPAY_API_KEY'] = 'test-api-key'
  process.env['AIRPAY_USERNAME'] = 'test-username'
  process.env['AIRPAY_PASSWORD'] = 'test-password'
})

describe('Airpay payload carries the mandatory contact field', () => {
  it('sends buyer_email when the shopper gave an email', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({
        serviceSlugs: ['a-service'],
        guestToken: GUEST,
        contact: { email: 'shopper@example.com', firstName: 'Ada', lastName: 'L' },
      }),
      res,
    )

    expect(captured.code).toBe(200)
    const payload = decodePayload(fieldsOf(captured.body))
    expect(payload['buyer_email']).toBe('shopper@example.com')
    // The rule is EITHER/OR; the empty one still exists in the payload shape.
    expect(payload).toHaveProperty('buyer_phone')
  })

  it('sends buyer_phone, normalised, when the shopper gave only a number', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({
        serviceSlugs: ['a-service'],
        guestToken: GUEST,
        contact: { phone: '+91 98765-43210' },
      }),
      res,
    )

    expect(captured.code).toBe(200)
    const payload = decodePayload(fieldsOf(captured.body))
    expect(payload['buyer_phone']).toBe('919876543210')
  })

  it('never sends both fields empty — the exact production refusal', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({ serviceSlugs: ['a-service'], guestToken: GUEST, contact: { email: 'a@b.com' } }),
      res,
    )

    const payload = decodePayload(fieldsOf(captured.body))
    const email = String(payload['buyer_email'] ?? '')
    const phone = String(payload['buyer_phone'] ?? '')
    expect(email !== '' || phone !== '').toBe(true)
  })

  it('stores the contact on the order row it already has columns for', async () => {
    const { res } = mockRes()
    await handler(
      post({
        serviceSlugs: ['a-service'],
        guestToken: GUEST,
        contact: { email: 'shopper@example.com', firstName: 'Ada', lastName: 'Lovelace' },
      }),
      res,
    )

    const call = rpc.calls[0]
    expect(call?.fn).toBe('create_airpay_order')
    expect(call?.args['p_contact_email']).toBe('shopper@example.com')
    expect(call?.args['p_contact_name']).toBe('Ada Lovelace')
  })
})

describe('missing contact is rejected before Airpay is called', () => {
  it('rejects an empty contact object with 400 and no gateway traffic', async () => {
    const { res, captured } = mockRes()
    await handler(post({ serviceSlugs: ['a-service'], guestToken: GUEST, contact: {} }), res)

    expect(captured.code).toBe(400)
    expect(captured.body).toEqual({ error: 'contact_required' })
    // Fail closed and fail early: no order row, no OAuth token, no payment.
    expect(rpc.calls).toEqual([])
    expect(oauth.calls).toBe(0)
  })

  it('rejects an absent contact block entirely', async () => {
    const { res, captured } = mockRes()
    await handler(post({ serviceSlugs: ['a-service'], guestToken: GUEST }), res)

    expect(captured.code).toBe(400)
    expect(rpc.calls).toEqual([])
  })

  it('rejects contact values the gateway could not use', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({
        serviceSlugs: ['a-service'],
        guestToken: GUEST,
        contact: { email: 'not-an-address', phone: '123' },
      }),
      res,
    )

    expect(captured.code).toBe(400)
    expect(rpc.calls).toEqual([])
  })

  /**
   * The rejection log reported `emailPresent: false, contactPresent: false` as
   * hardcoded literals, so it said the same thing whether the client omitted
   * the block or sent a value that would not normalise. That made a real
   * production rejection impossible to diagnose from the log alone.
   */
  it('logs the true presence of the raw fields, never their values', async () => {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(String(line))
    })

    try {
      const { res, captured } = mockRes()
      await handler(
        post({
          serviceSlugs: ['a-service'],
          guestToken: GUEST,
          // Present but unusable: the diagnosis the old log could not express.
          contact: { email: 'not-an-address', phone: '' },
        }),
        res,
      )
      expect(captured.code).toBe(400)

      const event = lines.map((l) => JSON.parse(l) as Record<string, unknown>)
        .find((e) => e['event'] === 'payment.create.contact_missing')

      expect(event).toBeDefined()
      expect(event?.['emailPresent']).toBe(true)
      expect(event?.['contactPresent']).toBe(false)
      // Presence only — the value itself must never be logged (§9.8).
      expect(lines.join(' ')).not.toContain('not-an-address')
    } finally {
      spy.mockRestore()
    }
  })

  it('reports both absent when the client sent no contact block', async () => {
    const lines: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(String(line))
    })

    try {
      const { res } = mockRes()
      await handler(post({ serviceSlugs: ['a-service'], guestToken: GUEST }), res)

      const event = lines.map((l) => JSON.parse(l) as Record<string, unknown>)
        .find((e) => e['event'] === 'payment.create.contact_missing')

      expect(event?.['emailPresent']).toBe(false)
      expect(event?.['contactPresent']).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('pricing stays server-authoritative', () => {
  it('ignores an amount supplied by the client', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({
        serviceSlugs: ['a-service'],
        guestToken: GUEST,
        contact: { email: 'a@b.com' },
        // All ignored — there is nowhere for these to be read.
        amount: 1,
        total: 1,
        price: 1,
        subtotal: 1,
      }),
      res,
    )

    expect(captured.code).toBe(200)
    // The RPC receives no amount of any kind; the database prices the basket.
    const args = rpc.calls[0]?.args ?? {}
    for (const key of Object.keys(args)) {
      expect(key).not.toMatch(/amount|total|price|subtotal/i)
    }

    // The response and the signed payload both carry the SERVER's 1499.
    expect((captured.body as { amount: number }).amount).toBe(1499)
    const payload = decodePayload(fieldsOf(captured.body))
    expect(payload['amount']).toBe('1499.00')
  })

  it('uses the row total even when the client claims another figure', async () => {
    rpc.result = {
      data: [{ id: 'order-uuid', reference: '', total_inr: 2, access_token: 'tok' }],
      error: null,
    }

    const { res, captured } = mockRes()
    await handler(
      post({
        serviceSlugs: ['a-service'],
        guestToken: GUEST,
        contact: { email: 'a@b.com' },
        amount: 99999,
      }),
      res,
    )

    expect((captured.body as { amount: number }).amount).toBe(2)
    const payload = decodePayload(fieldsOf(captured.body))
    expect(payload['amount']).toBe('2.00')
  })
})

describe('the rest of the flow is unchanged', () => {
  it('still mints the OAuth token after the order row, not before', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({ serviceSlugs: ['a-service'], guestToken: GUEST, contact: { email: 'a@b.com' } }),
      res,
    )

    expect(rpc.calls).toHaveLength(1)
    expect(oauth.calls).toBe(1)
    expect(captured.code).toBe(200)
  })

  it('reports gateway_unavailable when no token is issued, order already recorded', async () => {
    oauth.token = null

    const { res, captured } = mockRes()
    await handler(
      post({ serviceSlugs: ['a-service'], guestToken: GUEST, contact: { email: 'a@b.com' } }),
      res,
    )

    expect(captured.code).toBe(502)
    expect((captured.body as { error: string }).error).toBe('gateway_unavailable')
    // The order was recorded first, so the sweep can still resolve it.
    expect(rpc.calls).toHaveLength(1)
  })

  it('signs the payload with the full envelope the gateway expects', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({ serviceSlugs: ['a-service'], guestToken: GUEST, contact: { email: 'a@b.com' } }),
      res,
    )

    const fields = fieldsOf(captured.body)
    expect(Object.keys(fields).sort()).toEqual(['checksum', 'encdata', 'merchant_id', 'privatekey'])
  })

  it('still sends no line items or SKUs to Airpay (§7.3)', async () => {
    const { res, captured } = mockRes()
    await handler(
      post({ serviceSlugs: ['a-service'], guestToken: GUEST, contact: { email: 'a@b.com' } }),
      res,
    )

    const payload = decodePayload(fieldsOf(captured.body))
    expect(Object.keys(payload).sort()).toEqual([
      'amount',
      'buyer_email',
      'buyer_firstname',
      'buyer_lastname',
      'buyer_phone',
      'currency_code',
      'iso_currency',
      'orderid',
    ])
  })
})
