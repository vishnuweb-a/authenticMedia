import { describe, expect, it, vi } from 'vitest'

import type { CartRow } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({ supabase: null, getGuestToken: () => 'x' }))

const { reconcileCartRows } = await import('./supabase-cart-service')

/**
 * The cart must show what create_airpay_order will charge: active services at
 * their current catalogue price, nothing else. No network or database here.
 */
function row(slug: string, price: number): CartRow {
  return {
    service_slug: slug,
    title: slug,
    description: '',
    subtitle: null,
    features: [],
    price_inr: price,
    icon: 'wrench',
    badge: null,
    tier: 'core',
  }
}

describe('cart rows are reconciled with the active catalogue', () => {
  it('drops a service that is no longer active (cannot be bought, must not be totalled)', () => {
    const items = reconcileCartRows(
      [row('tech-maintenance', 849), row('fintech-partner', 499)],
      [{ slug: 'tech-maintenance', price_inr: 849 }],
    )
    expect(items.map((i) => i.serviceId)).toEqual(['tech-maintenance'])
    expect(items.reduce((sum, i) => sum + i.price, 0)).toBe(849)
  })

  it('replaces a stale cart price with the current catalogue price', () => {
    const [item] = reconcileCartRows([row('seo-audit', 299)], [{ slug: 'seo-audit', price_inr: 349 }])
    expect(item?.price).toBe(349)
  })

  it('ignores catalogue rows that are not in the cart (a modified cart cannot add items)', () => {
    const items = reconcileCartRows(
      [row('seo-audit', 349)],
      [
        { slug: 'seo-audit', price_inr: 349 },
        { slug: 'ai-automation', price_inr: 999 },
      ],
    )
    expect(items).toHaveLength(1)
  })

  it('shows an empty cart when nothing in it is active', () => {
    expect(reconcileCartRows([row('retired', 100)], [])).toEqual([])
  })
})
