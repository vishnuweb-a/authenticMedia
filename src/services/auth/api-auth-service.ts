import { err, ok, type ServiceResult } from '@/services/result'
import type { User } from '@/types'
import type { AuthService } from './types'

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email or password is not correct.',
  email_taken: 'An account with this email already exists. Sign in instead.',
  signin_required: 'Your account was created, but we could not sign you in. Please sign in.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  unauthenticated: 'Your session has expired. Please sign in again.',
  invalid_input: 'Please check the details you entered.',
  not_found: 'Registration is not available at the moment.',
}
const UNAVAILABLE = 'Sign-in is temporarily unavailable. Please try again later.'

/**
 * Same-origin JSON call. The session is an HttpOnly cookie the browser sends
 * itself; this code never sees or stores a token. The JSON content type is
 * part of the server's CSRF check.
 */
async function call<T>(method: string, path: string, body?: unknown): Promise<ServiceResult<T>> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data: unknown = await response.json().catch(() => null)
    const isObject = typeof data === 'object' && data !== null
    // A 200 that is not JSON (e.g. an SPA fallback page) is an outage, not a success.
    if (response.ok) return isObject ? ok(data as T) : err('unavailable', UNAVAILABLE)
    const code = isObject && 'error' in data && typeof data.error === 'string' ? data.error : 'unavailable'
    return err(code, MESSAGES[code] ?? UNAVAILABLE)
  } catch {
    return err('unavailable', UNAVAILABLE)
  }
}

const userOf = (result: ServiceResult<{ user: User }>): ServiceResult<User> =>
  result.ok ? ok(result.data.user) : result

export const apiAuthService: AuthService = {
  async getCurrentUser() {
    const result = await call<{ user: User | null }>('GET', 'me')
    return result.ok ? ok(result.data.user) : result
  },

  async signIn({ email, password }) {
    return userOf(await call('POST', 'login', { email, password }))
  },

  async signUp({ name, email, password }) {
    return userOf(await call('POST', 'register', { fullName: name, email, password }))
  },

  async signOut() {
    const result = await call<unknown>('POST', 'logout', {})
    return result.ok ? ok(undefined) : err('signout_failed', 'We could not sign you out. Please try again.')
  },

  async updateName(name) {
    return userOf(await call('PATCH', 'profile', { fullName: name }))
  },

  async requestPasswordReset() {
    // shortcut: no recovery backend yet; the screen is unrouted (AUTH_FEATURES), wire an endpoint here when email delivery exists.
    return err('unavailable', 'Password recovery is not available yet.')
  },
}
