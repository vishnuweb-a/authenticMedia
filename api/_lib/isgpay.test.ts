import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  amountsMatch,
  buildSaleRequest,
  buildStatusRequest,
  evaluateTransaction,
  generateTxnRefNo,
  inrToPaise,
  ISG_TXN_REF_RE,
  openGatewayResponse,
  parseStatusBody,
  querySaleStatus,
  STATUS_TIMEOUT_MS,
  type FetchLike,
} from './isgpay.js'
import { IsgpayDisabledError, loadIsgpayConfig, type IsgpayConfig } from './isgpay-config.js'
import {
  computeSecureHash,
  decryptEncData,
  encryptEncData,
  parseEncData,
  serializeEncData,
  verifyFields,
  type VerifiedIsgpayFields,
} from './isgpay-crypto.js'
import { FIXTURE_SECRETS, installIsgpayEnv } from './isgpay-test-fixture.js'
import { ORDER_REF_RE } from './order-ref.js'

installIsgpayEnv()

function enabledConfig(): IsgpayConfig {
  process.env['ISGPAY_ENABLED'] = 'true'
  return loadIsgpayConfig()
}

const REF = 'ISG0MABCDEF0123456789ABCDEF'

/** Fields the gateway would sign, for a given config. */
function gatewayFields(config: IsgpayConfig, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    BankId: config.bankId,
    MerchantId: config.merchantId,
    TerminalId: config.terminalId,
    TxnRefNo: REF,
    Currency: '356',
    Amount: '10120',
    ResponseCode: '00',
    Message: 'Transaction Successful',
    ...overrides,
  }
}

function signed(config: IsgpayConfig, fields: Record<string, string>): Record<string, string> {
  return { ...fields, SecureHash: computeSecureHash(fields, config.secrets.secureSecret) }
}

function verified(config: IsgpayConfig, fields: Record<string, string>): VerifiedIsgpayFields {
  const result = verifyFields(signed(config, fields), config.secrets.secureSecret)
  if (!result.ok) throw new Error('fixture failed to verify')
  return result.fields
}

describe('TxnRefNo', () => {
  it('is alphanumeric, ≤ 40 chars, and namespaced away from Airpay references', () => {
    const ref = generateTxnRefNo()
    expect(ref).toMatch(ISG_TXN_REF_RE)
    expect(ref).toMatch(/^[A-Za-z0-9]{1,40}$/)
    expect(ref.startsWith('ISG')).toBe(true)
    expect(ORDER_REF_RE.test(ref)).toBe(false)
  })

  it('is unique across many draws at the same instant', () => {
    const refs = new Set(Array.from({ length: 5000 }, () => generateTxnRefNo(1_700_000_000_000)))
    expect(refs.size).toBe(5000)
  })
})

describe('INR → paise', () => {
  it.each([
    [1, '100'],
    [101.2, '10120'],
    ['101.20', '10120'],
    ['0.01', '1'],
    [1.15, '115'],
    [0.29, '29'],
    ['199', '19900'],
    [' 5.5 ', '550'],
    ['9999999999.99', '999999999999'],
  ])('%j → %s (no float error)', (input, paise) => {
    expect(inrToPaise(input)).toBe(paise)
  })

  it.each([0, -1, '0.00', '1.234', 1.005, '1e3', 1e21, Number.NaN, Infinity, '', 'abc', '1,000', '₹10', '+5', '10000000000'])(
    'rejects %j',
    (input) => {
      expect(() => inrToPaise(input)).toThrow()
    },
  )

  it('compares amounts exactly', () => {
    expect(amountsMatch('10120', '10120')).toBe(true)
    expect(amountsMatch('10120', '010120')).toBe(true)
    expect(amountsMatch('10120', '10121')).toBe(false)
    expect(amountsMatch('10120', '101.20')).toBe(false)
    expect(amountsMatch('10120', undefined)).toBe(false)
  })
})

describe('sale request', () => {
  it('refuses to build when ISGPAY_ENABLED is false', () => {
    expect(() => buildSaleRequest(loadIsgpayConfig(), { txnRefNo: REF, amountPaise: '10120' })).toThrow(IsgpayDisabledError)
  })

  it('builds a hosted-redirect handoff with exactly the documented outer fields', () => {
    const config = enabledConfig()
    const handoff = buildSaleRequest(config, { txnRefNo: REF, amountPaise: '10120', orderInfo: 'AM12345' })
    expect(handoff.action).toBe('https://sandbox.isgpay.com/ISGPay-Genius/request.action')
    expect(Object.keys(handoff.fields).sort()).toEqual(['BankId', 'EncData', 'MerchantId', 'TerminalId'])
    expect(handoff.fields.BankId).toBe('000123')
    expect(handoff.txnRefNo).toBe(REF)
  })

  it('encrypts the v1.6 required fields with a verifiable SecureHash and no card data', () => {
    const config = enabledConfig()
    const handoff = buildSaleRequest(config, { txnRefNo: REF, amountPaise: '10120' })
    const plaintext = decryptEncData(handoff.fields.EncData, config.secrets.encKey)
    const fields = plaintext ? parseEncData(plaintext) : null
    expect(fields).toEqual({
      BankId: '000123',
      MerchantId: '100000000000001',
      TerminalId: '10000001',
      TxnRefNo: REF,
      MCC: '4112',
      PassCode: 'TEST1234',
      TxnType: 'Pay',
      Currency: '356',
      Amount: '10120',
      ReturnURL: 'https://authenticmedia.fun/api/payments/isgpay/return',
      Command: 'Pay',
      // Kit + sha256sum vector (isgpay-crypto.test.ts).
      SecureHash: 'a1805797069b17fd4e9c9738f917e8e06a9523a64a6ced343490de7467901d93',
    })
    for (const forbidden of ['CardNumber', 'ExpiryDate', 'CardSecurityCode', 'payOpt', 'Version']) {
      expect(fields).not.toHaveProperty(forbidden)
    }
  })

  it.each([
    [{ txnRefNo: 'AM-ABCDE-12345678', amountPaise: '100' }],
    [{ txnRefNo: REF, amountPaise: '0' }],
    [{ txnRefNo: REF, amountPaise: '101.20' }],
    [{ txnRefNo: REF, amountPaise: '1234567890123' }],
    [{ txnRefNo: REF, amountPaise: '100', orderInfo: 'bad::info' }],
    [{ txnRefNo: REF, amountPaise: '100', orderInfo: 'x'.repeat(41) }],
  ])('rejects invalid input %j', (input) => {
    expect(() => buildSaleRequest(enabledConfig(), input)).toThrow()
  })

  it('never exposes a secret in clear in the handoff', () => {
    const text = JSON.stringify(buildSaleRequest(enabledConfig(), { txnRefNo: REF, amountPaise: '10120' }))
    for (const secret of FIXTURE_SECRETS) expect(text).not.toContain(secret)
  })
})

describe('gateway response envelope', () => {
  it('opens a gateway-sealed response with the configured keys', () => {
    const config = loadIsgpayConfig()
    const fields = signed(config, gatewayFields(config))
    const encData = encryptEncData(serializeEncData(Object.entries(fields)), config.secrets.encKey)
    const result = openGatewayResponse(config, encData)
    expect(result.ok && result.fields['TxnRefNo']).toBe(REF)
  })
})

describe('status request', () => {
  it('signs the v1.6 §3.2.1 fields in plain form (not EncData)', () => {
    const config = loadIsgpayConfig()
    const request = buildStatusRequest(config, REF)
    expect(Object.keys(request).sort()).toEqual(['BankId', 'MCC', 'MerchantId', 'PassCode', 'SecureHash', 'TerminalId', 'TxnRefNo', 'TxnType'])
    expect(request['TxnType']).toBe('Status')
    expect(verifyFields(request, config.secrets.secureSecret).ok).toBe(true)
  })

  it('works with initiation disabled', () => {
    expect(() => buildStatusRequest(loadIsgpayConfig(), REF)).not.toThrow()
  })
})

describe('status response parsing', () => {
  const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString()

  it('verifies a k=v&k=v response (kit format), URL-decoding values', () => {
    const config = loadIsgpayConfig()
    const result = parseStatusBody(config, form(signed(config, gatewayFields(config))))
    expect(result.kind).toBe('verified')
    expect(result.kind === 'verified' && result.fields['Message']).toBe('Transaction Successful')
  })

  it('verifies a response that carries only an EncData envelope', () => {
    const config = loadIsgpayConfig()
    const fields = signed(config, gatewayFields(config))
    const encData = encryptEncData(serializeEncData(Object.entries(fields)), config.secrets.encKey)
    expect(parseStatusBody(config, form({ EncData: encData, MerchantId: config.merchantId })).kind).toBe('verified')
  })

  it.each([
    ['empty_body', '   '],
    ['unrecognized_format', '<html>error</html>'],
    ['unrecognized_format', '{"ResponseCode":"00"}'],
    ['unrecognized_format', 'Transaction Successful'],
    ['duplicate_field', 'ResponseCode=00&ResponseCode=05&SecureHash=00'],
    ['missing_hash', 'ResponseCode=00&TxnRefNo=X'],
    ['hash_mismatch', `ResponseCode=00&SecureHash=${'a'.repeat(64)}`],
    ['invalid_ciphertext', 'EncData=not-base64'],
  ])('returns inconclusive (%s) for %j', (reason, body) => {
    expect(parseStatusBody(loadIsgpayConfig(), body)).toEqual({ kind: 'inconclusive', reason })
  })

  it('rejects a response whose ResponseCode was changed after signing', () => {
    const config = loadIsgpayConfig()
    const fields = signed(config, gatewayFields(config, { ResponseCode: '05' }))
    fields['ResponseCode'] = '00'
    expect(parseStatusBody(config, form(fields))).toEqual({ kind: 'inconclusive', reason: 'hash_mismatch' })
  })
})

describe('status query transport (mocked; no network)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('POSTs form-encoded fields to the pinned status URL, refusing redirects', async () => {
    const config = loadIsgpayConfig()
    const fetchImpl = vi.fn<FetchLike>(async () => new Response(new URLSearchParams(signed(config, gatewayFields(config))).toString()))
    const result = await querySaleStatus(config, REF, fetchImpl)
    expect(result.kind).toBe('verified')
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('https://sandbox.isgpay.com/ISGPay-Genius/Status')
    expect(init?.method).toBe('POST')
    expect(init?.redirect).toBe('error')
    expect(url).not.toContain('PassCode') // secrets are in the body, never the URL
    expect(new URLSearchParams(String(init?.body)).get('TxnType')).toBe('Status')
  })

  it('treats a transport failure as inconclusive, never success', async () => {
    const result = await querySaleStatus(loadIsgpayConfig(), REF, async () => {
      throw new TypeError('fetch failed')
    })
    expect(result).toEqual({ kind: 'inconclusive', reason: 'transport_error' })
  })

  it('treats an HTTP error as inconclusive even if the body looks successful', async () => {
    const config = loadIsgpayConfig()
    const body = new URLSearchParams(signed(config, gatewayFields(config))).toString()
    const result = await querySaleStatus(config, REF, async () => new Response(body, { status: 502 }))
    expect(result).toEqual({ kind: 'inconclusive', reason: 'http_error', httpStatus: 502 })
  })

  it('aborts after the timeout and reports it', async () => {
    vi.useFakeTimers()
    const hang: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    const pending = querySaleStatus(loadIsgpayConfig(), REF, hang)
    await vi.advanceTimersByTimeAsync(STATUS_TIMEOUT_MS)
    expect(await pending).toEqual({ kind: 'inconclusive', reason: 'timeout' })
  })

  it('treats a malformed body as inconclusive', async () => {
    const result = await querySaleStatus(loadIsgpayConfig(), REF, async () => new Response('<html>Service Unavailable</html>'))
    expect(result).toEqual({ kind: 'inconclusive', reason: 'unrecognized_format' })
  })

  it('logs only names and categories — no secret, hash or field value', async () => {
    const config = loadIsgpayConfig()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const fields = signed(config, gatewayFields(config, { Email: 'customer@example.com' }))
    await querySaleStatus(config, REF, async () => new Response(new URLSearchParams(fields).toString()))
    await querySaleStatus(config, REF, async () => {
      throw new Error(`boom ${config.secrets.passCode}`)
    })
    const output = log.mock.calls.flat().join('\n')
    expect(output).toContain('isgpay.status_query')
    for (const secret of [...FIXTURE_SECRETS, 'customer@example.com', fields['SecureHash'] as string, 'Transaction Successful']) {
      expect(output).not.toContain(secret)
    }
  })
})

describe('transaction evaluation', () => {
  const expected = { txnRefNo: REF, amountPaise: '10120' }

  it('accepts only a verified, matching, ResponseCode 00 record', () => {
    const config = loadIsgpayConfig()
    expect(evaluateTransaction(config, expected, verified(config, gatewayFields(config)))).toEqual({ outcome: 'success', responseCode: '00' })
  })

  it.each([
    ['merchant', { MerchantId: '100000000000002' }],
    ['terminal', { TerminalId: '10000002' }],
    ['bank', { BankId: '000124' }],
    ['txn_ref', { TxnRefNo: 'ISG0MABCDEF0123456789ABCDE0' }],
    ['currency', { Currency: '840' }],
    ['amount', { Amount: '10119' }],
    ['amount', { Amount: '101.20' }],
  ])('flags a %s mismatch even when ResponseCode is 00', (reason, overrides) => {
    const config = loadIsgpayConfig()
    expect(evaluateTransaction(config, expected, verified(config, gatewayFields(config, overrides)))).toEqual({ outcome: 'mismatch', reason })
  })

  it.each(['0', '05', 'CAN', 'HNM', 'RNF', 'IER', 'SOMETHING_NEW'])('never treats ResponseCode %s as success', (code) => {
    const config = loadIsgpayConfig()
    expect(evaluateTransaction(config, expected, verified(config, gatewayFields(config, { ResponseCode: code })))).toEqual({
      outcome: 'not_success',
      responseCode: code,
    })
  })

  it('does not accept a 00 with no Amount to check', () => {
    const config = loadIsgpayConfig()
    const fields = gatewayFields(config)
    delete fields['Amount']
    expect(evaluateTransaction(config, expected, verified(config, fields))).toEqual({ outcome: 'unverifiable', reason: 'amount_absent' })
  })

  it('does not accept a record with no ResponseCode', () => {
    const config = loadIsgpayConfig()
    const fields = gatewayFields(config)
    delete fields['ResponseCode']
    expect(evaluateTransaction(config, expected, verified(config, fields))).toEqual({ outcome: 'unverifiable', reason: 'response_code_absent' })
  })
})
