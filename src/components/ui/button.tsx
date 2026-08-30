import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * `cart` is the muted in-card pill used by core-service cards; `primary` is the
 * gradient pill used by hero CTAs and micro-service cards. Both Add-to-Cart
 * treatments exist in the reference and are deliberate hierarchy, not an
 * inconsistency — do not collapse them (DESIGN-SYSTEM.md → Button / CTA System).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'cart' | 'ghost'

/** `lg` is the measured 62px hero CTA; `sm` the ~36px in-card pill. */
export type ButtonSize = 'lg' | 'sm'

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-primary text-text font-bold shadow-glow-primary hover:brightness-108 active:scale-[0.98]',
  secondary:
    'bg-transparent text-text font-semibold border border-border-secondary hover:bg-primary-start/10 active:scale-[0.98]',
  cart: 'bg-surface-cta-muted text-text-violet font-bold border border-primary-start/30 hover:brightness-115 active:scale-[0.98]',
  ghost: 'bg-transparent text-text-muted font-semibold hover:text-text',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  lg: 'h-[62px] px-8 text-base',
  sm: 'h-9 px-6 text-sm',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  /** Rendered after the label, e.g. the "@₹849" price on Add-to-Cart pills. */
  trailing?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'lg',
  isLoading = false,
  trailing,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      // Width is preserved while loading so the pill does not jump.
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-pill whitespace-nowrap',
        'transition-[filter,transform,background-color] duration-150',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {isLoading && (
        <>
          <Spinner />
          <span className="sr-only">Loading</span>
        </>
      )}
      {/* Kept in flow while loading so the pill does not change width. */}
      <span
        aria-hidden={isLoading || undefined}
        className={cn('inline-flex items-center gap-2', isLoading && 'invisible')}
      >
        {children}
        {trailing}
      </span>
    </button>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="absolute size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}
