import type { User } from '@/types'
import type { ServiceResult } from '@/services/result'

export interface SignInInput {
  email: string
  password: string
}

export interface SignUpInput extends SignInInput {
  name: string
}

/**
 * The authentication boundary. UI code depends only on this contract; the
 * implementation talks to the same-origin /api/auth endpoints (cookie session).
 */
export interface AuthService {
  /** Resolves to null when nobody is signed in. */
  getCurrentUser(): Promise<ServiceResult<User | null>>
  signIn(input: SignInInput): Promise<ServiceResult<User>>
  /** Creates an UNVERIFIED account and signs it in (session cookie set by the server). */
  signUp(input: SignUpInput): Promise<ServiceResult<User>>
  signOut(): Promise<ServiceResult<void>>
  updateName(name: string): Promise<ServiceResult<User>>
  requestPasswordReset(email: string): Promise<ServiceResult<void>>
}
