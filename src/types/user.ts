/** The signed-in user as returned by /api/auth/me. Never carries a hash or token. */
export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  /** ISO timestamp of account creation. */
  createdAt: string
}
