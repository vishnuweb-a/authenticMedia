-- Restore the ₹2 Airpay integration-test service.
--
-- Reverses 20260901_retire_airpay_test_service.sql.
--
-- REACTIVATED, NOT RE-INSERTED. The retirement set is_active = false rather
-- than deleting the row, precisely so it could be brought back without
-- creating a second one. The original row still holds its id, price, title,
-- copy and catalogue position, so flipping the flag restores the SAME service
-- the previous orders reference — an insert would have produced a duplicate
-- slug (or a new id that the existing order_items do not point at).
--
-- is_active = true re-admits it to all three layers it was withdrawn from:
--
--   1. the public RLS read policy on services  -- `using (is_active)`
--   2. the catalogue read queries              -- `.eq('is_active', true)`
--   3. the server-side pricing sum in create_airpay_order
--        -- `sum(s.price_inr) ... and s.is_active`
--
-- It remains an ordinary catalogue entry priced in services.price_inr, not a
-- payment bypass: create_airpay_order resolves ₹2 through the same server-side
-- path it resolves ₹849 through, and no endpoint, signing or settlement code
-- knows this row exists.
--
-- Idempotent, and scoped to exactly one slug.

update public.services
   set is_active = true
 where slug = 'airpay-integration-test';
