import { CheckCircle2 } from 'lucide-react'

/**
 * Shown after a successful checkout, once the cart has been cleared.
 *
 * [INFERRED] — no payment state is captured in the reference. It reuses the
 * empty state's anatomy so the drawer does not change shape at the moment of
 * confirmation, and says plainly that nothing was charged: this phase runs
 * against the mock PaymentService, not Airpay.
 */
export function CartPaymentSuccess({ onDone }: { onDone: () => void }) {
  return (
    <div role="status" className="flex flex-col items-center px-2 py-14 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-14 items-center justify-center rounded-2xl bg-surface-drawer-tile text-primary-mid"
      >
        <CheckCircle2 className="size-6" />
      </span>

      <p className="mt-5 text-[17px] font-bold text-text">Payment simulated</p>

      <p className="mt-2 max-w-[250px] text-[15px] text-text-muted">
        Your cart has been cleared. No real payment was processed — checkout is not yet connected.
      </p>

      <button
        type="button"
        onClick={onDone}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-pill border border-border-secondary px-6 text-[15px] font-semibold text-text transition-colors hover:bg-primary-start/10"
      >
        Done
      </button>
    </div>
  )
}
