import { getServiceClient } from './db.js'

/**
 * Database access for custom auth. Every call is a service-role RPC into the
 * private `app_private` schema (supabase/migrations/20261118_custom_auth.sql);
 * the tables themselves are not reachable through the Data API.
 */

export interface AuthUserRow {
  id: string
  full_name: string
  email: string
  email_verified_at: string | null
  created_at: string
}

export interface LoginRow {
  id: string
  password_hash: string
  email_verified: boolean
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getServiceClient().rpc(fn, args)
  // Only the code is kept: database messages can echo input values.
  if (error) throw new Error(`${fn} failed: ${error.code ?? 'unknown'}`)
  return data as T
}

const first = <T>(rows: T[] | null): T | null => rows?.[0] ?? null

/** Returns the new id, or null when the email is already registered. */
export const createUser = (fullName: string, email: string, passwordHash: string, verified: boolean) =>
  rpc<string | null>('auth_create_user', {
    p_full_name: fullName,
    p_email: email,
    p_password_hash: passwordHash,
    p_verified: verified,
  })

export const findLoginUser = async (email: string) =>
  first(await rpc<LoginRow[]>('auth_login_lookup', { p_email: email }))

export const startSession = async (userId: string, tokenHash: string, ttlSeconds: number) =>
  first(
    await rpc<AuthUserRow[]>('auth_start_session', {
      p_user_id: userId,
      p_token_hash: tokenHash,
      p_ttl_seconds: ttlSeconds,
    }),
  )

export const findSessionUser = async (tokenHash: string) =>
  first(await rpc<AuthUserRow[]>('auth_session_user', { p_token_hash: tokenHash }))

export const endSession = (tokenHash: string) =>
  rpc<null>('auth_end_session', { p_token_hash: tokenHash })

export const updateFullName = async (tokenHash: string, fullName: string) =>
  first(
    await rpc<AuthUserRow[]>('auth_update_full_name', {
      p_token_hash: tokenHash,
      p_full_name: fullName,
    }),
  )

/** True while the bucket is within `max` hits per window. */
export const rateLimitHit = (bucket: string, max: number, windowSeconds: number) =>
  rpc<boolean>('auth_rate_limit_hit', {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  })
