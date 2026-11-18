-- Restore the ₹2 Airpay integration-test service (again).
--
-- Reverses 20260901b_retire_airpay_test_service.sql. The service was retired
-- after the last live payment test and is now needed again.
--
-- REACTIVATED, NOT RE-INSERTED. Both retirements set is_active = false rather
-- than deleting the row, precisely so it could be brought back without
-- creating a second one. The original row still holds its id
-- (08a19711-55e8-4ffc-96d3-bf68f5d71a16), price, title, copy and catalogue
-- position, so flipping the flag restores the SAME service the existing orders
-- reference. An insert would have produced a duplicate slug, or a new id that
-- the eight order_items rows pointing at this service do not reference.
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
-- knows this row exists. Settlement still requires Airpay verification.
--
-- Idempotent, and scoped to exactly one slug.

update public.services
   set is_active = true
 where slug = 'airpay-integration-test';
