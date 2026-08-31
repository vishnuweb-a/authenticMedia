import { verifyTransaction, type VerifiedTransaction } from './airpay.ts'
import { verifySecureHash } from './airpay-crypto.ts'
import { isLiveMid, loadAirpayConfig, type AirpayConfig } from './config.ts'
import { findOrderByRef, settleOrderRow } from './db.ts'
import { logEvent } from './log.ts'

/**
 * Settlement — the ONLY place an order may be marked paid (AIPAY-DOCS §10).
 *
 * There is exactly one settleOrder. Every path that can settle an order calls
 * it: the success-page poll and the cron reconciliation sweep. Never write a
 * second settlement path.
 *
 * ⚠ In this integration Airpay delivers its callback to KKChat, not to us, so
 * the callback-driven path documented in §8 does not exist here. That removes
 * a PROMPT to check, not the check itself: Order Confirmation is a pull
 * interface keyed on our own order reference (§11), so verification never
 * depended on being told.
 */

export type SettleOutcome =
  | 'paid'
  | 'failed'
  | 'requires_review'
  | 'pending'
  | 'already_settled'
  | 'unknown_order'
  | 'hash_mismatch'
  | 'unverifiable'

export interface SettleResult {
  readonly outcome: SettleOutcome
  readonly orderRef: string
  readonly paymentStatus: string | null
}

/**
 * Terminal states. requires_review is included so a later delivery cannot
 * quietly overwrite a flag raised for human investigation (edge case 45).
 */
const TERMINAL = new Set(['paid', 'failed', 'cancelled', 'delivered', 'requires_review'])

/** Airpay status codes (§11.4). */
const STATUS_SUCCESS = 200
const STATUS_IN_PROCESS = 211

/**
 * The paisa tolerance for the amount cross-check (§10.5). Anything looser is a
 * rounding loophole.
 */
const AMOUNT_TOLERANCE = 0.001

export interface SettlePayload {
  readonly orderRef: string
  /**
   * Integrity fields, when a caller has them. The reconciliation sweep passes
   * a synthetic payload carrying only the reference: settleOrder then skips
   * the integrity check and decides purely from Order Confirmation, which is
   * the only authority anyway (§16).
   */
  readonly secureHash?: string | undefined
  readonly apTransactionId?: string | undefined
  readonly amount?: string | undefined
  readonly transactionStatus?: string | undefined
  readonly message?: string | undefined
  readonly customerVpa?: string | undefined
}

/**
 * Settles one order against Airpay Order Confirmation.
 *
 * The sequence in §10.1 is load-bearing and is followed exactly.
 */
export async function settleOrder(
  payload: SettlePayload,
  injectedConfig?: AirpayConfig,
  verify: (
    ref: string,
    config: AirpayConfig,
  ) => Promise<VerifiedTransaction | null> = verifyTransaction,
): Promise<SettleResult> {
  const { orderRef } = payload
  const config = injectedConfig ?? loadAirpayConfig()

  // 1. Load the order.
  const order = await findOrderByRef(orderRef)
  if (!order) {
    logEvent('payment.callback.unknown_order', { orderRef })
    return { outcome: 'unknown_order', orderRef, paymentStatus: null }
  }

  // 2. Terminal already? A cheap short-circuit to avoid a pointless Order
  //    Confirmation round trip on a re-delivery. The real guard is the
  //    conditional UPDATE at step 10 (§10.2) — this is idempotency #1.
  if (TERMINAL.has(order.status)) {
    logEvent('payment.callback.duplicate', { orderRef, status: order.status })
    return { outcome: 'already_settled', orderRef, paymentStatus: order.status }
  }

  // 3. Integrity check, when an integrity claim was supplied.
  //
  //    ⚠ CRC32 is unkeyed: anyone who can reach a callback can compute a valid
  //    hash for a forged SUCCESS. So this may only ever ADD A REJECTION —
  //    never grant a settlement. A pass here proves nothing and changes
  //    nothing; only Order Confirmation below decides.
  if (payload.secureHash) {
    const matches = verifySecureHash(
      payload.secureHash,
      {
        transactionId: orderRef,
        apTransactionId: payload.apTransactionId ?? '',
        amount: payload.amount ?? '',
        transactionStatus: payload.transactionStatus ?? '',
        message: payload.message ?? '',
        customerVpa: payload.customerVpa,
      },
      config,
    )
    if (!matches) {
      logEvent('payment.callback.hash_mismatch', { orderRef })
      return { outcome: 'hash_mismatch', orderRef, paymentStatus: order.status }
    }
  }

  // 4. Order Confirmation works only against a live MID (§10.3). On sandbox
  //    the trusted path is unavailable, so the order stays UNSETTLED rather
  //    than being marked paid on the strength of an untrusted signal.
  //
  //    A "sandbox convenience" flag here is the exact hole this module exists
  //    to close, and it ships to production the first time AIRPAY_ENV is
  //    mis-set.
  if (!isLiveMid(config)) {
    logEvent('payment.verify.skipped_sandbox', { orderRef })
    return { outcome: 'unverifiable', orderRef, paymentStatus: order.status }
  }

  // 5. The only authority.
  const confirmation = await verify(orderRef, config)

  // Inconclusive: unreachable, non-2xx, unreadable, inner failure, an answer
  // about another order, or an answer with no status. Never a failure to
  // report to the customer — ask again later (§11.3).
  if (!confirmation) {
    return { outcome: 'pending', orderRef, paymentStatus: order.status }
  }

  // 6/7. IN_PROCESS is legitimate for UPI, and a statusless confirmation is an
  //      UNKNOWN — guarded here as well as in verifyTransaction (§10.4).
  if (confirmation.status === STATUS_IN_PROCESS) {
    return { outcome: 'pending', orderRef, paymentStatus: order.status }
  }

  // 8. A definite non-success. Marking failed also demands proof, and we have
  //    it: Airpay stated a status and it was not success.
  if (confirmation.status !== STATUS_SUCCESS) {
    const settledId = await settleOrderRow(orderRef, 'failed', confirmation.apTransactionId)
    if (!settledId) {
      logEvent('payment.settled.race_lost', { orderRef })
      return { outcome: 'already_settled', orderRef, paymentStatus: null }
    }
    logEvent('payment.settled.failed', { orderRef, status: confirmation.status })
    return { outcome: 'failed', orderRef, paymentStatus: 'failed' }
  }

  // 9. Amount cross-check against the total the SERVER computed at checkout —
  //    never a figure supplied by a client or a callback (§10.5).
  //
  //    A mismatch is never paid and never failed: money may well have moved,
  //    just not the expected sum, so automation stops and a human
  //    investigates. It must not be left pending either, or the sweep would
  //    re-verify it forever while the shopper sits on a spinner.
  if (confirmation.amount === null || Math.abs(confirmation.amount - order.totalInr) > AMOUNT_TOLERANCE) {
    const settledId = await settleOrderRow(
      orderRef,
      'requires_review',
      confirmation.apTransactionId,
    )
    logEvent('payment.verify.amount_mismatch', { orderRef, settled: Boolean(settledId) })
    return {
      outcome: settledId ? 'requires_review' : 'already_settled',
      orderRef,
      paymentStatus: settledId ? 'requires_review' : null,
    }
  }

  // 10. Verified paid. The conditional UPDATE is idempotency #2: two
  //     simultaneous settlements cannot both pass, and the loser updates zero
  //     rows — a correct outcome, not an error.
  const settledId = await settleOrderRow(orderRef, 'succeeded', confirmation.apTransactionId)
  if (!settledId) {
    logEvent('payment.settled.race_lost', { orderRef })
    return { outcome: 'already_settled', orderRef, paymentStatus: null }
  }

  logEvent('payment.settled.paid', { orderRef })
  return { outcome: 'paid', orderRef, paymentStatus: 'paid' }
}

/** Whether an outcome means the shopper should stop seeing a spinner (§15). */
export function isSettledOutcome(status: string): boolean {
  return TERMINAL.has(status)
}
