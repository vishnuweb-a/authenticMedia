import type { Page, Request } from '@playwright/test'

import { ALL_SERVICES } from '../../src/features/services/data/catalogue.data'

/** A host that cannot resolve, so an unmocked hand-off could never reach a gateway. */
export const MOCK_GATEWAY = 'https://gateway.e2e.invalid/pay'

export interface MockOptions {
  catalogue?: 'ok' | 'error'
  createPayment?: 'ok' | 'error'
  orderStatus?: string
  /** Slugs already in the persisted cart when the page loads. */
  seedCart?: string[]
  /**
   * A service that is inactive: hidden from the catalogue read and skipped by
   * the order RPC, but still returned by get_cart (the unverified worst case).
   */
  retiredSlug?: string
  /** Overrides the server-priced amount, e.g. to simulate a price change. */
  chargedAmount?: number
  /** Whether the server offers the ISGPay sandbox to this browser. Default off. */
  isgpay?: boolean
  /** Body of /api/payments/isgpay/status (ISG references only). */
  isgpayStatus?: Record<string, unknown>
  /** Start signed in as the e2e account (default: signed in; the site is members-only). */
  signedIn?: boolean
}

/** The one account the /api/auth mock accepts. */
export const E2E_ACCOUNT = { email: 'asha@example.com', password: 'correct-horse-9' }
const E2E_USER = {
  id: 'e2e-user',
  name: 'Asha Rao',
  email: E2E_ACCOUNT.email,
  emailVerified: true,
  createdAt: '2026-11-01T00:00:00.000Z',
}

export interface MockLog {
  createPaymentBodies: Record<string, unknown>[]
  isgpayCreateBodies: Record<string, unknown>[]
  /** Raw form bodies POSTed to the (intercepted) ISGPay sandbox page. */
  isgpaySandboxPosts: string[]
  unmocked: string[]
}

export const ISGPAY_SANDBOX = 'https://sandbox.isgpay.com/ISGPay-Genius/request.action'
export const E2E_ISG_REF = 'ISG0E2ETEST0123456789ABCDEF'

const ROWS = ALL_SERVICES.map((s, i) => ({
  slug: s.id,
  title: s.title,
  description: s.description,
  subtitle: s.subtitle ?? null,
  features: s.features ?? [],
  price_inr: s.price,
  icon: s.icon,
  badge: s.badge ?? null,
  position: i,
  service_categories: { tier: s.tier },
}))

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

/**
 * Installs offline stand-ins for Supabase (catalogue + cart RPCs), the payment
 * API and the gateway. Anything else outside localhost is aborted and recorded,
 * so a test fails loudly instead of quietly reaching a real service.
 */
export async function installMocks(page: Page, options: MockOptions = {}): Promise<MockLog> {
  const log: MockLog = { createPaymentBodies: [], isgpayCreateBodies: [], isgpaySandboxPosts: [], unmocked: [] }
  const cart = new Set<string>(options.seedCart ?? [])
  const retired = options.retiredSlug
  const activeRows = ROWS.filter((r) => r.slug !== retired)
  const retiredRow = { ...ROWS[0], slug: retired ?? '', title: 'Retired Service', price_inr: 499 }

  await page.route(/supabase\.co\//, async (route, request: Request) => {
    const url = new URL(request.url())

    if (url.pathname === '/rest/v1/services') {
      if (options.catalogue === 'error') return route.fulfill(json({ message: 'down' }, 400))
      // Only active rows are readable, as with the production RLS policy.
      // `slug=eq.a` (one service) or `slug=in.(a,b)` (the cart's price check).
      const filter = url.searchParams.get('slug')
      const slugs = filter?.replace(/^eq\./, '').replace(/^in\.\((.*)\)$/, '$1').split(',').map((s) => s.replace(/^"|"$/g, ''))
      return route.fulfill(json(slugs ? activeRows.filter((r) => slugs.includes(r.slug)) : activeRows))
    }

    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/)?.[1]
    if (rpc) {
      const params = (request.postDataJSON() ?? {}) as Record<string, string>
      if (rpc === 'add_cart_item') cart.add(params.p_service_slug)
      if (rpc === 'remove_cart_item') cart.delete(params.p_service_slug)
      if (rpc === 'clear_cart') cart.clear()
      if (rpc === 'get_cart' || rpc.endsWith('_cart_item') || rpc === 'clear_cart') {
        const rows = [...ROWS, ...(retired ? [retiredRow] : [])].filter((r) => cart.has(r.slug)).map((r) => ({
          service_slug: r.slug,
          title: r.title,
          price_inr: r.price_inr,
          icon: r.icon,
        }))
        return route.fulfill(json(rpc === 'get_cart' ? rows : null))
      }
    }

    log.unmocked.push(`${request.method()} ${url.pathname}`)
    return route.fulfill(json({ message: 'unmocked in e2e' }, 501))
  })

  await page.route('**/api/payments/create', async (route, request) => {
    const body = request.postDataJSON() as Record<string, unknown>
    log.createPaymentBodies.push(body)
    if (options.createPayment === 'error') return route.fulfill(json({ error: 'x' }, 502))
    // Priced like create_airpay_order: active services only, current price.
    const slugs = (body.serviceSlugs as string[] | undefined) ?? []
    const serverAmount = activeRows.filter((r) => slugs.includes(r.slug)).reduce((sum, r) => sum + r.price_inr, 0)
    return route.fulfill(
      json({
        orderRef: 'AM-E2E-00000001',
        accessToken: 'e2e-token',
        amount: options.chargedAmount ?? serverAmount,
        actionUrl: MOCK_GATEWAY,
        fields: { mock: '1' },
        returnsToSite: true,
      }),
    )
  })

  await page.route('**/api/orders/status**', (route) =>
    route.fulfill(json({ status: options.orderStatus ?? 'paid', amount: 499, settled: true })),
  )

  await page.route('https://gateway.e2e.invalid/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mock gateway</h1>' }),
  )

  // ISGPay: availability (GET) and order creation (POST), priced like create_isgpay_order.
  await page.route('**/api/payments/isgpay/create', async (route, request) => {
    if (request.method() === 'GET') return route.fulfill(json({ available: options.isgpay === true, testMode: true }))
    const body = request.postDataJSON() as Record<string, unknown>
    log.isgpayCreateBodies.push(body)
    if (!options.isgpay) return route.fulfill(json({ error: 'not_found' }, 404))
    const slugs = (body.serviceSlugs as string[] | undefined) ?? []
    const serverAmount = activeRows.filter((r) => slugs.includes(r.slug)).reduce((sum, r) => sum + r.price_inr, 0)
    return route.fulfill(
      json({
        orderRef: E2E_ISG_REF,
        accessToken: 'e2e-isg-token',
        amount: options.chargedAmount ?? serverAmount,
        actionUrl: ISGPAY_SANDBOX,
        fields: { MerchantId: 'e2e', TerminalId: 'e2e', BankId: 'e2e', EncData: 'e2e-sealed' },
        testMode: true,
      }),
    )
  })

  await page.route('**/api/payments/isgpay/status**', (route) =>
    route.fulfill(json({ status: 'paid', amountInr: 499, settled: true, testMode: true, ...options.isgpayStatus })),
  )

  // Stateful stand-in for /api/auth (cookie session lives in this closure).
  let user = options.signedIn !== false ? { ...E2E_USER } : null
  await page.route('**/api/auth/**', async (route, request) => {
    const action = new URL(request.url()).pathname.split('/').pop()
    const body = (request.postDataJSON() ?? {}) as Record<string, string>
    if (action === 'me') return route.fulfill(json({ user }))
    if (action === 'login') {
      if (body['email'] !== E2E_ACCOUNT.email || body['password'] !== E2E_ACCOUNT.password) {
        return route.fulfill(json({ error: 'invalid_credentials' }, 401))
      }
      user = { ...E2E_USER }
      return route.fulfill(json({ user }))
    }
    if (action === 'register') {
      if (body['email']?.trim().toLowerCase() === E2E_ACCOUNT.email) {
        return route.fulfill(json({ error: 'email_taken' }, 409))
      }
      user = {
        id: 'e2e-new-user',
        name: body['fullName'] ?? '',
        email: body['email']?.trim().toLowerCase() ?? '',
        emailVerified: false,
        createdAt: '2026-11-17T00:00:00.000Z',
      }
      return route.fulfill(json({ user }, 201))
    }
    if (action === 'logout') {
      user = null
      return route.fulfill(json({ ok: true }))
    }
    if (action === 'profile' && user) {
      user = { ...user, name: body['fullName'] ?? user.name }
      return route.fulfill(json({ user }))
    }
    return route.fulfill(json({ error: 'not_found' }, 404))
  })

  // Never the real sandbox: the hosted page is replaced by a stub that records the POST.
  await page.route('https://sandbox.isgpay.com/**', (route, request) => {
    log.isgpaySandboxPosts.push(request.postData() ?? '')
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mock ISGPay sandbox</h1>' })
  })

  // Fonts and other third-party GETs are allowed; anything else external is blocked.
  await page.route(
    (url) => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname) && !/supabase\.co$|e2e\.invalid$|^sandbox\.isgpay\.com$|fonts\.(googleapis|gstatic)\.com$/.test(url.hostname),
    (route) => {
      log.unmocked.push(route.request().url())
      return route.abort()
    },
  )

  return log
}
