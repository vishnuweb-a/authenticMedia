-- Retire both Airpay test services (₹2 and ₹101) for go-live.
--
-- Reverses 20260901c_restore_airpay_test_service.sql and
-- 20260901d_airpay_101_payment_test_service.sql.
--
-- DEACTIVATED, NOT DELETED — for the same reason as the earlier retirements:
-- order_items.service_id references public.services ON DELETE SET NULL, and
-- real payment line items point at these rows. Deleting would null those
-- references and degrade genuine payment records.
--
-- is_active = false gates the RLS read policy, the catalogue queries and the
-- server-side pricing sum in create_airpay_order, so neither service is
-- visible nor purchasable, even by a request naming its slug directly.
--
-- Idempotent, and scoped to exactly these two slugs.

update public.services
   set is_active = false
 where slug in ('airpay-integration-test', 'airpay-101-payment-test');
