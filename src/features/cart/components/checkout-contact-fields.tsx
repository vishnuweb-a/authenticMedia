import { Input } from '@/components/ui'
import type { CheckoutContactErrors, CheckoutContactValues } from '../lib/contact'

export interface CheckoutContactFieldsProps {
  values: CheckoutContactValues
  errors: CheckoutContactErrors
  disabled?: boolean
  onChange: (field: keyof CheckoutContactValues, value: string) => void
}

/**
 * The contact block above the drawer's payment panel.
 *
 * ⚠ Airpay's hosted page refuses a payment carrying neither an email nor a
 * phone number ("Either email or contact number is mandatory"), so one of the
 * two must be collected before the handoff (AIPAY-DOCS §7.3). Name is optional
 * and only fills `buyer_firstname` / `buyer_lastname`.
 *
 * Nothing here is stored beyond the order row the payment creates — the fields
 * exist so Airpay can reach the shopper about their payment, not to build a
 * profile.
 */
export function CheckoutContactFields({
  values,
  errors,
  disabled,
  onChange,
}: CheckoutContactFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-subtle">
        Airpay needs an email address or a phone number to send your payment
        receipt. One is enough.
      </p>

      <Input
        label="Name (optional)"
        type="text"
        autoComplete="name"
        value={values.name}
        disabled={disabled}
        onChange={(event) => onChange('name', event.target.value)}
      />

      <Input
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        disabled={disabled}
        onChange={(event) => onChange('email', event.target.value)}
      />

      <Input
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        error={errors.phone}
        disabled={disabled}
        onChange={(event) => onChange('phone', event.target.value)}
      />
    </div>
  )
}
