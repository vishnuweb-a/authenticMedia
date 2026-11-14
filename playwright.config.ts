import { defineConfig } from '@playwright/test'

const PORT = 5179

/**
 * Browser QA (audit Phase 2). Every network call that would leave the browser —
 * Supabase, /api/*, the Airpay hosted page — is intercepted in e2e/support/mocks.ts,
 * so no run can create an order, touch the database or start a real payment.
 *
 * Explicit viewports rather than device presets: Chrome's minimum window width
 * would otherwise hide the 390px layout.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'small-500', use: { viewport: { width: 500, height: 900 } } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
