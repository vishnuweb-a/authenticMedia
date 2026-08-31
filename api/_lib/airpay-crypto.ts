import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import type { AirpayConfig } from './config'

/**
 * The four Airpay protocol primitives (AIPAY-DOCS §3).
 *
 * They live in exactly one module. Reimplementing any of them elsewhere is how
 * integrations drift, and several of the details below are counter-intuitive
 * enough that a well-meaning "fix" silently breaks payments.
 */

/**
 * privatekey = sha256_hex(API_KEY + "@" + USERNAME + ":|:" + PASSWORD)  (§3.1)
 *
 * A per-merchant constant, not a per-request signature. It commits to nothing —
 * not the order, not the amount, not the time — and it is POSTed from the
 * customer's browser in the hosted-page flow, so it is visible in DevTools.
 * Receiving it authenticates nothing.
 */
export function privateKey(config: AirpayConfig): string {
  return createHash('sha256')
    .update(`${config.apiKey}@${config.username}:|:${config.password}`)
    .digest('hex')
}

/**
 * aesKey = ASCII_BYTES(md5_hex(USERNAME + "~:~" + PASSWORD))  — 32 bytes
 *
 * ⚠ PROVEN (§3.2), the most misread detail in the protocol. MD5 yields 16 raw
 * bytes, which is not a valid AES-256 key. Airpay's PHP reference passes
 * md5(), which returns the *hex string* by default, so what reaches OpenSSL is
 * 32 ASCII characters — exactly the 32 bytes AES-256 needs.
 *
 * Hex-decoding this back to 16 bytes produces a different key and a silently
 * undecryptable payload. Do not "fix" it.
 */
export function aesKey(config: AirpayConfig): Buffer {
  const hex = createHash('md5').update(`${config.username}~:~${config.password}`).digest('hex')
  return Buffer.from(hex, 'ascii')
}

/**
 * encdata = iv + base64(AES-256-CBC(aesKey, iv, JSON))  (§3.3)
 *
 * The IV is 16 hex characters used as 16 ASCII bytes — the same
 * ASCII-of-hex convention as the key, NOT 8 bytes hex-decoded.
 */
export function encrypt(plaintext: string, config: AirpayConfig): string {
  const iv = randomBytes(8).toString('hex') // 16 hex chars, used as 16 ASCII bytes
  const cipher = createCipheriv('aes-256-cbc', aesKey(config), Buffer.from(iv, 'ascii'))
  cipher.setAutoPadding(true) // PKCS#5/7
  const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return iv + sealed.toString('base64')
}

/**
 * The exact reverse of encrypt: first 16 chars are the IV, the rest is base64.
 *
 * Returns null and NEVER throws (§3.3). A malformed payload is an expected
 * outcome on a public endpoint, not an exception.
 */
export function decrypt(sealed: string, config: AirpayConfig): string | null {
  try {
    if (typeof sealed !== 'string' || sealed.length <= 16) return null
    const iv = sealed.slice(0, 16)
    const body = sealed.slice(16)
    const decipher = createDecipheriv('aes-256-cbc', aesKey(config), Buffer.from(iv, 'ascii'))
    const out = Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()])
    return out.toString('utf8')
  } catch {
    return null
  }
}

/**
 * The IST date, formatted YYYY-MM-DD.  ⚠ PROVEN (§3.5)
 *
 * Airpay's reference is PHP date('Y-m-d') on an IST server; most hosts run UTC.
 * Between 00:00 and 05:30 IST the UTC date is still yesterday, so a checksum
 * built from toISOString().slice(0,10) is computed against the wrong day and
 * rejected — every night, for five and a half hours, and never during a
 * working-hours test.
 *
 * en-CA's short format IS ISO YYYY-MM-DD.
 */
export function istDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * checksum = sha256_hex(values_sorted_by_key.join("") + IST_DATE)  (§3.4)
 *
 * Sort by key (PHP ksort), concatenate values only with no separator, then
 * append the date last.
 */
export function checksum(
  payload: Readonly<Record<string, string | number>>,
  now: Date = new Date(),
): string {
  const joined = Object.keys(payload)
    .sort()
    .map((key) => String(payload[key]))
    .join('')
  return createHash('sha256').update(joined + istDate(now)).digest('hex')
}

const CRC32_TABLE: readonly number[] = (() => {
  const table: number[] = []
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

/** CRC-32 IEEE 802.3, matching PHP crc32(), as an unsigned decimal string. */
export function crc32(input: string): string {
  const bytes = Buffer.from(input, 'utf8')
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8)
  }
  return String((crc ^ 0xffffffff) >>> 0)
}

export interface SecureHashFields {
  /** OUR order reference, not Airpay's transaction id. */
  readonly transactionId: string
  readonly apTransactionId: string
  readonly amount: string
  readonly transactionStatus: string
  /** Verbatim — the live value is "Success"; do NOT upper-case it. */
  readonly message: string
  /** UPI only; appended last when present. */
  readonly customerVpa?: string | undefined
}

/**
 * ap_SecureHash = crc32_decimal(fields.join(':'))  (§3.6)
 *
 * ⚠ PROVEN by elimination: of seven candidate constructions, exactly one
 * reproduced a real live hash. Do not normalise the case, reorder the fields,
 * or drop the VPA.
 *
 * ⚠ This is an integrity check, NOT authentication. CRC32 is unkeyed and every
 * input is derivable by anyone holding the MID and username, so a match means
 * "probably not corrupted in transit" and nothing more. It may only ever add a
 * rejection — never grant a settlement.
 */
export function computeSecureHash(fields: SecureHashFields, config: AirpayConfig): string {
  const parts = [
    fields.transactionId,
    fields.apTransactionId,
    fields.amount,
    fields.transactionStatus,
    fields.message,
    config.mid,
    config.username,
  ]
  if (fields.customerVpa) parts.push(fields.customerVpa)
  return crc32(parts.join(':'))
}

export function verifySecureHash(
  expected: string,
  fields: SecureHashFields,
  config: AirpayConfig,
): boolean {
  return Boolean(expected) && computeSecureHash(fields, config) === expected
}

/**
 * OAuth2 token request envelope (§4).
 *
 * privatekey MUST be absent: sending it on the token request is a documented
 * way to have the token refused (edge case 3).
 */
export function buildEnvelope(
  payload: Readonly<Record<string, string | number>>,
  config: AirpayConfig,
  now: Date = new Date(),
): Record<string, string> {
  return {
    merchant_id: config.mid,
    encdata: encrypt(JSON.stringify(payload), config),
    checksum: checksum(payload, now), // over the PLAINTEXT payload
  }
}

/**
 * Envelope for every token-authenticated transactional API, including Order
 * Confirmation (§4).
 *
 * Airpay resolves *which merchant is asking* from privatekey. Omitting it on
 * /verify/ is exactly what makes the gateway answer {"merchant_id": null, …} —
 * an answer it could not attribute, encrypted under a key you do not hold.
 */
export function buildSignedEnvelope(
  payload: Readonly<Record<string, string | number>>,
  config: AirpayConfig,
  now: Date = new Date(),
): Record<string, string> {
  return { ...buildEnvelope(payload, config, now), privatekey: privateKey(config) }
}
