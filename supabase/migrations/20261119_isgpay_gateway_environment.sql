-- ISGPay production readiness: record WHICH gateway environment an order belongs to.
-- See docs/ISGPAY-PRODUCTION-READINESS.md §8–§9. NOT YET APPLIED — review first.
--
-- ADDITIVE AND BACKWARD-COMPATIBLE:
--   * one nullable column + one CHECK; no row is rewritten, nothing is dropped;
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
  p_contact_phone       text default null
)
returns table (id uuid, reference text, total_inr integer, access_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total integer;
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

  insert into public.orders (
    reference, status, subtotal_inr, total_inr, currency, payment_method, guest_token,
    gateway_environment, contact_name, contact_email, contact_phone
  )
  values (
    p_order_ref, 'pending_payment', v_total, v_total, 'INR', 'isgpay', p_guest_token,
    p_gateway_environment, p_contact_name, p_contact_email, p_contact_phone
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

revoke all on function public.create_isgpay_order(text[], text, uuid, text, text, text, text)
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
