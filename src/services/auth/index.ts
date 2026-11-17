import { apiAuthService } from './api-auth-service'
import type { AuthService } from './types'

export type { AuthService, SignInInput, SignUpInput } from './types'

/** The active auth implementation: custom server-side auth at /api/auth. */
export const authService: AuthService = apiAuthService
