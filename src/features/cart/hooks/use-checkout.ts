import { useCallback, useState } from 'react'

import { createAirpayPayment, submitToAirpay } from '@/services'
import { useCart } from '@/stores'
import type { CheckoutStatus } from '../types/cart.types'
import {
  EMPTY_CONTACT,
  normalisePhone,
  splitName,
  validateCheckoutContact,
  type CheckoutContactErrors,
  type CheckoutContactValues,
} from '../lib/contact'

export interface UseCheckoutResult {
  status: CheckoutStatus
  /** Human-readable failure message, set only when status is 'failed'. */
  error: string | null
  contact: CheckoutContactValues
  contactErrors: CheckoutContactErrors
  setContactValue: (field: keyof CheckoutContactValues, value: string) => void
  pay: () => Promise<void>
  reset: () => void
}

/**
 * The cart's checkout seam: create the order server-side, then hand the
 * browser off to Airpay's hosted payment page.
 *
 * The browser sends only service slugs and the shopper's contact details — no
 * price, subtotal or total. The server re-prices the basket from the catalogue,
 * so there is deliberately nowhere for a tampered client to state what it
 * thinks the order costs (AIPAY-DOCS §7.1).
 *
 * ⚠ Airpay's hosted page requires either an email or a phone number and
 * refuses the payment outright without one. This hook collects them and will
 * not call the server until at least one is usable; the server enforces the
 * same rule authoritatively (§7.3).
 *
 * ⚠ This hook never reports a payment as succeeded. It ends at the redirect;
 * whether money actually moved is decided by the server against Airpay's Order
 * Confirmation, and reported on the /order-success page. A redirect proves only
 * that a browser was pointed at a URL (§14.1).
 *
 * ⚠ ONE hand-off, one merchant: the full-tab POST that has always worked.
 * Airpay's dashboard Response URL for this MID points back here, so Airpay
 * itself brings the shopper home to /order-success, which asks the server what
 * actually happened. The redirect is evidence of nothing (§8.1, §14.1).
 *
 * The cart is deliberately NOT cleared here. The shopper has not paid yet, and
 * clearing it would lose their basket if they abandoned the gateway or the
 * payment failed.
 */
export function useCheckout(): UseCheckoutResult {
  const { items } = useCart()
  const [status, setStatus] = useState<CheckoutStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [contact, setContact] = useState<CheckoutContactValues>(EMPTY_CONTACT)
  const [contactErrors, setContactErrors] = useState<CheckoutContactErrors>({})
  const [hasAttempted, setHasAttempted] = useState(false)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setContactErrors({})
    setHasAttempted(false)
  }, [])

  const setContactValue = useCallback(
    (field: keyof CheckoutContactValues, value: string) => {
      setContact((current) => {
        const next = { ...current, [field]: value }
        // Only re-validate once they have tried to pay, so nobody is told they
        // are wrong before they have finished typing.
        if (hasAttempted) setContactErrors(validateCheckoutContact(next))
        return next
      })
    },
    [hasAttempted],
  )

  const pay = useCallback(async () => {
    // ⚠ One click, one order. A second call while the first is still in flight
    // would create a SECOND order row — and, worse, a second hosted page — for
    // a single checkout action. The status flag is the guard; the Pay control
    // is also disabled while pending, but a disabled button is a courtesy and
    // this is the correctness check.
    if (status === 'pending') return

    setHasAttempted(true)

    const errors = validateCheckoutContact(contact)
    setContactErrors(errors)
    if (Object.keys(errors).length > 0) {
      setStatus('idle')
      setError(null)
      return
    }

    setStatus('pending')
    setError(null)

    const { firstName, lastName } = splitName(contact.name)

    const created = await createAirpayPayment({
      serviceSlugs: items.map((item) => item.serviceId),
      contact: {
        firstName,
        lastName,
        email: contact.email.trim(),
        phone: normalisePhone(contact.phone),
      },
    })

    if (!created.ok) {
      setError(created.error.message)
      setStatus('failed')
      return
    }

    // The full-tab hand-off. Airpay returns this browser to /order-success
    // itself, so navigation ends this hook's involvement; status stays
    // 'pending' so the pill keeps its loading state until the page unloads.
    submitToAirpay(created.data)
  }, [contact, items, status])

  return {
    status,
    error,
    contact,
    contactErrors,
    setContactValue,
    pay,
    reset,
  }
}
