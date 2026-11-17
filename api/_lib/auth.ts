import { createHash, randomBytes } from 'node:crypto'

import { hash, verify } from '@node-rs/argon2'

import type { AuthUserRow } from './auth-store.js'
import { rateLimitHit } from './auth-store.js'
import { header, type ApiRequest } from './http.js'

/**
 * Shared server-side auth primitives (docs/AUTH-SETUP.md). Server only:
 * nothing under src/ may import this file.
 */

// __Host- forces Secure, Path=/ and no Domain, so subdomains cannot plant or read it.
export const SESSION_COOKIE = '__Host-am_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

// @node-rs/argon2 defaults: Argon2id, m=19456 KiB, t=2, p=1 (OWASP baseline), random salt per hash.
export const hashPassword = (password: string): Promise<string> => hash(password)

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | null = null

/** Burns the same Argon2 time as a real check, so unknown emails are not faster. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hash('dummy-password-for-timing-only')
  await verifyPassword(await dummyHash, password)
  return false
}

export const newSessionToken = (): string => randomBytes(32).toString('base64url')

/** Only this hash is stored, so a database leak yields no usable sessions. */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

const COOKIE_ATTRS = 'Path=/; HttpOnly; Secure; SameSite=Lax'

export const sessionCookie = (token: string): string =>
  `${SESSION_COOKIE}=${token}; ${COOKIE_ATTRS}; Max-Age=${SESSION_TTL_SECONDS}`

export const clearedSessionCookie = (): string => `${SESSION_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`

export function readSessionToken(req: ApiRequest): string | null {
  for (const part of (header(req, 'cookie') ?? '').split(';')) {
    const [name, value] = part.trim().split('=')
    if (name === SESSION_COOKIE) return value && TOKEN_RE.test(value) ? value : null
  }
  return null
}

/**
 * CSRF guard for every state-changing request: the browser-set Origin must be
 * this host, and the body must be JSON (which a cross-site form cannot send
 * without a CORS preflight this API never answers). SameSite=Lax is the third layer.
 */
export function isTrustedMutation(req: ApiRequest): boolean {
  const origin = header(req, 'origin')
  const host = header(req, 'host')
  if (!origin || !host) return false
  if (!(header(req, 'content-type') ?? '').startsWith('application/json')) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function clientIp(req: ApiRequest): string {
  return (
    header(req, 'x-real-ip') ?? header(req, 'x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  )
}

/** Shared across all Vercel instances (Postgres-backed). Keys are hashed before storage. */
export async function isRateLimited(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  return !(await rateLimitHit(hashToken(key), max, windowSeconds))
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/** Public registration is on everywhere; AUTH_PUBLIC_REGISTRATION=false is the emergency kill switch. */
export const isRegistrationEnabled = (): boolean =>
  process.env['AUTH_PUBLIC_REGISTRATION'] !== 'false'

export interface PublicUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: string
}

/** The only user shape that ever leaves the server: no hash, no session data. */
export const toPublicUser = (row: AuthUserRow): PublicUser => ({
  id: row.id,
  name: row.full_name,
  email: row.email,
  emailVerified: row.email_verified_at !== null,
  createdAt: row.created_at,
})
