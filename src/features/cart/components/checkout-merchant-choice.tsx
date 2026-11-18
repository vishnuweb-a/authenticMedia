import { Check } from 'lucide-react'
import { useId } from 'react'

import type { CheckoutGateway } from '../types/cart.types'

export interface CheckoutMerchantChoiceProps {
  value: CheckoutGateway
  /** Server-decided; when false the ISGPay radio is not rendered at all. */
  isgpayAvailable?: boolean
  /**
   * Server-decided. Defaults to true: only an explicit live (false) answer
   * drops the sandbox label and warning.
   */
  isgpayTestMode?: boolean
  disabled?: boolean
  onChange: (gateway: CheckoutGateway) => void
}

/**
 * The two Airpay payment options (AIPAY-DOCS §2.4), plus the ISGPay radio
 * when the server offers it to this browser — labelled as a sandbox test
 * unless the server reports the approved production release.
 *
 * ⚠ Native radios in a single `name` group, so the browser itself enforces
 * that exactly one is chosen: there is no state in which both are selected and
 * no way for one checkout action to reach two merchants. The visible cards are
 * the label of their own input, which keeps the whole card clickable while the
 * control stays a real radio — arrow-key navigable, announced as "1 of 2", and
 * focusable without any ARIA of our own.
 *
 * ⚠ What each option means is a server-side detail. This component knows only
 * `1` and `2`; no MID, credential or gateway URL exists in the browser, so
 * there is nothing here for a tampered client to escalate into.
 *
 * Labels must differ, or a screen reader announces two identical radios. They
 * are numbered rather than described: no difference in capability between the
 * two accounts has been established, so none is claimed. The selection
 * is an index the server validates against an allowlist before it maps it onto
 * credentials it holds itself.
 */
const OPTIONS: ReadonlyArray<{
  /** The radio's DOM value; Airpay keeps its historical "1" / "2". */
  readonly key: string
  readonly gateway: CheckoutGateway
  readonly label: string
  readonly note?: string
}> = [
  {
    key: '1',
    gateway: { kind: 'airpay', merchant: 1 },
    label: 'Pay with airpay — Option 1',
  },
  {
    key: '2',
    gateway: { kind: 'airpay', merchant: 2 },
    label: 'Pay with airpay — Option 2',
  },
  {
    key: 'isgpay',
    gateway: { kind: 'isgpay' },
    label: 'Pay with ISGPay — Sandbox Test',
    note: 'Test gateway for authorised testers. No real money moves and no service is delivered.',
  },
]

/** Shown only when the server reports live (production) ISGPay. */
const ISGPAY_LIVE_LABEL = 'Pay with ISGPay'

function keyOf(gateway: CheckoutGateway): string {
  return gateway.kind === 'isgpay' ? 'isgpay' : String(gateway.merchant)
}

export function CheckoutMerchantChoice({
  value,
  isgpayAvailable = false,
  isgpayTestMode = true,
  disabled,
  onChange,
}: CheckoutMerchantChoiceProps) {
  const groupName = useId()
  const selectedKey = keyOf(value)
  const options = OPTIONS.filter((o) => isgpayAvailable || o.gateway.kind !== 'isgpay').map((o) =>
    o.gateway.kind === 'isgpay' && !isgpayTestMode ? { ...o, label: ISGPAY_LIVE_LABEL, note: undefined } : o,
  )

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-[15px] font-semibold text-text">
        Choose payment gateway
      </legend>

      <div className="mt-3 flex flex-col gap-2.5">
        {options.map((option) => {
          const selected = option.key === selectedKey

          return (
            <label
              key={option.key}
              className={`group flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 transition-colors focus-within:ring-2 focus-within:ring-primary-mid/40 ${
                selected
                  ? 'border-primary-mid bg-surface-drawer-panel'
                  : 'border-border-drawer bg-transparent hover:border-text/20'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={groupName}
                value={option.key}
                checked={selected}
                onChange={() => onChange(option.gateway)}
                className="sr-only"
              />

              <span
                aria-hidden="true"
                className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  selected ? 'border-primary-mid bg-primary-mid text-on-primary' : 'border-text/35'
                }`}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>

              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-text">
                  {option.label}
                </span>
                {option.note && (
                  <span className="mt-1 block text-[12.5px] leading-snug text-text-muted">
                    {option.note}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
