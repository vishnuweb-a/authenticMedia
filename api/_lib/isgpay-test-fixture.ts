import { afterEach, beforeEach } from 'vitest'

import { ISGPAY_ENDPOINTS, loadIsgpayConfig, type IsgpayConfig, type IsgpayEndpoints, type IsgpayEnv } from './isgpay-config.js'

/** Synthetic ISGPay values for tests only. Never a real credential. */
export const ISGPAY_FIXTURE: Readonly<Record<string, string>> = {
  ISGPAY_ENABLED: 'false',
  ISGPAY_ENV: 'uat',
  ISGPAY_BANK_ID: '000123',
  ISGPAY_MERCHANT_ID: '100000000000001',
  ISGPAY_TERMINAL_ID: '10000001',
  ISGPAY_MCC: '4112',
  ISGPAY_PASSCODE: 'TEST1234',
  ISGPAY_SECURE_SECRET: 'A1B2C3D4E5F60718293A4B5C6D7E8F90',
  ISGPAY_ENC_KEY: 'TESTKEY0TESTKEY1TESTKEY2TESTKEY3',
  ISGPAY_CURRENCY: '356',
  ISGPAY_SALE_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/request.action',
  ISGPAY_STATUS_URL: 'https://sandbox.isgpay.com/ISGPay-Genius/Status',
  ISGPAY_RETURN_URL: 'https://authenticmedia.fun/api/payments/isgpay/return',
  ISGPAY_CALLBACK_URL: 'https://authenticmedia.fun/api/payments/isgpay/callback',
  ISGPAY_PRODUCTION_LAUNCH_ENABLED: 'false',
}

export const FIXTURE_SECRETS: readonly string[] = [
  ISGPAY_FIXTURE['ISGPAY_PASSCODE'] as string,
  ISGPAY_FIXTURE['ISGPAY_SECURE_SECRET'] as string,
  ISGPAY_FIXTURE['ISGPAY_ENC_KEY'] as string,
]

/** Installs the fixture into process.env for each test and restores the real environment after. */
export function installIsgpayEnv(): void {
  let saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    saved = {}
    for (const [key, value] of Object.entries(ISGPAY_FIXTURE)) {
      saved[key] = process.env[key]
      process.env[key] = value
    }
  })
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
}

/** Kept for existing suites; since Phase 4 it equals the real table. */
export const CONFIRMED_TEST_ENDPOINTS: Readonly<Record<IsgpayEnv, IsgpayEndpoints>> = {
  ...ISGPAY_ENDPOINTS,
  production: { sale: ISGPAY_ENDPOINTS.production.sale, status: 'https://isgpay.com/ISGPay-Genius/Status' },
}

/** Synthetic production-shaped credentials: different from the UAT fixture, still fake. */
export const PRODUCTION_FIXTURE: Readonly<Record<string, string>> = {
  ISGPAY_ENV: 'production',
  ISGPAY_BANK_ID: '000456',
  ISGPAY_MERCHANT_ID: '200000000000002',
  ISGPAY_TERMINAL_ID: '20000002',
  ISGPAY_MCC: '7372',
  ISGPAY_PASSCODE: 'PROD5678',
  ISGPAY_SECURE_SECRET: 'F0E1D2C3B4A5968778695A4B3C2D1E0F',
  ISGPAY_ENC_KEY: 'PRODKEY0PRODKEY1PRODKEY2PRODKEY3',
  ISGPAY_SALE_URL: 'https://isgpay.com/ISGPay-Genius/request.action',
  ISGPAY_STATUS_URL: 'https://isgpay.com/ISGPay-Genius/Status',
}

export const PRODUCTION_FIXTURE_SECRETS: readonly string[] = [
  PRODUCTION_FIXTURE['ISGPAY_PASSCODE'] as string,
  PRODUCTION_FIXTURE['ISGPAY_SECURE_SECRET'] as string,
  PRODUCTION_FIXTURE['ISGPAY_ENC_KEY'] as string,
]

/**
 * Switches the current test to the production fixture on the Vercel
 * Production deployment. installIsgpayEnv() restores the ISGPAY_* keys after
 * each test; the caller's beforeEach must reset VERCEL_ENV.
 */
export function setProductionEnv(): void {
  Object.assign(process.env, PRODUCTION_FIXTURE)
  process.env['VERCEL_ENV'] = 'production'
}

/** A production config as it will load once ISGPay confirms the Status URL. */
export function productionConfig(): IsgpayConfig {
  setProductionEnv()
  return loadIsgpayConfig(CONFIRMED_TEST_ENDPOINTS)
}
