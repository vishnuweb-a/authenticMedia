import { ChevronDown, Menu, Search, ShoppingCart, X } from 'lucide-react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { AccountMenu, MobileAccountLinks } from './account-menu'
import { Container } from './container'
import { Logo } from './logo'
import { Badge, IconButton } from '@/components/ui'
// Imported from the content module, not the feature barrel: the barrel pulls in
// LegalPageLayout, which imports this layout folder back.
import { POLICIES } from '@/features/legal/content/policies'
import { SearchOverlay } from '@/features/search'
import { cn } from '@/lib/cn'
import { PRIMARY_NAV, ROUTES } from '@/routes/paths'
import { useCart } from '@/stores'

/**
 * Global header: logo lockup on the left, then search / cart / hamburger.
 *
 * A hairline separates it from content on the light theme.
 * Sticky behavior is inferred (a full-page capture cannot show it); it is
 * implemented here as sticky with a blurred fill so content scrolling beneath
 * stays legible.
 */
export function Header() {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { itemCount, openCart } = useCart()

  useEffect(() => {
    if (!isNavOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsNavOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isNavOpen])

  const cartLabel = itemCount === 1 ? 'Cart, 1 item' : `Cart, ${itemCount} items`

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-header/85 backdrop-blur-md">
      <Container className="flex h-[66px] items-center justify-between gap-4">
        <Logo />

        {/* Inline navigation is an inferred desktop affordance — at the measured
            mobile width all navigation lives behind the hamburger. */}
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {PRIMARY_NAV.map((item) => (
              <Fragment key={item.to}>
                {item.to === ROUTES.contact && <PoliciesMenu />}
                <li>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'rounded-md text-[15px] font-medium transition-colors',
                        isActive ? 'text-text' : 'text-text-muted hover:text-text',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              </Fragment>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="mr-2 hidden sm:block">
            <AccountMenu />
          </div>

          <IconButton
            label="Search services"
            aria-expanded={isSearchOpen}
            icon={<Search className="size-5" />}
            onClick={() => {
              // Two overlays at once would fight over the focus trap.
              setIsNavOpen(false)
              setIsSearchOpen(true)
            }}
          />

          <IconButton
            label={cartLabel}
            onClick={openCart}
            icon={
              <>
                <ShoppingCart className="size-5" />
                {itemCount > 0 && <Badge className="absolute -top-1 -right-1">{itemCount}</Badge>}
              </>
            }
          />

          <IconButton
            label={isNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isNavOpen}
            aria-controls="mobile-nav"
            ring={false}
            className="ml-2 lg:hidden"
            onClick={() => setIsNavOpen((open) => !open)}
            icon={isNavOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          />
        </div>
      </Container>

      {/*
        Minimal mobile navigation. The reference never captured this drawer open,
        so it is intentionally plain — a feature session can restyle it without
        touching the header shell.
      */}
      {isNavOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          // The header is sticky, so a menu taller than the screen must scroll itself.
          className="max-h-[calc(100dvh-66px)] overflow-y-auto border-t border-border lg:hidden"
        >
          <Container className="py-4">
            <ul className="flex flex-col">
              {PRIMARY_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={() => setIsNavOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-2 py-3 text-base font-medium transition-colors',
                        isActive ? 'text-text' : 'text-text-muted hover:text-text',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <MobileAccountLinks onNavigate={() => setIsNavOpen(false)} />

            <div className="mt-2 border-t border-border pt-4">
              <h2 className="px-2 text-[13px] font-bold tracking-[0.12em] text-primary-mid uppercase">
                Policies
              </h2>
              <ul className="mt-1 flex flex-col">
                {[{ title: 'All policies', path: ROUTES.policies }, ...POLICIES].map((policy) => (
                  <li key={policy.path}>
                    <NavLink
                      to={policy.path}
                      onClick={() => setIsNavOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-2 py-2.5 text-[15px] font-medium transition-colors',
                          isActive ? 'text-text' : 'text-text-muted hover:text-text',
                        )
                      }
                    >
                      {policy.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </nav>
      )}

      {/* Rendered from the header because the button that opens it lives here,
          and the sheet drops from the header edge. */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  )
}

/**
 * Desktop "Policies" disclosure menu (WAI-ARIA disclosure navigation pattern):
 * a real button that toggles a list of real links. Tab moves through the links,
 * Escape closes and returns focus to the button, and it closes when focus or a
 * click lands outside it.
 */
function PoliciesMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const itemRef = useRef<HTMLLIElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const isActive =
    pathname === ROUTES.policies || POLICIES.some((policy) => policy.path === pathname)

  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      buttonRef.current?.focus()
    }
    function onPointerDown(event: PointerEvent) {
      if (!itemRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isOpen])

  return (
    <li
      ref={itemRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls="policies-menu"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md text-[15px] font-medium transition-colors',
          isActive || isOpen ? 'text-text' : 'text-text-muted hover:text-text',
        )}
      >
        Policies
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      <ul
        id="policies-menu"
        hidden={!isOpen}
        className="absolute top-full right-0 z-50 mt-3 w-64 rounded-2xl border border-border bg-surface p-2 shadow-lg"
      >
        {POLICIES.map((policy) => (
          <li key={policy.path}>
            <NavLink
              to={policy.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive: isCurrent }) =>
                cn(
                  'block rounded-lg px-3 py-2 text-[15px] font-medium transition-colors hover:bg-primary-start/10 hover:text-text',
                  isCurrent ? 'text-text' : 'text-text-muted',
                )
              }
            >
              {policy.title}
            </NavLink>
          </li>
        ))}
        <li className="mt-1 border-t border-border pt-1">
          <NavLink
            to={ROUTES.policies}
            onClick={() => setIsOpen(false)}
            className="block rounded-lg px-3 py-2 text-[15px] font-semibold text-primary-mid transition-colors hover:bg-primary-start/10"
          >
            All policies
          </NavLink>
        </li>
      </ul>
    </li>
  )
}
