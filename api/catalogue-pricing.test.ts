import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * The ₹2 Airpay verification service (supabase/migrations/20260831_airpay_test_service.sql).
 *
 * These assertions read the migration source rather than the live database.
 * The live MID must never be exercised by a test suite (AGENTS.md §29.3 rule
 * 11), and a test that queried production would fail in CI and pass locally.
 * What matters here is the *contract*: the row is an ordinary catalogue entry
 * priced in the ordinary column, and no payment code was taught about it.
 */

const MIGRATION = readFileSync('supabase/migrations/20260831_airpay_test_service.sql', 'utf8')

/** The migration with `--` comment lines stripped, i.e. the SQL that runs. */
const EXECUTABLE = MIGRATION.replace(/^\s*--.*$/gm, '')

describe('₹2 Airpay integration test service', () => {
  it('inserts the service under the documented slug', () => {
    expect(MIGRATION).toContain("'airpay-integration-test'")
    expect(MIGRATION).toContain("'Airpay Integration Test'")
  })

  it('prices it at exactly ₹2 in services.price_inr — the column the server reads', () => {
    // create_airpay_order resolves every basket through
    // `sum(s.price_inr) where s.slug = any(...) and s.is_active`. Pricing this
    // row anywhere else would mean the test did not exercise the real path.
    const insert = MIGRATION.slice(MIGRATION.indexOf('insert into public.services'))
    expect(insert).toMatch(/price_inr/)
    expect(insert).toMatch(/^\s*2,\s*$/m)
  })

  it('is active, so the catalogue read and the price lookup both see it', () => {
    // The public read policy is `using (is_active)`, and the pricing sum is
    // also gated on is_active — an inactive row would be invisible to both.
    expect(MIGRATION).toMatch(/\btrue\b/)
  })

  it('is additive: it inserts and never updates or deletes an existing row', () => {
    expect(EXECUTABLE).not.toMatch(/\bupdate\s+public\./i)
    expect(EXECUTABLE).not.toMatch(/\bdelete\s+from\b/i)
    expect(EXECUTABLE).not.toMatch(/\bdrop\b/i)
    expect(EXECUTABLE).not.toMatch(/\balter\s+table\b/i)
  })

  it('is idempotent on slug, so re-running creates no duplicate ₹2 service', () => {
    expect(MIGRATION).toMatch(/on conflict \(slug\) do nothing/)
  })

  it('touches only public.services — no order, payment or settlement row', () => {
    for (const table of ['public.orders', 'public.payments', 'public.order_items']) {
      expect(EXECUTABLE).not.toContain(table)
    }
  })

  it('carries no payment bypass: it calls no settlement or order function', () => {
    // The row is inert data. Nothing in this migration can move money, mark an
    // order paid, or reach a credential. (The words "airpay" and "kkchat" do
    // appear — in the slug and in a feature-list string, which are copy.)
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
})

describe('catalogue pricing stays server-authoritative', () => {
  const CREATE_ORDER = readFileSync('supabase/migrations/20260831_airpay_settlement.sql', 'utf8')
  const HANDLER = readFileSync('api/payments/create.ts', 'utf8')

  it('resolves the amount from services.price_inr, not from the request', () => {
    expect(CREATE_ORDER).toMatch(/sum\(s\.price_inr\)[\s\S]*?from public\.services/)
    expect(CREATE_ORDER).toMatch(/and s\.is_active/)
  })

  it('gives create_airpay_order no parameter by which a caller could state a price', () => {
    const signature = CREATE_ORDER.slice(
      CREATE_ORDER.indexOf('function public.create_airpay_order'),
      CREATE_ORDER.indexOf('returns table (id uuid'),
    )
    for (const param of ['amount', 'price', 'total', 'subtotal']) {
      expect(signature).not.toContain(param)
    }
  })

  it('signs the envelope with the order total the database returned', () => {
    // amount comes from row.total_inr — the RPC's computed sum — and nowhere else.
    expect(HANDLER).toContain('row.total_inr')
    expect(HANDLER).toContain('amount: amount.toFixed(2)')
  })
})
