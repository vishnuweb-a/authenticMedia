import { Menu, Search, ShoppingCart, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { Container } from './container'
import { Logo } from './logo'
import { Badge, IconButton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PRIMARY_NAV } from '@/routes/paths'
import { useCart } from '@/stores'

/**
 * Global header: logo lockup on the left, then search / cart / hamburger.
 *
 * The reference has no bottom border — the header dissolves into the hero glow.
 * Sticky behavior is inferred (a full-page capture cannot show it); it is
 * implemented here as sticky with a blurred fill so content scrolling beneath
 * stays legible.
 */
export function Header() {
  const [isNavOpen, setIsNavOpen] = useState(false)
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
    <header className="sticky top-0 z-40 bg-header/85 backdrop-blur-md">
      <Container className="flex h-[66px] items-center justify-between gap-4">
        <Logo />

        {/* Inline navigation is an inferred desktop affordance — at the measured
            mobile width all navigation lives behind the hamburger. */}
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {PRIMARY_NAV.map((item) => (
              <li key={item.to}>
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
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <IconButton
            label="Search"
            icon={<Search className="size-5" />}
            // The search overlay was never captured open; the Search feature
            // session owns it.
            onClick={() => undefined}
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
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border lg:hidden">
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
          </Container>
        </nav>
      )}
    </header>
  )
}
