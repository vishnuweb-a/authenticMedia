import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Small gradient count bubble — used for the header cart badge.
 *
 * The count must never be announced as a bare number; give the *control* that
 * owns this badge an aria-label such as "Cart, 1 item" and keep this decorative.
 */
export function Badge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-pill bg-gradient-primary',
        'size-5 px-1 text-[11px] leading-none font-bold text-text',
        className,
      )}
    >
      {children}
    </span>
  )
}
