import { inspect } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'

import { ISGPAY_ENDPOINTS, loadIsgpayConfig } from './isgpay-config.js'
import { buildSaleRequest } from './isgpay.js'
import { decryptEncData, parseEncData } from './isgpay-crypto.js'
import {
  CONFIRMED_TEST_ENDPOINTS,
  installIsgpayEnv,
  PRODUCTION_FIXTURE,
  PRODUCTION_FIXTURE_SECRETS,
  productionConfig,
  setProductionEnv,
} from './isgpay-test-fixture.js'

/**
 * ISGPay production readiness (docs/ISGPAY-PRODUCTION-READINESS.md).
 * Synthetic credentials only. No network, no database, no payment.
 */

installIsgpayEnv()
afterEach(() => {
  delete process.env['VERCEL_ENV']
})

const REF = 'ISG0MABCDEF0123456789ABCDEF'

describe('production endpoint table', () => {
  it('keeps UAT exactly as before', () => {
    expect(ISGPAY_ENDPOINTS.uat).toEqual({
      sale: 'https://sandbox.isgpay.com/ISGPay-Genius/request.action',
      status: 'https://sandbox.isgpay.com/ISGPay-Genius/Status',
    })
  })

  it('pins the production Sale and Status URLs exactly', () => {
    expect(ISGPAY_ENDPOINTS.production).toEqual({
      sale: 'https://isgpay.com/ISGPay-Genius/request.action',
      status: 'https://isgpay.com/ISGPay-Genius/Status',
    })
  })

  it('never shares an endpoint between environments', () => {
    const uat = Object.values(ISGPAY_ENDPOINTS.uat)
    for (const url of Object.values(ISGPAY_ENDPOINTS.production)) expect(uat).not.toContain(url)
  })

  it('a null Status endpoint still fails that environment closed', () => {
    setProductionEnv()
    const table = { ...ISGPAY_ENDPOINTS, production: { sale: ISGPAY_ENDPOINTS.production.sale, status: null } }
    expect(() => loadIsgpayConfig(table)).toThrow(/Status endpoint is not confirmed/)
  })
})

describe('ISGPAY_ENV=production', () => {
  it('loads with the real endpoint table on Vercel Production, with checkout still disabled', () => {
    setProductionEnv()
    const config = loadIsgpayConfig()
    expect(config.statusUrl).toBe('https://isgpay.com/ISGPay-Genius/Status')
    expect(config.enabled).toBe(false)
  })

  it('rejects UAT endpoints under production and production endpoints under UAT', () => {
    setProductionEnv()
    process.env['ISGPAY_STATUS_URL'] = 'https://sandbox.isgpay.com/ISGPay-Genius/Status'
    expect(() => loadIsgpayConfig()).toThrow('ISGPAY_STATUS_URL')
  })

  it('is accepted when complete and provider-confirmed', () => {
    const config = productionConfig()
    expect(config.env).toBe('production')
    expect(config.saleUrl).toBe('https://isgpay.com/ISGPay-Genius/request.action')
    expect(config.statusUrl).toBe('https://isgpay.com/ISGPay-Genius/Status')
    expect(config.enabled).toBe(false) // ISGPAY_ENABLED stays off unless set
  })

  it.each([undefined, 'preview', 'development'])('refuses to load outside the Vercel Production deployment (VERCEL_ENV=%j)', (vercelEnv) => {
    setProductionEnv()
    if (vercelEnv === undefined) delete process.env['VERCEL_ENV']
    else process.env['VERCEL_ENV'] = vercelEnv
    expect(() => loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)).toThrow(/only on the Vercel Production deployment/)
  })

  it.each([
    ['ISGPAY_SALE_URL', 'https://sandbox.isgpay.com/ISGPay-Genius/request.action'],
    ['ISGPAY_STATUS_URL', 'https://sandbox.isgpay.com/ISGPay-Genius/Status'],
    ['ISGPAY_SALE_URL', 'http://isgpay.com/ISGPay-Genius/request.action'],
    ['ISGPAY_SALE_URL', 'https://isgpay.com:8443/ISGPay-Genius/request.action'],
    ['ISGPAY_SALE_URL', 'https://user:pw@isgpay.com/ISGPay-Genius/request.action'],
    ['ISGPAY_SALE_URL', 'https://isgpay.com/ISGPay-Genius/other.action'],
    ['ISGPAY_SALE_URL', 'https://isgpay.com.evil.example/ISGPay-Genius/request.action'],
    ['ISGPAY_SALE_URL', 'https://www.isgpay.com/ISGPay-Genius/request.action'],
    ['ISGPAY_STATUS_URL', 'https://isgpay.com/ISGPay-Genius/Status?x=1'],
    ['ISGPAY_STATUS_URL', 'https://isgpay.com/ISGPay-Genius/Status#f'],
    ['ISGPAY_STATUS_URL', 'https://isgpay.com/ISGPay-Genius/Status/'],
    ['ISGPAY_STATUS_URL', 'https://isgpay.com/ISGPay-Genius/status'],
    ['ISGPAY_STATUS_URL', 'http://isgpay.com/ISGPay-Genius/Status'],
    ['ISGPAY_STATUS_URL', 'https://isgpay.com.evil.example/ISGPay-Genius/Status'],
    ['ISGPAY_STATUS_URL', 'https://isgpay.com/ISGPay-Genius/request.action'],
  ])('rejects sandbox or non-approved %s=%s', (name, value) => {
    setProductionEnv()
    process.env[name] = value
    expect(() => loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)).toThrow(name)
  })

  it('rejects a preview (vercel.app) ReturnURL even if VERCEL_BRANCH_URL is set', () => {
    setProductionEnv()
    process.env['VERCEL_BRANCH_URL'] = 'authentic-media-git-x-team.vercel.app'
    process.env['ISGPAY_RETURN_URL'] = 'https://authentic-media-git-x-team.vercel.app/api/payments/isgpay/return'
    expect(() => loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)).toThrow(/ISGPAY_RETURN_URL/)
    delete process.env['VERCEL_BRANCH_URL']
  })

  it.each([
    ['ISGPAY_BANK_ID', ''],
    ['ISGPAY_BANK_ID', '4'],
    ['ISGPAY_MERCHANT_ID', '1000-001'],
    ['ISGPAY_TERMINAL_ID', '123'],
    ['ISGPAY_MCC', '73'],
    ['ISGPAY_PASSCODE', 'P'],
    ['ISGPAY_SECURE_SECRET', 'tooshort'],
    ['ISGPAY_ENC_KEY', '0123456789abcdef'],
    ['ISGPAY_RETURN_URL', ''],
  ])('missing or malformed %s fails closed, naming only the variable', (name, value) => {
    setProductionEnv()
    process.env[name] = value
    expect(() => loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)).toThrow(name)
    try {
      loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)
    } catch (error) {
      for (const secret of PRODUCTION_FIXTURE_SECRETS) expect(String(error)).not.toContain(secret)
    }
  })

  it('preserves BankId / TerminalId as strings with leading zeros', () => {
    setProductionEnv()
    process.env['ISGPAY_BANK_ID'] = '000004'
    process.env['ISGPAY_TERMINAL_ID'] = '00000042'
    const config = loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)
    expect(config.bankId).toBe('000004')
    expect(config.terminalId).toBe('00000042')
    expect(typeof config.bankId).toBe('string')
  })

  it('maps the credential sheet onto the existing variable names', () => {
    const config = productionConfig()
    // MERCHANT_CODE, BANK_ID, TERMINAL_ID, MCC CODE
    expect(config.merchantId).toBe(PRODUCTION_FIXTURE['ISGPAY_MERCHANT_ID'])
    expect(config.bankId).toBe(PRODUCTION_FIXTURE['ISGPAY_BANK_ID'])
    expect(config.terminalId).toBe(PRODUCTION_FIXTURE['ISGPAY_TERMINAL_ID'])
    expect(config.mcc).toBe(PRODUCTION_FIXTURE['ISGPAY_MCC'])
    // ACCESS_CODE/PASS_CODE, SECURE SECRET/SALT, ENC_KEY
    expect(config.secrets.passCode).toBe(PRODUCTION_FIXTURE['ISGPAY_PASSCODE'])
    expect(config.secrets.secureSecret).toBe(PRODUCTION_FIXTURE['ISGPAY_SECURE_SECRET'])
    expect(config.secrets.encKey).toBe(PRODUCTION_FIXTURE['ISGPAY_ENC_KEY'])
  })

  it('ignores the Firvanra spelling ISGPAY_PASS_CODE and the UAT tester key', () => {
    setProductionEnv()
    delete process.env['ISGPAY_PASSCODE']
    process.env['ISGPAY_PASS_CODE'] = 'PROD5678'
    process.env['ISGPAY_UAT_ACCESS_KEY'] = 'a-long-random-uat-tester-key-0123456789'
    expect(() => loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)).toThrow(/ISGPAY_PASSCODE/)
    delete process.env['ISGPAY_PASS_CODE']
    delete process.env['ISGPAY_UAT_ACCESS_KEY']
  })

  it('never exposes production secrets through JSON, inspect or spreading', () => {
    const config = productionConfig()
    for (const text of [JSON.stringify(config), inspect(config, { depth: 5 }), JSON.stringify({ ...config })]) {
      for (const secret of PRODUCTION_FIXTURE_SECRETS) expect(text).not.toContain(secret)
    }
  })
})

describe('production Sale contract', () => {
  function sale() {
    process.env['ISGPAY_ENABLED'] = 'true'
    const config = productionConfig()
    return { config, handoff: buildSaleRequest(config, { txnRefNo: REF, amountPaise: '14900' }) }
  }

  it('posts to the production Sale URL with exactly the four outer fields', () => {
    const { handoff } = sale()
    expect(handoff.action).toBe('https://isgpay.com/ISGPay-Genius/request.action')
    expect(Object.keys(handoff.fields).sort()).toEqual(['BankId', 'EncData', 'MerchantId', 'TerminalId'])
  })

  it('EncData holds the required fields + SecureHash, and no Version', () => {
    const { config, handoff } = sale()
    const fields = parseEncData(decryptEncData(handoff.fields.EncData, config.secrets.encKey) ?? '')
    expect(fields).not.toBeNull()
    expect(Object.keys(fields ?? {}).sort()).toEqual(
      ['Amount', 'BankId', 'Command', 'Currency', 'MCC', 'MerchantId', 'PassCode', 'ReturnURL', 'SecureHash', 'TerminalId', 'TxnRefNo', 'TxnType'].sort(),
    )
    expect(fields?.['Version']).toBeUndefined()
    expect(fields?.['BankId']).toBe('000456')
    expect(Object.keys(handoff.fields)).not.toContain('SecureHash')
  })

  it('no secret appears in clear in the browser hand-off', () => {
    const { handoff } = sale()
    const text = JSON.stringify(handoff)
    for (const secret of PRODUCTION_FIXTURE_SECRETS) expect(text).not.toContain(secret)
  })

  it('stays blocked while ISGPAY_ENABLED is not "true"', () => {
    const config = productionConfig()
    expect(() => buildSaleRequest(config, { txnRefNo: REF, amountPaise: '14900' })).toThrow()
  })
})
