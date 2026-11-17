import { ROUTES } from '@/routes/paths'

const LOOP_PATHS = new Set(['/login', '/register', '/forgot-password'])

/**
 * Accepts only same-origin relative paths ("/account", "/services?x=1").
 * Anything else — absolute URLs, "//host", "/\host", control characters — falls
 * back to the account page, which closes the open-redirect hole.
 */
export function safeRedirect(target: unknown, fallback: string = ROUTES.account): string {
  if (typeof target !== 'string') return fallback
  const hasUnsafeChar = [...target].some((ch) => ch === '\\' || ch.charCodeAt(0) < 32)
  if (!target.startsWith('/') || target.startsWith('//') || hasUnsafeChar) {
    return fallback
  }
  const pathname = target.split(/[?#]/)[0] ?? ''
  return LOOP_PATHS.has(pathname) ? fallback : target
}
