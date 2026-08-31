-- A ₹2 catalogue service for controlled end-to-end Airpay verification.
--
-- ADDITIVE ONLY. It inserts one row into public.services and rewrites nothing.
--
-- This is an ordinary catalogue entry, not a payment bypass. It is priced in
-- the same column every other service is priced in (services.price_inr), so
-- create_airpay_order resolves ₹2 through the same server-side path it resolves
-- ₹849 through. No endpoint, no signing code and no settlement code knows this
-- row exists — which is the point: a test that needed special handling in the
-- payment path would not be testing the payment path.
--
-- It sits last in the micro-services tier so it never displaces a real
-- offering, and is idempotent on slug so re-running creates no duplicate.

insert into public.services (
  slug, category_id, title, description, subtitle, features,
  price_inr, icon, is_active, position
)
select
  'airpay-integration-test',
  c.id,
  'Airpay Integration Test',
  'A minimum-value service used to verify the live Airpay payment path end to end. It carries no deliverable — please do not purchase it.',
  'Internal payment verification',
  array[
    'Verifies the hosted payment hand-off',
    'Verifies Order Confirmation settlement',
    'Verifies the KKChat callback relay'
  ]::text[],
  2,
  'card',
  true,
  -- After every existing entry, so ordinary catalogue order is unchanged.
  (select coalesce(max(s.position), 0) + 1 from public.services s)
from public.service_categories c
where c.slug = 'micro-services'
on conflict (slug) do nothing;
