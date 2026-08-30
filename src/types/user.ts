export type UserRole = 'CUSTOMER' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface Session {
  user: User
  /** Epoch milliseconds. */
  expiresAt: number
}
