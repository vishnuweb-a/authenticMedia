import { LockKeyhole } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

import type { AuthRouteState } from '@/features/auth'
import { formatInr } from '@/lib/format'
import { ROUTES } from '@/routes/paths'

const PILL =
  'inline-flex h-11 flex-1 items-center justify-center rounded-pill px-5 text-[15px] whitespace-nowrap transition-[filter,background-color] duration-150'

export interface CheckoutSignInPromptProps {
  total: number
  /** Closes the drawer as the shopper leaves for the auth page. */
  onNavigate: () => void
}

/**
 * The drawer floor for a signed-out shopper: the same Total row as CartSummary,
 * then a sign-in step in place of the payment panel. Nothing here can start a
 * payment, and the cart itself is untouched (it is persisted server-side under
 * the guest token, so it survives the trip to /login or /register).
 */
export function CheckoutSignInPrompt({ total, onNavigate }: CheckoutSignInPromptProps) {
  const location = useLocation()
  const state: AuthRouteState = {
    from: `${location.pathname}${location.search}${location.hash}`,
    checkout: true,
  }

  return (
    <div className="border-t border-border-drawer bg-surface-drawer-footer px-[25px] pt-[22px] pb-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[21px] font-bold text-text">Total</p>
        <p className="text-[21px] font-bold text-text">{formatInr(total)}</p>
      </div>

      <section
        aria-labelledby="checkout-sign-in-title"
        className="mt-[22px] rounded-2xl border border-border-drawer bg-surface-drawer-panel p-5"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-drawer-tile text-primary-mid"
          >
            <LockKeyhole className="size-5" />
          </span>
          <div>
            <h3 id="checkout-sign-in-title" className="text-[17px] font-bold text-text">
              Sign in to continue
            </h3>
            <p className="mt-1 text-[14px] text-text-muted">
              Please sign in or create an account to proceed with your checkout. Your selected
              services will be saved.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to={ROUTES.login}
            state={state}
            onClick={onNavigate}
            className={`${PILL} bg-gradient-primary font-bold text-on-primary shadow-glow-primary hover:brightness-108`}
          >
            Sign In
          </Link>
          <Link
            to={ROUTES.register}
            state={state}
            onClick={onNavigate}
            className={`${PILL} border border-border-secondary font-semibold text-text hover:bg-primary-start/10`}
          >
            Create Account
          </Link>
        </div>
      </section>
    </div>
  )
}
