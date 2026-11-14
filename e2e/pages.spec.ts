import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { installMocks } from './support/mocks'

/** Every public route, rendered at every viewport project. */
const PAGES = [
  ['home', '/'],
  ['services', '/services'],
  ['about', '/about'],
  ['faq', '/faq'],
  ['policies', '/policies'],
  ['service-detail-core', '/services/tech-maintenance'],
  ['service-detail-micro', '/services/website-health-check'],
  ['service-detail-missing', '/services/no-such-service'],
  ['contact', '/contact'],
  ['grievance', '/grievance-redressal'],
  ['terms', '/terms'],
  ['privacy', '/privacy'],
  ['refund', '/refund'],
  ['service-delivery', '/service-delivery-policy'],
  ['order-paid', '/order-success?ref=AM-E2E-00000001&t=e2e-token'],
  ['not-found', '/does-not-exist'],
] as const

for (const [name, path] of PAGES) {
  test(`${name} renders cleanly`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const log = await installMocks(page)

    await page.goto(path)
    await expect(page.locator('h1')).toHaveCount(1)
    await page.waitForLoadState('networkidle')

    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth
      const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => el.getBoundingClientRect().right > width + 1)
        .filter((el) => getComputedStyle(el).position !== 'fixed')
        .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`)
      return { scroll: document.documentElement.scrollWidth - width, offenders: offenders.slice(0, 5) }
    })
    expect(overflow.scroll, `horizontal overflow: ${overflow.offenders.join(' | ')}`).toBeLessThanOrEqual(0)

    await page.screenshot({
      path: `test-results/screenshots/${info.project.name}/${name}.png`,
      fullPage: true,
    })

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    const serious = axe.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)
    expect(serious, serious.join('\n')).toEqual([])

    expect(errors).toEqual([])
    expect(log.unmocked).toEqual([])
  })
}
