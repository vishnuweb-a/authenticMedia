import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: every icon-only control needs an accessible name. */
  label: string
  icon: ReactNode
  /** The header's circular controls carry a faint violet ring. */
  ring?: boolean
}

export function IconButton({
  label,
  icon,
  ring = true,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'relative inline-flex size-11 shrink-0 items-center justify-center rounded-pill',
        'text-text transition-colors hover:bg-primary-start/12',
        ring && 'border border-border',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}
