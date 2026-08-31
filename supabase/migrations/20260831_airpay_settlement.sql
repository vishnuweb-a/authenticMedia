-- Airpay settlement support (AIPAY-DOCS §10, §17; AGENTS.md §30.8).
--
-- ADDITIVE ONLY. This migration adds columns and widens two check constraints.
-- It rewrites no existing row and drops nothing, because the live orders table
-- is production data.
--
-- It deliberately does NOT create the table from §17 verbatim: this repository
-- already has an orders model (reference / *_inr / a separate payments table),
-- and introducing a second orders table would create two sources of truth
-- about money. The documented *semantics* are adopted onto the existing shape.

-- ---------------------------------------------------------------------------
-- 1. Settlement columns
-- ---------------------------------------------------------------------------

alter table public.orders
  -- The opaque per-order read key for the status endpoint (§15). The order
  -- reference alone is not enough: references appear in the Airpay dashboard
  -- and in URLs, and the row holds contact details.
  add column if not exists access_token uuid not null default gen_random_uuid(),

  -- Which gateway owns settlement for this order. Only 'airpay' rows are
  -- swept by the reconciler (§16).
  add column if not exists payment_method text not null default 'mock',

  -- Airpay's own transaction id, recorded at settlement for dashboard lookup.
  add column if not exists ap_transactionid text,

  -- When Order Confirmation last returned a trusted answer for this order.
  add column if not exists ap_verified_at timestamptz;

comment on column public.orders.access_token is
  'Opaque per-order read key for GET /api/orders/:ref. Compared in constant time; never derived from the request.';
comment on column public.orders.ap_transactionid is
  'Airpay transaction id. Recorded for dashboard lookup only — payment mode, BIN, bank, RRN and settlement batch stay in Airpay (§17).';

alter table public.orders
  drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('mock', 'airpay'));

-- ---------------------------------------------------------------------------
-- 2. requires_review (§10.5, edge case 45)
-- ---------------------------------------------------------------------------
--
-- An amount that does not match the server-computed total to within 0.001
-- becomes requires_review: never paid, never failed, and never left pending.
-- Money may have moved, just not the expected sum, so automation stops and a
-- human investigates.
--
-- It is TERMINAL so a later delivery cannot quietly overwrite a flag raised
-- for human investigation.

alter table public.payments
  drop constraint if exists payments_status_check;
alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'initiated', 'succeeded', 'failed', 'refunded', 'requires_review'));

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending_payment', 'paid', 'in_progress', 'delivered',
                    'cancelled', 'failed', 'requires_review'));

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index if not exists orders_ap_transactionid_idx
  on public.orders (ap_transactionid) where ap_transactionid is not null;

-- Drives the reconciliation sweep's "oldest unsettled first" scan (§16).
create index if not exists orders_unsettled_idx
  on public.orders (created_at)
  where status in ('pending_payment', 'requires_review');

create index if not exists orders_reference_idx
  on public.orders (reference);

-- ---------------------------------------------------------------------------
-- 4. Settlement RPC — the ONE conditional UPDATE (§10.2)
-- ---------------------------------------------------------------------------
--
-- Idempotency is the database, not application logic: the check and the write
-- are a single statement, so two simultaneous settlements cannot both pass.
-- Postgres applies the row lock and the loser updates zero rows — reported as
-- a null return, which is a CORRECT OUTCOME, not an error.
--
-- SECURITY DEFINER + service-role-only execution: the browser anon key must
-- never reach this function, because it is the only thing that can mark an
-- order paid.

create or replace function public.settle_airpay_order(
  p_order_ref        text,
  p_payment_status   text,
  p_ap_transactionid text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_status text;
begin
  if p_payment_status not in ('succeeded', 'failed', 'requires_review') then
    raise exception 'settle_airpay_order: unsupported payment status';
  end if;

  v_order_status := case p_payment_status
    when 'succeeded'       then 'paid'
    when 'requires_review' then 'requires_review'
    else 'failed'
  end;

  -- The guard: only an order NOT already in a terminal state may transition.
  -- 'requires_review' is included in the terminal set so a later callback
  -- cannot overwrite a human's flag (edge case 45).
  update public.orders
     set status           = v_order_status,
         ap_transactionid = coalesce(p_ap_transactionid, ap_transactionid),
         ap_verified_at   = now(),
         updated_at       = now()
   where reference = p_order_ref
     and status not in ('paid', 'failed', 'cancelled', 'delivered', 'requires_review')
  returning id into v_order_id;

  -- Zero rows updated: either no such order, or another worker already
  -- settled it. Both are correct, non-exceptional outcomes.
  if v_order_id is null then
    return null;
  end if;

  update public.payments
     set status               = p_payment_status,
         provider             = 'airpay',
         provider_payment_id  = coalesce(p_ap_transactionid, provider_payment_id),
         updated_at           = now()
   where order_id = v_order_id
     and status not in ('succeeded', 'failed', 'refunded', 'requires_review');

  return v_order_id::text;
end;
$$;

revoke all on function public.settle_airpay_order(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Cancellation (§10.6)
-- ---------------------------------------------------------------------------
--
-- Moves an order to cancelled through the same conditional guard, so it can
-- only ever move it out of a non-terminal state. It cannot undo a payment that
-- settled while the shopper was pressing back.

create or replace function public.cancel_airpay_order(p_order_ref text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
begin
  update public.orders
     set status = 'cancelled', updated_at = now()
   where reference = p_order_ref
     and status not in ('paid', 'failed', 'cancelled', 'delivered', 'requires_review')
  returning id into v_order_id;

  return v_order_id::text;
end;
$$;

revoke all on function public.cancel_airpay_order(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Order creation for the Airpay flow (§7.2)
-- ---------------------------------------------------------------------------
--
-- Step 2 of the documented sequence — THE SECURITY BOUNDARY. The caller sends
-- service slugs and contact details only; every price is resolved here from
-- the catalogue. There is deliberately no parameter by which a caller could
-- state an amount (edge case 42).
--
-- Step 3 — the order is INSERTed as pending_payment with the server's amount
-- before the gateway is contacted, so an Airpay outage leaves a recorded
-- order rather than a silent nothing.

create or replace function public.create_airpay_order(
  p_service_slugs text[],
  p_order_ref     text,
  p_guest_token   uuid,
  p_contact_name  text default null,
  p_contact_email text default null,
  p_contact_phone text default null
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
  if p_service_slugs is null or array_length(p_service_slugs, 1) is null then
    raise exception 'create_airpay_order: no services supplied';
  end if;

  -- public.orders carries CHECK (num_nonnulls(user_id, guest_token) = 1), so
  -- every order must have exactly one owner. This is guest checkout. The token
  -- identifies the shopper's session only — it is NOT authorization to settle,
  -- which stays service-role-only.
  if p_guest_token is null then
    raise exception 'create_airpay_order: guest token required';
  end if;

  -- Price authority: services.price_inr, resolved server-side.
  select coalesce(sum(s.price_inr), 0) into v_total
    from public.services s
   where s.slug = any (p_service_slugs)
     and s.is_active;

  if v_total <= 0 then
    raise exception 'create_airpay_order: no active services matched';
  end if;

  insert into public.orders (
    reference, status, subtotal_inr, total_inr, currency, payment_method,
    guest_token, contact_name, contact_email, contact_phone
  )
  values (
    p_order_ref, 'pending_payment', v_total, v_total, 'INR', 'airpay',
    p_guest_token, p_contact_name, p_contact_email, p_contact_phone
  )
  returning orders.id into v_order_id;

  -- Purchase-time snapshots. Never join to services to render a past order.
  insert into public.order_items (
    order_id, service_id, service_slug, title, icon,
    unit_price_inr, quantity, subtotal_inr
  )
  select v_order_id, s.id, s.slug, s.title, s.icon, s.price_inr, 1, s.price_inr
    from public.services s
   where s.slug = any (p_service_slugs)
     and s.is_active;

  insert into public.payments (order_id, provider, status, amount_inr, currency)
  values (v_order_id, 'airpay', 'pending', v_total, 'INR');

  return query
    select o.id, o.reference, o.total_inr, o.access_token
      from public.orders o
     where o.id = v_order_id;
end;
$$;

revoke all on function public.create_airpay_order(text[], text, uuid, text, text, text)
  from public, anon, authenticated;
