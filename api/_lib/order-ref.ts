import { randomBytes } from 'node:crypto'

/**
 * Order reference generation (AIPAY-DOCS §7.5).
 *
 * Format: AM-<base36 ms, last 5, upper>-<8 hex chars from a CSPRNG>
 *
 * The AM- prefix is this repository's existing convention; the document's YV-
 * belongs to the Yarnvia integration (AGENTS.md §30.11).
 *
 * ⚠ Must NOT use Math.random(). This reference identifies real money, is sent
 * to Airpay as `orderid`, appears in the Airpay dashboard, and is the key the
 * Order Confirmation pull interface is keyed on — it must not be guessable.
 *
 * ⚠ ONE PREFIX, because there is one merchant. `AM-` is exactly what it has
 * always been: every reference already in production carries it, and
 * settlement is keyed on this very string. No prefix encodes a merchant any
 * more, and nothing decodes one back out — there is only ever one set of
 * credentials to verify an order against.
 */
const PREFIX = 'AM'

export function generateOrderRef(now: number = Date.now()): string {
  const time = now.toString(36).toUpperCase().slice(-5)
  const random = randomBytes(4).toString('hex')
  return `${PREFIX}-${time}-${random}`
}
