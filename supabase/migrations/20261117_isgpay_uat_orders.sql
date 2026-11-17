-- ISGPay (UAT) order support. See docs/ISGPAY-UAT-PHASE1.md §13.
--
-- ADDITIVE ONLY. Widens two check constraints and adds two functions. No row
-- is rewritten, nothing is dropped, and no Airpay function is changed.
--
-- ISGPay orders live in the same orders / order_items / payments tables as
-- Airpay orders (one source of truth about money), distinguished by
-- payment_method = 'isgpay'. Every Airpay path filters on
-- payment_method = 'airpay' (reconcile sweep, status self-heal), so ISGPay rows
-- never reach Airpay settlement, and these functions refuse non-ISGPay rows.

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('mock', 'airpay', 'isgpay'));

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments
  add constraint payments_provider_check
  check (provider in ('mock', 'airpay', 'isgpay'));

-- Order creation. Same price authority as create_airpay_order: the caller sends
-- service slugs only and every price is resolved here from the catalogue.
create or replace function public.create_isgpay_order(
  p_service_slugs text[],
  p_order_ref     text,
  p_guest_token   uuid
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
    reference, status, subtotal_inr, total_inr, currency, payment_method, guest_token
  )
  values (p_order_ref, 'pending_payment', v_total, v_total, 'INR', 'isgpay', p_guest_token)
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

revoke all on function public.create_isgpay_order(text[], text, uuid) from public, anon, authenticated;

-- The ONE conditional settlement UPDATE for ISGPay rows. Only a non-terminal
-- 'isgpay' order may transition; a zero-row update returns null (another
-- worker already settled it — a correct outcome, not an error).
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
