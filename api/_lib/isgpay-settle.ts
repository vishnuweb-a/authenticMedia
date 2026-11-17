import { getServiceClient, findOrderByRef } from './db.js'
import type { IsgpayConfig } from './isgpay-config.js'
import { evaluateTransaction, inrToPaise, ISG_TXN_REF_RE, querySaleStatus, type StatusResult } from './isgpay.js'
import { logEvent } from './log.js'

/**
 * ISGPay settlement — the ONLY place an ISGPay order may change state.
 *
 * Browser return, push callback and the status endpoint all call
 * settleIsgpayOrder with nothing but a TxnRefNo. The answer always comes from a
 * fresh, SecureHash-verified Sale Status Query, cross-checked against the
 * amount stored on our own row. A redirect or callback body never settles.
 *
 * Decline policy is undecided (docs §10, Q9), so a verified non-"00" leaves the
 * order pending: fail closed in both directions.
 */

const TERMINAL = new Set(['paid', 'failed', 'cancelled', 'delivered', 'requires_review'])

export type IsgpaySettleOutcome =
  | 'paid'
  | 'requires_review'
  | 'pending'
  | 'declined_pending'
  | 'already_settled'
  | 'unknown_order'

/** Safe-to-show summary of what the gateway said. No secret, no customer data. */
export interface GatewaySummary {
  readonly txnRefNo?: string | undefined
  readonly amountPaise?: string | undefined
  readonly responseCode?: string | undefined
  readonly message?: string | undefined
  readonly gatewayTxnId?: string | undefined
  readonly retRefNo?: string | undefined
}

export interface IsgpaySettleResult {
  readonly outcome: IsgpaySettleOutcome
  readonly orderRef: string
  readonly status: string | null
  readonly amountInr: number | null
  readonly reason?: string | undefined
  readonly gateway?: GatewaySummary | undefined
}

export interface IsgpaySettleDeps {
  readonly query?: (config: IsgpayConfig, txnRefNo: string) => Promise<StatusResult>
  readonly settleRow?: (orderRef: string, status: 'succeeded' | 'requires_review', gatewayRef: string | null) => Promise<string | null>
}

export async function settleIsgpayRow(
  orderRef: string,
  paymentStatus: 'succeeded' | 'requires_review',
  gatewayRef: string | null,
): Promise<string | null> {
  const { data, error } = await getServiceClient().rpc('settle_isgpay_order', {
    p_order_ref: orderRef,
    p_payment_status: paymentStatus,
    p_gateway_ref: gatewayRef,
  })
  if (error) throw new Error(`settle_isgpay_order failed: ${error.code ?? 'unknown'}`)
  return typeof data === 'string' ? data : null
}

export async function settleIsgpayOrder(
  config: IsgpayConfig,
  txnRefNo: string,
  deps: IsgpaySettleDeps = {},
): Promise<IsgpaySettleResult> {
  const query = deps.query ?? querySaleStatus
  const settleRow = deps.settleRow ?? settleIsgpayRow
  const base = { orderRef: txnRefNo }

  if (!ISG_TXN_REF_RE.test(txnRefNo)) return { ...base, outcome: 'unknown_order', status: null, amountInr: null }

  const order = await findOrderByRef(txnRefNo)
  if (!order || order.paymentMethod !== 'isgpay') {
    logEvent('isgpay.settle.unknown_order', { txnRefNo })
    return { ...base, outcome: 'unknown_order', status: null, amountInr: null }
  }
  const amountInr = order.totalInr
  if (TERMINAL.has(order.status)) return { ...base, outcome: 'already_settled', status: order.status, amountInr }

  const status = await query(config, txnRefNo)
  if (status.kind !== 'verified') {
    return { ...base, outcome: 'pending', status: order.status, amountInr, reason: status.reason }
  }

  const f = status.fields
  const gateway: GatewaySummary = {
    txnRefNo: f['TxnRefNo'],
    amountPaise: f['Amount'],
    responseCode: f['ResponseCode'],
    message: f['Message'],
    gatewayTxnId: f['pgTxnId'],
    retRefNo: f['RetRefNo'],
  }
  const gatewayRef = f['pgTxnId'] || f['RetRefNo'] || null
  const verdict = evaluateTransaction(config, { txnRefNo, amountPaise: inrToPaise(order.totalInr) }, f)
  logEvent('isgpay.settle.verdict', {
    txnRefNo,
    outcome: verdict.outcome,
    reason: 'reason' in verdict ? verdict.reason : undefined,
    responseCode: 'responseCode' in verdict ? verdict.responseCode : undefined,
  })

  if (verdict.outcome === 'success' || verdict.outcome === 'mismatch') {
    const target = verdict.outcome === 'success' ? 'succeeded' : 'requires_review'
    const settledId = await settleRow(txnRefNo, target, gatewayRef)
    if (!settledId) return { ...base, outcome: 'already_settled', status: null, amountInr, gateway }
    const outcome = verdict.outcome === 'success' ? 'paid' : 'requires_review'
    logEvent(`isgpay.settled.${outcome}`, { txnRefNo })
    return { ...base, outcome, status: outcome, amountInr, gateway, reason: 'reason' in verdict ? verdict.reason : undefined }
  }

  if (verdict.outcome === 'not_success') {
    return { ...base, outcome: 'declined_pending', status: order.status, amountInr, gateway }
  }
  return { ...base, outcome: 'pending', status: order.status, amountInr, gateway, reason: verdict.reason }
}
