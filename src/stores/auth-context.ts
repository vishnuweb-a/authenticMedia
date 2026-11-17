import { createContext } from 'react'

import type { SignInInput, SignUpInput } from '@/services'
import type { ServiceResult } from '@/services/result'
import type { User } from '@/types'

export interface AuthContextValue {
  user: User | null
  /** True until /api/auth/me has answered, so the UI never flashes the wrong state. */
  isLoading: boolean
  /** True after an explicit sign-out (guards send home, not to login). */
  signedOut: boolean
  signIn(input: SignInInput): Promise<ServiceResult<User>>
  signUp(input: SignUpInput): Promise<ServiceResult<User>>
  signOut(): Promise<ServiceResult<void>>
  updateName(name: string): Promise<ServiceResult<User>>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
