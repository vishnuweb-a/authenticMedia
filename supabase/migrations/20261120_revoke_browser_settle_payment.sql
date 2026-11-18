-- SECURITY: stop the browser from marking orders paid. NOT YET APPLIED — review first.
-- See docs/ISGPAY-PRODUCTION-PHASE3.md §7.
--
-- public.settle_payment(uuid, boolean, text, uuid, text) is a mock-era
-- SECURITY DEFINER function, created outside this repository. In production it
-- is EXECUTE-able by anon and authenticated (Supabase advisor 0028/0029), and
-- for any order whose id + guest token the caller knows it sets
-- orders.status = 'paid' and payments.status = 'succeeded' — with no
-- payment_method or status check and no gateway verification. The id is
-- returned by the equally anon-callable get_orders(p_guest_token), and the
-- guest token is the shopper's own. That bypasses Airpay and ISGPay settlement.
--
-- Nothing deployed calls it: the only caller is src/services/payment/
-- mock-payment-service.ts, which no UI uses. The function is kept (service_role
-- retains EXECUTE) so this change is a pure privilege removal, reversible with
-- a GRANT, and touches no row.

revoke execute on function public.settle_payment(uuid, boolean, text, uuid, text)
  from public, anon, authenticated;
