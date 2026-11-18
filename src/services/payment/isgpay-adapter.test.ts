import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The browser → /api/payments/isgpay/* contract. fetch is mocked at the
 * network boundary; nothing reaches ISGPay, our API or a database.
 */

const GUEST = '11111111-1111-4111-8111-111111111111'
vi.mock('@/lib/supabase', () => ({ getGuestToken: () => GUEST }))

const {
  createIsgpayPayment,
  fetchIsgpayAvailability,
  fetchIsgpayOrderStatus,
  ISGPAY_PRODUCTION_URL,
  ISGPAY_SANDBOX_URL,
  submitToIsgpay,
} = await import('./isgpay-adapter')

const REF = 'ISG0MABCDEF0123456789ABCDEF'

const HANDOFF = {
  orderRef: REF,
  accessToken: 'tok-uuid',
  amount: 648,
  actionUrl: 'https://sandbox.isgpay.com/ISGPay-Genius/request.action',
  fields: { MerchantId: 'm', TerminalId: 't', BankId: 'b', EncData: 'sealed' },
  testMode: true,
}

function respond(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

interface Sent {
  url: string
  init: RequestInit | undefined
}

function stubFetch(answer: (url: string) => Response | Promise<Response>): Sent[] {
  const sent: Sent[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      sent.push({ url, init })
      return answer(url)
    }),
  )
  return sent
}

const INPUT = {
  serviceSlugs: ['website-security-audit', 'seo-audit'],
  contact: { firstName: 'Test', lastName: 'Customer', email: 'test@example.com', phone: '9999999999' },
}

beforeEach(() => vi.unstubAllGlobals())

describe('createIsgpayPayment', () => {
  it('POSTs slugs, guest token and contact to the ISGPay create endpoint — no amount, no secret', async () => {
    const sent = stubFetch(() => respond(HANDOFF))
    const result = await createIsgpayPayment(INPUT)
    expect(result.ok).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('/api/payments/isgpay/create')
    expect(sent[0]?.init?.method).toBe('POST')
    const body = JSON.parse(String(sent[0]?.init?.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['contact', 'guestToken', 'serviceSlugs'])
    expect(body['guestToken']).toBe(GUEST)
    expect(JSON.stringify(body)).not.toMatch(/amount|price|merchant|secret|passcode|bankid|terminal|isgpay\.com/i)
  })

  it('never calls the Airpay endpoint', async () => {
    const sent = stubFetch(() => respond(HANDOFF))
    await createIsgpayPayment(INPUT)
    expect(sent.some((s) => s.url === '/api/payments/create')).toBe(false)
  })

  it('refuses a hand-off that points anywhere but the pinned sandbox URL', async () => {
    for (const actionUrl of [
      'https://evil.example/request.action',
      'https://sandbox.isgpay.com/ISGPay-Genius/request.action?x=1',
      'http://sandbox.isgpay.com/ISGPay-Genius/request.action',
    ]) {
      stubFetch(() => respond({ ...HANDOFF, actionUrl }))
      expect((await createIsgpayPayment(INPUT)).ok).toBe(false)
    }
  })

  it('refuses malformed gateway responses', async () => {
    for (const bad of [
      { ...HANDOFF, orderRef: 'AM-ABCDE-12345678' },
      { ...HANDOFF, amount: '648' },
      { ...HANDOFF, accessToken: undefined },
      { ...HANDOFF, fields: { EncData: 1 } },
    ]) {
      stubFetch(() => respond(bad))
      expect((await createIsgpayPayment(INPUT)).ok).toBe(false)
    }
    stubFetch(() => respond({ error: 'not_found' }, 404))
    expect((await createIsgpayPayment(INPUT)).ok).toBe(false)
  })
})

describe('unresolved earlier payment', () => {
  it('a 409 from the server becomes a wait-and-do-not-pay-again message, never a hand-off', async () => {
    stubFetch(() => new Response(JSON.stringify({ error: 'payment_unresolved' }), { status: 409 }))
    const result = await createIsgpayPayment(INPUT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('payment_unresolved')
      expect(result.error.message).toMatch(/charged twice/)
    }
  })
})

describe('submitToIsgpay', () => {
  it('auto-submits a hidden POST form to the sandbox in THIS tab, fields verbatim', () => {
    const forms: Array<{ method: string; action: string; target: string; hidden: boolean; fields: Record<string, string> }> = []
    const doc = {
      createElement: (tag: string) => {
        if (tag !== 'form') return { type: '', name: '', value: '' }
        const form = {
          method: '',
          action: '',
          target: '',
          style: {} as Record<string, string>,
          children: [] as Array<{ type: string; name: string; value: string }>,
          appendChild(child: { type: string; name: string; value: string }) {
            form.children.push(child)
          },
          submit() {
            forms.push({
              method: form.method,
              action: form.action,
              target: form.target,
              hidden: form.style['display'] === 'none' && form.children.every((c) => c.type === 'hidden'),
              fields: Object.fromEntries(form.children.map((c) => [c.name, c.value])),
            })
          },
        }
        return form
      },
      body: { appendChild: () => {} },
    } as unknown as Document

    submitToIsgpay({ ...HANDOFF, actionUrl: ISGPAY_SANDBOX_URL }, doc)
    expect(forms).toEqual([
      { method: 'POST', action: ISGPAY_SANDBOX_URL, target: '', hidden: true, fields: HANDOFF.fields },
    ])
  })
})

describe('one click, one ISGPay order', () => {
  it('three rapid clicks create ONE order (same pending guard as the hook)', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const sent = stubFetch(async () => {
      await gate
      return respond(HANDOFF)
    })
    let pending = false
    const pay = async () => {
      if (pending) return
      pending = true
      await createIsgpayPayment(INPUT)
    }
    const clicks = [pay(), pay(), pay()]
    release()
    await Promise.all(clicks)
    expect(sent).toHaveLength(1)
  })
})

describe('fetchIsgpayAvailability', () => {
  const NO = { available: false, testMode: true }

  it('available only for an explicit {available: true}', async () => {
    stubFetch(() => respond({ available: true, testMode: true }))
    expect(await fetchIsgpayAvailability()).toEqual({ available: true, testMode: true })
    stubFetch(() => respond({ available: 'yes' }))
    expect(await fetchIsgpayAvailability()).toEqual(NO)
    stubFetch(() => respond({}, 500))
    expect(await fetchIsgpayAvailability()).toEqual(NO)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await fetchIsgpayAvailability()).toEqual(NO)
  })

  it('is live only on an explicit testMode: false; anything else is the sandbox', async () => {
    stubFetch(() => respond({ available: true, testMode: false }))
    expect(await fetchIsgpayAvailability()).toEqual({ available: true, testMode: false })
    stubFetch(() => respond({ available: true }))
    expect(await fetchIsgpayAvailability()).toEqual({ available: true, testMode: true })
    stubFetch(() => respond({ available: true, testMode: 'false' }))
    expect(await fetchIsgpayAvailability()).toEqual({ available: true, testMode: true })
  })
})

describe('production hand-off pinning', () => {
  it('accepts the live Sale URL only for a live (testMode false) order', async () => {
    stubFetch(() => respond({ ...HANDOFF, testMode: false, actionUrl: ISGPAY_PRODUCTION_URL }))
    const live = await createIsgpayPayment(INPUT)
    expect(live.ok && live.data.actionUrl).toBe(ISGPAY_PRODUCTION_URL)
    expect(live.ok && live.data.testMode).toBe(false)
  })

  it('refuses a mismatched mode/URL pair either way', async () => {
    stubFetch(() => respond({ ...HANDOFF, testMode: true, actionUrl: ISGPAY_PRODUCTION_URL }))
    expect((await createIsgpayPayment(INPUT)).ok).toBe(false)
    stubFetch(() => respond({ ...HANDOFF, testMode: false, actionUrl: ISGPAY_SANDBOX_URL }))
    expect((await createIsgpayPayment(INPUT)).ok).toBe(false)
    stubFetch(() => respond({ ...HANDOFF, testMode: false, actionUrl: 'https://evil.example/request.action' }))
    expect((await createIsgpayPayment(INPUT)).ok).toBe(false)
  })
})

describe('fetchIsgpayOrderStatus', () => {
  const status = (body: Record<string, unknown>) => {
    const sent = stubFetch(() => respond({ orderRef: REF, amountInr: 149, testMode: true, ...body }))
    return { sent, run: () => fetchIsgpayOrderStatus(REF, 'tok-uuid') }
  }

  it('asks the ISGPay status endpoint, never the Airpay one', async () => {
    const { sent, run } = status({ status: 'paid', settled: true })
    await run()
    expect(sent[0]?.url).toBe(`/api/payments/isgpay/status?ref=${REF}&t=tok-uuid`)
  })

  it('reflects a server-verified paid order, flagged as a sandbox test', async () => {
    const { run } = status({ status: 'paid', settled: true })
    expect(await run()).toEqual({ orderRef: REF, state: 'paid', amount: 149, settled: true, testMode: true })
  })

  it('never reports paid while the row is unpaid, whatever the gateway summary says', async () => {
    const { run } = status({
      status: 'pending_payment',
      settled: false,
      verification: { outcome: 'pending', reason: 'hash_mismatch', gateway: { responseCode: '00' } },
    })
    const r = await run()
    expect(r?.state).toBe('checking')
    expect(r?.settled).toBe(false)
  })

  it('a verified decline stops polling as "declined", not "failed"', async () => {
    const { run } = status({ status: 'pending_payment', settled: false, verification: { outcome: 'declined_pending' } })
    const r = await run()
    expect(r?.state).toBe('declined')
    expect(r?.settled).toBe(true)
  })

  it('a production order (server testMode false) is not flagged as a test', async () => {
    const { run } = status({ status: 'paid', settled: true, testMode: false })
    expect((await run())?.testMode).toBe(false)
  })

  it('a missing testMode is treated as a sandbox test, never as a purchase', async () => {
    const { run } = status({ status: 'paid', settled: true, testMode: undefined })
    expect((await run())?.testMode).toBe(true)
  })

  it('amount mismatch surfaces as requires-review', async () => {
    const { run } = status({ status: 'requires_review', settled: true })
    expect((await run())?.state).toBe('requires-review')
  })
})
