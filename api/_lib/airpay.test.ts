import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { encrypt } from './airpay-crypto.js'
import type { AirpayConfig } from './config.js'
import { getAccessToken, resetTokenCache, verifyTransaction } from './airpay.js'

/**
 * OAuth and Order Confirmation tests (AIPAY-DOCS §6, §11).
 *
 * fetch is stubbed throughout. The live gateway is never contacted.
 */

const config: AirpayConfig = {
  mid: '366950',
  clientId: 'c',
  secretKey: 's',
  apiKey: 'a',
  username: 'test-user',
  password: 'test-pass',
  env: 'live',
  verifyUrl: 'https://example.invalid/verify/',
}

const ORDER_REF = 'AM-1234-abcdef01'

function respond(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetTokenCache()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OAuth (§6)', () => {
  it('issues a token from a successful grant', async () => {
    fetchMock.mockResolvedValue(respond({ data: { access_token: 'tok-123' } }))
    expect(await getAccessToken(config)).toBe('tok-123')
  })

  it('⚠ §6.1 — reads data.success, not the outer envelope', async () => {
    // A REJECTED grant that still reports success at the transport level.
    fetchMock.mockResolvedValue(
      respond({
        status_code: 200,
        response_code: '00',
        status: 'success',
        message: 'Success',
        data: { success: false, msg: 'Invalid client id or secret' },
      }),
    )

    expect(await getAccessToken(config)).toBeNull()
  })

  it('§6.2 — finds the token when data arrives as a JSON string', async () => {
    fetchMock.mockResolvedValue(respond({ data: JSON.stringify({ access_token: 'tok-nested' }) }))
    expect(await getAccessToken(config)).toBe('tok-nested')
  })

  it('accepts the documented token aliases', async () => {
    fetchMock.mockResolvedValue(respond({ data: { accessToken: 'tok-alias' } }))
    expect(await getAccessToken(config)).toBe('tok-alias')
  })

  it('returns null on a non-2xx, an unreachable gateway, or an absent token', async () => {
    fetchMock.mockResolvedValue(respond({}, 500))
    expect(await getAccessToken(config)).toBeNull()

    resetTokenCache()
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await getAccessToken(config)).toBeNull()

    resetTokenCache()
    fetchMock.mockResolvedValue(respond({ data: {} }))
    expect(await getAccessToken(config)).toBeNull()
  })

  it('sends form-urlencoded with credentials inside encdata, never as plain fields', async () => {
    fetchMock.mockResolvedValue(respond({ data: { access_token: 't' } }))
    await getAccessToken(config)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')

    const body = new URLSearchParams(init.body as string)
    expect(body.get('client_secret')).toBeNull()
    expect(body.get('encdata')).toBeTruthy()
    // Edge case 3: privatekey must be absent on the token request.
    expect(body.get('privatekey')).toBeNull()
  })

  it('names the response field NAMES when no token is found, and never a value', async () => {
    const logs: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logs.push(line)
    })

    // A refusal that states no `success` field: previously indistinguishable
    // from a token we simply failed to locate.
    fetchMock.mockResolvedValue(
      respond({ status_code: 401, response_code: '401', message: 'Unauthorized' }),
    )
    expect(await getAccessToken(config)).toBeNull()
    spy.mockRestore()

    const entry = logs.map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((e) => e['event'] === 'airpay.oauth.no_token')
    expect(entry?.['reason']).toBe('absent')
    expect(entry?.['status']).toBe(200)

    const names = String(entry?.['fieldNames']).split(',')
    expect(names).toContain('status_code')
    expect(names).toContain('message')
    // Names only — the VALUES beside them must never be logged (§9.8).
    expect(String(entry?.['fieldNames'])).not.toContain('Unauthorized')
  })

  it('still requires a genuine token — a diagnostic field is never treated as one', async () => {
    fetchMock.mockResolvedValue(respond({ status_code: 200, message: 'Success', data: { msg: 'x' } }))
    expect(await getAccessToken(config)).toBeNull()
  })

  it('caches the token across calls', async () => {
    fetchMock.mockResolvedValue(respond({ data: { access_token: 'tok' } }))
    await getAccessToken(config)
    await getAccessToken(config)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('Order Confirmation (§11)', () => {
  function withToken(): void {
    fetchMock.mockResolvedValueOnce(respond({ data: { access_token: 'tok' } }))
  }

  it('returns a trusted result for a confirmed payment', async () => {
    withToken()
    fetchMock.mockResolvedValueOnce(
      respond({
        TRANSACTIONID: ORDER_REF,
        TRANSACTIONSTATUS: '200',
        AMOUNT: '1499.00',
        APTRANSACTIONID: 'AP-1',
      }),
    )

    const result = await verifyTransaction(ORDER_REF, config)
    expect(result).toEqual({
      orderRef: ORDER_REF,
      status: 200,
      amount: 1499,
      apTransactionId: 'AP-1',
    })
  })

  it('posts form-urlencoded with a signed envelope and a real User-Agent', async () => {
    withToken()
    fetchMock.mockResolvedValueOnce(respond({ TRANSACTIONSTATUS: '200', AMOUNT: '1' }))
    await verifyTransaction(ORDER_REF, config)

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    // Edge case 6: /verify/, never /orderconfirmation/.
    expect(url).toContain('/verify/')
    expect(url).toContain('token=tok')

    const headers = init.headers as Record<string, string>
    // Edge case 5: a JSON body returns 403 "Parameters are required".
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(headers['User-Agent']).toBeTruthy()

    // Edge case 4: privatekey is required here, or the gateway cannot
    // attribute the request.
    const body = new URLSearchParams(init.body as string)
    expect(body.get('privatekey')).toBeTruthy()
    expect(body.get('merchant_id')).toBe('366950')
  })

  it('§11.1 — decrypts an enveloped response when one is present', async () => {
    withToken()
    const sealed = encrypt(
      JSON.stringify({ data: { TRANSACTIONSTATUS: '200', AMOUNT: '1499.00' } }),
      config,
    )
    fetchMock.mockResolvedValueOnce(respond({ response: sealed }))

    const result = await verifyTransaction(ORDER_REF, config)
    expect(result?.status).toBe(200)
    expect(result?.amount).toBe(1499)
  })

  it('§9.5 — reads a nested data object, not just outer scalars', async () => {
    withToken()
    fetchMock.mockResolvedValueOnce(
      respond({
        status_code: 200,
        status: 'success',
        message: 'Success',
        data: { TRANSACTIONSTATUS: '200', AMOUNT: '1499.00' },
      }),
    )

    const result = await verifyTransaction(ORDER_REF, config)
    expect(result?.status).toBe(200)
  })

  describe('fail-closed cross-checks (§11.2)', () => {
    it('returns null on an inner failure', async () => {
      withToken()
      fetchMock.mockResolvedValueOnce(respond({ data: { success: false, msg: 'nope' } }))
      expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
    })

    it('returns null when the answer names another order', async () => {
      withToken()
      fetchMock.mockResolvedValueOnce(
        respond({ TRANSACTIONID: 'AM-other-1', TRANSACTIONSTATUS: '200', AMOUNT: '1' }),
      )
      expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
    })

    it('returns null when the answer names another merchant', async () => {
      withToken()
      fetchMock.mockResolvedValueOnce(
        respond({ merchant_id: '999999', TRANSACTIONSTATUS: '200', AMOUNT: '1' }),
      )
      expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
    })

    it('⚠ §10.4 — refuses to return a statusless confirmation', async () => {
      withToken()
      fetchMock.mockResolvedValueOnce(
        respond({ TRANSACTIONID: null, TRANSACTIONSTATUS: null, AMOUNT: null }),
      )
      expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
    })

    it('returns null when a stated success contradicts the payment status', async () => {
      withToken()
      fetchMock.mockResolvedValueOnce(
        respond({
          TRANSACTIONSTATUS: '200',
          AMOUNT: '1',
          transaction_payment_status: 'declined',
        }),
      )
      expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
    })

    it('accepts any value beginning "success", so wording cannot strand a payment', async () => {
      withToken()
      fetchMock.mockResolvedValueOnce(
        respond({
          TRANSACTIONSTATUS: '200',
          AMOUNT: '1',
          transaction_payment_status: 'SUCCESSFUL',
        }),
      )
      expect((await verifyTransaction(ORDER_REF, config))?.status).toBe(200)
    })
  })

  it('returns null (never throws) when the gateway is unreachable or refuses', async () => {
    withToken()
    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    expect(await verifyTransaction(ORDER_REF, config)).toBeNull()

    resetTokenCache()
    withToken()
    fetchMock.mockResolvedValueOnce(respond('nope', 502))
    expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
  })

  it('returns null when no token can be minted (edge case 28)', async () => {
    fetchMock.mockResolvedValue(respond({ data: { success: false } }))
    expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
  })

  it('returns null on an unreadable envelope', async () => {
    withToken()
    fetchMock.mockResolvedValueOnce(
      respond({ response: '0123456789abcdefNOT-VALID-CIPHERTEXT' }),
    )
    expect(await verifyTransaction(ORDER_REF, config)).toBeNull()
  })
})
