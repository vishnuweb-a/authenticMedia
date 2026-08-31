import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

import { useCart } from '@/stores'
import { CartEmptyState } from './cart-empty-state'
import { CartLineItem } from './cart-line-item'
import { CartSummary } from './cart-summary'
import { useCheckout } from '../hooks/use-checkout'
import { useDialogBehavior } from '@/hooks'

/**
 * The cart: a slide-over panel above a dimmed page — never a route.
 *
 * Measured from cart(screenshot).png (1290px wide @3x, so ÷3 for CSS): the
 * panel's left edge sits at x=91 → a ~30px strip of dimmed page stays visible,
 * giving a 400px panel at the 430px reference width. The header divider falls
 * at y=247 → an 83px header. Surfaces are cooler than the violet page cards:
 * panel #1A1A24, line item #21212B, footer band #16161F.
 *
 * Mounted once in AppShell so it can open from any screen, and driven entirely
 * by the shared cart store — it holds no cart state of its own.
 */
export function CartDrawer() {
  const { items, total, itemCount, isOpen, removeItem, closeCart } = useCart()
  const { status, error, pay, reset } = useCheckout()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useDialogBehavior(isOpen, panelRef, closeCart)

  // A closed-and-reopened drawer should not still be showing the previous
  // attempt's success or failure message.
  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop. Dismissal is duplicated on the header ✕ and Esc, so this
          stays a presentational layer rather than a second focusable control. */}
      <div
        aria-hidden="true"
        onClick={closeCart}
        className="absolute inset-0 bg-black/65 motion-safe:animate-[fade-in_180ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-[min(400px,calc(100vw-30px))] flex-col bg-surface-drawer shadow-[-12px_0_40px_rgba(0,0,0,0.5)] motion-safe:animate-[slide-in-right_220ms_cubic-bezier(0.32,0.72,0,1)] sm:w-[420px]"
      >
        <header className="flex h-[83px] shrink-0 items-center justify-between gap-4 border-b border-border-drawer px-[25px]">
          <h2 id={titleId} className="text-[20px] font-bold text-text">
            Your Cart
          </h2>

          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-white/5 hover:text-text"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-[25px] py-6">
          {/* There is no success state here: paying redirects to Airpay's
              hosted page, and the outcome is confirmed on /order-success after
              the server verifies it with Airpay (AIPAY-DOCS §14.1). */}
          {itemCount === 0 ? (
            <CartEmptyState onBrowse={closeCart} />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <CartLineItem key={item.serviceId} item={item} onRemove={removeItem} />
              ))}
            </ul>
          )}
        </div>

        {/* The floor is meaningless with nothing to pay for. */}
        {itemCount > 0 && (
          <CartSummary total={total} status={status} error={error} onPay={pay} />
        )}
      </div>
    </div>
  )
}
