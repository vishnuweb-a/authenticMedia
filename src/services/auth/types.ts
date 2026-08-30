import type { Session } from '@/types'
import type { ServiceResult } from '@/services/result'

export interface SignInInput {
  email: string
  password: string
}

/**
 * The authentication boundary.
 *
 * A Supabase-backed implementation will satisfy this interface later; UI code
 * must depend only on this contract, never on a provider SDK (CLAUDE.md §8).
 */
export interface AuthService {
  signIn(input: SignInInput): Promise<ServiceResult<Session>>
  signOut(): Promise<ServiceResult<void>>
  /** Resolves to null when nobody is signed in. */
  getSession(): Promise<ServiceResult<Session | null>>
}
