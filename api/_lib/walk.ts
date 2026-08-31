/**
 * Breadth-first extraction of named fields from a decoded structure.
 *
 * Two Airpay behaviours make a naive reader fail silently:
 *
 *   §6.2 — `data` sometimes arrives as a JSON *string* rather than an object,
 *          so every `typeof x === 'object'` check skips it.
 *   §9.5 — the callback plaintext is NOT flat. A flat top-level-scalars-only
 *          reader keeps the outer scalars, drops `data` because it is an
 *          object, and never sees the order reference inside it.
 *
 * So: walk breadth-first, parse nested JSON strings, and let a NESTED
 * statement of a name win over a shallower one — the outer object is the
 * transport wrapper, whose `status` and `message` describe the delivery rather
 * than the transaction. Reading the wrapper's `message` as the transaction's
 * feeds the wrong string to verifySecureHash and strands a genuine payment.
 */

const MAX_DEPTH = 6
const MAX_NODES = 512

function maybeParse(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
}

/**
 * Collects scalar fields keyed by lower-cased name.
 *
 * Each name is carried ONCE: when a deeper node states a name already held,
 * the previously held key is deleted and replaced (§9.5). Otherwise a
 * wrapper's `message` and the payload's `MESSAGE` would both survive, one of
 * them stale.
 *
 * Returns the original casing alongside each value so the relay — and any
 * consumer — can forward fields exactly as received.
 */
export function walkFields(root: unknown): Map<string, { key: string; value: string }> {
  const found = new Map<string, { key: string; value: string; depth: number }>()
  let nodes = 0

  let frontier: Array<{ node: unknown; depth: number }> = [{ node: root, depth: 0 }]

  while (frontier.length > 0 && nodes < MAX_NODES) {
    const next: Array<{ node: unknown; depth: number }> = []

    for (const { node, depth } of frontier) {
      if (nodes >= MAX_NODES || depth > MAX_DEPTH) break
      nodes += 1
      if (node === null || typeof node !== 'object') continue

      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const lower = key.toLowerCase()

        if (value === null || value === undefined) continue

        if (typeof value === 'object') {
          next.push({ node: value, depth: depth + 1 })
          continue
        }

        if (typeof value === 'string') {
          const nested = maybeParse(value)
          if (nested !== null) {
            next.push({ node: nested, depth: depth + 1 })
            continue
          }
        }

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          const held = found.get(lower)
          // A deeper statement of the same name wins; carry each name once.
          if (!held || depth > held.depth) {
            found.set(lower, { key, value: String(value), depth })
          }
        }
      }
    }

    frontier = next
  }

  const result = new Map<string, { key: string; value: string }>()
  for (const [lower, { key, value }] of found) result.set(lower, { key, value })
  return result
}

/** Case-insensitive lookup across the documented aliases (§9.7). */
export function pick(
  fields: ReadonlyMap<string, { key: string; value: string }>,
  aliases: readonly string[],
): string | undefined {
  for (const alias of aliases) {
    const hit = fields.get(alias.toLowerCase())
    if (hit && hit.value !== '') return hit.value
  }
  return undefined
}

/** Field-name aliases, matched case-insensitively (§9.7). */
export const FIELD_ALIASES = {
  orderRef: ['TRANSACTIONID', 'transactionid', 'orderid', 'order_id'],
  apTransactionId: ['APTRANSACTIONID', 'ap_transactionid', 'aptransactionid'],
  amount: ['AMOUNT', 'amount'],
  status: ['TRANSACTIONSTATUS', 'transaction_status', 'transactionstatus'],
  message: ['MESSAGE', 'message'],
  secureHash: ['ap_SecureHash', 'apsecurehash', 'ap_securehash', 'securehash'],
  customerVpa: ['CUSTOMERVPA', 'customer_vpa', 'customervpa'],
  merchantId: ['merchant_id', 'merchantid'],
} as const
