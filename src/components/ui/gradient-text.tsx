import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Gradient-filled accent word.
 *
 * Always render this inside the real heading element so the full string stays
 * in the accessible name — never split a heading across two elements
 * (DESIGN-SYSTEM.md → Gradient Accent Text).
 *
 * @example <h2>Our Core <GradientText>Services</GradientText></h2>
 */
export function GradientText({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn('gradient-text', className)}>{children}</span>
}
