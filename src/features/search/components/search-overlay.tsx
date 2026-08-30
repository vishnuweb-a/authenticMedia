import { Loader2, Search, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'

import { useDialogBehavior } from '@/hooks'
import { ROUTES } from '@/routes/paths'
import { useSearch } from '../hooks/use-search'
import { SearchEmptyState, SearchErrorState, SearchIdleState } from './search-states'
import { SearchResultRow } from './search-result-row'

/** Prompts for the resting state — real catalogue terms, not lorem. */
const SUGGESTIONS = ['security', 'hosting', 'SEO'] as const

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Site search: a sheet that drops from under the header over a dimmed page.
 *
 * [INFERRED] — SCREEN-MAP.md names a `SearchOverlay` but it was never captured
 * open, so its surfaces, radii and spacing are taken from the one overlay that
 * *was* captured (the cart drawer) rather than invented: the same panel fill,
 * the same hairline border, the same 25px inset. It is an overlay rather than a
 * route for the same reason the cart is — it opens from any screen and leaves
 * the page beneath intact.
 */
export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const { query, setQuery, reset, status, results, error } = useSearch()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const statusId = useId()

  useDialogBehavior(isOpen, panelRef, onClose)

  // Reopening should offer a clean box, not the previous session's query.
  useEffect(() => {
    if (!isOpen) reset()
  }, [isOpen, reset])

  // The search field is the point of the overlay, so focus goes straight there
  // rather than to whichever control happens to come first in the DOM.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  const hasResults = results.length > 0
  const showEmpty = status === 'success' && !hasResults

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 motion-safe:animate-[fade-in_180ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 top-0 mx-auto flex max-h-[min(640px,100dvh)] w-full flex-col bg-surface-drawer shadow-[0_12px_40px_rgba(0,0,0,0.5)] motion-safe:animate-[slide-in-top_220ms_cubic-bezier(0.32,0.72,0,1)] sm:max-w-[640px] sm:rounded-b-card"
      >
        <h2 id={titleId} className="sr-only">
          Search services
        </h2>

        <div className="flex shrink-0 items-center gap-3 border-b border-border-drawer px-[25px] py-5">
          <Search aria-hidden="true" className="size-5 shrink-0 text-text-subtle" />

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services…"
            aria-label="Search services"
            aria-describedby={statusId}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[17px] text-text outline-none placeholder:text-text-subtle [&::-webkit-search-cancel-button]:hidden"
          />

          {status === 'searching' && (
            <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-primary-mid" />
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="-mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-pill text-text-muted transition-colors hover:bg-white/5 hover:text-text"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* Result count is announced politely so a screen-reader user learns the
            outcome without the focus ever leaving the input. */}
        <p id={statusId} role="status" aria-live="polite" className="sr-only">
          {status === 'searching'
            ? 'Searching…'
            : status === 'error'
              ? (error ?? 'Search failed.')
              : status === 'success'
                ? `${results.length} ${results.length === 1 ? 'service' : 'services'} found.`
                : ''}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-[25px] py-5">
          {status === 'error' && error ? (
            <SearchErrorState message={error} />
          ) : showEmpty ? (
            <SearchEmptyState query={query.trim()} />
          ) : hasResults ? (
            <ul className="flex flex-col gap-2.5">
              {results.map((result) => (
                <SearchResultRow
                  key={result.service.id}
                  result={result}
                  onNavigate={onClose}
                />
              ))}
            </ul>
          ) : (
            <SearchIdleState suggestions={SUGGESTIONS} />
          )}
        </div>

        {hasResults && (
          <div className="shrink-0 border-t border-border-drawer bg-surface-drawer-footer px-[25px] py-4">
            <Link
              to={ROUTES.services}
              onClick={onClose}
              className="text-[15px] font-semibold text-primary-mid transition-colors hover:text-primary-end"
            >
              Browse the full catalogue →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
