import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

import { Footer } from './footer'
import { Header } from './header'

/**
 * The persistent page frame: header, routed main content, footer.
 *
 * The hero glow is painted here as a fixed backdrop rather than per page so it
 * stays anchored top-centre and scales with the viewport, matching the single
 * continuous radial light source in the reference.
 */
export function AppShell() {
  const { pathname } = useLocation()

  // React Router preserves scroll position across navigations; each page should
  // start at the top.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden="true"
        className="bg-hero-glow pointer-events-none fixed inset-x-0 top-0 -z-10 h-[720px]"
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-pill focus:bg-surface focus:px-4 focus:py-2 focus:text-text"
      >
        Skip to content
      </a>

      <Header />

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}
