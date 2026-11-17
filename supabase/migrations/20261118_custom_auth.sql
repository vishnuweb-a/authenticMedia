-- Custom authentication (docs/AUTH-SETUP.md). Additive only: touches no
-- existing table, policy or function, and nothing payment-related.
--
-- Everything lives in the `app_private` schema, which is NOT in the Data API's
-- exposed schemas, so PostgREST cannot reach these tables at all. The only way
-- in is the service-role-only functions below, called from api/auth/.
-- RLS is enabled with no policies as defence in depth.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table if not exists app_private.app_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 80),
  email text not null check (char_length(email) <= 254),
  password_hash text not null,
  email_verified_at timestamptz,
  -- One active session per user (documented limitation): a new login replaces it.
  session_token_hash text,
  session_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists app_users_email_ci_key on app_private.app_users (lower(email));
create unique index if not exists app_users_session_key
  on app_private.app_users (session_token_hash) where session_token_hash is not null;

alter table app_private.app_users enable row level security;
revoke all on app_private.app_users from public, anon, authenticated;

-- Shared rate-limit counters. A second table is required: Vercel functions
-- share no memory, and per-user columns cannot throttle unknown emails or IPs.
-- Buckets are SHA-256 hashes, never raw emails or IPs.
create table if not exists app_private.auth_rate_limits (
  bucket text primary key,
  hits integer not null,
  window_start timestamptz not null
);

alter table app_private.auth_rate_limits enable row level security;
revoke all on app_private.auth_rate_limits from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions: SECURITY DEFINER, empty search_path, service_role only.
-- ---------------------------------------------------------------------------

-- Returns the new id, or NULL when the email is taken (no error detail leaks).
create or replace function public.auth_create_user(
  p_full_name text, p_email text, p_password_hash text, p_verified boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into app_private.app_users (full_name, email, password_hash, email_verified_at)
  values (p_full_name, lower(p_email), p_password_hash, case when p_verified then now() end)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  return null;
end $$;

create or replace function public.auth_login_lookup(p_email text)
returns table (id uuid, password_hash text, email_verified boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.password_hash, u.email_verified_at is not null
  from app_private.app_users u where lower(u.email) = lower(p_email);
$$;

-- Replaces any existing session: one active session per user.
create or replace function public.auth_start_session(
  p_user_id uuid, p_token_hash text, p_ttl_seconds integer
) returns table (id uuid, full_name text, email text, email_verified_at timestamptz, created_at timestamptz)
language sql security definer set search_path = '' as $$
  update app_private.app_users u
  set session_token_hash = p_token_hash,
      session_expires_at = now() + make_interval(secs => p_ttl_seconds),
      updated_at = now()
  where u.id = p_user_id
  returning u.id, u.full_name, u.email, u.email_verified_at, u.created_at;
$$;

create or replace function public.auth_session_user(p_token_hash text)
returns table (id uuid, full_name text, email text, email_verified_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.full_name, u.email, u.email_verified_at, u.created_at
  from app_private.app_users u
  where u.session_token_hash = p_token_hash and u.session_expires_at > now();
$$;

-- Matches on the token, so a late logout from an old session can never clear
-- a newer one (concurrent login/logout).
create or replace function public.auth_end_session(p_token_hash text)
returns void
language sql security definer set search_path = '' as $$
  update app_private.app_users
  set session_token_hash = null, session_expires_at = null, updated_at = now()
  where session_token_hash = p_token_hash;
$$;

-- Authorised by the session itself: a caller can only ever update their own row.
create or replace function public.auth_update_full_name(p_token_hash text, p_full_name text)
returns table (id uuid, full_name text, email text, email_verified_at timestamptz, created_at timestamptz)
language sql security definer set search_path = '' as $$
  update app_private.app_users u
  set full_name = p_full_name, updated_at = now()
  where u.session_token_hash = p_token_hash and u.session_expires_at > now()
  returning u.id, u.full_name, u.email, u.email_verified_at, u.created_at;
$$;

-- Fixed-window counter; the upsert's row lock makes concurrent hits atomic.
-- Returns true while the bucket is within p_max hits.
create or replace function public.auth_rate_limit_hit(
  p_bucket text, p_max integer, p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  insert into app_private.auth_rate_limits as r (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set
    hits = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start <= now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;

  -- Occasional pruning keeps the table small without a cron job.
  if random() < 0.01 then
    delete from app_private.auth_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_max;
end $$;

revoke all on function public.auth_create_user(text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.auth_login_lookup(text) from public, anon, authenticated;
revoke all on function public.auth_start_session(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.auth_session_user(text) from public, anon, authenticated;
revoke all on function public.auth_end_session(text) from public, anon, authenticated;
revoke all on function public.auth_update_full_name(text, text) from public, anon, authenticated;
revoke all on function public.auth_rate_limit_hit(text, integer, integer) from public, anon, authenticated;

grant execute on function public.auth_create_user(text, text, text, boolean) to service_role;
grant execute on function public.auth_login_lookup(text) to service_role;
grant execute on function public.auth_start_session(uuid, text, integer) to service_role;
grant execute on function public.auth_session_user(text) to service_role;
grant execute on function public.auth_end_session(text) to service_role;
grant execute on function public.auth_update_full_name(text, text) to service_role;
grant execute on function public.auth_rate_limit_hit(text, integer, integer) to service_role;
