-- Retire the ₹2 Airpay integration-test service.
--
-- The live payment path has been verified end to end, so the test entry is
-- withdrawn from the catalogue.
--
-- DEACTIVATED, NOT DELETED — deliberately.
--
-- order_items.service_id references public.services ON DELETE SET NULL, and
-- seven order_items rows point at this service, including the line item of a
-- real ₹2 payment (order AM-EMF8G-16de123d). Deleting the row would silently
-- null those references and degrade genuine payment records to satisfy a
-- catalogue cleanup. Order history is not ours to rewrite.
--
-- is_active = false is a complete withdrawal, not a partial one. It gates all
-- three layers independently:
--
--   1. the public RLS read policy on services  -- `using (is_active)`
--   2. the catalogue read queries              -- `.eq('is_active', true)`
--   3. the server-side pricing sum in create_airpay_order
--        -- `sum(s.price_inr) ... and s.is_active`
--
-- Because pricing is gated too, the service cannot be bought even by a request
-- that names its slug directly: it would price to nothing and the order would
-- be refused. That is a stronger guarantee than hiding it in the UI.
--
-- Idempotent, and scoped to exactly one slug.

update public.services
   set is_active = false
 where slug = 'airpay-integration-test';
