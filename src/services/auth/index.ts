import { mockAuthService } from './mock-auth-service'
import type { AuthService } from './types'

export type { AuthService, SignInInput } from './types'

/**
 * The active auth implementation. Swapping in Supabase later is a change to
 * this binding only — no component or hook needs to be touched.
 */
export const authService: AuthService = mockAuthService
