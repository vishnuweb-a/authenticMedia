/**
 * Every route in the application.
 *
 * The cart is deliberately absent: it is a slide-over drawer that opens from
 * any screen, not a route (SCREEN-MAP.md → Cart).
 */
export const ROUTES = {
  home: '/',
  services: '/services',
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy',
  refund: '/refund',
  orderSuccess: '/order-success',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

export interface NavLinkItem {
  label: string
  to: RoutePath
}

/** Primary navigation — the hamburger drawer at mobile, inline links at lg. */
export const PRIMARY_NAV: readonly NavLinkItem[] = [
  { label: 'Home', to: ROUTES.home },
  { label: 'Services', to: ROUTES.services },
  { label: 'About Us', to: ROUTES.about },
  { label: 'Contact Us', to: ROUTES.contact },
]

/** Footer "Quick Links" — the labels and order are verified on contact-us. */
export const FOOTER_LINKS: readonly NavLinkItem[] = [
  { label: 'Homepage', to: ROUTES.home },
  { label: 'Services', to: ROUTES.services },
  { label: 'About Us', to: ROUTES.about },
  { label: 'Contact Us', to: ROUTES.contact },
  { label: 'Terms & Conditions', to: ROUTES.terms },
  { label: 'Privacy Policy', to: ROUTES.privacy },
  { label: 'Refund & Cancellation', to: ROUTES.refund },
]
