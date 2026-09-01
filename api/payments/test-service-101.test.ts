import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from '../_lib/http.js'

/**
 * The ₹101 Airpay payment-test service
 * (supabase/migrations/20260901d_airpay_101_payment_test_service.sql).
 *
 * The whole point of this service is that it is ORDINARY. It exists to
 * exercise the live payment path, so every assertion below is really the same
 * assertion from a different angle: nothing anywhere was taught that this slug
 * is special. A test service that travelled its own route would verify only
 * that route.
 *
 * The catalogue assertions read the migration source rather than the live
 * database. The live MID must never be exercised by a test suite (AGENTS.md
 * §29.3 rule 11), and a test that queried production would fail in CI and pass
 * locally. The handler assertions run the real handler against mocked Supabase
 * and OAuth — no live gateway, no database, no payment created.
 */

const SLUG = 'airpay-101-payment-test'
const MIGRATION_PATH = 'supabase/migrations/20260901d_airpay_101_payment_test_service.sql'
const MIGRATION = readFileSync(MIGRATION_PATH, 'utf8')

/** The migration with `--` comment lines stripped, i.e. the SQL that runs. */
const EXECUTABLE = MIGRATION.replace(/^\s*--.*$/gm, '')

describe('1. the ₹101 service exists as an ordinary catalogue row', () => {
  it('inserts the service under the documented slug and title', () => {
    expect(MIGRATION).toContain(`'${SLUG}'`)
    expect(MIGRATION).toContain('Airpay ₹101 Payment Test')
  })

  it('prices it at exactly 101 in services.price_inr — the column the server reads', () => {
    // create_airpay_order resolves every basket through
    // `sum(s.price_inr) where s.slug = any(...) and s.is_active`. Pricing this
    // row anywhere else would mean the test did not exercise the real path.
    const insert = EXECUTABLE.slice(EXECUTABLE.indexOf('insert into public.services'))
    expect(insert).toMatch(/price_inr/)
    expect(insert).toMatch(/^\s*101,\s*$/m)
  })

  it('is active, so the catalogue read and the price lookup both see it', () => {
    // is_active gates three layers independently: the public RLS read policy
    // (`using (is_active)`), the catalogue query (`.eq('is_active', true)`)
    // and the server-side pricing sum. An inactive row is invisible to all.
    const insert = EXECUTABLE.slice(EXECUTABLE.indexOf('insert into public.services'))
    expect(insert).toMatch(/is_active/)
    expect(insert).toMatch(/^\s*true,\s*$/m)
  })

  it('joins an existing category rather than creating a new one', () => {
    expect(EXECUTABLE).toMatch(/from public\.service_categories c/)
    expect(EXECUTABLE).toMatch(/where c\.slug = 'micro-services'/)
    expect(EXECUTABLE).not.toMatch(/insert into public\.service_categories/i)
  })

  it('sits last in catalogue position, displacing no existing offering', () => {
    expect(EXECUTABLE).toMatch(/coalesce\(max\(s\.position\), 0\) \+ 1/)
  })

  it('is idempotent on slug, so re-running creates no duplicate service', () => {
    expect(MIGRATION).toMatch(/on conflict \(slug\) do nothing/)
  })
})

describe('2. the migration is additive and touches nothing else', () => {
  it('inserts and never updates, deletes, drops or alters', () => {
    expect(EXECUTABLE).not.toMatch(/\bupdate\s+public\./i)
    expect(EXECUTABLE).not.toMatch(/\bdelete\s+from\b/i)
    expect(EXECUTABLE).not.toMatch(/\bdrop\b/i)
    expect(EXECUTABLE).not.toMatch(/\balter\s+table\b/i)
    expect(EXECUTABLE).not.toMatch(/\btruncate\b/i)
  })

  it('touches only public.services — no order, payment or settlement row', () => {
    for (const table of ['public.orders', 'public.payments', 'public.order_items']) {
      expect(EXECUTABLE).not.toContain(table)
    }
  })

  it('leaves the existing ₹2 test service alone', () => {
    // The ₹2 row has order history pointing at it. This migration must not
    // re-price it, rename it, deactivate it, or reuse its slug.
    expect(EXECUTABLE).not.toContain('airpay-integration-test')
  })

  it('carries no payment bypass: it calls no settlement or order function', () => {
    // The row is inert data. Nothing here can move money, mark an order paid,
    // or reach a credential. ("airpay" appears in the slug and in feature-list
    // strings, which are copy.)
    for (const forbidden of [
      'create_airpay_order',
      'settle_airpay_order',
      'cancel_airpay_order',
      'security definer',
      'access_token',
    ]) {
      expect(EXECUTABLE.toLowerCase()).not.toContain(forbidden)
    }
  })

  it('introduces no credential, MID or callback URL', () => {
    for (const forbidden of ['368250', 'AIRPAY_', 'kkchat.in', 'authenticmedia.fun/callback']) {
      expect(MIGRATION).not.toContain(forbidden)
    }
  })
})

describe('3. the service is visible through the normal catalogue query', () => {
  const REPO = readFileSync('src/services/catalogue/supabase-catalogue-repository.ts', 'utf8')

  it('the catalogue read selects every active row, with no slug filter', () => {
    // There is no allow-list and no exclusion: `is_active` is the only gate,
    // so an active row appears by virtue of being active.
    expect(REPO).toMatch(/\.eq\('is_active', true\)/)
    expect(REPO).not.toContain(SLUG)
    expect(REPO).not.toContain('airpay-integration-test')
  })

  it('orders by position, so the new row lands last rather than displacing one', () => {
    expect(REPO).toMatch(/\.order\('position', \{ ascending: true \}\)/)
  })

  it('no frontend component singles this service out', () => {
    // If any card, section or hook mentioned the slug, the service would be
    // rendered by special-case code instead of the ordinary catalogue path.
    for (const file of [
      'src/features/services/components/service-card.tsx',
      'src/features/services/components/micro-service-card.tsx',
      'src/features/services/components/catalogue-micro-services-section.tsx',
      'src/features/services/components/core-offerings-section.tsx',
      'src/features/services/hooks/use-catalogue.ts',
      'src/features/services/hooks/use-add-to-cart.ts',
    ]) {
      expect(readFileSync(file, 'utf8')).not.toContain(SLUG)
    }
  })
})

describe('4. the service reaches the cart through the ordinary mechanism', () => {
  const ADD_TO_CART = readFileSync('src/features/services/hooks/use-add-to-cart.ts', 'utf8')
  const CART_TYPES = readFileSync('src/types/cart.ts', 'utf8')

  it('every service becomes a CartItem through the one shared hook', () => {
    // useAddToCart maps a Service onto a CartItem with no branch on identity.
    expect(ADD_TO_CART).toContain('serviceId: service.id')
    expect(ADD_TO_CART).toContain('price: service.price')
    expect(ADD_TO_CART).not.toMatch(/\bif\s*\(/)
  })

  it('a cart line is keyed on the slug and carries the catalogue price', () => {
    expect(CART_TYPES).toContain('serviceId: string')
    expect(CART_TYPES).toContain('price: number')
  })
})

/* -------------------------------------------------------------------------
 * 5–10. The payment path. The real handler, mocked Supabase and OAuth.
 * ---------------------------------------------------------------------- */

const rpc = vi.hoisted(() => ({
  calls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  result: {
    data: [{ id: 'order-uuid', total_inr: 101, access_token: 'tok' }],
    error: null as unknown,
  },
}))

const oauth = vi.hoisted(() => ({ configs: [] as Array<{ mid: string }> }))

vi.mock('../_lib/db.js', () => ({
  getServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpc.calls.push({ fn, args })
      return rpc.result
    },
  }),
}))

vi.mock('../_lib/airpay.js', () => ({
  getAccessToken: async (config: { mid: string }) => {
    oauth.configs.push({ mid: config.mid })
    return 'oauth-token'
  },
}))

const handler = (await import('./create.js')).default

const GUEST = '11111111-1111-4111-8111-111111111111'

/** The one merchant. */
const MID = '368250'

/** Placeholder values only. Never a real credential. */
const ENV: Record<string, string> = {
  AIRPAY_ENV: 'live',
  AIRPAY_MID: MID,
  AIRPAY_CLIENT_ID: 'client-placeholder',
  AIRPAY_SECRET_KEY: 'oauth-secret-placeholder',
  AIRPAY_API_KEY: 'api-key-placeholder',
  AIRPAY_USERNAME: 'user-placeholder',
  AIRPAY_PASSWORD: 'pass-placeholder',
}

/**
 * The retired merchant-2 variables, set to obviously wrong values so that any
 * code which still consults one shows up as a failed assertion, not silence.
 */
const RETIRED_ENV: Record<string, string> = {
  AIRPAY_MID_2: '362380',
  AIRPAY_CLIENT_ID_2: 'must-not-be-read',
  AIRPAY_SECRET_KEY_2: 'must-not-be-read',
  AIRPAY_API_KEY_2: 'must-not-be-read',
  AIRPAY_USERNAME_2: 'must-not-be-read',
  AIRPAY_PASSWORD_2: 'must-not-be-read',
  AIRPAY_ACTIVE_MERCHANT: '2',
}

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
 * A checkout POST for the given slugs.
 *
 * The merchant selection is REQUIRED by the server, so every request states
 * one. It defaults to merchant 1 — the production-proven account — because
 * these cases are about the SERVICE, not the merchant, and merchant 1 is what
 * they have always exercised.
 */
function checkout(slugs: readonly string[], merchant: 1 | 2 = 1): ApiRequest {
  return {
    method: 'POST',
    headers: {},
    body: {
      serviceSlugs: slugs,
      merchant,
      guestToken: GUEST,
      contact: { email: 'shopper@example.com', firstName: 'Ada', lastName: 'L' },
    },
  } as ApiRequest
}

function recordedRef(): string {
  return String(rpc.calls[0]?.args['p_order_ref'] ?? '')
}

beforeEach(() => {
  rpc.calls = []
  rpc.result = {
    data: [{ id: 'order-uuid', total_inr: 101, access_token: 'tok' }],
    error: null,
  }
  oauth.configs = []
  for (const [name, value] of Object.entries(ENV)) process.env[name] = value
  for (const [name, value] of Object.entries(RETIRED_ENV)) process.env[name] = value
})

describe('5. the ₹101 service uses the normal checkout path', () => {
  it('goes through the same create_airpay_order RPC as any other service', async () => {
    const { res, captured } = mockRes()
    await handler(checkout([SLUG]), res)

    expect(captured.code).toBe(200)
    expect(rpc.calls).toHaveLength(1)
    expect(rpc.calls[0]?.fn).toBe('create_airpay_order')
    // The slug reaches pricing, and nothing else.
    expect(rpc.calls[0]?.args['p_service_slugs']).toEqual([SLUG])
  })

  it('sends no price — the amount comes back from the database', async () => {
    const { res, captured } = mockRes()
    await handler(checkout([SLUG]), res)

    const args = rpc.calls[0]?.args ?? {}
    for (const key of Object.keys(args)) {
      expect(key).not.toMatch(/amount|price|total|subtotal/i)
    }
    expect((captured.body as { amount?: number }).amount).toBe(101)
  })

  it('baskets with an ordinary service alongside it as one order', async () => {
    const { res, captured } = mockRes()
    await handler(checkout(['website-security-audit', SLUG]), res)

    expect(captured.code).toBe(200)
    expect(rpc.calls).toHaveLength(1)
    expect(oauth.configs).toEqual([{ mid: MID }])
  })
})

describe('6. a payment for the service generates an AM-* order reference', () => {
  it('generates a well-formed AM- reference', async () => {
    const { res, captured } = mockRes()
    await handler(checkout([SLUG]), res)

    expect(captured.code).toBe(200)
    expect(recordedRef()).toMatch(/^AM-[0-9A-Z]{5}-[0-9a-f]{8}$/)
    expect(recordedRef()).not.toMatch(/^AM2-/)
    expect((captured.body as { orderRef?: string }).orderRef).toBe(recordedRef())
  })

  it('never produces an AM2- reference, over many orders', async () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i += 1) {
      rpc.calls = []
      const { res } = mockRes()
      await handler(checkout([SLUG]), res)
      const ref = recordedRef()
      expect(ref).toMatch(/^AM-[0-9A-Z]{5}-[0-9a-f]{8}$/)
      seen.add(ref)
    }
    // References identify real money and must not repeat or be guessable.
    expect(seen.size).toBe(200)
  })
})

describe('7. the payment path uses MID 368250', () => {
  it('contacts exactly one merchant, the unsuffixed one', async () => {
    const { res, captured } = mockRes()
    await handler(checkout([SLUG]), res)

    expect(captured.code).toBe(200)
    expect(oauth.configs).toEqual([{ mid: MID }])
  })

  it('still uses MID 368250 while every _2 variable says otherwise', async () => {
    // RETIRED_ENV is applied in beforeEach, including AIRPAY_ACTIVE_MERCHANT=2.
    const { res } = mockRes()
    await handler(checkout([SLUG]), res)

    expect(oauth.configs).toEqual([{ mid: MID }])
    expect(oauth.configs).not.toContainEqual({ mid: '362380' })
  })

  it('works identically when no _2 variable exists at all', async () => {
    for (const name of Object.keys(RETIRED_ENV)) delete process.env[name]

    const { res, captured } = mockRes()
    await handler(checkout([SLUG]), res)

    expect(captured.code).toBe(200)
    expect(oauth.configs).toEqual([{ mid: MID }])
  })
})

describe('8. no MID-2 credential is referenced anywhere', () => {
  const SOURCES = [
    'api/payments/create.ts',
    'api/_lib/config.ts',
    'api/_lib/order-ref.ts',
    MIGRATION_PATH,
  ]

  const FORBIDDEN = [
    'AIRPAY_MID_2',
    'AIRPAY_USERNAME_2',
    'AIRPAY_PASSWORD_2',
    'AIRPAY_CLIENT_ID_2',
    'AIRPAY_SECRET_KEY_2',
    'AIRPAY_API_KEY_2',
    'AIRPAY_ACTIVE_MERCHANT',
  ]

  for (const file of SOURCES) {
    it(`${file} names no _2 credential`, () => {
      const source = readFileSync(file, 'utf8')
      // Strip comments: config.ts and order-ref.ts DISCUSS the retired
      // merchant in prose, which is documentation, not a read.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|--).*$/gm, '')
      for (const name of FORBIDDEN) {
        expect(code).not.toContain(name)
      }
    })
  }
})

describe('9. no special payment path was introduced for this service', () => {
  const PAYMENT_SOURCES = [
    'api/payments/create.ts',
    'api/_lib/config.ts',
    'api/_lib/order-ref.ts',
    'api/_lib/settle.ts',
    'api/_lib/callback-flow.ts',
    'api/_lib/relay.ts',
    'api/callback/cpm/arp_frontiva/collection.ts',
    'api/payments/reconcile.ts',
    'api/orders/status.ts',
  ]

  for (const file of PAYMENT_SOURCES) {
    it(`${file} has never heard of the ₹101 slug`, () => {
      expect(readFileSync(file, 'utf8')).not.toContain(SLUG)
    })
  }

  it('the callback URL is unchanged', () => {
    const callback = readFileSync('api/callback/cpm/arp_frontiva/collection.ts', 'utf8')
    expect(callback).toContain('https://authenticmedia.fun/callback/cpm/arp_frontiva/collection')
  })

  it('the KKChat relay destination is unchanged', () => {
    const relay = readFileSync('api/_lib/relay.ts', 'utf8')
    expect(relay).toContain("'https://kkchat.in/callback/cpm/arp_frontiva/collection'")
  })

  it('settlement is keyed on the order reference, never on what was bought', () => {
    const settle = readFileSync('api/_lib/settle.ts', 'utf8')
    expect(settle).not.toContain(SLUG)
    expect(settle).not.toContain('service_slug')
  })
})

describe('10. existing services continue to behave exactly as before', () => {
  const UNCHANGED = ['tech-maintenance', 'website-security-audit', 'airpay-integration-test']

  for (const slug of UNCHANGED) {
    it(`${slug} still creates an AM- order for MID 368250`, async () => {
      const { res, captured } = mockRes()
      await handler(checkout([slug]), res)

      expect(captured.code).toBe(200)
      expect(recordedRef()).toMatch(/^AM-[0-9A-Z]{5}-[0-9a-f]{8}$/)
      expect(oauth.configs).toEqual([{ mid: MID }])
      expect(rpc.calls[0]?.args['p_service_slugs']).toEqual([slug])
    })
  }

  it('this migration re-prices no existing service', () => {
    // The ₹2 row in particular has order history pointing at it; re-pricing
    // it, rather than adding a row, would have rewritten that history's
    // meaning. This migration only ever INSERTs.
    const migration = MIGRATION.toLowerCase()
    expect(migration).not.toMatch(/set\s+price_inr/)
    expect(migration).not.toMatch(/update\s+public\.services/)
  })
})
