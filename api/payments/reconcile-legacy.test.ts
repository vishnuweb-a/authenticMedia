import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../_lib/http.js'

/**
 * The reconciliation sweep and historical AM2- rows (AGENTS.md §30.9).
 *
 * The sweep is the ONE caller that re-reads the same unsettled orders on every
 * run. Three pre-cutoff AM2- rows are still `pending_payment` and sit inside
 * its window, so without a skip it would ask a retired merchant's orders about
 * themselves on every single run, forever.
 *
 * ⚠ The skip is keyed on the CREATION DATE, never on the `AM2-` prefix alone.
 * Merchant 2 is an offered checkout option again, so a post-cutoff `AM2-` row
 * is an ordinary current MID-2 order and MUST be swept like any other. That is
 * asserted explicitly below with the real production timestamp.
 *
 * The properties under test:
 *
 *   - a PRE-CUTOFF legacy row is skipped BEFORE any outbound Airpay call;
 *   - a POST-CUTOFF AM2- row is swept as a current MID-2 order, not skipped;
 *   - it is counted, not hidden, so the sweep stays observable;
 *   - current AM- rows in the same batch are swept exactly as before;
 *   - nothing is written for a legacy row on any path.
 *
 * No live MID is contacted, no database is touched, and no payment is created.
 */

const unsettled = vi.hoisted(() => ({ list: [] as Array<Record<string, unknown>> }))
const settled = vi.hoisted(() => ({ calls: [] as string[] }))

vi.mock('../_lib/db.js', () => ({
  findUnsettledOrders: async () => unsettled.list,
  findOrderByRef: async () => null,
  settleOrderRow: async () => 'order-uuid',
  getServiceClient: () => {
    throw new Error('the sweep must not reach the raw client')
  },
}))

vi.mock('../_lib/settle.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/settle.js')>()
  return {
    ...actual,
    settleOrder: async ({ orderRef }: { orderRef: string }) => {
      // Records WHICH references the sweep actually tried to settle. A legacy
      // reference appearing here is the failure this file exists to catch.
      settled.calls.push(orderRef)
      return { outcome: 'pending' as const, orderRef, paymentStatus: null }
    },
  }
})

const reconcileHandler = (await import('./reconcile.js')).default

const CRON_SECRET = 'cron-secret-placeholder'

interface Captured {
  code: number
  body: unknown
}

function mockRes(): { res: ApiResponse; captured: Captured } {
  const captured: Captured = { code: 0, body: null }
  const res: ApiResponse = {
    status(code) {
      captured.code = code
      return res
    },
    setHeader() {
      return res
    },
    json(body) {
      captured.body = body
    },
    send(body) {
      captured.body = body
    },
    end() {},
  }
  return { res, captured }
}

/**
 * When the retired experiment's rows were created — BEFORE the cutoff.
 *
 * This is the default because most fixtures here are historical rows. A row
 * with a different creation date passes its own, which is the ONLY thing that
 * decides whether the sweep treats it as legacy.
 */
const PRE_CUTOFF_CREATED_AT = '2026-08-31T18:29:50Z'

/**
 * The real creation timestamp of the one post-cutoff AM2- row in production
 * (a 2 rupee integration-test order that never reached the gateway).
 *
 * ⚠ Used as a DATE, not as an identity. The assertions below prove the
 * timestamp rule; nothing keys on this row's reference string, and production
 * code contains no special case for it.
 */
const POST_CUTOFF_CREATED_AT = '2026-09-01T11:56:24Z'

function row(
  reference: string,
  createdAt: string = PRE_CUTOFF_CREATED_AT,
): Record<string, unknown> {
  return {
    id: `uuid-${reference}`,
    reference,
    status: 'pending_payment',
    totalInr: 2,
    accessToken: 'token-uuid',
    paymentMethod: 'airpay',
    apTransactionId: null,
    createdAt,
  }
}

function sweep(): Promise<void> {
  const { res, captured } = mockRes()
  return reconcileHandler(
    { method: 'GET', headers: { authorization: `Bearer ${CRON_SECRET}` } } as ApiRequest,
    res,
  ).then(() => {
    lastCaptured = captured
  })
}

let lastCaptured: Captured = { code: 0, body: null }

function body(): Record<string, unknown> {
  return lastCaptured.body as Record<string, unknown>
}

/**
 * The three PRE-CUTOFF historical rows still at pending_payment.
 *
 * `AM2-M32F8-a6a3b0a2` is deliberately NOT here: it was created after the
 * cutoff and is a current MID-2 order, covered by its own describe block.
 */
const LEGACY_PENDING = [
  'AM2-KP64Z-0749d330',
  'AM2-KUUIA-549afe9d',
  'AM2-NJGWM-05b40a9f',
] as const

/** The real post-cutoff AM2- order reference. Current, not legacy. */
const POST_CUTOFF_AM2 = 'AM2-M32F8-a6a3b0a2'

beforeEach(() => {
  unsettled.list = []
  settled.calls = []
  process.env['CRON_SECRET'] = CRON_SECRET
})

describe('the sweep skips historical AM2- rows before any Airpay call', () => {
  it('never settles a legacy reference', async () => {
    unsettled.list = LEGACY_PENDING.map((ref) => row(ref))

    await sweep()

    expect(lastCaptured.code).toBe(200)
    // The assertion that matters: not one outbound settlement attempt.
    expect(settled.calls).toEqual([])
    expect(body()['legacySkipped']).toBe(3)
    expect(body()['scanned']).toBe(3)
  })

  it('sweeps current rows and skips legacy ones in the same batch', async () => {
    unsettled.list = [
      row('AM-EMF8G-16de123d'),
      row('AM2-KP64Z-0749d330'),
      row('AM-ABCDE-0badc0de'),
    ]

    await sweep()

    // Only the AM- rows were attempted, in order, and the AM2- row was not.
    expect(settled.calls).toEqual(['AM-EMF8G-16de123d', 'AM-ABCDE-0badc0de'])
    expect(body()['legacySkipped']).toBe(1)
    expect(body()['scanned']).toBe(3)
  })

  it('a batch of only current rows is unaffected — legacySkipped is 0', async () => {
    unsettled.list = [row('AM-EMF8G-16de123d'), row('AM-ABCDE-0badc0de')]

    await sweep()

    expect(settled.calls).toEqual(['AM-EMF8G-16de123d', 'AM-ABCDE-0badc0de'])
    expect(body()['legacySkipped']).toBe(0)
    expect((body()['outcomes'] as Record<string, number>)['pending']).toBe(2)
  })

  it('skipping is stable — repeated sweeps never drift toward settling one', async () => {
    unsettled.list = LEGACY_PENDING.map((ref) => row(ref))

    for (let i = 0; i < 5; i += 1) {
      settled.calls = []
      await sweep()
      expect(settled.calls).toEqual([])
      expect(body()['legacySkipped']).toBe(3)
    }
  })

  it('an empty batch still reports the counter', async () => {
    await sweep()
    expect(lastCaptured.code).toBe(200)
    expect(body()['scanned']).toBe(0)
    expect(body()['legacySkipped']).toBe(0)
  })
})

/**
 * The other half of the discriminator, with the REAL production row.
 *
 * `AM2-M32F8-a6a3b0a2` was created 2026-09-01T11:56:24Z — after the cutoff —
 * so it is a current MID-2 order. The sweep must attempt it like any other.
 * Skipping it would strand a live order on the strength of its prefix alone,
 * which is precisely the bug the timestamp check exists to prevent.
 *
 * ⚠ These assertions exercise the TIMESTAMP RULE. The reference is a fixture,
 * not a condition: production code has no branch on this string, and swapping
 * in any other post-cutoff AM2- reference would produce the same result.
 */
describe('a POST-CUTOFF AM2- row is swept as a current MID-2 order', () => {
  it('the real post-cutoff row is attempted, never skipped as legacy', async () => {
    unsettled.list = [row(POST_CUTOFF_AM2, POST_CUTOFF_CREATED_AT)]

    await sweep()

    expect(lastCaptured.code).toBe(200)
    // The assertion that matters: the sweep DID reach for it.
    expect(settled.calls).toEqual([POST_CUTOFF_AM2])
    expect(body()['legacySkipped']).toBe(0)
    expect(body()['scanned']).toBe(1)
  })

  it('separates pre- and post-cutoff AM2- rows in one batch, by date alone', async () => {
    // Same prefix on every AM2- row here; only the timestamp differs. The
    // pre-cutoff one is skipped, the post-cutoff one is swept.
    unsettled.list = [
      row('AM2-KP64Z-0749d330', PRE_CUTOFF_CREATED_AT),
      row(POST_CUTOFF_AM2, POST_CUTOFF_CREATED_AT),
      row('AM-EMF8G-16de123d'),
    ]

    await sweep()

    expect(settled.calls).toEqual([POST_CUTOFF_AM2, 'AM-EMF8G-16de123d'])
    expect(body()['legacySkipped']).toBe(1)
    expect(body()['scanned']).toBe(3)
  })

  it('the boundary instant itself is current, not legacy', async () => {
    // The rule is `created < cutoff`, so a row created exactly AT the cutoff
    // is current. Asserted so the comparison can never silently become <=.
    unsettled.list = [row('AM2-BOUND-00000000', '2026-09-01T00:00:00Z')]

    await sweep()

    expect(settled.calls).toEqual(['AM2-BOUND-00000000'])
    expect(body()['legacySkipped']).toBe(0)
  })

  it('one millisecond before the cutoff is still legacy', async () => {
    unsettled.list = [row('AM2-BOUND-00000000', '2026-08-31T23:59:59.999Z')]

    await sweep()

    expect(settled.calls).toEqual([])
    expect(body()['legacySkipped']).toBe(1)
  })
})
