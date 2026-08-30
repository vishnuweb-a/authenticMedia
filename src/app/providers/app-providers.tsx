import type { ReactNode } from 'react'

import { CartProvider } from '@/stores'

/**
 * Single composition point for application-wide providers, so adding one later
 * (auth session, theme, query client) touches only this file.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>
}
