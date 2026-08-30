import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds the inferred hover lift + border brighten. Off by default. */
  interactive?: boolean
}

/**
 * The dominant repeated surface: 24px radius, 28px padding, and a hairline
 * border that reads as an edge-catch rather than a drawn line. The border is
 * deliberately near-invisible — never raise it to a solid violet stroke
 * (DESIGN-SYSTEM.md → Border System).
 */
export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface p-7',
        interactive &&
          'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary-start/45 hover:shadow-[var(--glow-card-hover)] motion-reduce:hover:translate-y-0',
        className,
      )}
      {...props}
    />
  )
}
