# Authentication setup (custom server-side auth)

Accounts use a small custom auth system on the existing Supabase **PostgreSQL** database.
Supabase **Auth** (the provider) is not used. The browser-side Supabase client stays
anonymous and still serves the catalogue, cart and checkout, exactly as before.

## Architecture

```
Browser (React)                          Vercel function                 Postgres (private schema)
useAuth() ── authService ── fetch ──▶  api/auth/[action].ts  ── rpc ──▶  public.auth_* functions
  (state: loading | user | null)        api/_lib/auth.ts                   └▶ app_private.app_users
  cookie: HttpOnly, never read by JS    api/_lib/auth-store.ts             └▶ app_private.auth_rate_limits
```

- `src/services/auth/api-auth-service.ts`: the only browser code that talks to the API. It is a same-origin `fetch` with no token handling.
- `src/stores/auth-provider.tsx`: one provider and one `/api/auth/me` request on load. There are no listeners and nothing in localStorage.
- `src/features/auth/`: login and account screens, plus the `RequireAuth` / `GuestOnly` route guards. Guards are UX only. The server enforces every rule.
- `src/features/auth/config.ts` (`AUTH_FEATURES`): the password-recovery screen is built but hidden. Registration (`/register`) is always routed.
- `src/features/auth/lib/validation.ts`: shared by the forms **and** the API.
- `api/auth/[action].ts`: one Vercel function serves all five endpoints, so it adds one entry to the function count (see `.vercelignore`).
- `api/_lib/auth.ts`: Argon2id, session tokens, cookies, CSRF check and rate limiting. It is server-only.
- `api/_lib/auth-store.ts`: the service-role RPC calls.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/me` | `{ user }` or `{ user: null }` (200 for guests). Clears a stale cookie. |
| POST | `/api/auth/login` | `{ email, password }` → sets the cookie and returns `{ user }`. 401 for any bad credential, 429 when rate limited. Unverified accounts may sign in (basic account access only). |
| POST | `/api/auth/logout` | Revokes the session row and clears the cookie. Always 200. |
| POST | `/api/auth/register` | `{ fullName, email, password }` → 201 `{ user }` plus the session cookie (automatic sign-in). 400 invalid input, 409 `email_taken`, 429 rate limited, 503 `signin_required` (account created but the session could not start: the user signs in normally), 404 when the kill switch is on. |
| PATCH | `/api/auth/profile` | `{ fullName }` → `{ user }`. The session decides whose row is updated. |

`user` is `{ id, name, email, emailVerified, createdAt }`. Responses never include a password, hash or token.

## Security model

- **Passwords:** Argon2id via `@node-rs/argon2` (m=19456 KiB, t=2, p=1, random salt). Hashing and verification happen only on the server. Unknown emails still run a dummy verification so their timing matches. Inputs over 256 characters are rejected before hashing.
- **Sessions:** a 32-byte random token is sent in cookie `__Host-am_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`, 7 days). Only its SHA-256 is stored. Every request is checked against `session_expires_at` in the database.
- **One active session per user (limitation):** a new login on any device signs out the previous one. Logout matches on the token hash, so a late logout from an old session cannot end a newer one.
- **CSRF:** every POST/PATCH must carry an `Origin` equal to the request host and a JSON `Content-Type`. `SameSite=Lax` is a third layer.
- **Rate limiting:** shared across all instances through Postgres. Login allows 10 per email and 30 per IP per 15 minutes; registration allows 5 per IP per hour and 20 per IP per day, counted before the duplicate-email check. Buckets are stored hashed. The per-email limit lets someone deliberately lock a known email out for 15 minutes (accepted trade-off).
- **Enumeration:** login gives the same 401 for an unknown email and a wrong password. Registration answers 409 `email_taken` for an existing email (standard shop behaviour, needed for a clear error and automatic sign-in); the per-IP registration limits cap how fast this can be probed.
- **Database confidentiality:** the tables live in `app_private`, which the Data API does not expose. RLS is on with no policies, and all access to `anon` and `authenticated` is revoked. The `public.auth_*` functions are `SECURITY DEFINER` with an empty `search_path` and can be executed by `service_role` only.
- **Logging:** only event names (`auth.login.ok`, `auth.login.rate_limited`, `auth.register.ok`, `auth.register.rate_limited`, `auth.register.session_failed`, `auth.error`) are logged. Emails, passwords, tokens and hashes never are.

## Registration and email verification

Public registration is **on** in every environment, Production included.

- `/api/auth/register` creates an **unverified** account (`email_verified_at` NULL) and signs it in with the same session mechanism as login. The client cannot set the verified flag, the id or the session: the handler reads only `fullName`, `email` and `password`.
- **Kill switch:** set `AUTH_PUBLIC_REGISTRATION=false` on the Vercel project and redeploy to close signups (the endpoint returns 404 and the form shows "Registration is not available at the moment"). Unset or any other value means open.
- **Concurrent signups** for one email are settled by the unique index on `lower(email)`: one insert wins, the others get 409.
- **Unverified accounts** get basic account access only: the account page, editing the display name, logging out. Nothing is granted on the strength of the email address. Orders are not linked to accounts at all (checkout is guest checkout, signed in or not), so no historical order can be claimed by matching an email. The account page shows "Email not verified" and there is no verified badge.
- **Known risk:** without verification, anyone can register an email address they do not own and so reserve it; the real owner then gets `email_taken`. Until verification exists, an operator resolves such a case by deleting the unverified row after confirming with the owner. Registration also reveals whether an email has an account (rate limited).
- **Operator-provisioned verified accounts** still work:
  ```
  node --env-file=.env scripts/provision-user.mjs
  ```
  It prompts for the name, email and password (the password is hidden). It needs `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` (or `VITE_SUPABASE_URL`). Run it in a real terminal: piped input is not supported.
- **Password recovery** stays hidden (`AUTH_FEATURES.passwordRecovery`). There is no reset shortcut, no security question and no client-side recovery.

### Future: transactional email (verification and recovery)

When a provider (Resend, or SMTP) is configured, both features need a single-use, expiring, hashed token: one new table (for example `app_private.auth_email_tokens(token_hash, user_id, purpose, expires_at, used_at)`), two or three new `service_role`-only functions, and new actions in the existing `api/auth/[action].ts` (no new Vercel function). Verification sets `email_verified_at`. Recovery mail must only go to a **verified** address, and a successful reset must clear the session. The provider key is a server-only secret (never `VITE_`). Any feature that needs proven email ownership must check `email_verified_at` on the server.

## Deploying

1. Apply `supabase/migrations/20261118_custom_auth.sql` (additive; it touches no existing table). Do **not** add `app_private` to *Settings → API → Exposed schemas*. Never use `supabase db push` on this project: the local file versions (`20260831`, `20260901b`…) do not match the remote history (14-digit timestamps), so a push would try to re-run every migration.
2. No new secrets are needed: the functions use the existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Leave `AUTH_PUBLIC_REGISTRATION` unset in Production (registration open); set it to `false` only to close signups. `VITE_AUTH_REGISTRATION` is no longer read and can be removed.
3. Public registration needs no database change: it reuses `auth_create_user` and `auth_start_session` from the migration above, with their existing `service_role`-only grants. Verified accounts can still be provisioned with the script above.
4. Optional cleanup in the Supabase dashboard: the Auth provider settings, redirect URLs and SMTP configured for the previous Supabase Auth attempt are no longer used.

Guest checkout, Airpay, ISGPay, callbacks and order status do not depend on auth. No payment code or table was changed.

## Manual verification

1. Provision an account, then `vercel dev` (the API does not run under plain `vite`).
2. Open `/account` → redirected to `/login` → sign in → back on `/account`.
3. Reload: you are still signed in. Change the display name, then reload: the change is kept.
4. Log out → `/`. Reopening `/account` → `/login`. Replaying the old cookie returns `{ user: null }`.
5. A wrong password shows a generic error, and the 11th attempt within 15 minutes returns 429.
6. Check out as a guest while signed in and while signed out (sandbox/test gateways only).
