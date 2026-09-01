import { Check } from 'lucide-react'
import { useId } from 'react'

import type { AirpayMerchantChoice } from '@/services'

export interface CheckoutMerchantChoiceProps {
  value: AirpayMerchantChoice
  disabled?: boolean
  onChange: (merchant: AirpayMerchantChoice) => void
}

/**
 * The Airpay payment options (AIPAY-DOCS §2.4), of which only the ones listed
 * in `OFFERED` are shown.
 *
 * ⚠ Native radios in a single `name` group, so the browser itself enforces
 * that exactly one is chosen: there is no state in which both are selected and
 * no way for one checkout action to reach two merchants. The visible cards are
 * the label of their own input, which keeps the whole card clickable while the
 * control stays a real radio — arrow-key navigable, announced with its position
 * in the group, and focusable without any ARIA of our own.
 *
 * ⚠ What each option means is a server-side detail. This component knows only
 * `1` and `2`; no MID, credential or gateway URL exists in the browser, so
 * there is nothing here for a tampered client to escalate into. The selection
 * is an index the server validates against an allowlist before it maps it onto
 * credentials it holds itself.
 */
const OPTIONS: ReadonlyArray<{
  readonly value: AirpayMerchantChoice
  readonly label: string
  readonly description: string
}> = [
  {
    value: 1,
    label: 'Airpay — Option 1',
    description: 'Pay securely by card, UPI, net banking or wallet.',
  },
  {
    value: 2,
    label: 'Airpay — Option 2',
    description: 'Alternative Airpay gateway. Use this if Option 1 fails.',
  },
]

/**
 * Which of the options above are actually offered to shoppers.
 *
 * ⚠ Presentation only. Merchant 2 stays fully described above and fully
 * supported by the server — it is simply not shown yet. Re-offering it is a
 * one-line change (add `2`) with nothing else to undo.
 */
const OFFERED: ReadonlyArray<AirpayMerchantChoice> = [1]

export function CheckoutMerchantChoice({
  value,
  disabled,
  onChange,
}: CheckoutMerchantChoiceProps) {
  const groupName = useId()

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-[15px] font-semibold text-text">
        Payment method
      </legend>

      <div className="mt-3 flex flex-col gap-2.5">
        {OPTIONS.filter((option) => OFFERED.includes(option.value)).map((option) => {
          const selected = option.value === value

          return (
            <label
              key={option.value}
              className={`group flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors focus-within:ring-2 focus-within:ring-white/40 ${
                selected
                  ? 'border-white/35 bg-surface-drawer-panel'
                  : 'border-border-drawer bg-transparent hover:border-white/20'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />

              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  selected ? 'border-white bg-white text-black' : 'border-white/35'
                }`}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>

              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-text">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-text-subtle">
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
