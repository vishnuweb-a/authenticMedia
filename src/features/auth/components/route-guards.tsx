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
 * UX guard only — it hides pages from signed-out visitors. Anything that must
 * be private is enforced by the server / RLS, never by this component.
 */
export function RequireAuth() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <Pending />
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

/** Signed-in users are sent on to where they were going, or to the account page. */
export function GuestOnly() {
  const { user, isLoading } = useAuth()
  const { state } = useLocation() as { state: { from?: unknown } | null }

  if (isLoading) return <Pending />
  if (user) return <Navigate to={safeRedirect(state?.from)} replace />
  return <Outlet />
}
