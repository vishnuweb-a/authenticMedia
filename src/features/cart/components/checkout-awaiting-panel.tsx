import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { ROUTES } from '@/routes/paths'
import { useOrderStatus } from '../hooks/use-order-status'

export interface CheckoutAwaitingPanelProps {
  readonly orderRef: string
  readonly accessToken: string
}

/**
 * Shown while the shopper is paying in a SEPARATE window (AIPAY-DOCS §14.3).
 *
 * ⚠ Why this exists: Airpay resolves its Response URL per MID from its own
 * dashboard (§8.1). Merchant 2's points at KKChat — the client's requirement,
 * and not ours to change — so Airpay lands the paying window on KKChat and
 * never navigates any browser back here. This tab was deliberately kept, and
 * this panel is what it does with itself: it polls the authoritative status
 * endpoint, which verifies against Airpay Order Confirmation and settles
 * inline, then moves the shopper to /order-success.
 *
 * ⚠ Nothing here decides whether the payment succeeded, and nothing here reads
 * the payment window. The other window is on a foreign origin and cannot be
 * inspected — which is just as well, because a page's contents would be no more
 * evidence of payment than the callback body is (§0, §14.1). The order is
 * resolved entirely server-side; this panel only watches for it.
 */
export function CheckoutAwaitingPanel({ orderRef, accessToken }: CheckoutAwaitingPanelProps) {
  const { state } = useOrderStatus(orderRef, accessToken)
  const navigate = useNavigate()

  // Once the server has an answer — paid, failed or needing review — hand the
  // shopper to the page that reports it. The URL carries the reference and the
  // order's read key and no claim about the outcome, exactly as Airpay's own
  // return would have (§14.1); order-success asks the server again itself.
  useEffect(() => {
    if (state === 'checking') return

    const query = new URLSearchParams({ ref: orderRef, t: accessToken })
    navigate(`${ROUTES.orderSuccess}?${query.toString()}`)
  }, [state, orderRef, accessToken, navigate])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <Loader2 aria-hidden="true" className="size-8 animate-spin text-text-muted" />

      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold text-text">Complete your payment</p>
        <p className="text-[13px] leading-relaxed text-text-muted">
          We have opened the secure payment page in a new window. Finish paying there and
          keep this tab open — we will confirm your order here automatically.
        </p>
      </div>

      <p className="text-[12px] text-text-muted">
        Order reference <span className="font-mono text-text">{orderRef}</span>
      </p>
    </div>
  )
}
