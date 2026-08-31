import { beforeEach, describe, expect, it, vi } from 'vitest'

import { computeSecureHash } from './airpay-crypto.js'
import type { AirpayConfig } from './config.js'
import type { VerifiedTransaction } from './airpay.js'

/**
 * Settlement regression tests (AGENTS.md §30.9).
 *
 * Every one runs against mocks and fixtures. No live MID is contacted and no
 * payment is created.
 */

const orders = vi.hoisted(() => ({ map: new Map<string, Record<string, unknown>>() }))
const settleCalls = vi.hoisted(() => ({ list: [] as Array<[string, string, string | null]> }))
const settleResult = vi.hoisted(() => ({ value: 'order-uuid' as string | null }))

vi.mock('./db.js', () => ({
  findOrderByRef: async (ref: string) => orders.map.get(ref) ?? null,
  settleOrderRow: async (ref: string, status: string, apId: string | null) => {
    settleCalls.list.push([ref, status, apId])
    return settleResult.value
  },
}))

const { settleOrder } = await import('./settle.js')

const config: AirpayConfig = {
  merchant: 1,
  mid: '366950',
  clientId: 'c',
  secretKey: 's',
  apiKey: 'a',
  username: 'test-user',
  password: 'p',
  env: 'live',
  verifyUrl: 'https://example.invalid/verify/',
}

const ORDER_REF = 'AM-1234-abcdef01'

function seedOrder(overrides: Record<string, unknown> = {}): void {
  orders.map.set(ORDER_REF, {
    id: 'order-uuid',
    reference: ORDER_REF,
    status: 'pending_payment',
    totalInr: 1499,
    accessToken: 'token-uuid',
    paymentMethod: 'airpay',
    apTransactionId: null,
    createdAt: '2026-08-31T00:00:00Z',
    ...overrides,
  })
}

const verified = (over: Partial<VerifiedTransaction> = {}): VerifiedTransaction => ({
  orderRef: ORDER_REF,
  status: 200,
  amount: 1499,
  apTransactionId: 'AP-999',
  ...over,
})

beforeEach(() => {
  orders.map.clear()
  settleCalls.list = []
  settleResult.value = 'order-uuid'
})

describe('settleOrder — the only path to paid (§10)', () => {
  it('marks an order paid only after Order Confirmation confirms it', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () => verified())

    expect(result.outcome).toBe('paid')
    expect(settleCalls.list).toEqual([[ORDER_REF, 'succeeded', 'AP-999']])
  })

  it('NEVER marks paid on a callback status alone — verification decides', async () => {
    seedOrder()
    // A callback asserting a perfect SUCCESS, with a VALID SecureHash.
    const fields = {
      transactionId: ORDER_REF,
      apTransactionId: 'AP-999',
      amount: '1499.00',
      transactionStatus: '200',
      message: 'Success',
    }
    const hash = computeSecureHash(fields, config)

    // Verification is inconclusive (null). The order must NOT be settled,
    // however emphatically the callback claims success.
    const result = await settleOrder(
      {
        orderRef: ORDER_REF,
        secureHash: hash,
        apTransactionId: fields.apTransactionId,
        amount: fields.amount,
        transactionStatus: fields.transactionStatus,
        message: fields.message,
      },
      config,
      async () => null,
    )

    expect(result.outcome).toBe('pending')
    expect(settleCalls.list).toEqual([])
  })

  it('records a definite non-success as failed', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () =>
      verified({ status: 400 }),
    )

    expect(result.outcome).toBe('failed')
    expect(settleCalls.list).toEqual([[ORDER_REF, 'failed', 'AP-999']])
  })

  it('treats 211 IN_PROCESS as pending, not failed (edge case 27)', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () =>
      verified({ status: 211 }),
    )

    expect(result.outcome).toBe('pending')
    expect(settleCalls.list).toEqual([])
  })

  it('reports unknown_order for a reference that does not exist', async () => {
    const result = await settleOrder({ orderRef: 'AM-nope-00000000' }, config, async () =>
      verified(),
    )

    expect(result.outcome).toBe('unknown_order')
    expect(settleCalls.list).toEqual([])
  })
})

describe('integrity check may only ever reject (§10.1 step 3)', () => {
  it('rejects a callback whose SecureHash does not match', async () => {
    seedOrder()
    const verify = vi.fn(async () => verified())

    const result = await settleOrder(
      { orderRef: ORDER_REF, secureHash: '999', transactionStatus: '200', message: 'Success' },
      config,
      verify,
    )

    expect(result.outcome).toBe('hash_mismatch')
    expect(settleCalls.list).toEqual([])
    // It stops BEFORE verification: a corrupt claim is not worth a round trip.
    expect(verify).not.toHaveBeenCalled()
  })

  it('a valid hash grants nothing on its own — verification still decides', async () => {
    seedOrder()
    const fields = {
      transactionId: ORDER_REF,
      apTransactionId: 'AP-1',
      amount: '1499.00',
      transactionStatus: '200',
      message: 'Success',
    }

    const result = await settleOrder(
      {
        orderRef: ORDER_REF,
        secureHash: computeSecureHash(fields, config),
        apTransactionId: 'AP-1',
        amount: '1499.00',
        transactionStatus: '200',
        message: 'Success',
      },
      config,
      // Airpay says FAILED despite the callback's valid SUCCESS hash.
      async () => verified({ status: 400 }),
    )

    expect(result.outcome).toBe('failed')
  })

  it('skips the integrity check for the synthetic reconcile payload (§16)', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () => verified())
    expect(result.outcome).toBe('paid')
  })
})

describe('⚠ PROVEN §10.4 — no status is an UNKNOWN, not a failure', () => {
  it('leaves the order pending when verification cannot be obtained', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () => null)

    expect(result.outcome).toBe('pending')
    // The bug this guards: a genuine ₹81 payment terminally marked failed
    // because null !== 200. Nothing may be written here.
    expect(settleCalls.list).toEqual([])
  })
})

describe('amount mismatch → requires_review (§10.5)', () => {
  it('never marks paid or failed when the amount differs', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () =>
      verified({ amount: 1 }),
    )

    expect(result.outcome).toBe('requires_review')
    expect(settleCalls.list).toEqual([[ORDER_REF, 'requires_review', 'AP-999']])
  })

  it('accepts a difference within the 0.001 paisa tolerance', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () =>
      verified({ amount: 1499.0005 }),
    )

    expect(result.outcome).toBe('paid')
  })

  it('rejects a difference just outside the tolerance', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () =>
      verified({ amount: 1499.01 }),
    )

    expect(result.outcome).toBe('requires_review')
  })

  it('treats a confirmation with no amount as requiring review', async () => {
    seedOrder()
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () =>
      verified({ amount: null }),
    )

    expect(result.outcome).toBe('requires_review')
  })
})

describe('idempotency (§10.2)', () => {
  it('short-circuits an order already in a terminal state', async () => {
    seedOrder({ status: 'paid' })
    const verify = vi.fn(async () => verified())

    const result = await settleOrder({ orderRef: ORDER_REF }, config, verify)

    expect(result.outcome).toBe('already_settled')
    expect(verify).not.toHaveBeenCalled()
    expect(settleCalls.list).toEqual([])
  })

  it('treats requires_review as terminal so a human flag is never overwritten', async () => {
    seedOrder({ status: 'requires_review' })
    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () => verified())

    expect(result.outcome).toBe('already_settled')
    expect(settleCalls.list).toEqual([])
  })

  it('reports a lost race as already_settled, not an error', async () => {
    seedOrder()
    settleResult.value = null // the conditional UPDATE matched zero rows

    const result = await settleOrder({ orderRef: ORDER_REF }, config, async () => verified())

    expect(result.outcome).toBe('already_settled')
  })

  it('a duplicate delivery settles exactly once', async () => {
    seedOrder()
    await settleOrder({ orderRef: ORDER_REF }, config, async () => verified())
    // Simulate the row now being terminal, as the real UPDATE would leave it.
    seedOrder({ status: 'paid' })
    await settleOrder({ orderRef: ORDER_REF }, config, async () => verified())

    expect(settleCalls.list).toHaveLength(1)
  })
})

describe('sandbox refuses to settle (§10.3)', () => {
  it('leaves the order unsettled rather than trusting an untrusted signal', async () => {
    seedOrder()
    const verify = vi.fn(async () => verified())

    const result = await settleOrder({ orderRef: ORDER_REF }, { ...config, env: 'sandbox' }, verify)

    expect(result.outcome).toBe('unverifiable')
    expect(verify).not.toHaveBeenCalled()
    expect(settleCalls.list).toEqual([])
  })
})
