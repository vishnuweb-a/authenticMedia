import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { authService } from '@/services'
import type { User } from '@/types'
import { AuthContext, type AuthContextValue } from './auth-context'

/**
 * Three states only: loading, signed in (user), signed out (null). The server
 * is the source of truth; the browser keeps nothing but the HttpOnly cookie.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [signedOut, setSignedOut] = useState(false)

  useEffect(() => {
    let active = true
    void authService.getCurrentUser().then((result) => {
      if (!active) return
      // An unreachable API is treated as signed out; guest pages keep working.
      setUser(result.ok ? result.data : null)
      setIsLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signedOut,
      async signIn(input) {
        const result = await authService.signIn(input)
        if (result.ok) {
          setUser(result.data)
          setSignedOut(false)
        }
        return result
      },
      async signUp(input) {
        const result = await authService.signUp(input)
        if (result.ok) {
          setUser(result.data)
          setSignedOut(false)
        }
        return result
      },
      async signOut() {
        const result = await authService.signOut()
        if (result.ok) {
          setUser(null)
          setSignedOut(true)
        }
        return result
      },
      async updateName(name) {
        const result = await authService.updateName(name)
        if (result.ok) setUser(result.data)
        // The server ended the session (expired/replaced): reflect it.
        else if (result.error.code === 'unauthenticated') setUser(null)
        return result
      },
    }),
    [user, isLoading, signedOut],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
