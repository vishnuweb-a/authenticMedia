import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  computeSecureHash,
  decryptEncData,
  encryptEncData,
  IsgpayProtocolError,
  openEnvelope,
  parseEncData,
  secureHashMatches,
  serializeEncData,
  verifyFields,
} from './isgpay-crypto.js'

/** Synthetic credentials (also in isgpay-test-fixture.ts). */
const KEY = 'TESTKEY0TESTKEY1TESTKEY2TESTKEY3'
const SECRET = 'A1B2C3D4E5F60718293A4B5C6D7E8F90'

/** A full v1.6 sale field set with synthetic identities. */
const SALE = {
  BankId: '000123',
  MerchantId: '100000000000001',
  TerminalId: '10000001',
  TxnRefNo: 'ISG0MABCDEF0123456789ABCDEF',
  MCC: '4112',
  PassCode: 'TEST1234',
  TxnType: 'Pay',
  Currency: '356',
  Amount: '10120',
  ReturnURL: 'https://authenticmedia.fun/api/payments/isgpay/return',
  Command: 'Pay',
}

describe('SecureHash (v1.6 §4)', () => {
  it('reproduces the v1.6 §4 published example exactly', () => {
    // The spec's own sample secret and three fields.
    const fields = { MerchantId: 'MER123', OrderInfo: 'Order456', Amount: '2995' }
    expect(computeSecureHash(fields, '0F5DD14AE2E38C7EBD8814D29CF6F6F0')).toBe(
      'f43c85acfc4e659dcc0f654c553a199797a57cb45a8f5772770271a13fbe287b',
    )
  })

  it('matches the legacy kit and coreutils sha256sum on a full sale field set', () => {
    // Derived offline twice: YesBankPG Utility.generateSecurehash, and
    // `printf secret+values | sha256sum` with the ASCII order written out by hand.
    expect(computeSecureHash(SALE, SECRET)).toBe('a1805797069b17fd4e9c9738f917e8e06a9523a64a6ced343490de7467901d93')
  })

  it('is plain SHA-256, not HMAC-SHA256', () => {
    const fields = { Amount: '2995' }
    const hmac = createHmac('sha256', SECRET).update('2995').digest('hex')
    expect(computeSecureHash(fields, SECRET)).not.toBe(hmac)
  })

  it('orders by ASCII code unit: uppercase before lowercase, prefix before longer name', () => {
    // 'Card' < 'CardNum' < 'card'  → secret + "1" + "2" + "3"
    expect(computeSecureHash({ card: '3', CardNum: '2', Card: '1' }, SECRET)).toBe(
      computeSecureHash({ A: '123' }, SECRET),
    )
    expect(computeSecureHash({ card: '1', Card: '2' }, SECRET)).not.toBe(computeSecureHash({ card: '2', Card: '1' }, SECRET))
  })

  it('is independent of insertion order', () => {
    const reversed = Object.fromEntries(Object.entries(SALE).reverse())
    expect(computeSecureHash(reversed, SECRET)).toBe(computeSecureHash(SALE, SECRET))
  })

  it('excludes the SecureHash field from its own input', () => {
    const hash = computeSecureHash(SALE, SECRET)
    expect(computeSecureHash({ ...SALE, SecureHash: 'anything' }, SECRET)).toBe(hash)
  })

  it('treats field values case-sensitively', () => {
    expect(computeSecureHash({ ...SALE, TxnType: 'pay' }, SECRET)).not.toBe(computeSecureHash(SALE, SECRET))
  })

  it('verifies a correct hash in constant time, case-insensitively', () => {
    const hash = computeSecureHash(SALE, SECRET)
    expect(secureHashMatches({ ...SALE, SecureHash: hash }, SECRET)).toBe(true)
    expect(secureHashMatches({ ...SALE, SecureHash: hash.toUpperCase() }, SECRET)).toBe(true)
  })

  it('rejects a tampered field and a wrong secret', () => {
    const hash = computeSecureHash(SALE, SECRET)
    expect(secureHashMatches({ ...SALE, Amount: '1', SecureHash: hash }, SECRET)).toBe(false)
    expect(secureHashMatches({ ...SALE, SecureHash: hash }, 'B1B2C3D4E5F60718293A4B5C6D7E8F90')).toBe(false)
  })

  it.each(['', 'zz', 'a'.repeat(63), 'g'.repeat(64)])('rejects a malformed received hash %j', (hash) => {
    expect(secureHashMatches({ ...SALE, SecureHash: hash }, SECRET)).toBe(false)
  })

  it('refuses an empty secret', () => {
    expect(() => computeSecureHash(SALE, '')).toThrow(IsgpayProtocolError)
  })
})

describe('EncData serialization (v1.6 §5)', () => {
  it('produces Name||Value::Name||Value with no whitespace or trailing separator', () => {
    expect(serializeEncData([['MerchantId', '100000020000001'], ['TerminalId', 'CG000001'], ['TxnRefNo', '210315162206'], ['BankId', '000004']])).toBe(
      'MerchantId||100000020000001::TerminalId||CG000001::TxnRefNo||210315162206::BankId||000004',
    )
  })

  it('keeps the given order (hash ordering is a separate concern)', () => {
    expect(serializeEncData([['b', '2'], ['A', '1']])).toBe('b||2::A||1')
  })

  it('omits undefined and empty optional fields', () => {
    expect(serializeEncData([['A', '1'], ['OrderInfo', undefined], ['UDF01', ''], ['B', '2']])).toBe('A||1::B||2')
  })

  it('accepts a URL value (":/" is not a delimiter)', () => {
    expect(serializeEncData([['ReturnURL', SALE.ReturnURL]])).toBe(`ReturnURL||${SALE.ReturnURL}`)
  })

  it.each([
    ['a pipe', 'x|y'],
    ['a double pipe', 'x||Amount'],
    ['a double colon', 'x::Amount||1'],
    ['a trailing colon', 'x:'],
    ['a newline', 'x\ny'],
    ['a NUL', 'x\u0000'],
  ])('rejects a value containing %s (delimiter injection)', (_label, value) => {
    expect(() => serializeEncData([['OrderInfo', value]])).toThrow(IsgpayProtocolError)
  })

  it.each(['', '1Amount', 'Amo unt', 'Amount|', 'Amo:unt'])('rejects field name %j', (name) => {
    expect(() => serializeEncData([[name, '1']])).toThrow(IsgpayProtocolError)
  })

  it('rejects duplicate field names', () => {
    expect(() => serializeEncData([['Amount', '1'], ['Amount', '2']])).toThrow(/duplicate/)
  })

  it('parses its own output back exactly, preserving case', () => {
    const text = serializeEncData(Object.entries(SALE))
    expect(parseEncData(text)).toEqual(SALE)
  })

  it.each([
    ['empty', ''],
    ['no separator', 'Amount10120'],
    ['three-way split', 'Amount||1||2'],
    ['trailing separator', 'Amount||1::'],
    ['leading whitespace in name', ' Amount||1'],
    ['duplicate names', 'Amount||1::Amount||2'],
    ['stray pipe in value', 'Amount||1|2'],
    ['control character', 'Amount||1\r'],
  ])('rejects malformed plaintext: %s', (_label, text) => {
    expect(parseEncData(text)).toBeNull()
  })

  it('keeps an empty value as empty rather than dropping it', () => {
    expect(parseEncData('Amount||1::UDF01||')).toEqual({ Amount: '1', UDF01: '' })
  })
})

describe('AES-256-ECB / PKCS#7 / Base64 (legacy kit, UNCONFIRMED with gateway)', () => {
  const PLAIN = 'BankId||000123::MerchantId||100000000000001::Amount||10120'
  // Produced offline by BOTH the YesBankPG kit's encrypt_aes and
  // `openssl enc -aes-256-ecb -K <hex of the key's 32 ASCII bytes> -nosalt -base64`.
  const VECTOR = 'nnfyIuEeUSmoznIq66OXmJz7MUPv7HbjEUkfEFsPH33Dc+VSRYP4Pn/R97tQihax/GluQu7yjjvBqSOEsIulRA=='

  it('matches the kit/OpenSSL fixed vector', () => {
    expect(encryptEncData(PLAIN, KEY)).toBe(VECTOR)
  })

  it('decrypts the fixed vector', () => {
    expect(decryptEncData(VECTOR, KEY)).toBe(PLAIN)
  })

  it('uses the key string bytes, not its hex decoding', () => {
    // A 32-hex-char key hex-decodes to 16 bytes, which AES-256 must refuse.
    expect(() => encryptEncData(PLAIN, '0123456789ABCDEF')).toThrow(IsgpayProtocolError)
    const hexKey = '0123456789ABCDEF0123456789ABCDEF'
    expect(decryptEncData(encryptEncData(PLAIN, hexKey), hexKey)).toBe(PLAIN)
  })

  it('round-trips multi-block and exact-block-length input (PKCS#7 adds a full block)', () => {
    const sixteen = 'A'.repeat(16)
    expect(Buffer.from(encryptEncData(sixteen, KEY), 'base64')).toHaveLength(32)
    const long = serializeEncData(Object.entries(SALE))
    expect(decryptEncData(encryptEncData(long, KEY), KEY)).toBe(long)
  })

  it.each([
    ['empty', ''],
    ['not base64', '***not-base64***'],
    ['bad padding position', 'nnfy=IuE'],
    ['URL-safe alphabet', VECTOR.replace(/\+/g, '-').replace(/\//g, '_')],
    ['spaces where + was form-decoded', VECTOR.replace(/\+/g, ' ')],
    ['not a block multiple', Buffer.alloc(15).toString('base64')],
  ])('returns null for invalid Base64: %s', (_label, input) => {
    expect(decryptEncData(input, KEY)).toBeNull()
  })

  it('returns null for corrupted ciphertext (bad padding) and never throws', () => {
    const bytes = Buffer.from(VECTOR, 'base64')
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 0xff
    expect(decryptEncData(bytes.toString('base64'), KEY)).toBeNull()
  })

  it('returns null with the wrong key', () => {
    expect(decryptEncData(VECTOR, 'WRONGKEYWRONGKEYWRONGKEYWRONGKEY')).toBeNull()
  })
})

describe('envelope verification', () => {
  const keys = { encKey: KEY, secureSecret: SECRET }
  const response = { ...SALE, ResponseCode: '00', Message: 'Transaction Successful' }
  const seal = (fields: Record<string, string>, secret = SECRET) =>
    encryptEncData(serializeEncData([...Object.entries(fields), ['SecureHash', computeSecureHash(fields, secret)]]), KEY)

  it('opens a correctly signed envelope', () => {
    const result = openEnvelope(seal(response), keys)
    expect(result.ok && result.fields['ResponseCode']).toBe('00')
    expect(result.ok && result.hashOver).toBe('raw')
  })

  it('reports each failure distinctly', () => {
    expect(openEnvelope('garbage', keys)).toEqual({ ok: false, reason: 'invalid_ciphertext' })
    expect(openEnvelope(encryptEncData('no-pairs-here', KEY), keys)).toEqual({ ok: false, reason: 'malformed_plaintext' })
    expect(openEnvelope(encryptEncData(serializeEncData(Object.entries(response)), KEY), keys)).toEqual({ ok: false, reason: 'missing_hash' })
    expect(openEnvelope(seal(response, 'B1B2C3D4E5F60718293A4B5C6D7E8F90'), keys)).toEqual({ ok: false, reason: 'hash_mismatch' })
    expect(openEnvelope(seal(response), { ...keys, encKey: 'WRONGKEYWRONGKEYWRONGKEYWRONGKEY' })).toEqual({ ok: false, reason: 'invalid_ciphertext' })
  })

  it('accepts a hash computed over URL-decoded values (kit behaviour) and returns decoded values', () => {
    const decoded = { ...response, Message: 'Transaction Successful' }
    const hash = computeSecureHash(decoded, SECRET)
    const result = verifyFields({ ...decoded, Message: 'Transaction+Successful', SecureHash: hash }, SECRET)
    expect(result.ok && result.hashOver).toBe('url_decoded')
    expect(result.ok && result.fields['Message']).toBe('Transaction Successful')
  })

  it('rejects a tampered field even when other fields are URL-encoded', () => {
    const hash = computeSecureHash(response, SECRET)
    expect(verifyFields({ ...response, Amount: '1', SecureHash: hash }, SECRET)).toEqual({ ok: false, reason: 'hash_mismatch' })
  })
})
