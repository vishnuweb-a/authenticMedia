import { formatInr } from '@/lib/format'

/**
 * Terms §8 promises that the total shown in the cart is the amount the shopper
 * will be asked to pay. The server re-prices the basket from active catalogue
 * rows only, so a price change, a retired service still sitting in the cart, or
 * a stale tab can make the two differ. This is the last check before hand-off:
 * returns null when they agree, otherwise the message to show instead of paying.
 *
 * Display-side only. It never decides whether anything is paid — settlement
 * stays with Airpay Order Confirmation on the server.
 */
export function chargedAmountMismatch(displayedTotal: number, chargedAmount: number): string | null {
  if (chargedAmount === displayedTotal) return null

  if (!(chargedAmount > 0)) {
    return 'We could not confirm the amount for your order, so you have not been taken to payment and nothing has been charged. Please try again.'
  }

  return `The amount for your order is ${formatInr(chargedAmount)}, not the ${formatInr(displayedTotal)} shown in your cart. This happens when a price changes or a service is no longer offered. Nothing has been charged — we have refreshed your cart, so please review it before paying.`
}
