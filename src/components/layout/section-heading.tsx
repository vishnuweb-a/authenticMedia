import type { ReactNode } from 'react'

import { SectionEyebrow } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface SectionHeadingProps {
  eyebrow?: string
  /** Pass the gradient accent word as <GradientText> inside this node. */
  title: ReactNode
  description?: ReactNode
  /** Renders the short gradient rule seen beneath page-hero headings. */
  rule?: boolean
  as?: 'h1' | 'h2'
  className?: string
}

/**
 * The eyebrow → accent heading → muted sub-copy block that opens every section.
 *
 * Centered, with body copy constrained so it breaks near three lines at mobile
 * width, matching the reference rhythm.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  rule = false,
  as: Heading = 'h2',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-col items-center gap-5 text-center', className)}>
      {eyebrow && <SectionEyebrow>{eyebrow}</SectionEyebrow>}

      <Heading
        className={cn(
          'max-w-3xl',
          Heading === 'h1'
            ? 'text-[40px] sm:text-5xl lg:text-6xl'
            : 'text-[32px] sm:text-4xl lg:text-5xl',
        )}
      >
        {title}
      </Heading>

      {description && (
        <p className="max-w-2xl text-[17px] text-text-muted">{description}</p>
      )}

      {rule && (
        <span
          aria-hidden="true"
          className="bg-gradient-primary mt-1 h-0.5 w-16 rounded-pill"
        />
      )}
    </div>
  )
}
