import { ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ROUTES } from '@/routes/paths'

/**
 * Shown when the cart reaches zero items. [INFERRED] — the capture only shows
 * the populated cart, so this is built from the drawer's own visual language
 * (the same tile, the same muted body copy) rather than invented as a separate
 * marketing panel.
 */
export function CartEmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center px-2 py-14 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-14 items-center justify-center rounded-2xl bg-surface-drawer-tile text-primary-mid"
      >
        <ShoppingCart className="size-6" />
      </span>

      <p className="mt-5 text-[17px] font-bold text-text">Your cart is empty</p>

      <p className="mt-2 max-w-[240px] text-[15px] text-text-muted">
        Add a service to see it here and continue to checkout.
      </p>

      {/* Navigating away from a modal should close it, so the drawer does not
          stay open over a page the user just moved to. */}
      <Link
        to={ROUTES.services}
        onClick={onBrowse}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-pill border border-border-secondary px-6 text-[15px] font-semibold text-text transition-colors hover:bg-primary-start/10"
      >
        Browse services
      </Link>
    </div>
  )
}
