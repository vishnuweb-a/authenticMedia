import type { HTMLAttributes } from 'react'

import { Container } from './container'
import { cn } from '@/lib/cn'

/**
 * A vertical page section.
 *
 * Separation between sections comes from whitespace alone — the reference has
 * no banded backgrounds or dividers, so do not add alternating section fills
 * (DESIGN-SYSTEM.md → Background System).
 */
export function Section({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('py-16 md:py-20 lg:py-24', className)} {...props}>
      <Container>{children}</Container>
    </section>
  )
}
