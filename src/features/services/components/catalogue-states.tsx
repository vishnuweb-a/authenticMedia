import { AlertCircle } from 'lucide-react'

/**
 * Loading and error states for a catalogue grid.
 *
 * They occupy the same grid cell geometry as a real card so the section does
 * not jump height when data arrives, and they use the existing surface and
 * border tokens rather than introducing a new visual pattern
 * (REFERENCE-LIMITATIONS.md → rule 5).
 */

/** Placeholder cards shown while the catalogue loads. */
export function CatalogueSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex">
          <div className="h-[320px] w-full animate-pulse rounded-card border border-border/60 bg-surface/60" />
        </li>
      ))}
    </ul>
  )
}

/** Shown when the catalogue could not be loaded at all. */
export function CatalogueError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-14 flex flex-col items-center rounded-card border border-border/60 bg-surface/60 px-6 py-14 text-center"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface text-primary-mid"
      >
        <AlertCircle className="size-5" />
      </span>

      <p className="mt-4 text-[17px] font-bold text-text">We could not load the services</p>
      <p className="mt-2 max-w-[320px] text-[15px] text-text-muted">{message}</p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-pill border border-border-secondary px-6 text-[15px] font-semibold text-text transition-colors hover:bg-primary-start/10"
      >
        Try again
      </button>
    </div>
  )
}

/** Shown when the catalogue loads successfully but holds nothing. */
export function CatalogueEmpty() {
  return (
    <div className="mt-14 rounded-card border border-border/60 bg-surface/60 px-6 py-14 text-center">
      <p className="text-[17px] font-bold text-text">No services listed yet</p>
      <p className="mt-2 text-[15px] text-text-muted">Please check back shortly.</p>
    </div>
  )
}
