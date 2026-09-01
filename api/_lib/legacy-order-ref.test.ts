import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AirpayConfig } from './config.js'
import type { VerifiedTransaction } from './airpay.js'
import {
  ORDER_REF_RE,
  generateOrderRef,
  isCurrentOrderRef,
  isLegacyMerchantOrderRef,
} from './order-ref.js'

/**
 * Historical AM2- order references (AGENTS.md §30.9).
 *
 * Five PRE-CUTOFF AM2- rows exist in production, created during the retired
 * second-merchant experiment (MID 362380) and left behind when it was
 * withdrawn. They are records of a closed experiment, not orders anyone is
 * waiting on.
 *
 * ⚠ The `AM2-` prefix alone does NOT mean historical. Merchant 2 is an offered
 * checkout option again and issues that prefix to real, settleable orders, so
 * the discriminator is the row's CREATION DATE against the cutoff. A
 * post-cutoff `AM2-` row — including the one that really exists in production —
 * is a current MID-2 order and is asserted as such below.
 *
 * The properties under test:
 *
 *   - every reference this application generates is AM-, never AM2-;
 *   - an AM2- reference is RECOGNISED as historical and declined explicitly,
 *     rather than silently asked about under the wrong merchant's credentials;
 *   - declining writes NOTHING: the row is never renamed, rewritten,
 *     reassigned, settled or failed;
 *   - no `_2` credential and no AIRPAY_ACTIVE_MERCHANT is consulted to do it.
 *
 * Every value below is a fixture. No live MID is contacted, no database is
 * touched, and no payment is created.
 */

const orders = vi.hoisted(() => ({ map: new Map<string, Record<string, unknown>>() }))
const settleCalls = vi.hoisted(() => ({ list: [] as Array<[string, string, string | null]> }))

vi.mock('./db.js', () => ({
  findOrderByRef: async (ref: string) => orders.map.get(ref) ?? null,
  settleOrderRow: async (ref: string, status: string, apId: string | null) => {
    settleCalls.list.push([ref, status, apId])
    return 'order-uuid'
  },
}))

const { settleOrder } = await import('./settle.js')

/** The one merchant. */
const config: AirpayConfig = {
  merchant: 1,
  mid: '368250',
  clientId: 'c',
  secretKey: 's',
  apiKey: 'a',
  username: 'test-user',
  password: 'p',
  env: 'live',
  verifyUrl: 'https://example.invalid/verify/',
}

/**
 * The five real PRE-CUTOFF historical references. Used as FIXTURES ONLY —
 * nothing in this file reads or writes the database.
 *
 * `AM2-M32F8-a6a3b0a2` is deliberately absent: it was created after the cutoff
 * and is a current MID-2 order, asserted separately below.
 */
const HISTORICAL = [
  'AM2-KP64Z-0749d330',
  'AM2-KUUIA-549afe9d',
  'AM2-MAJUV-d7557745',
  'AM2-MYT4R-270ff2df',
  'AM2-NJGWM-05b40a9f',
] as const

/** The three still sitting at pending_payment, inside the sweep's window. */
const STILL_PENDING = [
  'AM2-KP64Z-0749d330',
  'AM2-KUUIA-549afe9d',
  'AM2-NJGWM-05b40a9f',
] as const

/** The two the previous merchant left terminally failed. */
const HISTORICAL_FAILED = ['AM2-MAJUV-d7557745', 'AM2-MYT4R-270ff2df'] as const

/**
 * When the historical rows were created — BEFORE merchant 2 was re-enabled.
 *
 * This is what marks them historical now that `AM2-` is a live reference
 * format again. All five predate 2026-09-01.
 */
const HISTORICAL_CREATED_AT = '2026-08-31T18:29:50Z'

/**
 * The one POST-CUTOFF AM2- order that really exists in production, with its
 * real creation timestamp: a 2 rupee integration-test order, still
 * pending_payment, that never reached the gateway.
 *
 * ⚠ Present as a DATE-CARRYING FIXTURE, not as an identity. Production code
 * has no branch on this reference, and any other post-cutoff AM2- string would
 * behave identically — which the boundary cases below demonstrate.
 */
const POST_CUTOFF_REF = 'AM2-M32F8-a6a3b0a2'
const POST_CUTOFF_CREATED_AT = '2026-09-01T11:56:24Z'

function seed(
  reference: string,
  status = 'pending_payment',
  createdAt: string = HISTORICAL_CREATED_AT,
): void {
  orders.map.set(reference, {
    id: `uuid-${reference}`,
    reference,
    status,
    totalInr: 2,
    accessToken: 'token-uuid',
    paymentMethod: 'airpay',
    apTransactionId: null,
    createdAt,
  })
}

/** A verify fn that fails the test if it is ever reached. */
function forbiddenVerify(): () => Promise<VerifiedTransaction | null> {
  return vi.fn(async () => {
    throw new Error('Order Confirmation must never be asked about a legacy order')
  })
}

beforeEach(() => {
  orders.map.clear()
  settleCalls.list = []
})

describe('1-3. generation produces AM- and can never produce AM2-', () => {
  it('every generated reference matches the documented format', () => {
    for (let i = 0; i < 2000; i += 1) {
      expect(generateOrderRef()).toMatch(/^AM-[0-9A-Z]{5}-[0-9a-f]{8}$/)
    }
  })

  it('never generates an AM2- reference, across a wide span of clock values', () => {
    // Spans the real timestamps this code can see: the historical orders'
    // own creation time, now, and far-future dates.
    //
    // The base36 time segment is five characters for every millisecond value
    // after 1971-11-24, so a genuine Date.now() always fills it. Tiny
    // synthetic clocks (0, 1, 62) would yield a SHORTER segment and are
    // deliberately excluded: they are unreachable in production, and widening
    // ORDER_REF_RE to admit them would weaken the very check that makes the
    // format unambiguous.
    const clocks = [
      1_756_664_990_000, // the first historical AM2- order's timestamp
      Date.now(),
      4_102_444_800_000, // 2100-01-01
      9_999_999_999_999,
    ]
    for (const now of clocks) {
      for (let i = 0; i < 250; i += 1) {
        const ref = generateOrderRef(now)
        expect(ref.startsWith('AM-')).toBe(true)
        expect(ref.startsWith('AM2-')).toBe(false)
        expect(isLegacyMerchantOrderRef(ref)).toBe(false)
        expect(isCurrentOrderRef(ref)).toBe(true)
      }
    }
  })

  it('every historical reference is well-formed, and dated BEFORE the cutoff', () => {
    // Merchant 2 is an offered checkout option again, so `AM2-` is once more a
    // reference format this application generates: the prefix alone no longer
    // separates a historical record from a live order, and the regex admits
    // both. What separates them is the CREATION DATE on the row.
    for (const ref of HISTORICAL) {
      expect(ORDER_REF_RE.test(ref)).toBe(true)
      expect(isCurrentOrderRef(ref)).toBe(true)
      expect(isLegacyMerchantOrderRef(ref, HISTORICAL_CREATED_AT)).toBe(true)
    }
  })

  it('the REAL post-cutoff AM2- row is not historical, at its true timestamp', () => {
    // The production row this rule was re-examined for. Its own recorded
    // creation date is what makes it current — nothing about its reference.
    expect(isLegacyMerchantOrderRef(POST_CUTOFF_REF, POST_CUTOFF_CREATED_AT)).toBe(false)
    expect(isCurrentOrderRef(POST_CUTOFF_REF)).toBe(true)
    expect(ORDER_REF_RE.test(POST_CUTOFF_REF)).toBe(true)

    // Proof the decision is the DATE and not the string: the very same
    // reference, dated before the cutoff, would be historical. Production
    // never sees that row — this only pins down which input decides.
    expect(isLegacyMerchantOrderRef(POST_CUTOFF_REF, HISTORICAL_CREATED_AT)).toBe(true)
  })

  it('the cutoff boundary is exact — at it is current, 1ms before is legacy', () => {
    // `created < cutoff`, so the boundary instant itself is CURRENT. Pinned so
    // the comparison can never silently become <=.
    expect(isLegacyMerchantOrderRef('AM2-BOUND-00000000', '2026-09-01T00:00:00Z')).toBe(false)
    expect(isLegacyMerchantOrderRef('AM2-BOUND-00000000', '2026-08-31T23:59:59.999Z')).toBe(true)
  })

  it('a NEW merchant-2 order is not treated as historical', () => {
    // The other half of the discriminator, and the reason it exists: an AM2-
    // order created after the cutoff is an ordinary live order and must settle
    // normally. Reading it as historical would silently strand real payments.
    const fresh = generateOrderRef(Date.parse('2026-09-01T12:00:00Z'), 2)
    expect(fresh.startsWith('AM2-')).toBe(true)
    expect(isCurrentOrderRef(fresh)).toBe(true)
    expect(isLegacyMerchantOrderRef(fresh, '2026-09-01T12:00:00Z')).toBe(false)
  })

  it('an AM- reference is never historical, whatever its date', () => {
    for (const createdAt of ['2026-08-01T00:00:00Z', '2026-09-30T00:00:00Z', null]) {
      expect(isLegacyMerchantOrderRef(generateOrderRef(), createdAt)).toBe(false)
    }
  })

  it('an undatable AM2- row fails closed to historical', () => {
    // Declining to act is the safe reading for a row that cannot be dated: a
    // real new order always carries a timestamp.
    for (const createdAt of [null, undefined, '', 'not-a-date']) {
      expect(isLegacyMerchantOrderRef('AM2-KP64Z-0749d330', createdAt)).toBe(true)
    }
  })
})

describe('5. an AM2- reference cannot reach Airpay under MID 368250', () => {
  it('declines explicitly and never calls Order Confirmation', async () => {
    for (const ref of STILL_PENDING) {
      settleCalls.list = []
      seed(ref)
      const verify = forbiddenVerify()

      const result = await settleOrder({ orderRef: ref }, config, verify)

      expect(result.outcome).toBe('legacy_merchant')
      // The single most important assertion in this file: no outbound call
      // against the live MID for an order it did not create.
      expect(verify).not.toHaveBeenCalled()
    }
  })

  it('a forged SUCCESS callback on a legacy ref still settles nothing', async () => {
    const ref = 'AM2-KP64Z-0749d330'
    seed(ref)
    const verify = forbiddenVerify()

    const result = await settleOrder(
      {
        orderRef: ref,
        transactionStatus: 'SUCCESS',
        amount: '2.00',
        apTransactionId: 'AP-FORGED',
      },
      config,
      verify,
    )

    expect(result.outcome).toBe('legacy_merchant')
    expect(result.paymentStatus).toBe('pending_payment')
    expect(verify).not.toHaveBeenCalled()
    expect(settleCalls.list).toEqual([])
  })
})

describe('4, 6. a historical record is read, never rewritten', () => {
  it('writes nothing at all — no rename, no settle, no reassignment', async () => {
    for (const ref of HISTORICAL) {
      settleCalls.list = []
      const status = (HISTORICAL_FAILED as readonly string[]).includes(ref)
        ? 'failed'
        : 'pending_payment'
      seed(ref, status)

      await settleOrder({ orderRef: ref }, config, forbiddenVerify())

      // No settlement write of any kind.
      expect(settleCalls.list).toEqual([])
      // The row is left EXACTLY as stored: same reference, same status.
      const row = orders.map.get(ref)
      expect(row?.['reference']).toBe(ref)
      expect(row?.['status']).toBe(status)
    }
  })

  it('never converts an AM2- reference into an AM- one', async () => {
    for (const ref of STILL_PENDING) {
      seed(ref)
      const result = await settleOrder({ orderRef: ref }, config, forbiddenVerify())
      // The outcome reports the ORIGINAL reference, unmodified.
      expect(result.orderRef).toBe(ref)
      expect(result.orderRef.startsWith('AM2-')).toBe(true)
      expect(orders.map.get(ref)?.['reference']).toBe(ref)
    }
  })

  it('an already-terminal legacy row short-circuits as already_settled', async () => {
    // The terminal guard runs FIRST, so the two `failed` historical rows are
    // reported as settled rather than as legacy — and either way, nothing is
    // written and their terminal state is preserved.
    for (const ref of HISTORICAL_FAILED) {
      settleCalls.list = []
      seed(ref, 'failed')
      const result = await settleOrder({ orderRef: ref }, config, forbiddenVerify())
      expect(result.outcome).toBe('already_settled')
      expect(result.paymentStatus).toBe('failed')
      expect(settleCalls.list).toEqual([])
    }
  })
})

describe('7-8. no retired credential is consulted to reach that decision', () => {
  it('reads no _2 variable and no AIRPAY_ACTIVE_MERCHANT — proven at the source', async () => {
    const { readFile } = await import('node:fs/promises')
    const sources = [
      new URL('./order-ref.ts', import.meta.url),
      new URL('./settle.ts', import.meta.url),
      new URL('./config.ts', import.meta.url),
      new URL('../payments/reconcile.ts', import.meta.url),
      new URL('../payments/create.ts', import.meta.url),
    ]

    /**
     * Comments are stripped before scanning. These modules DOCUMENT the
     * retired variables by name, to record that they are deliberately gone —
     * that prose is the point, and a plain substring search would flag it as
     * the very thing it exists to warn against. What must not appear is a
     * READ, so only executable code is examined.
     */
    const stripComments = (code: string): string =>
      code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

    for (const source of sources) {
      const code = stripComments(await readFile(source, 'utf8'))

      // ⚠ No GLOBAL merchant switch, anywhere. This is the one that must never
      // come back: an environment variable naming the active merchant would
      // silently override the customer's own checkout choice.
      expect(
        code,
        `${source.pathname} must not reference AIRPAY_ACTIVE_MERCHANT`,
      ).not.toContain('AIRPAY_ACTIVE_MERCHANT')

      // No merchant-2 credential is named literally outside config.ts, whose
      // suffix() helper is the single place that composes those names.
      if (!source.pathname.endsWith('config.ts')) {
        for (const name of [
          'AIRPAY_MID_2',
          'AIRPAY_USERNAME_2',
          'AIRPAY_PASSWORD_2',
          'AIRPAY_CLIENT_ID_2',
          'AIRPAY_SECRET_KEY_2',
          'AIRPAY_API_KEY_2',
        ]) {
          expect(code, `${source.pathname} must not reference ${name}`).not.toContain(name)
        }
      }

      // ⚠ No `_2`-suffixed variable is named LITERALLY in executable code.
      // The second merchant's credentials are reached only through the
      // suffix() helper in config.ts, which builds the name from a validated
      // MerchantId — so config.ts is exempt from this one check and is
      // covered instead by api/_lib/multi-merchant.test.ts.
      if (!source.pathname.endsWith('config.ts')) {
        expect(code).not.toMatch(/_2['"`\]]/)
      }
    }
  })

  it('the legacy decision uses only the reference, never a second credential set', async () => {
    // The retired variables are SET to obviously wrong values. Any code that
    // still consulted one would have to change the outcome to be observed.
    const previous = { ...process.env }
    process.env['AIRPAY_MID_2'] = '362380'
    process.env['AIRPAY_ACTIVE_MERCHANT'] = '2'
    try {
      const ref = 'AM2-KP64Z-0749d330'
      seed(ref)
      const result = await settleOrder({ orderRef: ref }, config, forbiddenVerify())
      expect(result.outcome).toBe('legacy_merchant')
      expect(settleCalls.list).toEqual([])
    } finally {
      process.env = previous
    }
  })
})

describe('a POST-CUTOFF AM2- order settles as a current MID-2 order', () => {
  /**
   * The mirror image of the legacy block above. A post-cutoff `AM2-` row is an
   * ordinary live order: Order Confirmation IS asked, and its answer — and
   * only its answer — decides the outcome.
   *
   * ⚠ The reference is a fixture. The timestamp is the rule.
   */
  it('reaches Order Confirmation instead of being declined as legacy', async () => {
    seed(POST_CUTOFF_REF, 'pending_payment', POST_CUTOFF_CREATED_AT)
    const verify = vi.fn(async () => ({
      orderRef: POST_CUTOFF_REF,
      status: 200,
      amount: 2,
      apTransactionId: 'AP-POST',
    }))

    const result = await settleOrder({ orderRef: POST_CUTOFF_REF }, config, verify)

    // It was NOT short-circuited as legacy...
    expect(result.outcome).not.toBe('legacy_merchant')
    // ...the trusted path was actually consulted...
    expect(verify).toHaveBeenCalled()
    // ...and settlement followed Order Confirmation's word.
    expect(result.outcome).toBe('paid')
    expect(settleCalls.list).toEqual([[POST_CUTOFF_REF, 'succeeded', 'AP-POST']])
  })

  it('still settles nothing without proof — an inconclusive answer stays pending', async () => {
    // Being "current" grants no settlement of its own. The fail-closed rule is
    // unchanged for post-cutoff rows.
    seed(POST_CUTOFF_REF, 'pending_payment', POST_CUTOFF_CREATED_AT)

    const result = await settleOrder({ orderRef: POST_CUTOFF_REF }, config, async () => null)

    expect(result.outcome).toBe('pending')
    expect(settleCalls.list).toEqual([])
  })

  it('the same reference dated BEFORE the cutoff is declined — the date decides', async () => {
    // Identical string, different stored date, opposite outcome. This is what
    // proves no per-reference special case exists on the settlement path.
    seed(POST_CUTOFF_REF, 'pending_payment', HISTORICAL_CREATED_AT)

    const result = await settleOrder({ orderRef: POST_CUTOFF_REF }, config, forbiddenVerify())

    expect(result.outcome).toBe('legacy_merchant')
    expect(settleCalls.list).toEqual([])
  })
})

describe('9-12. the AM- path is completely unaffected', () => {
  const CURRENT = 'AM-EMF8G-16de123d'

  it('9. a current reference still settles normally', async () => {
    seed(CURRENT)
    const result = await settleOrder({ orderRef: CURRENT }, config, async () => ({
      orderRef: CURRENT,
      status: 200,
      amount: 2,
      apTransactionId: 'AP-1',
    }))

    expect(result.outcome).toBe('paid')
    expect(settleCalls.list).toEqual([[CURRENT, 'succeeded', 'AP-1']])
  })

  it('10. 503 on a current reference remains pending', async () => {
    seed(CURRENT)
    const result = await settleOrder({ orderRef: CURRENT }, config, async () => ({
      orderRef: CURRENT,
      status: 503,
      amount: 2,
      apTransactionId: null,
    }))

    expect(result.outcome).toBe('pending')
    expect(settleCalls.list).toEqual([])
  })

  it('11. an inconclusive/statusless confirmation remains pending', async () => {
    seed(CURRENT)
    const result = await settleOrder({ orderRef: CURRENT }, config, async () => null)
    expect(result.outcome).toBe('pending')
    expect(settleCalls.list).toEqual([])
  })

  it('12. repeated deliveries on a legacy ref stay safe and idempotent', async () => {
    const ref = 'AM2-NJGWM-05b40a9f'
    seed(ref)
    for (let i = 0; i < 3; i += 1) {
      const result = await settleOrder({ orderRef: ref }, config, forbiddenVerify())
      expect(result.outcome).toBe('legacy_merchant')
    }
    expect(settleCalls.list).toEqual([])
  })
})
