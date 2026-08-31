import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  aesKey,
  buildEnvelope,
  buildSignedEnvelope,
  checksum,
  computeSecureHash,
  crc32,
  decrypt,
  encrypt,
  istDate,
  privateKey,
  verifySecureHash,
} from './airpay-crypto.ts'
import type { AirpayConfig } from './config.ts'

/** Non-secret fixture values. Never a real credential. */
const config: AirpayConfig = {
  mid: '366950',
  clientId: 'test-client',
  secretKey: 'test-oauth-secret',
  apiKey: 'test-api-key',
  username: 'test-user',
  password: 'test-pass',
  env: 'live',
  verifyUrl: 'https://example.invalid/verify/',
}

describe('privateKey (§3.1)', () => {
  it('derives sha256(API_KEY@USERNAME:|:PASSWORD)', () => {
    const expected = createHash('sha256')
      .update('test-api-key@test-user:|:test-pass')
      .digest('hex')
    expect(privateKey(config)).toBe(expected)
  })

  it('uses the API key, not the OAuth secret (⚠ PROVEN §2.2)', () => {
    const swapped = { ...config, apiKey: config.secretKey }
    expect(privateKey(swapped)).not.toBe(privateKey(config))
  })
})

describe('aesKey (⚠ PROVEN §3.2)', () => {
  it('is the 32 ASCII characters of the md5 hex, not 16 raw bytes', () => {
    const key = aesKey(config)
    expect(key.length).toBe(32)

    const hex = createHash('md5').update('test-user~:~test-pass').digest('hex')
    expect(key.toString('ascii')).toBe(hex)
  })

  it('differs from the hex-decoded 16-byte form', () => {
    const hex = createHash('md5').update('test-user~:~test-pass').digest('hex')
    expect(aesKey(config).equals(Buffer.from(hex, 'hex'))).toBe(false)
  })
})

describe('encrypt / decrypt (§3.3)', () => {
  it('round-trips a payload', () => {
    const plaintext = JSON.stringify({ orderid: 'AM-1234-abcd', amount: '1499.00' })
    const sealed = encrypt(plaintext, config)
    expect(decrypt(sealed, config)).toBe(plaintext)
  })

  it('prefixes 16 ASCII IV characters', () => {
    const sealed = encrypt('{}', config)
    expect(sealed.slice(0, 16)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('returns null rather than throwing on malformed input', () => {
    expect(decrypt('', config)).toBeNull()
    expect(decrypt('short', config)).toBeNull()
    expect(decrypt('0123456789abcdef!!!not-base64!!!', config)).toBeNull()
  })

  it('returns null when decrypted under the wrong key', () => {
    const sealed = encrypt('{"a":1}', config)
    const other = { ...config, password: 'different-pass' }
    expect(decrypt(sealed, other)).toBeNull()
  })
})

describe('istDate (⚠ PROVEN §3.5)', () => {
  it('formats YYYY-MM-DD', () => {
    expect(istDate(new Date('2026-08-31T12:00:00Z'))).toBe('2026-08-31')
  })

  it('is already tomorrow in IST when UTC is still the previous evening', () => {
    // 20:00 UTC = 01:30 IST the next day. This is the 00:00–05:30 IST window
    // in which a UTC-based checksum is computed against the wrong day.
    const instant = new Date('2026-08-31T20:00:00Z')
    expect(istDate(instant)).toBe('2026-09-01')
    expect(instant.toISOString().slice(0, 10)).toBe('2026-08-31')
  })
})

describe('checksum (§3.4)', () => {
  it('sorts by key, joins values only, then appends the IST date', () => {
    const now = new Date('2026-08-31T12:00:00Z')
    // Keys sort to [b, z]; values concatenate in THAT order, no separator.
    const expected = createHash('sha256').update('betaalpha2026-08-31').digest('hex')
    expect(checksum({ z: 'alpha', b: 'beta' }, now)).toBe(expected)
  })

  it('changes when the date changes', () => {
    const payload = { a: '1' }
    const day1 = checksum(payload, new Date('2026-08-31T12:00:00Z'))
    const day2 = checksum(payload, new Date('2026-09-01T12:00:00Z'))
    expect(day1).not.toBe(day2)
  })
})

describe('crc32', () => {
  it('matches PHP crc32() as an unsigned decimal string', () => {
    // Known IEEE 802.3 vector: crc32("123456789") === 3421780262
    expect(crc32('123456789')).toBe('3421780262')
  })
})

describe('ap_SecureHash (⚠ PROVEN §3.6)', () => {
  const fields = {
    transactionId: 'AM-1234-abcd',
    apTransactionId: 'AP999',
    amount: '1499.00',
    transactionStatus: '200',
    message: 'Success',
  }

  it('joins the proven field order with colons', () => {
    const expected = crc32(
      ['AM-1234-abcd', 'AP999', '1499.00', '200', 'Success', '366950', 'test-user'].join(':'),
    )
    expect(computeSecureHash(fields, config)).toBe(expected)
  })

  it('appends the customer VPA last when present', () => {
    const withVpa = computeSecureHash({ ...fields, customerVpa: 'a@upi' }, config)
    const expected = crc32(
      ['AM-1234-abcd', 'AP999', '1499.00', '200', 'Success', '366950', 'test-user', 'a@upi'].join(
        ':',
      ),
    )
    expect(withVpa).toBe(expected)
    expect(withVpa).not.toBe(computeSecureHash(fields, config))
  })

  it('does NOT upper-case the message', () => {
    const upper = computeSecureHash({ ...fields, message: 'SUCCESS' }, config)
    expect(upper).not.toBe(computeSecureHash(fields, config))
  })

  it('verifies a matching hash and rejects a mismatch', () => {
    const hash = computeSecureHash(fields, config)
    expect(verifySecureHash(hash, fields, config)).toBe(true)
    expect(verifySecureHash('0', fields, config)).toBe(false)
    expect(verifySecureHash('', fields, config)).toBe(false)
  })
})

describe('envelopes (§4)', () => {
  it('omits privatekey on the OAuth envelope (edge case 3)', () => {
    const envelope = buildEnvelope({ grant_type: 'client_credentials' }, config)
    expect(envelope).not.toHaveProperty('privatekey')
    expect(Object.keys(envelope).sort()).toEqual(['checksum', 'encdata', 'merchant_id'])
  })

  it('includes privatekey on the signed envelope (edge case 4)', () => {
    const envelope = buildSignedEnvelope({ orderid: 'AM-1' }, config)
    expect(envelope.privatekey).toBe(privateKey(config))
  })

  it('computes the checksum over the plaintext, and encdata decrypts back', () => {
    const payload = { orderid: 'AM-1', merchant_id: '366950' }
    const envelope = buildSignedEnvelope(payload, config)
    expect(decrypt(envelope.encdata as string, config)).toBe(JSON.stringify(payload))
  })
})
