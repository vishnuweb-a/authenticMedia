import type { ReactNode } from 'react'

import { AuthProvider, CartProvider } from '@/stores'

/**
 * Single composition point for application-wide providers, so adding one later
 * (theme, query client) touches only this file.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  )
}
