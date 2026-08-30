import type { ElementType, HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
}

/**
 * Centered content column.
 *
 * The 24px mobile gutter is measured; the wider gutters and the 1200px cap are
 * inferred extensions of the mobile language — no desktop reference exists
 * (REFERENCE-LIMITATIONS.md → Mobile-only References).
 */
export function Container({ as: Component = 'div', className, ...props }: ContainerProps) {
  return (
    <Component
      className={cn('mx-auto w-full max-w-[1200px] px-6 md:px-8 lg:px-12', className)}
      {...props}
    />
  )
}
