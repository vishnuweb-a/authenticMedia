import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui'
import { formatInr } from '@/lib/format'
import { AirpayMark } from './airpay-mark'
import type { CheckoutStatus } from '../types/cart.types'

export interface CartSummaryProps {
  total: number
  status: CheckoutStatus
  error: string | null
  onPay: () => void
}

/**
 * The drawer floor: a hairline divider, the Total row, then the bordered
 * payment panel holding the airpay mark and the gradient Pay Now pill.
 *
 * The reference shows **only** a Total — no subtotal, tax, or shipping row —
 * so none is added (SCREEN-MAP.md → Cart). The amount is always derived from
 * cart state; nothing here is hardcoded.
 */
export function CartSummary({ total, status, error, onPay }: CartSummaryProps) {
  const payLabel = status === 'failed' ? 'Try Again' : 'Pay Now'

  return (
    <div className="border-t border-border-drawer bg-surface-drawer-footer px-[25px] pt-[22px] pb-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[21px] font-bold text-text">Total</p>
        <p className="text-[21px] font-bold text-text">{formatInr(total)}</p>
      </div>

      {/* A failure is announced, since the pill only changes to "Try Again" and
          that alone does not say what went wrong. There is no success state:
          paying redirects to Airpay, and the outcome is confirmed on
          /order-success once the server has verified it. */}
      <div role="status" aria-live="polite">
        {status === 'failed' && error && (
          <p className="mt-4 flex items-start gap-2 text-[14px] text-red-400">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>

      <div className="mt-[22px] flex h-[71px] items-center justify-between gap-4 rounded-2xl border border-border-drawer bg-surface-drawer-panel px-5">
        <AirpayMark />

        {/* Button hides its label while loading so the pill keeps its width,
            which would leave this control announced only as "Loading". An
            explicit label keeps its name stable for the whole request. */}
        <Button
          size="sm"
          onClick={onPay}
          isLoading={status === 'pending'}
          disabled={total <= 0}
          aria-label={`${payLabel}, ${formatInr(total)}`}
          className="h-11 w-[127px] px-0 text-[15px]"
        >
          {payLabel}
        </Button>
      </div>
    </div>
  )
}
