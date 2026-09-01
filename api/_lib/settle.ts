import { verifyTransaction, type VerifiedTransaction } from './airpay.js'
import { verifySecureHash } from './airpay-crypto.js'
import { isLiveMid, loadAirpayConfig, type AirpayConfig } from './config.js'
import { findOrderByRef, settleOrderRow } from './db.js'
import { isLegacyMerchantOrderRef, merchantForOrderRef } from './order-ref.js'
import { logEvent } from './log.js'

/**
 * Settlement — the ONLY place an order may be marked paid (AIPAY-DOCS §10).
 *
 * There is exactly one settleOrder. All three paths that can settle an order
 * call it: the Response/IPN callback, the success-page poll and the cron
 * reconciliation sweep. Never write a second settlement path.
 *
 * No caller is load-bearing on its own. Order Confirmation is a PULL interface
 * keyed on our own order reference (§11), so a callback only ever supplies a
 * PROMPT to check — never the answer.
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
  | 'legacy_merchant'

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
const STATUS_FAILED = 400

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

  // ⚠ The merchant comes from the ORDER REFERENCE, and from nothing else
  // (§2.4). Not from the request, not from the environment, and never from the
  // shopper's current checkout selection — which belongs to whatever they are
  // buying NOW and says nothing about an order created minutes or days ago.
  //
  // This is what makes the three settlement paths agree. The callback, the
  // success-page poll and the cron sweep all run outside the browser session
  // that chose the merchant; the reference is the only thing all three hold,
  // it is persisted on the row, and it is immutable. So each one reaches for
  // the SAME credentials that created the payment.
  //
  // Order Confirmation still decides. This only determines who is ASKED.
  const merchant = merchantForOrderRef(orderRef)
  const config = injectedConfig ?? loadAirpayConfig(merchant)

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

  // 2b. HISTORICAL RECORD from the RETIRED second-merchant experiment.
  //
  //     Merchant 2 is a live checkout option again, so an `AM2-` reference on
  //     its own no longer means "historical" — it is the ordinary reference
  //     format for every new merchant-2 order, and those settle normally
  //     through the code below under MID 362380's own credentials.
  //
  //     What is still historical is the five rows created BEFORE merchant 2 was
  //     re-enabled (isLegacyMerchantOrderRef checks the row's creation
  //     timestamp against the cutoff, not just its prefix). They were left
  //     mid-flight when the merchant was withdrawn, three of them still
  //     pending_payment and inside the reconciliation sweep's window, and they
  //     are records of a closed experiment rather than orders anyone is
  //     waiting on. Re-verifying them now would reopen settlement on payments
  //     abandoned a merchant-withdrawal ago.
  //
  //     Post-cutoff `AM2-` rows — including merchant-2 integration tests — are
  //     NOT historical and fall through to the settlement path below, on the
  //     evidence of Order Confirmation alone. No individual reference is
  //     special-cased here.
  //
  //     ⚠ This is a REFUSAL TO ACT, not a conversion. The row is read and left
  //     exactly as it is: no rename, no rewrite, no reassignment, and no write
  //     of any kind on this path. It never becomes paid, never becomes failed,
  //     and its recorded status is returned untouched — the same fail-closed
  //     discipline as the sandbox guard below (§10.3).
  if (isLegacyMerchantOrderRef(orderRef, order.createdAt)) {
    logEvent('payment.settle.legacy_merchant', { orderRef, status: order.status })
    return { outcome: 'legacy_merchant', orderRef, paymentStatus: order.status }
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

  // 6. IN_PROCESS is legitimate for UPI — the shopper is simply waiting.
  if (confirmation.status === STATUS_IN_PROCESS) {
    return { outcome: 'pending', orderRef, paymentStatus: order.status }
  }

  // 7. ⚠ PROVEN §10.4 — "no status" is an UNKNOWN, NOT a failure.
  //
  //    This is the SECOND of the two guards the documentation requires: the
  //    first is in verifyTransaction, which refuses to return a statusless
  //    confirmation. Without this one, a status that could not be read falls
  //    through to the `!== STATUS_SUCCESS` comparison below — because
  //    null !== 200 — and the order is terminally marked failed. A genuine ₹81
  //    UPI payment was destroyed exactly that way, and because `failed` is
  //    terminal nothing in the running system could recover it.
  //
  //    Refusing to mark an order paid without proof and refusing to mark it
  //    failed without proof are the same discipline (edge case 23).
  if (confirmation.status === null || !Number.isFinite(confirmation.status)) {
    logEvent('airpay.verify.no_status', { orderRef })
    return { outcome: 'pending', orderRef, paymentStatus: order.status }
  }

  // 8. A definite non-success. Marking failed demands proof, and only a
  //    DOCUMENTED failure code is proof.
  //
  //    ⚠ An unrecognised code is an UNKNOWN, not a failure — the same
  //    discipline as the statusless guard at step 7, reached through a
  //    different door. §11.4 documents exactly three codes (200, 211, 400);
  //    anything else is the gateway saying something we do not understand, and
  //    a blanket `!== STATUS_SUCCESS` turns that into a terminal `failed`
  //    exactly as `null !== 200` once did. A real order was
  //    destroyed that way by a TRANSACTIONSTATUS of 503 — a transient
  //    gateway condition, terminally recorded as a customer's failed payment
  //    and unrecoverable by the running system.
  //
  //    Pending is the safe reading: the reconciliation sweep re-verifies it,
  //    so a genuinely failed payment still reaches `failed` the moment Airpay
  //    states 400, while a transient blip resolves on its own.
  if (confirmation.status !== STATUS_SUCCESS && confirmation.status !== STATUS_FAILED) {
    logEvent('airpay.verify.unknown_status', { orderRef, status: confirmation.status })
    return { outcome: 'pending', orderRef, paymentStatus: order.status }
  }

  if (confirmation.status === STATUS_FAILED) {
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
