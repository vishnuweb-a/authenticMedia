import { use } from 'react'

import { AuthContext, type AuthContextValue } from './auth-context'

/** The current user and the auth actions (sign in, sign out, update name). */
export function useAuth(): AuthContextValue {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
