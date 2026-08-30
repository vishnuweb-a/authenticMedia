import { err, ok } from '@/services/result'
import type { Session } from '@/types'
import type { AuthService, SignInInput } from './types'

const SESSION_DURATION_MS = 1000 * 60 * 60

/** Simulated latency so loading states are exercised during development. */
function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * In-memory stand-in for the future Supabase implementation.
 *
 * It authenticates any well-formed email with a non-empty password. It is a
 * development affordance only and must never be presented as real auth.
 */
function createMockAuthService(): AuthService {
  let session: Session | null = null

  return {
    async signIn({ email, password }: SignInInput) {
      await delay()

      if (!email.includes('@') || password.length === 0) {
        return err('invalid_credentials', 'That email or password is not correct.')
      }

      session = {
        user: {
          id: 'mock-user',
          name: email.split('@')[0] ?? 'User',
          email,
          role: 'CUSTOMER',
        },
        expiresAt: Date.now() + SESSION_DURATION_MS,
      }

      return ok(session)
    },

    async signOut() {
      await delay(150)
      session = null
      return ok(undefined)
    },

    async getSession() {
      await delay(150)

      if (session && session.expiresAt < Date.now()) {
        session = null
      }

      return ok(session)
    },
  }
}

export const mockAuthService = createMockAuthService()
