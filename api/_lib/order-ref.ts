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
 * SAME credentials that created the payment — on paths that run long after the
 * browser session that chose the merchant has gone, and where the shopper's
 * current selection is neither available nor relevant.
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

/**
 * The reference formats this application generates, per merchant. Anchored at
 * both ends: the prefix, then five upper base36 characters, then eight
 * lowercase hex.
 */
export const ORDER_REF_RE = /^AM2?-[0-9A-Z]{5}-[0-9a-f]{8}$/

/**
 * Whether a reference is one this application could have created.
 *
 * A format test only — it says nothing about whether the order exists, which
 * merchant owns it, or whether it was paid, and it never decides a payment
 * outcome.
 */
export function isCurrentOrderRef(reference: string): boolean {
  return ORDER_REF_RE.test(reference)
}

/**
 * The boundary between the RETIRED second-merchant experiment and the
 * re-enabled merchant-2 checkout option (§2.4).
 *
 * Five `AM2-` rows exist in production from the earlier experiment, all
 * created 2026-08-31. Merchant 2 was then withdrawn, and while it was gone the
 * only correct thing to do with those rows was to decline to touch them.
 *
 * Merchant 2 is now offered again and creates `AM2-` references once more, so
 * the PREFIX alone no longer distinguishes a historical record from a live
 * order. The creation timestamp does, and it is already on the row.
 *
 * ⚠ The cutoff separates the retired experiment's population from ALL later
 * `AM2-` traffic — it does not separate "historical" from "customer". Later
 * traffic includes merchant-2 integration testing: at least one post-cutoff
 * `AM2-` row exists from a ₹2 test service, created 2026-09-01, which never
 * reached the gateway. Such rows sit on the LIVE side of this discriminator
 * deliberately and are treated as ordinary current merchant-2 orders — read,
 * verified against MID 362380 like any other, and settled only on Order
 * Confirmation's word. Nothing here special-cases an individual reference, and
 * nothing should: a per-reference exception would be settlement logic keyed on
 * a string rather than on evidence.
 *
 * ⚠ This is a READ-ONLY discriminator. It selects whether settlement acts on a
 * row or leaves it alone; it never rewrites, renames, migrates or reassigns
 * one, and no historical row's stored data depends on it.
 */
export const LEGACY_MERCHANT_CUTOFF_MS = Date.UTC(2026, 8, 1, 0, 0, 0)

/**
 * Whether a reference belongs to the retired second-merchant experiment
 * (MID 362380, before merchant 2 was re-enabled).
 *
 * ⚠ BOTH conditions are required. An `AM2-` reference alone is no longer
 * enough: merchant 2 is a live checkout option again and issues that prefix to
 * real, settleable orders. Only an `AM2-` row created BEFORE the cutoff is
 * historical.
 *
 * ⚠ These rows are RECORDS, not work. They are never renamed, rewritten,
 * reassigned or migrated — the five of them stay exactly as they are. This
 * predicate exists so settlement can RECOGNISE one and decline to act on it,
 * which is the opposite of converting it.
 *
 * A row with no readable creation timestamp is treated as historical: for an
 * `AM2-` reference that cannot be dated, declining to act is the fail-closed
 * reading, and a new order always has a timestamp.
 */
export function isLegacyMerchantOrderRef(reference: string, createdAt?: string | null): boolean {
  if (!reference.startsWith('AM2-')) return false

  if (createdAt === undefined || createdAt === null || createdAt === '') return true

  const created = Date.parse(createdAt)
  if (!Number.isFinite(created)) return true

  return created < LEGACY_MERCHANT_CUTOFF_MS
}
