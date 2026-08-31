import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from './_lib/http.js'

/**
 * The merchant-2 browser return (AIPAY-DOCS §8.1, §14.3).
 *
 * ⚠ The failure under regression: Airpay resolves its Response URL per MID from
 * its own DASHBOARD. MID 362380 points that at KKChat, at the client's explicit
 * requirement, so Airpay POSTs the BROWSER to KKChat and never navigates it back
 * here. The shopper stops on KKChat's `200 success`, /order-success never loads,
 * and the poll that is merchant 2's ONLY settlement prompt never runs.
 *
 * The server states which hand-off style applies via `returnsToSite`. These
 * tests pin that contract.
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
    AIRPAY_CLIENT_ID: 'm1-client-placeholder',
    AIRPAY_SECRET_KEY: 'm1-oauth-secret-placeholder',
    AIRPAY_API_KEY: 'm1-api-key-placeholder',
    AIRPAY_USERNAME: 'm1-user-placeholder',
    AIRPAY_PASSWORD: 'm1-pass-placeholder',
    AIRPAY_MID_2: '362380',
    AIRPAY_CLIENT_ID_2: 'm2-client-placeholder',
    AIRPAY_SECRET_KEY_2: 'm2-oauth-secret-placeholder',
    AIRPAY_API_KEY_2: 'm2-api-key-placeholder',
    AIRPAY_USERNAME_2: 'm2-user-placeholder',
    AIRPAY_PASSWORD_2: 'm2-pass-placeholder',
  })) {
    process.env[name] = value
  }
  delete process.env['AIRPAY_ACTIVE_MERCHANT']
})

describe('the create response states how the browser gets back (§14.3)', () => {
  it('merchant 1 returns to the site — the unchanged, proven hand-off', async () => {
    const { res, captured } = mockRes()
    await handler(post(VALID), res)

    expect(captured.code).toBe(200)
    const body = captured.body as { returnsToSite: boolean; orderRef: string }
    // MID 368250's dashboard Response URL points back at this application, so
    // Airpay brings the browser home itself. Nothing about this flow changes.
    expect(body.returnsToSite).toBe(true)
    expect(body.orderRef).toMatch(/^AM-/)
  })

  it('merchant 2 does NOT return to the site', async () => {
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    const { res, captured } = mockRes()
    await handler(post(VALID), res)

    expect(captured.code).toBe(200)
    const body = captured.body as { returnsToSite: boolean; orderRef: string }
    // MID 362380's dashboard Response URL is KKChat. If this were ever true,
    // the tab would navigate away and the shopper would end up stranded on
    // KKChat's `200 success` with the order unsettled.
    expect(body.returnsToSite).toBe(false)
    expect(body.orderRef).toMatch(/^AM2-/)
  })

  it('is derived from the merchant, never from anything the client sent', async () => {
    // The hostile shape: a client asking to keep the tab hand-off for what is
    // about to become a merchant-2 order.
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    const { res, captured } = mockRes()
    await handler(post({ ...VALID, returnsToSite: true, merchant: 1 }), res)

    const body = captured.body as { returnsToSite: boolean; orderRef: string }
    expect(body.returnsToSite).toBe(false)
    expect(body.orderRef).toMatch(/^AM2-/)
  })

  it('carries no claim about payment — the order is still only pending', async () => {
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
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
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    const { res, captured } = mockRes()
    await handler(post(VALID), res)

    const { decrypt } = await import('./_lib/airpay-crypto.js')
    const { loadAirpayConfig } = await import('./_lib/config.js')
    const fields = (captured.body as { fields: Record<string, string> }).fields

    const plaintext = decrypt(fields['encdata'] as string, loadAirpayConfig(2))
    expect(plaintext).not.toBeNull()
    const payload = JSON.parse(plaintext as string) as Record<string, unknown>

    // The browser return is arranged on OUR side, before the hand-off. Airpay
    // resolves the Response URL from its dashboard and ignores anything sent
    // here, so inventing a field would be a speculative change with no effect.
    for (const key of Object.keys(payload)) {
      expect(key).not.toMatch(/url|return|redirect|callback|response/i)
    }
    // And the dashboard URL is never named in what we send.
    expect(JSON.stringify(payload)).not.toContain('kkchat.in')
  })
})
