import { randomBytes } from 'node:crypto'

import type { MerchantId } from './config.js'

/**
 * Order reference generation (AIPAY-DOCS §7.5).
 *
 * Format: <prefix>-<base36 ms, last 5, upper>-<8 hex chars from a CSPRNG>
 *
 * The AM- prefix is this repository's existing convention; the document's YV-
 * belongs to the Yarnvia integration (AGENTS.md §30.11).
 *
 * ⚠ Must NOT use Math.random(). This reference identifies real money, is sent
 * to Airpay as `orderid`, appears in the Airpay dashboard, and is the key the
 * Order Confirmation pull interface is keyed on — it must not be guessable.
 */

/**
 * The per-merchant reference prefixes (§2.4).
 *
 * ⚠ Merchant 1 keeps `AM-` EXACTLY as it has always been. Every reference
 * already in production carries it, and changing it would strand live orders
 * whose settlement is keyed on this very string.
 *
 * Merchant 2 gets its own prefix so that the reference — which is already
 * persisted on every order row, echoed by Airpay and carried through every
 * settlement path — records which merchant took the payment. Nothing else has
 * to be stored, and no existing row changes meaning.
 */
const PREFIX: Readonly<Record<MerchantId, string>> = { 1: 'AM', 2: 'AM2' }

export function generateOrderRef(now: number = Date.now(), merchant: MerchantId = 1): string {
  const time = now.toString(36).toUpperCase().slice(-5)
  const random = randomBytes(4).toString('hex')
  return `${PREFIX[merchant]}-${time}-${random}`
}

/**
 * Recovers the merchant that created an order from its reference (§2.4).
 *
 * This is how settlement, verification and reconciliation always reach for the
 * SAME credentials that created the payment, on a path where no callback is
 * involved at all — which for merchant 2 is every path, because Airpay
 * delivers its callbacks directly to KKChat.
 *
 * ⚠ Anything not explicitly merchant 2 resolves to merchant 1. Unrecognised
 * input must never divert an order away from the production-proven merchant.
 *
 * ⚠ This selects WHICH CREDENTIALS VERIFY an order — never whether it is paid.
 * A forged `AM2-` reference merely causes Order Confirmation to be asked of a
 * merchant that has never heard of that order, which returns inconclusive and
 * settles nothing (§11.3). It cannot grant a settlement, and it cannot reach
 * an order it does not already name: settleOrder loads the row by this exact
 * string first, so a reference nobody issued matches no row.
 */
export function merchantForOrderRef(orderRef: string): MerchantId {
  return /^AM2-/.test(orderRef) ? 2 : 1
}
