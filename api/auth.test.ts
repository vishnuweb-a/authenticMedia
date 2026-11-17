import { createHash } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ApiRequest, ApiResponse } from './_lib/http.js'

/**
 * Custom auth endpoints: the real handler and real Argon2id, over an in-memory
 * stand-in for the RPCs that mirrors supabase/migrations/20261118_custom_auth.sql.
 */

interface UserRow {
  id: string
  full_name: string
  email: string
  password_hash: string
  email_verified_at: string | null
  session_token_hash: string | null
  session_expires_at: number | null
  created_at: string
}

const db = vi.hoisted(() => ({
  users: new Map<string, UserRow>(),
  rate: new Map<string, { hits: number; start: number }>(),
  now: Date.now(),
  fail: false,
}))

vi.mock('./_lib/auth-store.js', () => {
  const guard = () => {
    if (db.fail) throw new Error('auth_session_user failed: 08006')
  }
  const pub = (u: UserRow) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    email_verified_at: u.email_verified_at,
    created_at: u.created_at,
  })
  const bySession = (hash: string) =>
    [...db.users.values()].find(
      (u) => u.session_token_hash === hash && (u.session_expires_at ?? 0) > db.now,
    )
  return {
    createUser: async (fullName: string, email: string, hash: string, verified: boolean) => {
      guard()
      if ([...db.users.values()].some((u) => u.email.toLowerCase() === email.toLowerCase())) return null
      const id = `u${db.users.size + 1}`
      db.users.set(id, {
        id,
        full_name: fullName,
        email: email.toLowerCase(),
        password_hash: hash,
        email_verified_at: verified ? new Date(db.now).toISOString() : null,
        session_token_hash: null,
        session_expires_at: null,
        created_at: new Date(db.now).toISOString(),
      })
      return id
    },
    findLoginUser: async (email: string) => {
      guard()
      const u = [...db.users.values()].find((x) => x.email === email.toLowerCase())
      return u ? { id: u.id, password_hash: u.password_hash, email_verified: u.email_verified_at !== null } : null
    },
    startSession: async (id: string, hash: string, ttl: number) => {
      guard()
      const u = db.users.get(id)
      if (!u) return null
      u.session_token_hash = hash
      u.session_expires_at = db.now + ttl * 1000
      return pub(u)
    },
    findSessionUser: async (hash: string) => {
      guard()
      const u = bySession(hash)
      return u ? pub(u) : null
    },
    endSession: async (hash: string) => {
      guard()
      for (const u of db.users.values()) {
        if (u.session_token_hash === hash) {
          u.session_token_hash = null
          u.session_expires_at = null
        }
      }
      return null
    },
    updateFullName: async (hash: string, name: string) => {
      guard()
      const u = bySession(hash)
      if (!u) return null
      u.full_name = name
      return pub(u)
    },
    rateLimitHit: async (bucket: string, max: number, windowSeconds: number) => {
      guard()
      const r = db.rate.get(bucket)
      if (!r || r.start <= db.now - windowSeconds * 1000) db.rate.set(bucket, { hits: 1, start: db.now })
      else r.hits += 1
      return db.rate.get(bucket)!.hits <= max
    },
  }
})

const handler = (await import('./auth/[action].js')).default
const { hashPassword } = await import('./_lib/auth.js')

const HOST = 'authenticmedia.fun'
const sha = (s: string) => createHash('sha256').update(s).digest('hex')

interface Result {
  code: number
  body: Record<string, unknown>
  headers: Record<string, string>
}

async function call(
  action: string,
  init: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string> } = {},
): Promise<Result> {
  const method = init.method ?? (action === 'me' ? 'GET' : action === 'profile' ? 'PATCH' : 'POST')
  const headers: Record<string, string> = { host: HOST, 'x-real-ip': '203.0.113.7' }
  if (method !== 'GET') {
    headers['origin'] = `https://${HOST}`
    headers['content-type'] = 'application/json'
  }
  if (init.cookie) headers['cookie'] = init.cookie
  Object.assign(headers, init.headers)
  for (const [k, v] of Object.entries(headers)) if (v === '') delete headers[k]

  const req: ApiRequest = { method, headers, query: { action }, body: init.body ?? {} }
  const out: Result = { code: 0, body: {}, headers: {} }
  const res: ApiResponse = {
    status(code) {
      out.code = code
      return res
    },
    setHeader(name, value) {
      out.headers[name] = value
      return res
    },
    json(body) {
      out.body = body as Record<string, unknown>
    },
    send() {},
    end() {},
  }
  await handler(req, res)
  return out
}

const cookieOf = (r: Result) => (r.headers['Set-Cookie'] ?? '').split(';')[0] ?? ''
const tokenOf = (r: Result) => cookieOf(r).split('=')[1] ?? ''

async function seedUser(verified = true, email = 'asha@example.com', password = 'correct-horse-9') {
  const id = `u${db.users.size + 1}`
  db.users.set(id, {
    id,
    full_name: 'Asha Rao',
    email,
    password_hash: await hashPassword(password),
    email_verified_at: verified ? new Date(db.now).toISOString() : null,
    session_token_hash: null,
    session_expires_at: null,
    created_at: '2026-11-01T00:00:00.000Z',
  })
  return { id, email, password }
}

async function signedIn() {
  const u = await seedUser()
  const r = await call('login', { body: { email: u.email, password: u.password } })
  return { ...u, cookie: cookieOf(r), token: tokenOf(r) }
}

beforeEach(() => {
  db.users.clear()
  db.rate.clear()
  db.now = Date.now()
  db.fail = false
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('registration', () => {
  const NEW = { fullName: 'Asha Rao', email: 'asha@example.com', password: 'correct-horse-9' }

  it('is open on Production by default (no flag needed)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const r = await call('register', { body: NEW })
    expect(r.code).toBe(201)
    expect(db.users.size).toBe(1)
  })

  it('AUTH_PUBLIC_REGISTRATION=false is an emergency kill switch', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('AUTH_PUBLIC_REGISTRATION', 'false')
    const r = await call('register', { body: NEW })
    expect(r.code).toBe(404)
    expect(db.users.size).toBe(0)
  })

  it.each([
    [{ fullName: 'A', email: 'a@b.co', password: 'abcdef12' }],
    [{ fullName: 'Asha Rao', email: 'not-an-email', password: 'abcdef12' }],
    [{ fullName: 'Asha Rao', email: 'a@b.co', password: 'short1' }],
    [{ fullName: 'Asha Rao', email: 'a@b.co', password: 'nodigitshere' }],
    [{ fullName: 42, email: 'a@b.co', password: 'abcdef12' }],
  ])('rejects invalid input %#', async (body) => {
    expect((await call('register', { body })).code).toBe(400)
    expect(db.users.size).toBe(0)
  })

  it('creates an UNVERIFIED user with an Argon2id hash, normalising the email', async () => {
    const r = await call('register', {
      body: { fullName: ' Asha Rao ', email: ' Asha@Example.COM ', password: 'correct-horse-9' },
    })
    expect(r.code).toBe(201)
    const [user] = [...db.users.values()]
    expect(user?.email).toBe('asha@example.com')
    expect(user?.full_name).toBe('Asha Rao')
    expect(user?.email_verified_at).toBeNull()
    expect(user?.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(user?.password_hash).not.toContain('correct-horse-9')
    expect(JSON.stringify(r.body)).not.toMatch(/argon2|session_token|password/)
  })

  it('signs the new user in with the same 7-day session cookie as login', async () => {
    const r = await call('register', { body: NEW })
    expect(r.body['user']).toMatchObject({ name: 'Asha Rao', email: 'asha@example.com', emailVerified: false })
    const cookie = r.headers['Set-Cookie'] ?? ''
    expect(cookie).toMatch(/^__Host-am_session=[A-Za-z0-9_-]{43};/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 7}`)
    const [user] = [...db.users.values()]
    expect(user?.session_token_hash).toBe(sha(tokenOf(r)))
    // Survives a refresh: /me with the cookie returns the same user.
    expect((await call('me', { cookie: cookieOf(r) })).body['user']).toMatchObject({ id: user?.id })
  })

  it('ignores a client-supplied verified flag, id or session', async () => {
    const r = await call('register', {
      body: { ...NEW, emailVerified: true, verified: true, email_verified_at: '2026-01-01', id: 'x', token: 'y' },
    })
    expect(r.body['user']).toMatchObject({ emailVerified: false })
    const [user] = [...db.users.values()]
    expect(user?.email_verified_at).toBeNull()
    expect(user?.id).not.toBe('x')
  })

  it('reports a duplicate email (any case) as 409 without a session', async () => {
    await call('register', { body: NEW })
    const again = await call('register', { body: { ...NEW, email: 'ASHA@example.com' } })
    expect(again.code).toBe(409)
    expect(again.body).toEqual({ error: 'email_taken' })
    expect(again.headers['Set-Cookie']).toBeUndefined()
    expect(db.users.size).toBe(1)
  })

  it('concurrent signups for one email create exactly one account', async () => {
    const results = await Promise.all([1, 2, 3].map(() => call('register', { body: NEW })))
    expect(results.map((r) => r.code).sort()).toEqual([201, 409, 409])
    expect(db.users.size).toBe(1)
  })

  it('a failed session start keeps the account and asks the user to sign in', async () => {
    const realSet = db.users.set.bind(db.users)
    // Break the database right after the user row is written: the session RPC is next.
    const spy = vi.spyOn(db.users, 'set').mockImplementation((k, v) => {
      db.fail = true
      return realSet(k, v)
    })
    const r = await call('register', { body: NEW })
    spy.mockRestore()
    db.fail = false
    expect(r.code).toBe(503)
    expect(r.body).toEqual({ error: 'signin_required' })
    expect(r.headers['Set-Cookie']).toBeUndefined()
    // The account is intact and can sign in normally.
    expect((await call('login', { body: NEW })).code).toBe(200)
  })

  it('an unverified account can sign in (basic access)', async () => {
    await call('register', { body: NEW })
    const r = await call('login', { body: NEW })
    expect(r.code).toBe(200)
    expect(r.body['user']).toMatchObject({ emailVerified: false })
    expect(r.headers['Set-Cookie']).toMatch(/^__Host-am_session=/)
  })

  it('is rate limited per IP (5/hour), counting duplicate attempts too', async () => {
    const codes = []
    for (let i = 0; i < 6; i++) {
      codes.push((await call('register', { body: { ...NEW, email: i < 3 ? NEW.email : `a${i}@b.co` } })).code)
    }
    expect(codes).toEqual([201, 409, 409, 201, 201, 429])
  })

  it('caps one IP at 20 signups a day across hourly windows', async () => {
    let created = 0
    for (let hour = 0; hour < 6; hour++) {
      for (let i = 0; i < 5; i++) {
        const r = await call('register', { body: { ...NEW, email: `h${hour}i${i}@b.co` } })
        if (r.code === 201) created += 1
      }
      db.now += 60 * 60 * 1000 + 1
    }
    expect(created).toBe(20)
  })
})

describe('login', () => {
  it('sets a secure opaque session cookie and stores only its hash', async () => {
    const u = await seedUser()
    const r = await call('login', { body: { email: 'ASHA@example.com ', password: u.password } })
    expect(r.code).toBe(200)
    expect(r.body['user']).toEqual({
      id: u.id,
      name: 'Asha Rao',
      email: u.email,
      emailVerified: true,
      createdAt: '2026-11-01T00:00:00.000Z',
    })

    const cookie = r.headers['Set-Cookie'] ?? ''
    expect(cookie).toMatch(/^__Host-am_session=[A-Za-z0-9_-]{43};/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain(`Max-Age=${60 * 60 * 24 * 7}`)

    const stored = db.users.get(u.id)!
    expect(stored.session_token_hash).toBe(sha(tokenOf(r)))
    expect(stored.session_token_hash).not.toBe(tokenOf(r))
    expect(JSON.stringify(r.body)).not.toMatch(/argon2|session_token|password/)
  })

  it('gives one indistinguishable answer for a wrong password and an unknown email', async () => {
    await seedUser()
    const wrong = await call('login', { body: { email: 'asha@example.com', password: 'nope-nope-1' } })
    const unknown = await call('login', { body: { email: 'ghost@example.com', password: 'nope-nope-1' } })
    expect([wrong.code, unknown.code]).toEqual([401, 401])
    expect(wrong.body).toEqual(unknown.body)
    expect(wrong.headers['Set-Cookie']).toBeUndefined()
  })

  it('rejects non-string and oversized fields without hashing them', async () => {
    expect((await call('login', { body: { email: ['a'], password: 'x' } })).code).toBe(400)
    expect((await call('login', { body: { email: 'a@b.co', password: 'x'.repeat(10_000) } })).code).toBe(400)
  })

  it('locks an email after 10 attempts in 15 minutes, then recovers', async () => {
    const u = await seedUser()
    for (let i = 0; i < 10; i++) {
      expect((await call('login', { body: { email: u.email, password: 'bad-guess-1' } })).code).toBe(401)
    }
    // Even the right password is refused while locked.
    expect((await call('login', { body: { email: u.email, password: u.password } })).code).toBe(429)
    db.now += 15 * 60 * 1000 + 1
    expect((await call('login', { body: { email: u.email, password: u.password } })).code).toBe(200)
  })

  it('limits one IP across many emails', async () => {
    const codes = []
    for (let i = 0; i < 31; i++) {
      codes.push((await call('login', { body: { email: `x${i}@b.co`, password: 'bad-guess-1' } })).code)
    }
    expect(codes.at(-1)).toBe(429)
    expect(codes.slice(0, 30).every((c) => c === 401)).toBe(true)
  })

  it('a new login replaces the previous session (one active session per user)', async () => {
    const first = await signedIn()
    const second = await call('login', { body: { email: first.email, password: first.password } })
    expect((await call('me', { cookie: first.cookie })).body).toEqual({ user: null })
    expect((await call('me', { cookie: cookieOf(second) })).body['user']).toMatchObject({ id: first.id })
  })
})

describe('session', () => {
  it('/me returns null for guests and the user for a valid session', async () => {
    expect((await call('me')).body).toEqual({ user: null })
    const u = await signedIn()
    const r = await call('me', { cookie: `theme=dark; ${u.cookie}` })
    expect(r.code).toBe(200)
    expect(r.body['user']).toMatchObject({ id: u.id, email: u.email })
    expect(JSON.stringify(r.body)).not.toMatch(/argon2|session|password/)
  })

  it('persists across requests until it expires, then clears the cookie', async () => {
    const u = await signedIn()
    db.now += 6 * 24 * 60 * 60 * 1000
    expect((await call('me', { cookie: u.cookie })).body['user']).not.toBeNull()
    db.now += 2 * 24 * 60 * 60 * 1000
    const r = await call('me', { cookie: u.cookie })
    expect(r.body).toEqual({ user: null })
    expect(r.headers['Set-Cookie']).toMatch(/^__Host-am_session=;.*Max-Age=0/)
  })

  it('ignores malformed and forged tokens', async () => {
    await signedIn()
    for (const cookie of ['__Host-am_session=abc', '__Host-am_session=' + 'A'.repeat(43), 'am_session=x']) {
      expect((await call('me', { cookie })).body).toEqual({ user: null })
    }
  })

  it('logout revokes the session server-side and clears the cookie', async () => {
    const u = await signedIn()
    const r = await call('logout', { cookie: u.cookie })
    expect(r.code).toBe(200)
    expect(r.headers['Set-Cookie']).toMatch(/Max-Age=0/)
    expect(db.users.get(u.id)!.session_token_hash).toBeNull()
    // Replaying the old cookie gets nothing.
    expect((await call('me', { cookie: u.cookie })).body).toEqual({ user: null })
  })

  it('a late logout from an old session does not end a newer one', async () => {
    const old = await signedIn()
    const fresh = await call('login', { body: { email: old.email, password: old.password } })
    await call('logout', { cookie: old.cookie })
    expect((await call('me', { cookie: cookieOf(fresh) })).body['user']).toMatchObject({ id: old.id })
  })

  it('concurrent logins leave exactly one valid session', async () => {
    const u = await seedUser()
    const results = await Promise.all(
      [1, 2, 3].map(() => call('login', { body: { email: u.email, password: u.password } })),
    )
    const live = []
    for (const r of results) {
      if ((await call('me', { cookie: cookieOf(r) })).body['user']) live.push(r)
    }
    expect(live).toHaveLength(1)
  })

  it('logout without a session still succeeds', async () => {
    expect((await call('logout')).code).toBe(200)
  })
})

describe('profile', () => {
  it('requires a session', async () => {
    expect((await call('profile', { body: { fullName: 'New Name' } })).code).toBe(401)
  })

  it('updates only the caller’s own name, whatever ids the body carries', async () => {
    const other = await seedUser(true, 'other@example.com')
    const u = await signedIn()
    const r = await call('profile', { cookie: u.cookie, body: { fullName: '  Asha R. ', id: other.id } })
    expect(r.code).toBe(200)
    expect(r.body['user']).toMatchObject({ id: u.id, name: 'Asha R.' })
    expect(db.users.get(other.id)!.full_name).toBe('Asha Rao')
  })

  it('validates the name', async () => {
    const u = await signedIn()
    expect((await call('profile', { cookie: u.cookie, body: { fullName: 'x' } })).code).toBe(400)
    expect((await call('profile', { cookie: u.cookie, body: { fullName: 'y'.repeat(81) } })).code).toBe(400)
  })

  it('refuses an expired session', async () => {
    const u = await signedIn()
    db.now += 8 * 24 * 60 * 60 * 1000
    expect((await call('profile', { cookie: u.cookie, body: { fullName: 'New Name' } })).code).toBe(401)
  })
})

describe('CSRF and routing', () => {
  it.each(['login', 'logout', 'register', 'profile'])('%s refuses a cross-site origin', async (action) => {
    const u = await signedIn()
    const r = await call(action, { cookie: u.cookie, headers: { origin: 'https://evil.example' } })
    expect(r.code).toBe(403)
    expect(db.users.get(u.id)!.session_token_hash).not.toBeNull()
  })

  it('refuses a missing Origin and a non-JSON body (HTML form posts)', async () => {
    const u = await signedIn()
    expect((await call('logout', { cookie: u.cookie, headers: { origin: '' } })).code).toBe(403)
    expect(
      (await call('logout', { cookie: u.cookie, headers: { 'content-type': 'application/x-www-form-urlencoded' } }))
        .code,
    ).toBe(403)
    expect(db.users.get(u.id)!.session_token_hash).not.toBeNull()
  })

  it('answers wrong methods with 405 and unknown actions with 404', async () => {
    expect((await call('login', { method: 'GET' })).code).toBe(405)
    expect((await call('me', { method: 'POST' })).code).toBe(405)
    expect((await call('constructor', { method: 'GET' })).code).toBe(404)
    expect((await call('admin', { method: 'GET' })).code).toBe(404)
  })

  it('a database failure is a bare 503 with no detail', async () => {
    db.fail = true
    const r = await call('me', { cookie: '__Host-am_session=' + 'A'.repeat(43) })
    expect(r.code).toBe(503)
    expect(r.body).toEqual({ error: 'unavailable' })
  })

  it('never logs credentials', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const u = await signedIn()
    await call('login', { body: { email: u.email, password: 'wrong-pass-1' } })
    const logged = log.mock.calls.flat().join(' ')
    expect(logged).not.toContain(u.password)
    expect(logged).not.toContain(u.email)
    expect(logged).not.toContain(u.token)
  })
})
