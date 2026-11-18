-- ISGPay production readiness: record WHICH gateway environment an order belongs to.
-- See docs/ISGPAY-PRODUCTION-READINESS.md §8–§9 and ISGPAY-PRODUCTION-PHASE3.md §4.
-- NOT YET APPLIED — review first.
--
-- ADDITIVE AND BACKWARD-COMPATIBLE:
--   * two nullable columns (gateway_environment, app_user_id) + one CHECK + two
--     partial unique indexes; no row is rewritten, nothing is dropped;
--   * create_isgpay_order (production) takes transaction-scoped advisory locks
--     and refuses a second unresolved live order for the same shopper (IG409);
--   * NULL means a legacy ISGPay row created when only UAT existed, and is read
--     as 'uat' everywhere (code and SQL). Existing UAT orders stay identifiable
--     as sandbox and can never be read as live revenue;
--   * new 4-argument overloads of create_/settle_isgpay_order carry the
--     environment. The existing 3-argument functions keep working for the code
--     currently deployed, but are narrowed to UAT rows only (they were only
--     ever called by UAT-only code), so they cannot create or settle a
--     production order;
--   * no Airpay function, column or row is touched.
--
-- Deploy order: apply this migration BEFORE deploying the code that calls the
-- 4-argument functions.

alter table public.orders
  add column if not exists gateway_environment text;

alter table public.orders drop constraint if exists orders_gateway_environment_check;
alter table public.orders
  add constraint orders_gateway_environment_check
  check (gateway_environment is null or gateway_environment in ('uat', 'production'));

comment on column public.orders.gateway_environment is
  'ISGPay only: gateway environment the order was created under. NULL = legacy UAT. '
  'Only ''production'' rows can ever be real revenue.';

-- The signed-in custom-auth account (app_private.app_users) that placed the
-- order, if any. orders.user_id cannot be used: it references auth.users
-- (Supabase Auth, unused) and orders_one_owner requires exactly one of
-- user_id / guest_token. Lets the duplicate-payment guard follow a shopper
-- across browsers and devices, where the guest token differs.
alter table public.orders
  add column if not exists app_user_id uuid
  references app_private.app_users (id) on delete set null;

comment on column public.orders.app_user_id is
  'Custom-auth account that placed the order (NULL = signed out). Not an owner for RLS; used by the ISGPay live duplicate-payment guard.';

-- ── Order creation (new overload) ───────────────────────────────────────────
-- Same price authority as before; adds the server-chosen environment and the
-- contact details a production order needs for fulfilment. p_gateway_environment
-- has NO default, so a 3-argument call can only resolve to the legacy function.
create or replace function public.create_isgpay_order(
  p_service_slugs       text[],
  p_order_ref           text,
  p_guest_token         uuid,
  p_gateway_environment text,
  p_contact_name        text default null,
  p_contact_email       text default null,
  p_contact_phone       text default null,
  p_app_user_id         uuid default null
)
returns table (id uuid, reference text, total_inr integer, access_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total integer;
  v_key bigint;
  v_earlier text;
begin
  if p_gateway_environment is null or p_gateway_environment not in ('uat', 'production') then
    raise exception 'create_isgpay_order: invalid gateway environment';
  end if;
  if p_service_slugs is null or array_length(p_service_slugs, 1) is null then
    raise exception 'create_isgpay_order: no services supplied';
  end if;
  if p_guest_token is null then
    raise exception 'create_isgpay_order: guest token required';
  end if;
  if p_order_ref !~ '^ISG[0-9A-Z]{8}[0-9A-F]{16}$' then
    raise exception 'create_isgpay_order: invalid reference';
  end if;

  select coalesce(sum(s.price_inr), 0) into v_total
    from public.services s
   where s.slug = any (p_service_slugs)
     and s.is_active;

  if v_total <= 0 then
    raise exception 'create_isgpay_order: no active services matched';
  end if;

  -- ── Live duplicate-payment guard (atomic) ──────────────────────────────────
  -- At most ONE unresolved live order per guest token and per signed-in
  -- account. Transaction-scoped advisory locks serialise concurrent calls for
  -- the same shopper; the check and the insert below run in this one
  -- transaction, so a second caller waits, then sees the first order and is
  -- refused. Keys are taken in sorted order (no deadlock between a request
  -- locking {guest A, user U} and one locking {guest B, user U}). There is no
  -- time window: a pending live order blocks until settlement resolves it.
  -- UAT orders are never locked, checked or counted here.
  if p_gateway_environment = 'production' then
    for v_key in
      select distinct k from unnest(array[
        hashtextextended('isgpay-live:guest:' || p_guest_token::text, 0),
        hashtextextended('isgpay-live:user:' || p_app_user_id::text, 0)  -- NULL when signed out
      ]) as k where k is not null order by k
    loop
      perform pg_advisory_xact_lock(v_key);
    end loop;

    select o.reference into v_earlier
      from public.orders o
     where o.payment_method = 'isgpay'
       and o.gateway_environment = 'production'
       and o.status = 'pending_payment'
       and (o.guest_token = p_guest_token or (p_app_user_id is not null and o.app_user_id = p_app_user_id))
     order by o.created_at
     limit 1;

    if v_earlier is not null then
      -- The earlier row is left untouched; its reference is the one to verify.
      raise exception 'create_isgpay_order: unresolved live payment'
        using errcode = 'IG409', detail = v_earlier;
    end if;
  end if;

  insert into public.orders (
    reference, status, subtotal_inr, total_inr, currency, payment_method, guest_token,
    gateway_environment, contact_name, contact_email, contact_phone, app_user_id
  )
  values (
    p_order_ref, 'pending_payment', v_total, v_total, 'INR', 'isgpay', p_guest_token,
    p_gateway_environment, p_contact_name, p_contact_email, p_contact_phone, p_app_user_id
  )
  returning orders.id into v_order_id;

  insert into public.order_items (
    order_id, service_id, service_slug, title, icon, unit_price_inr, quantity, subtotal_inr
  )
  select v_order_id, s.id, s.slug, s.title, s.icon, s.price_inr, 1, s.price_inr
    from public.services s
   where s.slug = any (p_service_slugs)
     and s.is_active;

  insert into public.payments (order_id, provider, status, amount_inr, currency)
  values (v_order_id, 'isgpay', 'pending', v_total, 'INR');

  return query
    select o.id, o.reference, o.total_inr, o.access_token
      from public.orders o
     where o.id = v_order_id;
end;
$$;

revoke all on function public.create_isgpay_order(text[], text, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;

-- ── Settlement (new overload) ───────────────────────────────────────────────
-- The ONE conditional settlement UPDATE, now also pinned to the environment
-- whose credentials verified the payment. A UAT-verified result can never
-- settle a production row, nor the reverse.
create or replace function public.settle_isgpay_order(
  p_order_ref           text,
  p_payment_status      text,
  p_gateway_ref         text,
  p_gateway_environment text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if p_payment_status not in ('succeeded', 'requires_review') then
    raise exception 'settle_isgpay_order: unsupported payment status';
  end if;
  if p_gateway_environment is null or p_gateway_environment not in ('uat', 'production') then
    raise exception 'settle_isgpay_order: invalid gateway environment';
  end if;

  update public.orders
     set status         = case p_payment_status when 'succeeded' then 'paid' else 'requires_review' end,
         ap_verified_at = now(),
         updated_at     = now()
   where reference = p_order_ref
     and payment_method = 'isgpay'
     and coalesce(gateway_environment, 'uat') = p_gateway_environment
     and status not in ('paid', 'failed', 'cancelled', 'delivered', 'requires_review')
  returning id into v_order_id;

  if v_order_id is null then
    return null;
  end if;

  update public.payments
     set status              = p_payment_status,
         provider_payment_id = coalesce(p_gateway_ref, provider_payment_id),
         updated_at          = now()
   where order_id = v_order_id
     and provider = 'isgpay'
     and status not in ('succeeded', 'failed', 'refunded', 'requires_review');

  return v_order_id::text;
end;
$$;

revoke all on function public.settle_isgpay_order(text, text, text, text)
  from public, anon, authenticated;

-- ── Legacy 3-argument settlement: UAT rows only ─────────────────────────────
-- Body identical to 20261117_isgpay_uat_orders.sql except the environment
-- predicate. The code that calls it is UAT-only, so this changes nothing for
-- it, and it can no longer touch a production row. (The legacy 3-argument
-- create needs no change: it inserts gateway_environment NULL = UAT.)
create or replace function public.settle_isgpay_order(
  p_order_ref      text,
  p_payment_status text,
  p_gateway_ref    text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  if p_payment_status not in ('succeeded', 'requires_review') then
    raise exception 'settle_isgpay_order: unsupported payment status';
  end if;

  update public.orders
     set status         = case p_payment_status when 'succeeded' then 'paid' else 'requires_review' end,
         ap_verified_at = now(),
         updated_at     = now()
   where reference = p_order_ref
     and payment_method = 'isgpay'
     and coalesce(gateway_environment, 'uat') = 'uat'
     and status not in ('paid', 'failed', 'cancelled', 'delivered', 'requires_review')
  returning id into v_order_id;

  if v_order_id is null then
    return null;
  end if;

  update public.payments
     set status              = p_payment_status,
         provider_payment_id = coalesce(p_gateway_ref, provider_payment_id),
         updated_at          = now()
   where order_id = v_order_id
     and provider = 'isgpay'
     and status not in ('succeeded', 'failed', 'refunded', 'requires_review');

  return v_order_id::text;
end;
$$;

revoke all on function public.settle_isgpay_order(text, text, text) from public, anon, authenticated;

-- ── Explicit EXECUTE privileges ─────────────────────────────────────────────
-- Supabase's default privileges already grant service_role, but the model is
-- stated here rather than assumed: only the server-side service role may call
-- any payment function; PUBLIC, anon and authenticated may not.
grant execute on function public.create_isgpay_order(text[], text, uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.settle_isgpay_order(text, text, text, text) to service_role;
grant execute on function public.settle_isgpay_order(text, text, text) to service_role;

-- ── Live duplicate-payment guard: database-enforced backstop ────────────────
-- Uniqueness on the same predicate the function checks under its locks, so no
-- write path (present or future) can leave two unresolved live orders for one
-- guest token or one account. Also serves findUnresolvedIsgpayOrder.
-- Safe to build on today's data: no row has gateway_environment = 'production'.
-- UAT / legacy (NULL) rows are outside both indexes and never block anything.
create unique index if not exists orders_isgpay_live_pending_guest_key
  on public.orders (guest_token)
  where payment_method = 'isgpay' and gateway_environment = 'production' and status = 'pending_payment';

create unique index if not exists orders_isgpay_live_pending_user_key
  on public.orders (app_user_id)
  where payment_method = 'isgpay' and gateway_environment = 'production' and status = 'pending_payment'
    and app_user_id is not null;
