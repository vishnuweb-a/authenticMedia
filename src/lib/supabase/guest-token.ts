/**
 * The guest cart identity.
 *
 * An unguessable uuid held in localStorage that the RLS policies treat as proof
 * of ownership for an anonymous cart. It is sent as the `request.guest_token`
 * setting on every request, letting a signed-out visitor keep a server-side
 * cart, and letting that cart be claimed once authentication lands.
 *
 * It is not a credential for anything else: it grants access only to the cart
 * and orders created under it.
 */
const STORAGE_KEY = 'am.guest_token'

let cached: string | null = null

/** Reads the token, minting and persisting one on first use. */
export function getGuestToken(): string {
  if (cached) return cached

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) {
      cached = existing
      return existing
    }
  } catch {
    // Private mode or blocked storage: fall through to an in-memory token so
    // the cart still works for the life of the tab.
  }

  const token = crypto.randomUUID()
  cached = token

  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Non-fatal — `cached` keeps the session coherent without persistence.
  }

  return token
}
