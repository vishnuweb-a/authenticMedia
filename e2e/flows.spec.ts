import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { ALL_SERVICES } from '../src/features/services/data/catalogue.data'
import { E2E_ACCOUNT, E2E_ISG_REF, installMocks, ISGPAY_SANDBOX, MOCK_GATEWAY } from './support/mocks'

async function shot(page: Page, project: string, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${project}/${name}.png` })
}

async function seriousAxe(page: Page, include: string) {
  const r = await new AxeBuilder({ page }).include(include).withTags(['wcag2a', 'wcag2aa']).analyze()
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)
}

async function openCart(page: Page) {
  await page.getByRole('button', { name: /^Cart,/ }).click()
  return page.getByRole('dialog')
}

test.describe('catalogue and cart', () => {
  test('loads the catalogue, adds, updates and removes cart items', async ({ page }, info) => {
    const log = await installMocks(page)
    await page.goto('/services')

    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    await expect(page.getByRole('button', { name: 'Tech Maintenance added to cart' })).toBeVisible()
    await page.getByRole('button', { name: 'Add Website Health Check to cart' }).click()
    await expect(page.getByRole('button', { name: 'Cart, 2 items' })).toBeVisible()

    const drawer = await openCart(page)
    await expect(drawer.getByText('Tech Maintenance')).toBeVisible()
    await expect(drawer.getByText('Website Health Check')).toBeVisible()
    await shot(page, info.project.name, 'cart-drawer')
    expect(await seriousAxe(page, '[role="dialog"]')).toEqual([])

    await drawer.getByRole('button', { name: 'Remove Tech Maintenance from cart' }).click()
    await expect(drawer.getByText('Tech Maintenance')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cart, 1 item' })).toBeVisible()

    await drawer.getByRole('button', { name: 'Remove Website Health Check from cart' }).click()
    await expect(page.getByRole('button', { name: 'Cart, 0 items' })).toBeVisible()
    await shot(page, info.project.name, 'cart-empty')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(log.unmocked).toEqual([])
  })

  test('shows a recoverable error when the catalogue cannot load', async ({ page }, info) => {
    await installMocks(page, { catalogue: 'error' })
    await page.goto('/services')
    await expect(page.getByText(/could not load the services/i).first()).toBeVisible()
    await shot(page, info.project.name, 'catalogue-error')
  })
})

test.describe('guest checkout', () => {
  test('validates, then hands off to the (mock) gateway with an index, never an amount', async ({ page }, info) => {
    const log = await installMocks(page)
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    const drawer = await openCart(page)

    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()
    await expect(drawer.getByText(/accept the Terms/i)).toBeVisible()
    await expect(drawer.locator('[aria-invalid="true"]').first()).toBeVisible()
    await shot(page, info.project.name, 'checkout-validation')
    expect(log.createPaymentBodies).toHaveLength(0)

    await drawer.getByLabel('Email').fill('not-an-email')
    await drawer.getByLabel('Phone').fill('12')
    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()
    expect(log.createPaymentBodies).toHaveLength(0)

    await drawer.getByLabel('Name (optional)').fill('Test Buyer')
    await drawer.getByLabel('Email').fill('buyer@example.com')
    await drawer.getByLabel('Phone').fill('9876543210')
    const radios = drawer.getByRole('radio')
    await expect(radios).toHaveCount(2)
    // The radio is visually hidden; shoppers click its card, which is its <label>.
    await drawer.locator('label:has(input[type=radio][value="2"])').click()
    await expect(radios.nth(1)).toBeChecked()
    await drawer.getByRole('checkbox').check()
    await shot(page, info.project.name, 'checkout-ready')

    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()
    await page.waitForURL(MOCK_GATEWAY)

    expect(log.createPaymentBodies).toHaveLength(1)
    const body = log.createPaymentBodies[0]
    expect(body.serviceSlugs).toEqual(['tech-maintenance'])
    expect(body.merchant).toBe(2)
    expect(body).not.toHaveProperty('amount')
    expect(JSON.stringify(body)).not.toMatch(/mid|secret|price/i)
  })

  test('shows a retryable error when order creation fails', async ({ page }, info) => {
    await installMocks(page, { createPayment: 'error' })
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    const drawer = await openCart(page)
    await drawer.getByLabel('Email').fill('buyer@example.com')
    await drawer.getByLabel('Phone').fill('9876543210')
    await drawer.getByRole('checkbox').check()
    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()
    await expect(drawer.getByRole('button', { name: /^Try Again,/ })).toBeVisible()
    await shot(page, info.project.name, 'checkout-failed')
    expect(await seriousAxe(page, '[role="dialog"]')).toEqual([])
  })

  // MOCKED server and gateway: these prove the drawer's behaviour, not a real charge.
  test('a retired service left in a saved cart is not shown, totalled or sent', async ({ page }) => {
    const log = await installMocks(page, {
      seedCart: ['tech-maintenance', 'retired-service'],
      retiredSlug: 'retired-service',
    })
    await page.goto('/services')
    const drawer = await openCart(page)
    await expect(drawer.getByText('Tech Maintenance')).toBeVisible()
    await expect(drawer.getByText('Retired Service')).toHaveCount(0)
    await expect(drawer.getByRole('button', { name: /^Pay Now, ₹849$/ })).toBeVisible()

    await drawer.getByLabel('Email').fill('buyer@example.com')
    await drawer.getByRole('checkbox').check()
    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()
    await page.waitForURL(MOCK_GATEWAY)
    expect(log.createPaymentBodies[0]?.serviceSlugs).toEqual(['tech-maintenance'])
  })

  test('a server amount that differs from the cart total stops before the gateway', async ({ page }, info) => {
    const log = await installMocks(page, { chargedAmount: 949 })
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    const drawer = await openCart(page)
    await drawer.getByLabel('Email').fill('buyer@example.com')
    await drawer.getByRole('checkbox').check()
    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()

    await expect(drawer.getByText(/amount for your order is ₹949, not the ₹849/)).toBeVisible()
    await expect(drawer.getByRole('button', { name: /^Try Again,/ })).toBeVisible()
    expect(page.url()).not.toContain(MOCK_GATEWAY)
    expect(log.createPaymentBodies).toHaveLength(1)
    await shot(page, info.project.name, 'checkout-amount-mismatch')
    expect(await seriousAxe(page, '[role="dialog"]')).toEqual([])
  })

  test('checkout policy links open the policies', async ({ page, context }) => {
    await installMocks(page)
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    const drawer = await openCart(page)
    const [terms] = await Promise.all([
      context.waitForEvent('page'),
      drawer.getByRole('link', { name: 'Terms & Conditions' }).click(),
    ])
    await terms.waitForLoadState()
    expect(new URL(terms.url()).pathname).toBe('/terms')
  })
})

// MOCKED server and sandbox: proves the drawer's behaviour, never a real charge.
test.describe('ISGPay sandbox checkout', () => {
  test('hidden when sandbox testing is not offered', async ({ page }) => {
    await installMocks(page)
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    const drawer = await openCart(page)
    await expect(drawer.getByRole('radio')).toHaveCount(2)
    await expect(drawer.getByText(/ISGPay/)).toHaveCount(0)
  })

  test('select ISGPay → one server-priced order → automatic POST to the sandbox', async ({ page }, info) => {
    const log = await installMocks(page, { isgpay: true })
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    await page.getByRole('button', { name: 'Add Website Health Check to cart' }).click()
    const drawer = await openCart(page)

    const radios = drawer.getByRole('radio')
    await expect(radios).toHaveCount(3)
    await expect(radios.nth(0)).toBeChecked() // Airpay merchant 1 stays the default

    await drawer.getByLabel('Name (optional)').fill('Test Customer')
    await drawer.getByLabel('Email').fill('test@example.com')
    await drawer.getByLabel('Phone').fill('9999999999')

    await drawer.locator('label:has(input[type=radio][value="isgpay"])').click()
    await expect(drawer.getByRole('radio', { name: /ISGPay — Sandbox Test/ })).toBeChecked()
    await expect(radios.nth(0)).not.toBeChecked()
    await expect(radios.nth(1)).not.toBeChecked()
    await expect(drawer.getByText('Sandbox test', { exact: true })).toBeVisible()

    // Switching gateways keeps the basket and the contact details.
    await drawer.locator('label:has(input[type=radio][value="2"])').click()
    await drawer.locator('label:has(input[type=radio][value="isgpay"])').click()
    await expect(drawer.getByLabel('Email')).toHaveValue('test@example.com')
    await expect(drawer.getByText('Website Health Check')).toBeVisible()

    await drawer.getByRole('checkbox').check()
    await shot(page, info.project.name, 'checkout-isgpay-ready')
    await drawer.getByRole('button', { name: /^Pay Now,/ }).dblclick()
    await page.waitForURL(ISGPAY_SANDBOX)

    expect(log.createPaymentBodies).toHaveLength(0) // Airpay never reached
    expect(log.isgpayCreateBodies).toHaveLength(1) // double-click → one order
    const body = log.isgpayCreateBodies[0] ?? {}
    expect(body.serviceSlugs).toEqual(['tech-maintenance', 'website-health-check'])
    expect(Object.keys(body).sort()).toEqual(['contact', 'guestToken', 'serviceSlugs'])
    expect(log.isgpaySandboxPosts).toHaveLength(1)
    expect(new URLSearchParams(log.isgpaySandboxPosts[0]).get('EncData')).toBe('e2e-sealed')
  })

  test('a server amount that differs from the cart total stops before the sandbox', async ({ page }) => {
    const log = await installMocks(page, { isgpay: true, chargedAmount: 1 })
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    const drawer = await openCart(page)
    await drawer.locator('label:has(input[type=radio][value="isgpay"])').click()
    await drawer.getByLabel('Email').fill('test@example.com')
    await drawer.getByRole('checkbox').check()
    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()
    await expect(drawer.getByRole('button', { name: /^Try Again,/ })).toBeVisible()
    expect(log.isgpaySandboxPosts).toHaveLength(0)
  })

  test('verified sandbox payment is shown as a test, never as a purchase', async ({ page }, info) => {
    await installMocks(page)
    await page.goto(`/order-success?ref=${E2E_ISG_REF}&t=e2e-isg-token`)
    await expect(page.getByRole('heading', { level: 1, name: 'Sandbox test payment verified' })).toBeVisible()
    await expect(page.getByText(/not a real purchase/)).toBeVisible()
    await expect(page.getByText('Payment confirmed')).toHaveCount(0)
    await shot(page, info.project.name, 'order-isgpay-paid')
    expect(await seriousAxe(page, 'main')).toEqual([])
  })

  test('a verified decline is shown as not approved', async ({ page }) => {
    await installMocks(page, {
      isgpayStatus: { status: 'pending_payment', settled: false, verification: { outcome: 'declined_pending' } },
    })
    await page.goto(`/order-success?ref=${E2E_ISG_REF}&t=e2e-isg-token`)
    await expect(page.getByRole('heading', { level: 1, name: 'Payment not approved' })).toBeVisible()
  })

  test('an unverifiable gateway return claims nothing', async ({ page }) => {
    await installMocks(page)
    await page.goto('/order-success?status=unverified')
    await expect(page.getByRole('heading', { level: 1, name: 'We could not verify the gateway response' })).toBeVisible()
  })
})

test.describe('payment status page', () => {
  const CASES = [
    ['paid', 'Payment confirmed'],
    ['failed', 'That payment did not go through'],
    ['cancelled', 'That payment did not go through'],
    ['requires_review', 'Your payment needs a quick check'],
  ] as const

  for (const [status, heading] of CASES) {
    test(`renders the ${status} state from the server's answer`, async ({ page }, info) => {
      await installMocks(page, { orderStatus: status })
      await page.goto('/order-success?ref=AM-E2E-00000001&t=e2e-token')
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await shot(page, info.project.name, `order-${status}`)
    })
  }

  test('a link without a reference claims nothing', async ({ page }) => {
    await installMocks(page)
    await page.goto('/order-success')
    await expect(page.getByRole('heading', { name: 'We could not find that order' })).toBeVisible()
  })
})

test.describe('contact and search', () => {
  test('contact form validates, then falls back to the email app', async ({ page }, info) => {
    await installMocks(page)
    await page.goto('/contact')
    await page.getByRole('button', { name: 'Send Message' }).click()
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(3)

    await page.getByLabel('Name').fill('Test Person')
    await page.getByLabel('Email').fill('person@example.com')
    await page.getByLabel('Message').fill('I would like a website health check.')
    await page.getByRole('button', { name: 'Send Message' }).click()
    await expect(page.getByText('Your email is ready to send')).toBeVisible()
    await shot(page, info.project.name, 'contact-success')
  })

  test('search overlay finds services and closes with Escape', async ({ page }, info) => {
    await installMocks(page)
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'Search services' })
    await trigger.click()
    await page.getByRole('searchbox', { name: 'Search services' }).or(page.getByLabel('Search services').last()).fill('SEO')
    await expect(page.getByRole('dialog').getByText(/Website Health Check|SEO/).first()).toBeVisible()
    await shot(page, info.project.name, 'search-results')
    expect(await seriousAxe(page, '[role="dialog"]')).toEqual([])

    await page.getByLabel('Search services').last().fill('zzzz-nothing')
    await expect(page.getByRole('dialog').getByText(/no (services|results)/i).first()).toBeVisible()
    await shot(page, info.project.name, 'search-empty')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})

test.describe('navigation', () => {
  test('every internal link on every page resolves to a real page', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-1440', 'link crawl runs once')
    test.setTimeout(300_000) // ~28 sequential page loads
    await installMocks(page)
    const seen = new Set<string>()
    const queue = ['/']
    const broken: string[] = []

    while (queue.length) {
      const path = queue.shift()!
      if (seen.has(path)) continue
      seen.add(path)
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      if (await page.getByRole('heading', { name: 'Page not found' }).count()) broken.push(path)

      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') ?? ''))
      for (const href of hrefs) {
        if (href === '#' || href === '') broken.push(`${path} → empty href`)
        else if (href.startsWith('/')) queue.push(href.split('#')[0])
        else if (href.startsWith('mailto:') && !/^mailto:[^@\s]+@[^@\s]+\.\w+/.test(href)) broken.push(href)
        else if (href.startsWith('tel:') && !/^tel:\+?\d{10,13}$/.test(href)) broken.push(href)
      }
    }
    expect(broken).toEqual([])
    // Every route linked while signed in (the crawl is members-only; the auth pages redirect), excluding the unlinked
    // /order-success and /account (and the hidden /forgot-password), plus one page per service.
    expect(seen.size).toBe(12 + ALL_SERVICES.length)
  })

  test('mobile menu opens, navigates and marks the active page', async ({ page }) => {
    test.skip(test.info().project.name === 'desktop-1440', 'menu is hidden at lg')
    await installMocks(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const nav = page.getByRole('navigation', { name: 'Mobile' })
    await nav.getByRole('link', { name: 'FAQs' }).click()
    await expect(page).toHaveURL(/\/faq$/)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(nav.getByRole('link', { name: 'FAQs' })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('website navigation and catalogue browsing', () => {
  test('desktop Policies menu works by keyboard and lists every policy', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1440', 'the dropdown is the lg+ header')
    await installMocks(page)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByRole('link', { name: 'FAQs' })).toBeVisible()
    const button = nav.getByRole('button', { name: 'Policies' })
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    for (const name of ['Terms', 'Privacy Policy', 'Refund & Cancellation Policy', 'Service Delivery Policy', 'Grievance Redressal', 'All policies']) {
      await expect(nav.getByRole('link', { name, exact: name !== 'Terms' })).toBeVisible()
    }
    await shot(page, info.project.name, 'policies-dropdown')
    await page.keyboard.press('Escape')
    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(button).toBeFocused()

    await button.click()
    await nav.getByRole('link', { name: 'Refund & Cancellation Policy' }).click()
    await expect(page).toHaveURL(/\/refund$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Refund & Cancellation Policy')
    await expect(nav.getByRole('link', { name: 'Refund & Cancellation Policy' })).toBeHidden()
  })

  test('mobile menu has a Policies section', async ({ page }, info) => {
    test.skip(info.project.name === 'desktop-1440', 'menu is hidden at lg')
    await installMocks(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    const nav = page.getByRole('navigation', { name: 'Mobile' })
    await expect(nav.getByRole('heading', { name: 'Policies' })).toBeVisible()
    await shot(page, info.project.name, 'mobile-menu')
    await nav.getByRole('link', { name: 'All policies' }).click()
    await expect(page).toHaveURL(/\/policies$/)
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(5)
  })

  test('services page lists, searches, filters and sorts every active service', async ({ page }, info) => {
    await installMocks(page)
    await page.goto('/services')
    const status = page.getByText(/^Showing \d+ of \d+ services$/)
    await expect(status).toHaveText(`Showing ${ALL_SERVICES.length} of ${ALL_SERVICES.length} services`)
    await expect(page.getByRole('link', { name: /^View details:/ })).toHaveCount(ALL_SERVICES.length)

    await page.getByRole('radio', { name: 'Micro-services' }).check({ force: true })
    await expect(page.getByRole('link', { name: /^View details:/ })).toHaveCount(ALL_SERVICES.filter((s) => s.tier === 'micro').length)
    await page.getByRole('radio', { name: 'All' }).check({ force: true })

    await page.getByLabel('Sort by').selectOption('price-asc')
    const cheapest = [...ALL_SERVICES].sort((a, b) => a.price - b.price)[0]
    // Core services render first; the cheapest core card leads its group.
    await expect(page.getByRole('link', { name: /^View details:/ }).first()).toHaveAccessibleName(`View details: ${cheapest.title}`)

    await page.getByLabel('Search the catalogue').fill('zzzz-nothing')
    await expect(page.getByText('No services match your filters')).toBeVisible()
    await shot(page, info.project.name, 'services-no-match')
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(status).toHaveText(`Showing ${ALL_SERVICES.length} of ${ALL_SERVICES.length} services`)
  })

  test('a service card opens its detail page, which adds to cart and survives refresh', async ({ page }, info) => {
    await installMocks(page)
    await page.goto('/services')
    await page.getByRole('link', { name: 'View details: SEO Audit Service' }).click()
    await expect(page).toHaveURL(/\/services\/seo-audit-service$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SEO Audit Service')
    await expect(page).toHaveTitle('SEO Audit Service — Authentic Media')
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('SEO Audit Service')
    await page.getByRole('button', { name: /^Add SEO Audit Service to cart/ }).click()
    await expect(page.getByRole('button', { name: 'Cart, 1 item' })).toBeVisible()
    await shot(page, info.project.name, 'service-detail')
  })

  test('FAQ search filters questions and links to the refund policy', async ({ page }) => {
    await installMocks(page)
    await page.goto('/faq')
    await page.getByLabel('Search the FAQs').fill('refund policy')
    const question = page.getByText('Where can I read the refund policy?')
    await question.click()
    await page.locator('#refund-policy').getByRole('link', { name: 'Refund & Cancellation Policy' }).click()
    await expect(page).toHaveURL(/\/refund$/)
  })
})

test.describe('accounts (custom /api/auth)', () => {
  test('signed-out visitors are sent from /account to login', async ({ page }) => {
    await installMocks(page, { signedIn: false })
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()
  })

  test('sign in, see and edit the account, log out', async ({ page }, info) => {
    const log = await installMocks(page, { signedIn: false })
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(E2E_ACCOUNT.email)
    await page.getByLabel('Password', { exact: true }).fill('wrong-pass-1')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('That email or password is not correct.')

    await page.getByLabel('Password', { exact: true }).fill(E2E_ACCOUNT.password)
    await page.getByRole('button', { name: 'Show password' }).click()
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
    await shot(page, info.project.name, 'login-filled')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Returns to where the guard sent us from.
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()
    await expect(page.getByText(E2E_ACCOUNT.email)).toBeVisible()
    await expect(page.getByText('1 November 2026')).toBeVisible()
    await shot(page, info.project.name, 'account')

    await page.getByLabel('Display name').fill('Asha R.')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('status')).toHaveText('Name updated.')
    await expect(page.locator('dd').first()).toHaveText('Asha R.')

    // The session survives a reload (it is the server's, not the page's).
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()

    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/account')
    await expect(page).toHaveURL(/\/login$/)
    expect(log.unmocked).toEqual([])
  })

  test('register, land signed in on /account (unverified), log out', async ({ page }, info) => {
    const log = await installMocks(page, { signedIn: false })
    await page.goto('/login')
    await page.getByRole('link', { name: 'Create an account' }).click()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Create your account' })).toBeVisible()

    // Client-side validation before any request.
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Enter your full name.')).toBeVisible()
    await expect(page.getByText('Enter your email address.')).toBeVisible()

    await page.getByLabel('Full name').fill('Ravi Kumar')
    await page.getByLabel('Email').fill(E2E_ACCOUNT.email)
    await page.getByLabel('Password', { exact: true }).fill('another-pass-7')
    await page.getByLabel('Confirm password').fill('another-pass-7')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toHaveText('An account with this email already exists. Sign in instead.')

    await page.getByLabel('Email').fill('ravi@example.com')
    await shot(page, info.project.name, 'register-filled')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()
    await expect(page.getByText('ravi@example.com')).toBeVisible()
    await expect(page.getByText('Email not verified')).toBeVisible()
    await shot(page, info.project.name, 'account-unverified')

    // The session survives a reload.
    await page.reload()
    await expect(page.getByText('ravi@example.com')).toBeVisible()

    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(log.unmocked).toEqual([])
  })

  test('password recovery stays hidden', async ({ page }) => {
    await installMocks(page)
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /forgot password/i })).toHaveCount(0)
    for (const path of ['/forgot-password', '/reset-password']) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/password/i)
    }
  })

  test('a signed-in shopper still checks out as a guest', async ({ page }) => {
    const log = await installMocks(page, { signedIn: true })
    await page.goto('/services')
    await page.getByRole('button', { name: 'Add Tech Maintenance to cart' }).click()
    const drawer = await openCart(page)
    await drawer.getByLabel('Email').fill('buyer@example.com')
    await drawer.getByLabel('Phone').fill('9876543210')
    await drawer.locator('label:has(input[type=radio][value="1"])').click()
    await drawer.getByRole('checkbox').check()
    await drawer.getByRole('button', { name: /^Pay Now,/ }).click()
    await page.waitForURL(MOCK_GATEWAY)
    expect(log.createPaymentBodies).toHaveLength(1)
    // Payment stays independent of the account: nothing about the user is sent.
    expect(JSON.stringify(log.createPaymentBodies[0])).not.toMatch(/e2e-user|asha@example\.com/)
  })

  test('signed-out visitors are sent to login; legal pages stay public', async ({ page }) => {
    await installMocks(page, { signedIn: false })
    for (const path of ['/', '/services', '/about', '/faq']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
    }
    await page.goto('/privacy')
    await expect(page).toHaveURL(/\/privacy$/)
  })
})
