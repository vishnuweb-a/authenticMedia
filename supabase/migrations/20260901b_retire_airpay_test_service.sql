-- Retire the ₹2 Airpay integration-test service (again).
--
-- Reverses 20260901_restore_airpay_test_service.sql. The service was restored
-- for a further live payment test and is now withdrawn again.
--
-- DEACTIVATED, NOT DELETED — for the same reason as the first retirement.
--
-- order_items.service_id references public.services ON DELETE SET NULL, and
-- eight order_items rows now point at this service (one more than at the first
-- retirement — another order was created in between), including the line item
-- of the real ₹2 payment AM-EMF8G-16de123d. Deleting the row would silently
-- null those references and degrade genuine payment records to satisfy a
-- catalogue cleanup. Order history is not ours to rewrite.
--
-- is_active = false is a complete withdrawal, not a cosmetic one. It gates all
-- three layers independently:
--
--   1. the public RLS read policy on services  -- `using (is_active)`
--   2. the catalogue read queries              -- `.eq('is_active', true)`
--   3. the server-side pricing sum in create_airpay_order
--        -- `sum(s.price_inr) ... and s.is_active`
--
-- Because pricing is gated too, the service cannot be bought even by a request
-- that names its slug directly: it prices to ₹0 and the order is refused.
--
-- The row is left in place, so this is reversible by setting is_active = true
-- as 20260901_restore_airpay_test_service.sql does.
--
-- Idempotent, and scoped to exactly one slug.

update public.services
   set is_active = false
 where slug = 'airpay-integration-test';
