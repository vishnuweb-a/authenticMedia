import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The browser hand-off styles (AIPAY-DOCS §8.1, §14.3).
 *
 * ⚠ The failure under regression: Airpay resolves its Response URL per MID from
 * its own DASHBOARD. MID 362380 points that at KKChat at the client's explicit
 * requirement, so Airpay POSTs the BROWSER there and never navigates it back.
 * If this tab hands itself off full-screen for such an order, the shopper ends
 * on KKChat's `200 success` and /order-success never loads — which for merchant
 * 2 also means the only settlement prompt never fires.
 *
 * Nothing here reaches the network, Airpay or KKChat.
 */

const GUEST = '11111111-1111-4111-8111-111111111111'
vi.mock('@/lib/supabase', () => ({ getGuestToken: () => GUEST }))

const { createAirpayPayment, submitToAirpay, openPaymentWindow, PAYMENT_WINDOW_NAME } =
  await import('./airpay-adapter')

interface FakeForm {
  method: string
  action: string
  target: string
  style: Record<string, string>
  children: Array<{ name: string; value: string }>
  submitted: number
  appendChild(child: { name: string; value: string }): void
  submit(): void
}

/** A DOM stand-in — the suite runs on the `node` environment. */
function fakeDoc(): { doc: Document; form: FakeForm } {
  const form: FakeForm = {
    method: '',
    action: '',
    target: '',
    style: {},
    children: [],
    submitted: 0,
    appendChild(child) {
      this.children.push(child)
    },
    submit() {
      this.submitted += 1
    },
  }

  const doc = {
    createElement: (tag: string) =>
      tag === 'form' ? form : ({ type: '', name: '', value: '' } as unknown),
    body: { appendChild: () => undefined },
  } as unknown as Document

  return { doc, form }
}

const HANDOFF = {
  orderRef: 'AM2-EMF8G-22222222',
  accessToken: 'tok',
  amount: 1499,
  actionUrl: 'https://payments.airpay.co.in/pay/v4/?token=x',
  fields: { merchant_id: '362380', encdata: 'e', checksum: 'c', privatekey: 'p' },
  returnsToSite: false,
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('submitToAirpay targets the window it is told to (§14.3)', () => {
  it('defaults to this tab — merchant 1 behaviour, unchanged', () => {
    const { doc, form } = fakeDoc()
    submitToAirpay({ ...HANDOFF, returnsToSite: true }, doc)

    expect(form.method).toBe('POST')
    expect(form.action).toBe(HANDOFF.actionUrl)
    // No target: the form replaces this tab, exactly as it always has.
    expect(form.target).toBe('')
    expect(form.submitted).toBe(1)
  })

  it('POSTs into the named window when one is given', () => {
    const { doc, form } = fakeDoc()
    submitToAirpay(HANDOFF, doc, PAYMENT_WINDOW_NAME)

    expect(form.target).toBe(PAYMENT_WINDOW_NAME)
    expect(form.submitted).toBe(1)
  })

  it('forwards the signed fields verbatim in both styles (§7.6)', () => {
    for (const target of [undefined, PAYMENT_WINDOW_NAME]) {
      const { doc, form } = fakeDoc()
      submitToAirpay(HANDOFF, doc, target)

      // Nothing is renamed, reordered, dropped or re-encrypted. The browser
      // performs no cryptography and holds no credential.
      expect(form.children.map((c) => c.name)).toEqual(Object.keys(HANDOFF.fields))
      expect(form.children.map((c) => c.value)).toEqual(Object.values(HANDOFF.fields))
    }
  })
})

describe('openPaymentWindow', () => {
  it('opens a blank, FIXED-NAME window so a retry reuses it', () => {
    const calls: Array<[string, string]> = []
    const win = {
      open: (url: string, name: string) => {
        calls.push([url, name])
        return {} as Window
      },
    } as unknown as Window

    expect(openPaymentWindow(win)).not.toBeNull()
    // Blank, because the signed fields do not exist yet — it must be opened
    // inside the click gesture, before the create request is awaited.
    expect(calls).toEqual([['', PAYMENT_WINDOW_NAME]])
    // A second hand-off must land in the SAME window. Two hosted pages open on
    // one order is the shortest path to a shopper paying twice.
    openPaymentWindow(win)
    expect(calls[1]?.[1]).toBe(PAYMENT_WINDOW_NAME)
  })

  it('returns null when the browser refuses, rather than throwing', () => {
    // A blocked popup is an expected outcome on a public site, not an error.
    // The caller falls back to the full-tab hand-off.
    const blocked = { open: () => null } as unknown as Window
    expect(openPaymentWindow(blocked)).toBeNull()

    const throwing = {
      open: () => {
        throw new Error('blocked')
      },
    } as unknown as Window
    expect(openPaymentWindow(throwing)).toBeNull()
  })
})

describe('createAirpayPayment reads returnsToSite from the SERVER', () => {
  function stub(payload: Record<string, unknown>): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          orderRef: 'AM2-EMF8G-22222222',
          accessToken: 'tok',
          amount: 1499,
          actionUrl: 'https://payments.airpay.co.in/pay/v4/?token=x',
          fields: { encdata: 'e' },
          ...payload,
        }),
      })) as unknown as typeof fetch,
    )
  }

  it('carries false through for a merchant-2 order', async () => {
    stub({ returnsToSite: false })
    const result = await createAirpayPayment({ serviceSlugs: ['s'], contact: { email: 'a@b.c' } })
    expect(result.ok).toBe(true)
    expect(result.ok && result.data.returnsToSite).toBe(false)
  })

  it('carries true through for a merchant-1 order', async () => {
    stub({ returnsToSite: true })
    const result = await createAirpayPayment({ serviceSlugs: ['s'], contact: { email: 'a@b.c' } })
    expect(result.ok && result.data.returnsToSite).toBe(true)
  })

  it('defaults to the PROVEN full-tab hand-off when the field is absent', async () => {
    // An older API deployment omits it entirely. That must behave exactly as
    // before rather than silently switching merchant 1 to a popup.
    stub({})
    const result = await createAirpayPayment({ serviceSlugs: ['s'], contact: { email: 'a@b.c' } })
    expect(result.ok && result.data.returnsToSite).toBe(true)
  })
})
