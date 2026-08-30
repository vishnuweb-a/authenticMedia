import { Check, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { ServiceIcon, isServiceIconName } from '@/components/shared'
import { useAddToCart } from '@/features/services'
import { formatInr } from '@/lib/format'
import { ROUTES } from '@/routes/paths'
import type { SearchResult } from '../types/search.types'

const MATCH_LABELS: Record<SearchResult['matchedOn'], string> = {
  title: '',
  subtitle: 'Matched subtitle',
  description: 'Matched description',
  feature: 'Matched deliverable',
}

interface SearchResultRowProps {
  result: SearchResult
  /** Closes the overlay — navigating away from a modal must dismiss it. */
  onNavigate: () => void
}

/**
 * One search hit: icon tile, title, price, and a direct add-to-cart control.
 *
 * The row itself navigates to the service on the Services page; the add button
 * is a separate control inside it, so it is deliberately **not** a nested
 * button — the row is a `<button>` and the add action sits beside it in the
 * flex row rather than within it (nested interactive elements are invalid and
 * unusable by keyboard).
 */
export function SearchResultRow({ result, onNavigate }: SearchResultRowProps) {
  const { service, matchedOn, excerpt } = result
  const { isAdded, add } = useAddToCart(service)
  const navigate = useNavigate()

  function openService() {
    onNavigate()
    // The catalogue lives on one page; the anchor scrolls to the card itself.
    navigate(`${ROUTES.services}#service-${service.id}`)
  }

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-border-drawer bg-surface-drawer-item p-3 transition-colors hover:border-border-secondary">
      <button
        type="button"
        onClick={openService}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-xl text-left"
      >
        {isServiceIconName(service.icon) && (
          <ServiceIcon
            name={service.icon}
            tile
            className="size-12 shrink-0 rounded-[15px] border-0 bg-surface-drawer-tile"
          />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-tight font-bold text-text">
            {service.title}
          </span>

          <span className="mt-1 flex items-center gap-2 text-[15px] leading-tight font-semibold text-primary-mid">
            {formatInr(service.price)}
            <span className="text-[12px] font-medium tracking-wide text-text-subtle uppercase">
              {service.tier === 'core' ? 'Core' : 'Micro'}
            </span>
          </span>

          {/* Only shown when the hit was somewhere the user cannot already see. */}
          {matchedOn !== 'title' && excerpt && (
            <span className="mt-1.5 block truncate text-[13px] text-text-subtle">
              <span className="sr-only">{MATCH_LABELS[matchedOn]}: </span>
              {excerpt}
            </span>
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={add}
        disabled={isAdded}
        aria-label={isAdded ? `${service.title} is in your cart` : `Add ${service.title} to cart`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border-secondary text-primary-mid transition-colors hover:bg-primary-start/15 disabled:border-transparent disabled:bg-primary-start/10 disabled:text-text-subtle"
      >
        {isAdded ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Plus aria-hidden="true" className="size-4" />
        )}
      </button>
    </li>
  )
}
