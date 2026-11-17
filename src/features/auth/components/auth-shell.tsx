import type { ReactNode } from 'react'

import { Section } from '@/components/layout'
import { Card } from '@/components/ui'

interface AuthShellProps {
  title: string
  description?: string
  children: ReactNode
  /** Secondary navigation under the card, e.g. "Already have an account?". */
  footer?: ReactNode
}

/** Centered card used by every authentication screen; carries the page's single <h1>. */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <Section className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-[460px]">
        <h1 className="text-center text-[32px] sm:text-4xl">{title}</h1>
        {description && (
          <p className="mx-auto mt-4 max-w-[40ch] text-center text-[16px] leading-[1.65] text-text-muted">
            {description}
          </p>
        )}
        <Card className="mt-8 p-6 sm:p-8">{children}</Card>
        {footer && <p className="mt-6 text-center text-[15px] text-text-muted">{footer}</p>}
      </div>
    </Section>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-input border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {children}
    </p>
  )
}
