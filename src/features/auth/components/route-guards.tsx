import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { Section } from '@/components/layout'
import { ROUTES } from '@/routes/paths'
import { useAuth } from '@/stores'
import { safeRedirect } from '../lib/safe-redirect'

function Pending() {
  return (
    <Section>
      <p role="status" className="text-center text-text-muted">
        Loading…
      </p>
    </Section>
  )
}

/**
 * Router state carried into /login and /register, and back out of them.
 * `checkout`: sign-in was started from the cart's checkout step.
 * `resumeCheckout`: set on the return trip so the cart reopens once (never pays).
 */
export interface AuthRouteState {
  from?: unknown
  checkout?: unknown
  resumeCheckout?: unknown
}

/**
 * UX guard only — it hides pages from signed-out visitors. Anything that must
 * be private is enforced by the server / RLS, never by this component.
 */
export function RequireAuth() {
  const { user, isLoading, signedOut } = useAuth()
  const location = useLocation()

  if (isLoading) return <Pending />
  // Signing out on a private page goes home (as the header does), not to login.
  if (!user && signedOut) return <Navigate to={ROUTES.home} replace />
  if (!user) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    )
  }
  return <Outlet />
}

/**
 * Signed-in users are sent on to where they were going, or to the account page.
 * From checkout, the fallback is home (never /account) and the cart reopens there.
 */
export function GuestOnly() {
  const { user, isLoading } = useAuth()
  const { state } = useLocation() as { state: AuthRouteState | null }

  if (isLoading) return <Pending />
  if (user) {
    const fromCheckout = state?.checkout === true
    return (
      <Navigate
        to={safeRedirect(state?.from, fromCheckout ? ROUTES.home : ROUTES.account)}
        replace
        state={fromCheckout ? ({ resumeCheckout: true } satisfies AuthRouteState) : null}
      />
    )
  }
  return <Outlet />
}
