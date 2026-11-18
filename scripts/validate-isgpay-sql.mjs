// Executes the ISGPay migrations on in-memory Postgres (PGlite) over a stub of the
// production base schema (read from the live catalog 2026-11-18) and checks the
// live duplicate-payment guard, environment pinning and privileges. No network,
// no real database. Sequential only: PGlite has one backend, so lock CONTENTION
// is not exercised; that needs the staging run in docs/ISGPAY-PRODUCTION-PHASE3.md.
//
//   npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/validate-isgpay-sql.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const REPO = process.cwd()
const { PGlite } = await import('@electric-sql/pglite')
const db = new PGlite()
const mig = (f) => readFileSync(`${REPO}/supabase/migrations/${f}`, 'utf8')

await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users (id uuid primary key);
create schema app_private; create table app_private.app_users (id uuid primary key default gen_random_uuid());
create table public.services (id uuid primary key default gen_random_uuid(), slug text unique, title text, icon text, price_inr integer, is_active boolean default true);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, guest_token uuid,
  reference text not null unique, status text not null default 'pending_payment',
  subtotal_inr integer not null check (subtotal_inr >= 0), total_inr integer not null check (total_inr >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  contact_name text, contact_email text, contact_phone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  access_token uuid not null default gen_random_uuid(),
  payment_method text not null default 'mock' check (payment_method in ('mock','airpay','isgpay')),
  ap_transactionid text, ap_verified_at timestamptz,
  constraint orders_one_owner check (num_nonnulls(user_id, guest_token) = 1),
  constraint orders_status_check check (status in ('pending_payment','paid','in_progress','delivered','cancelled','failed','requires_review')));
create table public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null, service_slug text, title text, icon text,
  unit_price_inr integer, quantity integer check (quantity > 0), subtotal_inr integer);
create table public.payments (id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id) on delete cascade,
  provider text, status text, amount_inr integer, currency text default 'INR', provider_payment_id text, failure_reason text,
  created_at timestamptz default now(), updated_at timestamptz default now());
create function public.settle_payment(p_order_id uuid, p_succeeded boolean, p_provider_payment_id text default null, p_guest_token uuid default null, p_failure_reason text default null)
  returns text language sql security definer as $$ select 'stub' $$;
grant execute on function public.settle_payment(uuid, boolean, text, uuid, text) to anon, authenticated, service_role;
insert into public.services (slug, title, icon, price_inr) values ('audit', 'Audit', 'shield', 149);
`)
for (const f of ['20261117_isgpay_uat_orders.sql', '20261119_isgpay_gateway_environment.sql', '20261120_revoke_browser_settle_payment.sql']) {
  await db.exec(mig(f)); console.log('applied', f)
}
await db.exec(mig('20261119_isgpay_gateway_environment.sql')); console.log('re-applied 20261119 (idempotent)')

let n = 0
const ref = () => 'ISG' + 'MWLZZW6Y' + (++n).toString(16).toUpperCase().padStart(16, '0')
const G = (i) => `0000000${i}-0000-4000-8000-000000000000`
const U = (await db.query(`insert into app_private.app_users default values returning id`)).rows[0].id
async function create(guest, env, user = null) {
  const r = ref()
  try {
    await db.query(`select * from public.create_isgpay_order(array['audit'], $1, $2::uuid, $3, null, null, null, $4::uuid)`, [r, guest, env, user])
    return { ok: true, ref: r }
  } catch (e) { return { ok: false, code: e.code, detail: e.detail, msg: e.message } }
}
const check = (name, cond) => { assert.ok(cond, name); console.log('PASS', name) }

const a = await create(G(1), 'production')
check('first live order is created', a.ok)
const b = await create(G(1), 'production')
check('second live order for the same guest token is refused with IG409', !b.ok && b.code === 'IG409')
check('the refusal names the ORIGINAL reference', b.detail === a.ref)
check('the refused attempt wrote nothing', (await db.query(`select count(*)::int c from orders`)).rows[0].c === 1)

check('a sandbox order for the same shopper is still allowed', (await create(G(1), 'uat')).ok)
check('a pending sandbox order never blocks a live one', (await create(G(2), 'uat')).ok && (await create(G(2), 'production')).ok)
await db.query(`insert into orders (reference, status, subtotal_inr, total_inr, payment_method, guest_token) values ($1,'pending_payment',149,149,'isgpay',$2)`, [ref(), G(3)])
check('a legacy (NULL = UAT) pending order never blocks a live one', (await create(G(3), 'production')).ok)

const c = await create(G(4), 'production', U)
check('live order with signed-in account is created', c.ok)
const d = await create(G(5), 'production', U)
check('same account on another device (new guest token) is refused', !d.ok && d.code === 'IG409' && d.detail === c.ref)
check('a different signed-out shopper is unaffected', (await create(G(6), 'production')).ok)

await db.query(`update orders set created_at = now() - interval '3 days' where reference = $1`, [a.ref])
check('a pending live order older than 24h STILL blocks', (await create(G(1), 'production')).code === 'IG409')

check('legacy 3-arg settle cannot touch a production row', (await db.query(`select public.settle_isgpay_order($1,'succeeded','gw1') s`, [a.ref])).rows[0].s === null)
check('UAT-pinned settle cannot touch a production row', (await db.query(`select public.settle_isgpay_order($1,'succeeded','gw1','uat') s`, [a.ref])).rows[0].s === null)
check('production settle settles it', (await db.query(`select public.settle_isgpay_order($1,'succeeded','gw1','production') s`, [a.ref])).rows[0].s !== null)
check('settlement is idempotent (second settle is a no-op)', (await db.query(`select public.settle_isgpay_order($1,'succeeded','gw1','production') s`, [a.ref])).rows[0].s === null)
check('once settled, the shopper may buy again', (await create(G(1), 'production')).ok)

let uniq = null
try { await db.query(`insert into orders (reference, status, subtotal_inr, total_inr, payment_method, guest_token, gateway_environment) values ($1,'pending_payment',149,149,'isgpay',$2,'production')`, [ref(), G(6)]) } catch (e) { uniq = e.code }
check('unique index backstop rejects a second pending live row written outside the function', uniq === '23505')
let uniqU = null
try { await db.query(`insert into orders (reference, status, subtotal_inr, total_inr, payment_method, guest_token, gateway_environment, app_user_id) values ($1,'pending_payment',149,149,'isgpay',$2,'production',$3)`, [ref(), G(7), U]) } catch (e) { uniqU = e.code }
check('unique index backstop rejects a second pending live row for one account', uniqU === '23505')

let badEnv = null
try { await db.query(`update orders set gateway_environment = 'live' where reference = $1`, [c.ref]) } catch (e) { badEnv = e.code }
check('gateway_environment CHECK rejects unknown values', badEnv === '23514')

const priv = async (role, sig) => (await db.query(`select has_function_privilege($1, $2, 'execute') p`, [role, sig])).rows[0].p
const CREATE = 'public.create_isgpay_order(text[], text, uuid, text, text, text, text, uuid)'
const SETTLE = 'public.settle_isgpay_order(text, text, text, text)'
for (const role of ['anon', 'authenticated']) {
  check(`${role} cannot execute create_isgpay_order (8-arg)`, !(await priv(role, CREATE)))
  check(`${role} cannot execute settle_isgpay_order (4-arg)`, !(await priv(role, SETTLE)))
  check(`${role} cannot execute settle_payment after 20261120`, !(await priv(role, 'public.settle_payment(uuid, boolean, text, uuid, text)')))
}
check('service_role can execute create/settle', (await priv('service_role', CREATE)) && (await priv('service_role', SETTLE)))
check('service_role keeps settle_payment', await priv('service_role', 'public.settle_payment(uuid, boolean, text, uuid, text)'))
const sd = (await db.query(`select bool_and(prosecdef) s, bool_and(proconfig @> array['search_path=public']) p from pg_proc where proname in ('create_isgpay_order','settle_isgpay_order')`)).rows[0]
check('all ISGPay functions are SECURITY DEFINER with a pinned search_path', sd.s && sd.p)
console.log('\nALL SQL CHECKS PASSED')
