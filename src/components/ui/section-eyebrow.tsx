import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * The pill label that opens every section.
 *
 * Rendered as a <p>, never a heading: it is decorative labelling and must not
 * enter the document outline (DESIGN-SYSTEM.md → Eyebrow Badges).
 *
 * The label is lavender #C4B5FD, not white. DESIGN-SYSTEM.md specifies white,
 * but the pill text samples #C4B5FD on the WHAT WE OFFER badge (home.png) and
 * on both Contact eyebrows — the screenshot wins (AGENTS.md §4).
 */
export function SectionEyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'inline-flex items-center rounded-pill border border-border-strong bg-surface-badge',
        'px-5 py-2 text-xs font-bold tracking-[0.12em] text-text-lavender uppercase',
        className,
      )}
    >
      {children}
    </p>
  )
}
