import { inspect } from 'node:util'

import { describe, expect, it } from 'vitest'

import { assertInitiationEnabled, ConfigError, IsgpayDisabledError, loadIsgpayConfig } from './isgpay-config.js'
import { FIXTURE_SECRETS, installIsgpayEnv } from './isgpay-test-fixture.js'

installIsgpayEnv()

describe('ISGPay configuration', () => {
  it('loads a valid UAT configuration and preserves leading zeros', () => {
    const config = loadIsgpayConfig()
    expect(config.env).toBe('uat')
    expect(config.bankId).toBe('000123')
    expect(config.merchantId).toBe('100000000000001')
    expect(config.mcc).toBe('4112')
    expect(config.currency).toBe('356')
    expect(config.saleUrl).toBe('https://sandbox.isgpay.com/ISGPay-Genius/request.action')
    expect(config.statusUrl).toBe('https://sandbox.isgpay.com/ISGPay-Genius/Status')
    expect(config.secrets.passCode).toBe('TEST1234')
  })

  it.each(['ISGPAY_BANK_ID', 'ISGPAY_MERCHANT_ID', 'ISGPAY_TERMINAL_ID', 'ISGPAY_MCC', 'ISGPAY_PASSCODE', 'ISGPAY_SECURE_SECRET', 'ISGPAY_ENC_KEY', 'ISGPAY_CURRENCY', 'ISGPAY_SALE_URL', 'ISGPAY_STATUS_URL', 'ISGPAY_RETURN_URL'])(
    'fails closed when %s is missing, naming only the variable',
    (name) => {
      process.env[name] = '   '
      expect(() => loadIsgpayConfig()).toThrow(ConfigError)
      expect(() => loadIsgpayConfig()).toThrow(name)
    },
  )

  it.each([
    ['ISGPAY_BANK_ID', '4'],
    ['ISGPAY_BANK_ID', '00012A3'],
    ['ISGPAY_MERCHANT_ID', '10000000000000012'],
    ['ISGPAY_MERCHANT_ID', '1000-001'],
    ['ISGPAY_TERMINAL_ID', '1000001'],
    ['ISGPAY_MCC', '411'],
    ['ISGPAY_MCC', 'ABCD'],
    ['ISGPAY_PASSCODE', 'TEST12'],
    ['ISGPAY_SECURE_SECRET', 'short'],
    ['ISGPAY_ENC_KEY', '0123456789ABCDEF'],
    ['ISGPAY_ENC_KEY', 'TESTKEY0TESTKEY1TESTKEY2TESTKEY3X'],
    ['ISGPAY_CURRENCY', '840'],
    ['ISGPAY_ENABLED', 'yes'],
  ])('rejects malformed %s', (name, value) => {
    process.env[name] = value
    expect(() => loadIsgpayConfig()).toThrow(name)
  })

  it('never puts a secret value in an error message', () => {
    process.env['ISGPAY_ENC_KEY'] = 'SECRETVALUE-SHOULD-NOT-LEAK'
    expect(() => loadIsgpayConfig()).toThrow(/ISGPAY_ENC_KEY/)
    try {
      loadIsgpayConfig()
    } catch (error) {
      expect(String(error)).not.toContain('SECRETVALUE')
    }
  })

  describe('feature flag', () => {
    it('defaults to disabled and blocks initiation', () => {
      delete process.env['ISGPAY_ENABLED']
      const config = loadIsgpayConfig()
      expect(config.enabled).toBe(false)
      expect(() => assertInitiationEnabled(config)).toThrow(IsgpayDisabledError)
    })

    it('enables initiation only for exactly "true"', () => {
      process.env['ISGPAY_ENABLED'] = 'TRUE'
      expect(() => assertInitiationEnabled(loadIsgpayConfig())).not.toThrow()
    })
  })

  describe('endpoints', () => {
    it.each(['production', 'live', 'sandbox', ''])('rejects ISGPAY_ENV=%j', (value) => {
      process.env['ISGPAY_ENV'] = value
      expect(() => loadIsgpayConfig()).toThrow(/ISGPAY_ENV/)
    })

    it.each([
      ['ISGPAY_SALE_URL', 'https://isgpay.com/ISGPay-Genius/request.action'],
      ['ISGPAY_SALE_URL', 'https://sandbox.isgpay.com:8443/ISGPay/request.action'],
      ['ISGPAY_SALE_URL', 'http://sandbox.isgpay.com/ISGPay-Genius/request.action'],
      ['ISGPAY_SALE_URL', 'https://sandbox.isgpay.com.evil.example/ISGPay-Genius/request.action'],
      ['ISGPAY_SALE_URL', 'https://sandbox.isgpay.com/ISGPay-Genius/request.action?x=1'],
      ['ISGPAY_STATUS_URL', 'https://isgpay.com/ISGPay-Genius/Status'],
      ['ISGPAY_STATUS_URL', 'https://sandbox.isgpay.com/ISGPay-Genius/request.action'],
    ])('rejects a non-approved %s', (name, value) => {
      process.env[name] = value
      expect(() => loadIsgpayConfig()).toThrow(name)
    })

    it.each([
      'http://authenticmedia.fun/api/payments/isgpay/return',
      'https://evil.example/return',
      'https://authenticmedia.fun.evil.example/return',
      'https://authenticmedia.fun:8443/return',
      'https://authenticmedia.fun/return?a=1|b',
    ])('rejects ReturnURL %s', (value) => {
      process.env['ISGPAY_RETURN_URL'] = value
      expect(() => loadIsgpayConfig()).toThrow(/ISGPAY_RETURN_URL/)
    })

    it('refuses to point the ISGPay callback at the Airpay callback', () => {
      process.env['ISGPAY_CALLBACK_URL'] = 'https://authenticmedia.fun/callback/cpm/arp_frontiva/collection'
      expect(() => loadIsgpayConfig()).toThrow(/ISGPAY_CALLBACK_URL/)
    })

    it('treats the callback URL as optional', () => {
      delete process.env['ISGPAY_CALLBACK_URL']
      expect(loadIsgpayConfig().callbackUrl).toBeUndefined()
    })
  })

  it('does not expose secrets through JSON, inspect or spreading', () => {
    const config = loadIsgpayConfig()
    const surfaces = [JSON.stringify(config), inspect(config, { depth: 5 }), JSON.stringify({ ...config }), String(config.secrets)]
    for (const text of surfaces) {
      for (const secret of FIXTURE_SECRETS) {
        expect(text).not.toContain(secret)
      }
    }
  })
})

describe('return / callback URLs carry no token', () => {
  it('rejects a query string (e.g. a Vercel protection bypass) or fragment', () => {
    for (const name of ['ISGPAY_RETURN_URL', 'ISGPAY_CALLBACK_URL']) {
      const original = process.env[name]
      for (const suffix of ['?x-vercel-protection-bypass=abc', '#frag']) {
        process.env[name] = `https://authenticmedia.fun/api/payments/isgpay/${name.includes('RETURN') ? 'return' : 'callback'}${suffix}`
        expect(() => loadIsgpayConfig()).toThrow(ConfigError)
      }
      process.env[name] = original
    }
    expect(() => loadIsgpayConfig()).not.toThrow()
  })
})
