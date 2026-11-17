import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ROUTES } from '@/routes/paths'
import { useAuth } from '@/stores'

/** Signs out, then returns to the homepage; `replace` keeps Back from reopening a private page. */
export function useSignOut() {
  const navigate = useNavigate()
  const { signOut: endSession } = useAuth()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    setIsPending(true)
    setError(null)
    const result = await endSession()
    setIsPending(false)
    if (!result.ok) setError(result.error.message)
    else navigate(ROUTES.home, { replace: true })
  }

  return { signOut, isPending, error }
}
