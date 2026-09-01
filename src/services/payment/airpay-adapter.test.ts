import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The frontend → /api/payments/create request contract.
 *
 * ⚠ Regression cover for the production failure where the server logged
 * `payment.create.contact_missing`. The UI collected an email and a phone, and
 * React state held them — but nothing proved the values survived the trip into
 * the HTTP body. Asserting on React state would have passed while the request
 * still went out contact-less.
 *
 * So these tests mock `fetch` at the network boundary and read back the actual
 * JSON that would leave the browser. No request reaches Airpay or our own API:
 * the adapter's only outbound call is the mocked fetch below, and no payment
 * is ever created.
 */

const GUEST = '11111111-1111-4111-8111-111111111111'

vi.mock('@/lib/supabase', () => ({ getGuestToken: () => GUEST }))

const { createAirpayPayment, submitToAirpay } = await import('./airpay-adapter')

interface Sent {
  url: string
  body: Record<string, unknown>
}

/** Captures the outgoing request and answers with a valid handoff. */
function captureFetch(): { sent: Sent[] } {
  const sent: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          orderRef: 'YV-TEST-0001',
          accessToken: 'tok',
          amount: 2,
          actionUrl: 'https://payments.airpay.co.in/pay?token=x',
          fields: { encdata: 'e', checksum: 'c' },
        }),
      }
    }),
  )
  return { sent }
}

function contactOf(sent: Sent): Record<string, unknown> {
  return sent.body['contact'] as Record<string, unknown>
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('the contact the shopper typed reaches the request body', () => {
  it('puts an entered email at contact.email', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: 'customer@example.com', phone: '' },
    })

    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('/api/payments/create')
    expect(contactOf(sent[0] as Sent)['email']).toBe('customer@example.com')
  })

  it('puts an entered phone at contact.phone', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: '', phone: '9876543210' },
    })

    expect(contactOf(sent[0] as Sent)['phone']).toBe('9876543210')
  })

  it('carries the name fields Airpay maps to buyer_firstname / buyer_lastname', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
    })

    const contact = contactOf(sent[0] as Sent)
    expect(contact['firstName']).toBe('Ada')
    expect(contact['lastName']).toBe('Lovelace')
  })

  it('sends the exact body shape api/payments/create.ts destructures', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: 'customer@example.com', phone: '' },
    })

    // The server reads body.serviceSlugs, body.guestToken and body.contact.*.
    // A rename on either side breaks here rather than in production.
    expect(sent[0]?.body).toMatchObject({
      serviceSlugs: ['airpay-integration-test'],
      guestToken: GUEST,
      contact: { email: 'customer@example.com' },
    })
  })
})

describe('pricing stays server-authoritative', () => {
  it('sends no amount, price, total or subtotal', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: 'customer@example.com' },
    })

    const body = sent[0]?.body ?? {}
    for (const forbidden of ['amount', 'price', 'total', 'subtotal']) {
      expect(body).not.toHaveProperty(forbidden)
    }
    // Only these three keys cross the boundary. There is deliberately no
    // merchant field: one merchant, chosen by the server from its own
    // environment, and nothing in the browser that could name or select one.
    expect(Object.keys(body).sort()).toEqual(['contact', 'guestToken', 'serviceSlugs'])
  })

  it('holds no Airpay credential or signing material', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: 'customer@example.com' },
    })

    const serialised = JSON.stringify(sent[0]?.body).toLowerCase()
    for (const forbidden of ['secret', 'password', 'checksum', 'encdata', 'mid', 'client_id']) {
      expect(serialised).not.toContain(forbidden)
    }
  })
})

describe('the request body names no merchant at all', () => {
  it('sends no merchant field — the server never offers a choice', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: 'customer@example.com' },
    })

    expect(sent[0]?.body).not.toHaveProperty('merchant')
  })

  it('sends exactly ONE request for one call', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: 'customer@example.com' },
    })

    // Two requests would mean two order rows and two hosted pages for a single
    // checkout action — the shortest path to a shopper paying twice.
    expect(sent).toHaveLength(1)
  })

  it('carries no MID, credential or gateway configuration', async () => {
    const { sent } = captureFetch()

    await createAirpayPayment({
      serviceSlugs: ['airpay-integration-test'],
      contact: { email: 'customer@example.com' },
    })

    const serialised = JSON.stringify(sent[0]?.body)
    // The live MID, the retired one, and anything shaped like a credential or
    // an override.
    for (const forbidden of [
      '368250',
      '362380',
      'AIRPAY_',
      'username',
      'password',
      'secret',
      'client_id',
      'clientId',
      'apiKey',
      'verifyUrl',
      'callbackUrl',
    ]) {
      expect(serialised).not.toContain(forbidden)
    }
  })
})

describe('submitToAirpay hands off in THIS tab (§7.6, §14.3)', () => {
  it('forwards the signed fields verbatim, into no named window', () => {
    const forms: Array<{ target: string; fields: Record<string, string> }> = []

    const doc = {
      createElement: (tag: string) => {
        if (tag === 'form') {
          const form = {
            method: '',
            action: '',
            target: '',
            style: {} as Record<string, string>,
            children: [] as Array<{ name: string; value: string }>,
            appendChild(child: { name: string; value: string }) {
              form.children.push(child)
            },
            submit() {
              const fields: Record<string, string> = {}
              for (const child of form.children) fields[child.name] = child.value
              forms.push({ target: form.target, fields })
            },
          }
          return form as unknown as HTMLFormElement
        }
        return { type: '', name: '', value: '' } as unknown as HTMLInputElement
      },
      body: { appendChild: () => {} },
    } as unknown as Document

    submitToAirpay(
      {
        orderRef: 'AM-ABCDE-12345678',
        accessToken: 'tok',
        amount: 1499,
        actionUrl: 'https://payments.airpay.co.in/pay/v4/?token=x',
        fields: { encdata: 'sealed', checksum: 'sum', merchant_id: '368250' },
      },
      doc,
    )

    expect(forms).toHaveLength(1)
    // No target: the hosted page loads in this tab, and Airpay returns the
    // browser here itself.
    expect(forms[0]?.target).toBe('')
    expect(forms[0]?.fields).toEqual({
      encdata: 'sealed',
      checksum: 'sum',
      merchant_id: '368250',
    })
  })
})
