import { afterEach, beforeEach } from 'vitest'

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
