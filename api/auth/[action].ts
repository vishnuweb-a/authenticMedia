// Validation is shared with the browser forms; the file has no imports, so this
// pulls nothing from the frontend into the function.
import {
  validateEmail,
  validateName,
  validatePassword,
} from '../../src/features/auth/lib/validation.js'
import {
  SESSION_TTL_SECONDS,
  clearedSessionCookie,
  clientIp,
  hashPassword,
  hashToken,
  isRateLimited,
  isRegistrationEnabled,
  isTrustedMutation,
  newSessionToken,
  normalizeEmail,
  readSessionToken,
  sessionCookie,
  toPublicUser,
  verifyAgainstDummy,
  verifyPassword,
} from '../_lib/auth.js'
import {
  createUser,
  endSession,
  findLoginUser,
  findSessionUser,
  startSession,
  updateFullName,
} from '../_lib/auth-store.js'
import { noStore, type ApiRequest, type ApiResponse } from '../_lib/http.js'
import { logEvent } from '../_lib/log.js'

/**
 * /api/auth/{me,login,logout,register,profile} — one function for all five, so
 * auth adds a single entry to the deployment's Function count (.vercelignore).
 *
 * Never logged: passwords, hashes, tokens, emails, names.
 */

const MINUTE = 60

type Handler = (req: ApiRequest, res: ApiResponse) => Promise<void>

const fail = (res: ApiResponse, code: number, error: string): void => {
  res.status(code).json({ error })
}

function body(req: ApiRequest): Record<string, unknown> {
  return typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {}
}

/** Bounded so an oversized field cannot be used to burn Argon2 time. */
function str(value: unknown, max = 256): string | null {
  return typeof value === 'string' && value.length <= max ? value : null
}

const me: Handler = async (req, res) => {
  const token = readSessionToken(req)
  const row = token ? await findSessionUser(hashToken(token)) : null
  if (token && !row) res.setHeader('Set-Cookie', clearedSessionCookie())
  // 200 with null (not 401) for guests: every page load asks, and that is not an error.
  res.status(200).json({ user: row ? toPublicUser(row) : null })
}

const login: Handler = async (req, res) => {
  const input = body(req)
  const email = str(input['email'])
  const password = str(input['password'])
  if (!email || !password) return fail(res, 400, 'invalid_input')

  const normalized = normalizeEmail(email)
  if (
    (await isRateLimited(`login:ip:${clientIp(req)}`, 30, 15 * MINUTE)) ||
    (await isRateLimited(`login:email:${normalized}`, 10, 15 * MINUTE))
  ) {
    logEvent('auth.login.rate_limited')
    return fail(res, 429, 'rate_limited')
  }

  const user = await findLoginUser(normalized)
  const valid = user
    ? await verifyPassword(user.password_hash, password)
    : await verifyAgainstDummy(password)
  // One answer for "no such user" and "wrong password": no account enumeration.
  if (!user || !valid) return fail(res, 401, 'invalid_credentials')
  // Unverified accounts may sign in for basic account access only: nothing on
  // the server grants anything on the strength of the email address.

  const token = newSessionToken()
  const row = await startSession(user.id, hashToken(token), SESSION_TTL_SECONDS)
  if (!row) return fail(res, 401, 'invalid_credentials')

  res.setHeader('Set-Cookie', sessionCookie(token))
  logEvent('auth.login.ok')
  res.status(200).json({ user: toPublicUser(row) })
}

const logout: Handler = async (req, res) => {
  const token = readSessionToken(req)
  if (token) await endSession(hashToken(token))
  res.setHeader('Set-Cookie', clearedSessionCookie())
  res.status(200).json({ ok: true })
}

const register: Handler = async (req, res) => {
  if (!isRegistrationEnabled()) return fail(res, 404, 'not_found')

  const input = body(req)
  const fullName = str(input['fullName'])?.trim() ?? ''
  const email = str(input['email']) ?? ''
  const password = str(input['password']) ?? ''
  if (validateName(fullName) || validateEmail(email) || validatePassword(password)) {
    return fail(res, 400, 'invalid_input')
  }

  // Counted before the duplicate check, so probing for registered emails is
  // capped by the same limits (5/hour and 20/day per IP).
  const ip = clientIp(req)
  if (
    (await isRateLimited(`register:ip:${ip}`, 5, 60 * MINUTE)) ||
    (await isRateLimited(`register:ip-day:${ip}`, 20, 24 * 60 * MINUTE))
  ) {
    logEvent('auth.register.rate_limited')
    return fail(res, 429, 'rate_limited')
  }

  // Never pre-verified. The unique index on lower(email) settles concurrent
  // signups: exactly one insert wins, the rest get null.
  const id = await createUser(fullName, normalizeEmail(email), await hashPassword(password), false)
  if (!id) return fail(res, 409, 'email_taken')

  // The account now exists either way. If the session cannot be started, say so
  // explicitly; a generic failure would make the user retry and hit email_taken.
  const token = newSessionToken()
  const row = await startSession(id, hashToken(token), SESSION_TTL_SECONDS).catch(() => null)
  if (!row) {
    logEvent('auth.register.session_failed')
    return fail(res, 503, 'signin_required')
  }

  res.setHeader('Set-Cookie', sessionCookie(token))
  logEvent('auth.register.ok')
  res.status(201).json({ user: toPublicUser(row) })
}

const profile: Handler = async (req, res) => {
  const token = readSessionToken(req)
  if (!token) return fail(res, 401, 'unauthenticated')

  const fullName = str(body(req)['fullName'])?.trim() ?? ''
  if (validateName(fullName)) return fail(res, 400, 'invalid_input')

  // The session token is the authorisation: only its own row can match.
  const row = await updateFullName(hashToken(token), fullName)
  if (!row) return fail(res, 401, 'unauthenticated')
  res.status(200).json({ user: toPublicUser(row) })
}

const ROUTES: Record<string, { method: string; run: Handler }> = {
  me: { method: 'GET', run: me },
  login: { method: 'POST', run: login },
  logout: { method: 'POST', run: logout },
  register: { method: 'POST', run: register },
  profile: { method: 'PATCH', run: profile },
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  noStore(res)
  const raw = req.query?.['action']
  const action = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  // Not Object.hasOwn: Vercel type-checks with the root tsconfig, whose default lib predates it.
  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : undefined

  if (!route) return fail(res, 404, 'not_found')
  if (req.method !== route.method) {
    res.setHeader('Allow', route.method)
    return fail(res, 405, 'method_not_allowed')
  }
  if (route.method !== 'GET' && !isTrustedMutation(req)) return fail(res, 403, 'forbidden')

  try {
    await route.run(req, res)
  } catch {
    logEvent('auth.error', { action })
    fail(res, 503, 'unavailable')
  }
}
