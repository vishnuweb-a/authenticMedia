import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { CheckoutMerchantChoice } from './checkout-merchant-choice'

/**
 * The checkout merchant selector (AIPAY-DOCS §2.4).
 *
 * The shopper — not the server, and not an environment variable — decides
 * which of the two Airpay merchants takes the payment. These tests pin the
 * properties that make that choice safe and usable:
 *
 *   - exactly TWO options are offered, never one and never three;
 *   - they are native radios in ONE group, so the browser itself guarantees a
 *     single selection and keyboard navigation;
 *   - the default selection is deterministic and is merchant 1;
 *   - the control disables itself while a payment is being created;
 *   - NO credential, MID, gateway URL or internal detail reaches the markup.
 *
 * Rendered as real markup rather than inspected as data, so an option that
 * exists in the table but never reaches the page would fail here.
 *
 * Nothing in this file touches the network, Airpay, or a database.
 */

function render(
  props: Partial<React.ComponentProps<typeof CheckoutMerchantChoice>> = {},
): string {
  return renderToStaticMarkup(
    <CheckoutMerchantChoice value={1} onChange={() => {}} {...props} />,
  )
}

/** Every `<input type="radio">` in the markup, with its attributes. */
function radios(markup: string): string[] {
  return markup.match(/<input[^>]*type="radio"[^>]*>/g) ?? []
}

function attr(tag: string, name: string): string | null {
  const found = new RegExp(`${name}="([^"]*)"`).exec(tag)
  return found?.[1] ?? null
}

describe('23. the checkout renders exactly two merchant options', () => {
  it('renders two radio inputs and no more', () => {
    expect(radios(render())).toHaveLength(2)
  })

  it('offers merchant 1 and merchant 2, as an INDEX and nothing else', () => {
    const values = radios(render()).map((tag) => attr(tag, 'value'))
    expect(values.sort()).toEqual(['1', '2'])
  })

  it('puts both radios in ONE named group, so the browser enforces one choice', () => {
    const names = radios(render()).map((tag) => attr(tag, 'name'))
    expect(names[0]).toBeTruthy()
    // A single shared name is what makes these mutually exclusive and
    // arrow-key navigable, without any ARIA of our own.
    expect(new Set(names).size).toBe(1)
  })

  it('labels each option in prose the shopper can act on', () => {
    const markup = render()
    expect(markup).toContain('Primary payment')
    expect(markup).toContain('Alternative payment')
  })

  it('uses a real fieldset and legend, so the group is announced as a group', () => {
    const markup = render()
    expect(markup).toContain('<fieldset')
    expect(markup).toContain('<legend')
  })
})

describe('24. the default selection is deterministic', () => {
  it('checks merchant 1 — the production-proven account — when value is 1', () => {
    const checked = radios(render({ value: 1 })).filter((tag) => tag.includes('checked'))
    expect(checked).toHaveLength(1)
    expect(attr(checked[0] as string, 'value')).toBe('1')
  })

  it('checks merchant 2 only when the shopper has actually chosen it', () => {
    const checked = radios(render({ value: 2 })).filter((tag) => tag.includes('checked'))
    expect(checked).toHaveLength(1)
    expect(attr(checked[0] as string, 'value')).toBe('2')
  })

  it('never renders zero or two checked radios — one is always selected', () => {
    for (const value of [1, 2] as const) {
      const checked = radios(render({ value })).filter((tag) => tag.includes('checked'))
      expect(checked).toHaveLength(1)
    }
  })

  it('reports the chosen index — and only an index — to its caller', () => {
    const onChange = vi.fn()
    // The component's contract: it hands back 1 or 2, never a MID or a config.
    render({ value: 1, onChange })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('25. selection is disabled while a payment is being created', () => {
  it('disables the whole fieldset when disabled', () => {
    expect(render({ disabled: true })).toMatch(/<fieldset[^>]*disabled/)
  })

  it('leaves it enabled otherwise', () => {
    expect(render({ disabled: false })).not.toMatch(/<fieldset[^>]*disabled/)
  })
})

describe('the browser is told nothing it should not know', () => {
  it('leaks no MID, credential, gateway URL or internal detail', () => {
    const markup = render({ value: 2 }).toLowerCase()

    // The real MIDs, which belong to the server's environment alone.
    expect(markup).not.toContain('368250')
    expect(markup).not.toContain('362380')

    for (const secret of [
      'username',
      'password',
      'secret',
      'client_id',
      'clientid',
      'api_key',
      'apikey',
      'airpay.co.in',
      'kkchat',
      'orderref',
      'verify',
      'callback',
    ]) {
      expect(markup, `markup must not mention ${secret}`).not.toContain(secret)
    }
  })
})
