import { AlertCircle } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'

import { ROUTES } from '@/routes/paths'

export interface CheckoutPolicyConsentProps {
  checked: boolean
  error: string | null
  disabled?: boolean
  onChange: (checked: boolean) => void
}

const LINK = 'rounded-sm text-text-lavender underline underline-offset-2 hover:text-text'

/**
 * Explicit, unticked-by-default acceptance shown immediately above Pay Now.
 * Links open in a new tab so reading a policy never disturbs the cart.
 */
export function CheckoutPolicyConsent({
  checked,
  error,
  disabled,
  onChange,
}: CheckoutPolicyConsentProps) {
  const errorId = useId()

  return (
    <div className="mt-[18px]">
      <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-[1.55] text-text-muted">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary-start"
        />
        <span>
          I have read and agree to the{' '}
          <Link to={ROUTES.terms} target="_blank" rel="noopener" className={LINK}>
            Terms & Conditions
          </Link>{' '}
          and acknowledge the{' '}
          <Link to={ROUTES.refund} target="_blank" rel="noopener" className={LINK}>
            Refund & Cancellation Policy
          </Link>
          .
        </span>
      </label>
      <p className="mt-2 pl-7 text-[12px] text-text-subtle">
        See also our{' '}
        <Link to={ROUTES.privacy} target="_blank" rel="noopener" className={LINK}>
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link to={ROUTES.serviceDelivery} target="_blank" rel="noopener" className={LINK}>
          Service Delivery Policy
        </Link>
        .
      </p>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-2 pl-7 text-[13px] text-red-400"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
