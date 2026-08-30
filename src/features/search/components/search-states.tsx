import { AlertCircle, SearchX, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * The overlay's non-result panels, sharing one silhouette so the body does not
 * jump as the user types. Built from the drawer's visual language — the same
 * tile, the same muted copy — rather than as three unrelated designs.
 */
function StatePanel({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-2 py-12 text-center">
      <span
        aria-hidden="true"
        className="inline-flex size-14 items-center justify-center rounded-2xl bg-surface-drawer-tile text-primary-mid"
      >
        {icon}
      </span>

      <p className="mt-5 text-[17px] font-bold text-text">{title}</p>

      <div className="mt-2 max-w-[280px] text-[15px] text-text-muted">{children}</div>
    </div>
  )
}

/** Resting state: nothing typed yet. */
export function SearchIdleState({ suggestions }: { suggestions: readonly string[] }) {
  return (
    <StatePanel icon={<Sparkles className="size-6" />} title="Search our services">
      Find a service by name, what it covers, or what it delivers — try{' '}
      {suggestions.map((term, index) => (
        <span key={term}>
          {index > 0 && index === suggestions.length - 1 ? ' or ' : index > 0 ? ', ' : ''}
          <span className="font-semibold text-text-violet">“{term}”</span>
        </span>
      ))}
      .
    </StatePanel>
  )
}

/** A valid search that simply matched nothing. */
export function SearchEmptyState({ query }: { query: string }) {
  return (
    <StatePanel icon={<SearchX className="size-6" />} title="No services found">
      Nothing matches <span className="font-semibold text-text">“{query}”</span>. Try a broader
      term, or browse the full catalogue.
    </StatePanel>
  )
}

/** The search call itself failed. */
export function SearchErrorState({ message }: { message: string }) {
  return (
    <StatePanel icon={<AlertCircle className="size-6" />} title="Search unavailable">
      {message} Please try again in a moment.
    </StatePanel>
  )
}
