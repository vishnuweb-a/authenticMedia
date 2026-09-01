import { useCallback, useState } from 'react'

import {
  createAirpayPayment,
  openPaymentWindow,
  PAYMENT_WINDOW_NAME,
  submitToAirpay,
} from '@/services'
import type { AirpayMerchantChoice } from '@/services'
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
  /**
   * Which of the two Airpay payment options the shopper has chosen (§2.4).
   *
   * Exactly one, always — the type admits no third value and no "both", so one
   * checkout action can only ever create one order for one merchant.
   */
  merchant: AirpayMerchantChoice
  setMerchant: (merchant: AirpayMerchantChoice) => void
  pay: () => Promise<void>
  reset: () => void
  /**
   * Set only while the shopper is paying in a SEPARATE window and this tab is
   * waiting for them (§14.3). The drawer renders a waiting panel and polls this
   * order; null means the ordinary full-tab hand-off, where this tab is
   * navigating away and there is nothing to wait for.
   *
   * ⚠ Carries no claim about the payment — only which order to ask about.
   */
  awaiting: { readonly orderRef: string; readonly accessToken: string } | null
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
 * ⚠ Two hand-off styles, chosen by the SERVER (§8.1, §14.3):
 *
 *   returnsToSite  → the original full-tab POST. Airpay's dashboard Response
 *                    URL for that merchant points back here, so Airpay itself
 *                    brings the shopper home. Merchant 1, unchanged.
 *
 *   !returnsToSite → the hosted page opens in a SEPARATE window and this tab
 *                    stays put, polling the order. Airpay's dashboard Response
 *                    URL for merchant 2 points at KKChat — the client's
 *                    requirement, and not ours to change — so Airpay will land
 *                    the paying window on KKChat and never navigate it back.
 *                    Keeping this tab is the only way the shopper returns.
 *
 * Neither style is evidence of anything. Both end at the same authoritative
 * poll of /api/orders/status.
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
  // Merchant 1 is preselected: it is the production-proven account, so the
  // shopper who changes nothing gets the flow that has always worked.
  const [merchant, setMerchant] = useState<AirpayMerchantChoice>(1)
  const [awaiting, setAwaiting] = useState<UseCheckoutResult['awaiting']>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setContactErrors({})
    setHasAttempted(false)
    setAwaiting(null)
    setMerchant(1)
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

    // ⚠ Opened BEFORE the await (§14.3). A popup blocker permits a window
    // opened during the click gesture and refuses one opened after the stack
    // has yielded, so this cannot wait to find out whether it is needed. If the
    // server turns out to want a full-tab hand-off, the window is closed again
    // a few lines below and the shopper never sees it.
    const paymentWindow = openPaymentWindow()

    const { firstName, lastName } = splitName(contact.name)

    const created = await createAirpayPayment({
      serviceSlugs: items.map((item) => item.serviceId),
      // The shopper's single choice, sent as an index. The server validates it
      // and maps it onto its own credentials; nothing here knows a MID (§2.4).
      merchant,
      contact: {
        firstName,
        lastName,
        email: contact.email.trim(),
        phone: normalisePhone(contact.phone),
      },
    })

    if (!created.ok) {
      paymentWindow?.close()
      setError(created.error.message)
      setStatus('failed')
      return
    }

    const handoff = created.data

    // The full-tab hand-off — merchant 1, exactly as before. Airpay returns
    // this browser to /order-success itself, so no window is needed.
    // Navigation ends this hook's involvement; status stays 'pending' so the
    // pill keeps its loading state until the page unloads.
    if (handoff.returnsToSite) {
      paymentWindow?.close()
      submitToAirpay(handoff)
      return
    }

    // Airpay will NOT bring this browser back (§14.3). If the window was
    // refused there is nowhere to pay but this tab: take the full-tab hand-off
    // rather than stranding the shopper on a dead button. They then finish on
    // KKChat's page and reach /order-success from their emailed link or by
    // returning to the site — worse, but never a lost payment, because
    // settlement does not depend on this browser at all.
    if (!paymentWindow) {
      submitToAirpay(handoff)
      return
    }

    // POST into the window we still own, and hold this tab. The order is now
    // this tab's to watch: it polls /api/orders/status, which verifies against
    // Airpay Order Confirmation and settles inline — the same single trusted
    // path, on the same trigger the success page has always used.
    submitToAirpay(handoff, document, PAYMENT_WINDOW_NAME)
    setAwaiting({ orderRef: handoff.orderRef, accessToken: handoff.accessToken })
  }, [contact, items, merchant, status])

  return {
    status,
    error,
    contact,
    contactErrors,
    setContactValue,
    merchant,
    setMerchant,
    pay,
    reset,
    awaiting,
  }
}
