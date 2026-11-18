import type { AuthUserRow } from './auth-store.js'

/**
 * Test-only: a signed-in shopper for suites that exercise checkout but not auth.
 * Starting a payment requires a session (requireSession), so these suites mock
 * auth-store with `authStoreMock` and send `SIGNED_IN_COOKIE`.
 */
export const SIGNED_IN_COOKIE = `__Host-am_session=${'s'.repeat(43)}`

export const SIGNED_IN_USER: AuthUserRow = {
  id: '99999999-9999-4999-8999-999999999999',
  full_name: 'Test Shopper',
  email: 'shopper@example.com',
  email_verified_at: null,
  created_at: '2026-11-01T00:00:00.000Z',
}

export const authStoreMock = {
  findSessionUser: async (): Promise<AuthUserRow> => SIGNED_IN_USER,
}
