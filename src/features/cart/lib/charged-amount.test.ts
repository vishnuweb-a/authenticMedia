import { describe, expect, it } from 'vitest'

import { chargedAmountMismatch } from './charged-amount'

/**
 * Terms §8: the total shown in the cart is the amount the shopper is asked to
 * pay. The server prices from active catalogue rows only; when that differs
 * from the drawer, checkout must stop before the gateway. No network here.
 */
describe('checkout refuses to hand off when the server amount differs from the cart', () => {
  it('passes when the server charges exactly the displayed total', () => {
    expect(chargedAmountMismatch(1848, 1848)).toBeNull()
  })

  it('stops on a stale price (server re-priced upward)', () => {
    const message = chargedAmountMismatch(849, 949)
    expect(message).toContain('₹949')
    expect(message).toContain('₹849')
    expect(message).toMatch(/nothing has been charged/i)
  })

  it('stops when a retired service was silently skipped server-side (charged less)', () => {
    // Cart showed Tech Maintenance ₹849 + Fintech Partner ₹499; the RPC skipped the inactive one.
    expect(chargedAmountMismatch(1348, 849)).toContain('₹849')
  })

  it('fails closed when the server amount is missing, zero or not a number', () => {
    for (const amount of [0, -1, Number.NaN]) {
      expect(chargedAmountMismatch(849, amount)).toMatch(/could not confirm the amount/i)
    }
  })
})
