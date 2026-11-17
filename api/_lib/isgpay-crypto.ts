import { createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'node:crypto'

/**
 * ISGPay protocol primitives. Pure functions; secrets are passed in, never read
 * from the environment, so every function is unit-testable without config.
 *
 * Provenance (docs/ISGPAY-UAT-PHASE1.md):
 *   SecureHash   — v1.6 §4, reproduced byte-for-byte by the §4 example (CONFIRMED).
 *   EncData text — v1.6 §3.1.1/§5 "Name||Value::Name||Value" (CONFIRMED format).
 *   AES          — v1.6 says only "AES-256". Mode, padding and key bytes come from
 *                  the provider's legacy Node kit (Utility.js): AES-256-ECB, PKCS#7,
 *                  key = the key string's own UTF-8 bytes, Base64 out. UNCONFIRMED
 *                  against the live gateway.
 *
 * Nothing here logs. Callers must never log plaintexts, EncData or secrets.
 */

export type IsgpayFields = Readonly<Record<string, string>>

/** Brand: fields whose SecureHash has been verified with our secret. */
declare const verifiedBrand: unique symbol
export type VerifiedIsgpayFields = IsgpayFields & { readonly [verifiedBrand]: true }

const FIELD_NAME_RE = /^[A-Za-z][A-Za-z0-9]{0,63}$/
const HASH_RE = /^[0-9a-fA-F]{64}$/
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
// Anything below U+0020 (incl. NUL, CR, LF) — §4/§5: "must not include any null terminating characters".
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/

export class IsgpayProtocolError extends Error {}

/**
 * hex(SHA-256(secret + values of every non-empty field except SecureHash, in
 * ascending ASCII order of field name)).  v1.6 §4.
 *
 * Plain SHA-256 of the concatenation — NOT HMAC. Empty values contribute ""
 * either way, so omitting them (the kit's behaviour) cannot change the digest.
 * Default Array#sort compares UTF-16 code units, which for ASCII names is
 * exactly the ASCII order §4 requires ('Card' < 'CardNum' < 'card').
 */
export function computeSecureHash(fields: IsgpayFields, secret: string): string {
  if (!secret) throw new IsgpayProtocolError('secure secret is required')
  const names = Object.keys(fields)
    .filter((name) => name !== 'SecureHash')
    .sort()
  let input = secret
  for (const name of names) input += fields[name] ?? ''
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Constant-time check of a received SecureHash (case-insensitive hex). */
export function secureHashMatches(fields: IsgpayFields, secret: string): boolean {
  const received = fields['SecureHash']
  if (received === undefined || !HASH_RE.test(received)) return false
  const expected = Buffer.from(computeSecureHash(fields, secret), 'hex')
  return timingSafeEqual(expected, Buffer.from(received.toLowerCase(), 'hex'))
}

function assertSafeValue(name: string, value: string): void {
  // '|' anywhere, '::' anywhere, or a trailing ':' (which would merge with the
  // next '::') would let a value forge or swallow a field.
  if (value.includes('|') || value.includes('::') || value.endsWith(':') || CONTROL_RE.test(value)) {
    throw new IsgpayProtocolError(`field ${name} contains a reserved character`)
  }
}

/**
 * "Name||Value::Name||Value" in the order given (v1.6 §5: order is free, unlike
 * the hash). Undefined/empty optional fields are omitted, as the kit does.
 * Duplicate names, bad names and delimiter-bearing values are rejected.
 */
export function serializeEncData(entries: ReadonlyArray<readonly [string, string | undefined]>): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const [name, value] of entries) {
    if (!FIELD_NAME_RE.test(name)) throw new IsgpayProtocolError('invalid field name')
    if (seen.has(name)) throw new IsgpayProtocolError(`duplicate field ${name}`)
    seen.add(name)
    if (value === undefined || value === '') continue
    assertSafeValue(name, value)
    parts.push(`${name}||${value}`)
  }
  if (parts.length === 0) throw new IsgpayProtocolError('no fields to serialize')
  return parts.join('::')
}

/** Strict inverse of serializeEncData. Returns null on any malformation. */
export function parseEncData(plaintext: string): IsgpayFields | null {
  if (!plaintext || CONTROL_RE.test(plaintext)) return null
  const fields: Record<string, string> = Object.create(null) as Record<string, string>
  for (const part of plaintext.split('::')) {
    const pieces = part.split('||')
    if (pieces.length !== 2) return null
    const [name, value] = pieces as [string, string]
    if (!FIELD_NAME_RE.test(name) || name in fields || value.includes('|')) return null
    fields[name] = value
  }
  return { ...fields }
}

function aesKey(encKey: string): Buffer {
  // The key string's own bytes (kit: createCipheriv(…, EncKey string)). A 32-char
  // hex key is NOT hex-decoded: that would give 16 bytes and a different cipher.
  const key = Buffer.from(encKey, 'utf8')
  if (key.length !== 32) throw new IsgpayProtocolError('encryption key must be 32 bytes')
  return key
}

/** Base64(AES-256-ECB/PKCS#7(key, utf8 plaintext)). */
export function encryptEncData(plaintext: string, encKey: string): string {
  const cipher = createCipheriv('aes-256-ecb', aesKey(encKey), null)
  return Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]).toString('base64')
}

const utf8 = new TextDecoder('utf-8', { fatal: true })

/** Inverse of encryptEncData. Returns null (never throws) on bad Base64, key, padding or UTF-8. */
export function decryptEncData(encData: string, encKey: string): string | null {
  if (!encData || encData.length % 4 !== 0 || !BASE64_RE.test(encData)) return null
  const bytes = Buffer.from(encData, 'base64')
  if (bytes.length === 0 || bytes.length % 16 !== 0) return null
  try {
    const decipher = createDecipheriv('aes-256-ecb', aesKey(encKey), null)
    return utf8.decode(Buffer.concat([decipher.update(bytes), decipher.final()]))
  } catch {
    return null
  }
}

export type EnvelopeFailure = 'invalid_ciphertext' | 'malformed_plaintext' | 'missing_hash' | 'hash_mismatch'

export type EnvelopeResult =
  | { readonly ok: true; readonly fields: VerifiedIsgpayFields; readonly hashOver: 'raw' | 'url_decoded' }
  | { readonly ok: false; readonly reason: EnvelopeFailure }

function urlDecodeValues(fields: IsgpayFields): IsgpayFields | null {
  const out: Record<string, string> = {}
  try {
    for (const [name, value] of Object.entries(fields)) {
      out[name] = name === 'SecureHash' ? value : decodeURIComponent(value.replace(/\+/g, '%20'))
    }
  } catch {
    return null
  }
  return out
}

/**
 * Verifies fields (already parsed) against SecureHash.
 *
 * Tries the values as received first. Only if that fails, tries them once
 * URL-decoded, because the legacy kit decodes response values ('+' → space)
 * before hashing and v1.6 does not say which form the gateway signs
 * (UNCONFIRMED). Both variants need the secret; neither can be forged without it.
 */
export function verifyFields(fields: IsgpayFields, secret: string): EnvelopeResult {
  if (!fields['SecureHash']) return { ok: false, reason: 'missing_hash' }
  if (secureHashMatches(fields, secret)) {
    return { ok: true, fields: fields as VerifiedIsgpayFields, hashOver: 'raw' }
  }
  const decoded = urlDecodeValues(fields)
  if (decoded && secureHashMatches(decoded, secret)) {
    return { ok: true, fields: decoded as VerifiedIsgpayFields, hashOver: 'url_decoded' }
  }
  return { ok: false, reason: 'hash_mismatch' }
}

/** Decrypt → parse → verify an EncData envelope (sale response / push callback). */
export function openEnvelope(encData: string, keys: { readonly encKey: string; readonly secureSecret: string }): EnvelopeResult {
  const plaintext = decryptEncData(encData, keys.encKey)
  if (plaintext === null) return { ok: false, reason: 'invalid_ciphertext' }
  const fields = parseEncData(plaintext)
  if (fields === null) return { ok: false, reason: 'malformed_plaintext' }
  return verifyFields(fields, keys.secureSecret)
}
