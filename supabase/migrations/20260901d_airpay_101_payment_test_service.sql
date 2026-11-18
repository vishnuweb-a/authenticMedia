-- A ₹101 catalogue service for verifying the live Airpay payment path.
--
-- ADDITIVE ONLY. It inserts one row into public.services and rewrites nothing.
--
-- This is an ordinary catalogue entry, not a payment bypass. It is priced in
-- the same column every other service is priced in (services.price_inr), so
-- create_airpay_order resolves ₹101 through the same server-side path it
-- resolves ₹849 through. No endpoint, no signing code and no settlement code
-- knows this row exists — which is the point: a test that needed special
-- handling in the payment path would not be testing the payment path.
--
-- SEPARATE FROM, AND NOT A REPLACEMENT FOR, 'airpay-integration-test' (₹2).
-- That row stays exactly as it is: eight order_items rows point at it,
-- including the line item of a real ₹2 payment, and its price is not ours to
-- rewrite. Re-pricing an existing service would also change what a shopper
-- with it already in their cart is charged. A new slug is the additive answer.
--
-- It joins the existing micro-services category rather than creating a new one
-- (the schema needs no new category for it), and sits last in catalogue
-- position so it never displaces a real offering. Idempotent on slug, so
-- re-running creates no duplicate.

insert into public.services (
  slug, category_id, title, description, subtitle, features,
  price_inr, icon, is_active, position
)
select
  'airpay-101-payment-test',
  c.id,
  'Airpay ₹101 Payment Test',
  'A fixed ₹101 service used to verify the live Airpay payment path end to end. It carries no deliverable — please do not purchase it.',
  'Internal payment verification',
  array[
    'Verifies the hosted payment hand-off',
    'Verifies Order Confirmation settlement',
    'Verifies the KKChat callback relay'
  ]::text[],
  101,
  'card',
  true,
  -- After every existing entry, so ordinary catalogue order is unchanged.
  (select coalesce(max(s.position), 0) + 1 from public.services s)
from public.service_categories c
where c.slug = 'micro-services'
on conflict (slug) do nothing;
