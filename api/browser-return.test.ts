import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from './_lib/http.js'

/**
 * The browser return (AIPAY-DOCS §8.1, §14.3).
 *
 * ⚠ Airpay resolves its Response URL per MID from its own DASHBOARD, never from
 * anything sent at transaction time. MID 368250's dashboard points that URL
 * back at this application, so Airpay itself brings the shopper home to
 * /order-success — the single, production-proven hand-off. There is no second
 * style to select and nothing in the create response that chooses one.
 *
 * These tests pin what the create response must NOT contain: no return URL sent
 * to Airpay, and no claim about whether the payment succeeded.
 *
 * Every Airpay call is mocked. No live MID is contacted, no payment is created,
 * and every credential below is a fake placeholder.
 */

const rpc = vi.hoisted(() => ({
  result: {
    data: [{ id: 'order-uuid', total_inr: 1499, access_token: 'tok' }],
    error: null as unknown,
  },
}))

vi.mock('./_lib/db.js', () => ({
  getServiceClient: () => ({
    rpc: async () => rpc.result,
  }),
}))

vi.mock('./_lib/airpay.js', () => ({
  getAccessToken: async () => 'oauth-token',
}))

const handler = (await import('./payments/create.js')).default

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

function post(body: unknown): ApiRequest {
  return { method: 'POST', headers: {}, body } as ApiRequest
}

const VALID = {
  serviceSlugs: ['a-service'],
  guestToken: GUEST,
  contact: { email: 'shopper@example.com', firstName: 'Ada', lastName: 'L' },
}

beforeEach(() => {
  rpc.result = {
    data: [{ id: 'order-uuid', total_inr: 1499, access_token: 'tok' }],
    error: null,
  }

  // Fake, non-secret placeholders. These are not credentials.
  process.env['AIRPAY_ENV'] = 'sandbox'
  for (const [name, value] of Object.entries({
    AIRPAY_MID: '368250',
    AIRPAY_CLIENT_ID: 'client-placeholder',
    AIRPAY_SECRET_KEY: 'oauth-secret-placeholder',
    AIRPAY_API_KEY: 'api-key-placeholder',
    AIRPAY_USERNAME: 'user-placeholder',
    AIRPAY_PASSWORD: 'pass-placeholder',
  })) {
    process.env[name] = value
  }
})

describe('the create response hands off to the one merchant (§14.3)', () => {
  it('creates an AM- order and returns the hosted-page hand-off', async () => {
    const { res, captured } = mockRes()
    await handler(post(VALID), res)

    expect(captured.code).toBe(200)
    const body = captured.body as { orderRef: string; actionUrl: string }
    expect(body.orderRef).toMatch(/^AM-/)
    expect(body.actionUrl).toContain('payments.airpay.co.in')
  })

  it('states no hand-off style — there is only one, and it is not the client to pick', async () => {
    const { res, captured } = mockRes()
    await handler(post({ ...VALID, returnsToSite: false, merchant: 2 }), res)

    const body = captured.body as Record<string, unknown>
    // Neither field is read from the request nor echoed back. Airpay returns
    // this browser to the site because MID 368250's dashboard says so.
    expect(body['returnsToSite']).toBeUndefined()
    expect(body['merchant']).toBeUndefined()
    expect(String(body['orderRef'])).toMatch(/^AM-/)
  })

  it('carries no claim about payment — the order is still only pending', async () => {
    const { res, captured } = mockRes()
    await handler(post(VALID), res)

    const body = captured.body as Record<string, unknown>
    // Nothing in the create response may look like a settled status. What the
    // browser receives is a hand-off, and the outcome comes only from Order
    // Confirmation via /api/orders/status (§0, §14.1).
    expect(body['status']).toBeUndefined()
    expect(body['paid']).toBeUndefined()
    expect(JSON.stringify(body)).not.toMatch(/"(paid|succeeded)"/)
  })

  it('never sends a return URL to Airpay — there is no such field (§7.3)', async () => {
    const { res, captured } = mockRes()
    await handler(post(VALID), res)

    const { decrypt } = await import('./_lib/airpay-crypto.js')
    const { loadAirpayConfig } = await import('./_lib/config.js')
    const fields = (captured.body as { fields: Record<string, string> }).fields

    const plaintext = decrypt(fields['encdata'] as string, loadAirpayConfig())
    expect(plaintext).not.toBeNull()
    const payload = JSON.parse(plaintext as string) as Record<string, unknown>

    // The browser return is resolved by Airpay from its dashboard, which
    // ignores anything sent here, so inventing a field would be a speculative
    // change with no effect.
    for (const key of Object.keys(payload)) {
      expect(key).not.toMatch(/url|return|redirect|callback|response/i)
    }
    // And the KKChat relay URL is never named in what we send to Airpay.
    expect(JSON.stringify(payload)).not.toContain('kkchat.in')
  })
})
