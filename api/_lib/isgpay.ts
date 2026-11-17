import { randomBytes } from 'node:crypto'

import { assertInitiationEnabled, type IsgpayConfig } from './isgpay-config.js'
import {
  computeSecureHash,
  encryptEncData,
  IsgpayProtocolError,
  openEnvelope,
  serializeEncData,
  verifyFields,
  type EnvelopeResult,
  type IsgpayFields,
  type VerifiedIsgpayFields,
} from './isgpay-crypto.js'
import { logEvent } from './log.js'

/**
 * ISGPay gateway client — Phase 1 (UAT, offline-tested only).
 *
 * Builds signed requests and validates gateway answers. It writes nothing to
 * any database and settles nothing: `evaluateTransaction` only says whether a
 * VERIFIED record is eligible for settlement in a later phase.
 */

// ── Transaction reference ───────────────────────────────────────────────────

/**
 * ISG + 8 base36 time chars + 16 hex (64 CSPRNG bits), upper-case, 27 chars.
 *
 * v1.6: TxnRefNo is Alpha-Numeric, 1–40. A hyphen ("ISG-…") is NOT used: the
 * 2017 docx sample had one, but v1.6 does not confirm it and rejects invalid
 * characters (VERORDID04). No hyphen also means it can never match the Airpay
 * `AM-` / `AM2-` formats.
 */
export const ISG_TXN_REF_RE = /^ISG[0-9A-Z]{8}[0-9A-F]{16}$/

export function generateTxnRefNo(now: number = Date.now()): string {
  const time = now.toString(36).toUpperCase().padStart(8, '0').slice(-8)
  return `ISG${time}${randomBytes(8).toString('hex').toUpperCase()}`
}

// ── Amount ──────────────────────────────────────────────────────────────────

/** v1.6 §9: smallest unit, no decimals/separators, > 0; §3.1.1 length 1–12. */
const MAX_PAISE = 999_999_999_999n

/**
 * Server-verified INR amount → integer paise string. 101.2 / "101.20" → "10120".
 *
 * String arithmetic via BigInt: no binary floating point is ever multiplied.
 * Numbers are accepted only when their shortest decimal form has ≤ 2 places.
 */
export function inrToPaise(amount: number | string): string {
  const text = typeof amount === 'number' ? (Number.isFinite(amount) ? String(amount) : '') : amount.trim()
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(text)
  if (!match) throw new IsgpayProtocolError('amount must be a positive INR value with at most 2 decimals')
  const paise = BigInt(match[1] as string) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
  if (paise <= 0n || paise > MAX_PAISE) throw new IsgpayProtocolError('amount out of range')
  return paise.toString()
}

/** Exact comparison of a gateway Amount with the expected paise string. */
export function amountsMatch(expectedPaise: string, gatewayAmount: string | undefined): boolean {
  if (gatewayAmount === undefined || !/^\d{1,12}$/.test(gatewayAmount) || !/^\d{1,12}$/.test(expectedPaise)) return false
  return BigInt(gatewayAmount) === BigInt(expectedPaise)
}

// ── Sale request ────────────────────────────────────────────────────────────

export interface SaleInput {
  readonly txnRefNo: string
  /** Server-computed amount in paise (from inrToPaise). Never client-supplied. */
  readonly amountPaise: string
  /** Optional, v1.6 Alpha-Numeric 1–40. */
  readonly orderInfo?: string | undefined
}

/** What the browser auto-posts to the hosted page. No secret is in clear here. */
export interface SaleHandoff {
  /** Server-selected, allowlisted gateway URL. */
  readonly action: string
  readonly fields: {
    readonly MerchantId: string
    readonly TerminalId: string
    readonly BankId: string
    readonly EncData: string
  }
  readonly txnRefNo: string
  readonly amountPaise: string
}

/**
 * Builds the encrypted Sale request (v1.6 §3.1.1).
 *
 * Non-PCI hosted redirection: no CardNumber / ExpiryDate / CardSecurityCode /
 * payOpt. The cardholder chooses and enters everything on ISGPay's page.
 * `Version` is omitted: it is in the 2019 kit but in no v1.6 table (UNCONFIRMED).
 */
export function buildSaleRequest(config: IsgpayConfig, input: SaleInput): SaleHandoff {
  assertInitiationEnabled(config)
  if (!ISG_TXN_REF_RE.test(input.txnRefNo)) throw new IsgpayProtocolError('invalid TxnRefNo')
  if (!/^[1-9]\d{0,11}$/.test(input.amountPaise)) throw new IsgpayProtocolError('invalid amount')
  if (input.orderInfo !== undefined && !/^[A-Za-z0-9]{1,40}$/.test(input.orderInfo)) {
    throw new IsgpayProtocolError('invalid OrderInfo')
  }

  const fields: Record<string, string> = {
    BankId: config.bankId,
    MerchantId: config.merchantId,
    TerminalId: config.terminalId,
    TxnRefNo: input.txnRefNo,
    MCC: config.mcc,
    PassCode: config.secrets.passCode,
    TxnType: 'Pay',
    Currency: config.currency,
    Amount: input.amountPaise,
    ReturnURL: config.returnUrl,
    // v1.6 §3.1.1 sample + §9 "Constant value as Pay". "Pay+TP" is tokenisation only.
    Command: 'Pay',
  }
  if (input.orderInfo) fields['OrderInfo'] = input.orderInfo

  const secureHash = computeSecureHash(fields, config.secrets.secureSecret)
  const plaintext = serializeEncData([...Object.entries(fields), ['SecureHash', secureHash]])

  return {
    action: config.saleUrl,
    fields: {
      MerchantId: config.merchantId,
      TerminalId: config.terminalId,
      BankId: config.bankId,
      EncData: encryptEncData(plaintext, config.secrets.encKey),
    },
    txnRefNo: input.txnRefNo,
    amountPaise: input.amountPaise,
  }
}

// ── Gateway response (browser return / push callback) ───────────────────────

/** Opens an EncData envelope with this merchant's keys. Phase 2 wires it to routes. */
export function openGatewayResponse(config: IsgpayConfig, encData: string): EnvelopeResult {
  return openEnvelope(encData, config.secrets)
}

// ── Sale Status Query ───────────────────────────────────────────────────────

export const STATUS_TIMEOUT_MS = 8_000
const USER_AGENT = 'AuthenticMedia/1.0 (+https://authenticmedia.fun)'

export type StatusFailure =
  | 'transport_error'
  | 'timeout'
  | 'http_error'
  | 'empty_body'
  | 'unrecognized_format'
  | 'duplicate_field'
  | 'invalid_ciphertext'
  | 'malformed_plaintext'
  | 'missing_hash'
  | 'hash_mismatch'

export type StatusResult =
  | { readonly kind: 'verified'; readonly fields: VerifiedIsgpayFields }
  | { readonly kind: 'inconclusive'; readonly reason: StatusFailure; readonly httpStatus?: number | undefined }

/** Status request fields, v1.6 §3.2.1. Plain (not EncData): the table lists no EncData. */
export function buildStatusRequest(config: IsgpayConfig, txnRefNo: string): Record<string, string> {
  if (!ISG_TXN_REF_RE.test(txnRefNo)) throw new IsgpayProtocolError('invalid TxnRefNo')
  const fields: Record<string, string> = {
    BankId: config.bankId,
    MerchantId: config.merchantId,
    TerminalId: config.terminalId,
    TxnRefNo: txnRefNo,
    PassCode: config.secrets.passCode,
    TxnType: 'Status',
    MCC: config.mcc,
  }
  fields['SecureHash'] = computeSecureHash(fields, config.secrets.secureSecret)
  return fields
}

/**
 * Parses a status body. The kit reads `k=v&k=v` (URL-decoded); v1.6 lists
 * fields but no wire format (UNCONFIRMED). If the pairs carry only an EncData
 * envelope, it is opened like a sale response. Anything else is inconclusive.
 */
export function parseStatusBody(config: IsgpayConfig, body: string): StatusResult {
  const text = body.trim()
  if (!text) return { kind: 'inconclusive', reason: 'empty_body' }
  if (!/^[A-Za-z][A-Za-z0-9]*=/.test(text) || /[<{\s]/.test(text.replace(/\+/g, ''))) {
    return { kind: 'inconclusive', reason: 'unrecognized_format' }
  }
  const fields: Record<string, string> = {}
  for (const [name, value] of new URLSearchParams(text)) {
    if (name in fields) return { kind: 'inconclusive', reason: 'duplicate_field' }
    fields[name] = value
  }
  const envelope = fields['EncData'] !== undefined && fields['ResponseCode'] === undefined
    ? openEnvelope(fields['EncData'], config.secrets)
    : verifyFields(fields, config.secrets.secureSecret)
  if (envelope.ok === false) return { kind: 'inconclusive', reason: envelope.reason }
  return { kind: 'verified', fields: envelope.fields }
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/**
 * POSTs a signed status query and returns a VERIFIED record or an inconclusive
 * reason. Never throws, never retries (a retry loop is a Phase 2 decision).
 *
 * Transport UNCONFIRMED: v1.6 says HTTP POST only; the kit puts params in the
 * query string. We send an x-www-form-urlencoded body (docx §2.5 "form POST")
 * so PassCode/SecureHash never appear in a URL. Redirects are refused.
 */
export async function querySaleStatus(
  config: IsgpayConfig,
  txnRefNo: string,
  fetchImpl: FetchLike = fetch,
): Promise<StatusResult> {
  const request = buildStatusRequest(config, txnRefNo)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  let result: StatusResult
  try {
    const response = await fetchImpl(config.statusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: new URLSearchParams(request).toString(),
      redirect: 'error',
      signal: controller.signal,
    })
    const body = await response.text()
    result = response.ok
      ? parseStatusBody(config, body)
      : { kind: 'inconclusive', reason: 'http_error', httpStatus: response.status }
  } catch {
    result = { kind: 'inconclusive', reason: controller.signal.aborted ? 'timeout' : 'transport_error' }
  } finally {
    clearTimeout(timer)
  }
  // Names and categories only — never field values or the body.
  logEvent('isgpay.status_query', {
    txnRefNo,
    result: result.kind,
    reason: result.kind === 'inconclusive' ? result.reason : undefined,
    httpStatus: result.kind === 'inconclusive' ? result.httpStatus : undefined,
  })
  return result
}

// ── Transaction validation ──────────────────────────────────────────────────

export interface ExpectedTransaction {
  readonly txnRefNo: string
  readonly amountPaise: string
}

export type TransactionOutcome =
  /** Verified, identity + amount match, ResponseCode "00". Eligible for settlement. */
  | { readonly outcome: 'success'; readonly responseCode: '00' }
  /** Verified and matching, but not approved. NOT necessarily terminal (Phase 2 policy). */
  | { readonly outcome: 'not_success'; readonly responseCode: string }
  /** Verified, but cannot be trusted for this order → requires_review later. */
  | { readonly outcome: 'mismatch'; readonly reason: 'merchant' | 'terminal' | 'bank' | 'txn_ref' | 'currency' | 'amount' }
  /** Verified and matching, ResponseCode 00, but no amount to check → stays pending. */
  | { readonly outcome: 'unverifiable'; readonly reason: 'amount_absent' | 'response_code_absent' }

/**
 * Cross-checks a VERIFIED record against our config and our own order.
 * Only ResponseCode "00" (v1.6 §7/§9) is success; the legacy "0" is not.
 */
export function evaluateTransaction(
  config: IsgpayConfig,
  expected: ExpectedTransaction,
  record: VerifiedIsgpayFields,
): TransactionOutcome {
  const r: IsgpayFields = record
  if (r['MerchantId'] !== config.merchantId) return { outcome: 'mismatch', reason: 'merchant' }
  if (r['TerminalId'] !== config.terminalId) return { outcome: 'mismatch', reason: 'terminal' }
  if (r['BankId'] !== config.bankId) return { outcome: 'mismatch', reason: 'bank' }
  if (r['TxnRefNo'] !== expected.txnRefNo) return { outcome: 'mismatch', reason: 'txn_ref' }
  if (r['Currency'] !== undefined && r['Currency'] !== config.currency) return { outcome: 'mismatch', reason: 'currency' }
  if (r['Amount'] !== undefined && !amountsMatch(expected.amountPaise, r['Amount'])) {
    return { outcome: 'mismatch', reason: 'amount' }
  }

  const code = r['ResponseCode']
  if (code === undefined || code === '') return { outcome: 'unverifiable', reason: 'response_code_absent' }
  if (code !== '00') return { outcome: 'not_success', responseCode: code }
  // Amount is Optional in the status response (§3.2.2): success without it is not proof.
  if (r['Amount'] === undefined) return { outcome: 'unverifiable', reason: 'amount_absent' }
  return { outcome: 'success', responseCode: '00' }
}
