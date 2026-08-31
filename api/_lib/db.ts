import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { ConfigError } from './config.js'

/**
 * Server-side Supabase access (AIPAY-DOCS §17, AGENTS.md §30.8).
 *
 * This client holds the SERVICE ROLE key, which bypasses RLS entirely. It
 * exists only inside serverless functions and must never be imported from
 * anything under src/ — that tree is compiled into the browser bundle.
 */

let client: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (client) return client

  const url = process.env['SUPABASE_URL']?.trim()
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim()

  if (!url) throw new ConfigError('Missing required environment variable: SUPABASE_URL')
  if (!key) {
    throw new ConfigError('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY')
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

/** Exposed for tests; never called in request paths. */
export function resetServiceClient(): void {
  client = null
}

export interface OrderRecord {
  readonly id: string
  readonly reference: string
  readonly status: string
  readonly totalInr: number
  readonly accessToken: string
  readonly paymentMethod: string
  readonly apTransactionId: string | null
  readonly createdAt: string
}

interface OrderRow {
  id: string
  reference: string
  status: string
  total_inr: number
  access_token: string
  payment_method: string
  ap_transactionid: string | null
  created_at: string
}

const ORDER_COLUMNS =
  'id, reference, status, total_inr, access_token, payment_method, ap_transactionid, created_at'

function toRecord(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    totalInr: row.total_inr,
    accessToken: row.access_token,
    paymentMethod: row.payment_method,
    apTransactionId: row.ap_transactionid,
    createdAt: row.created_at,
  }
}

export async function findOrderByRef(orderRef: string): Promise<OrderRecord | null> {
  const { data, error } = await getServiceClient()
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('reference', orderRef)
    .maybeSingle<OrderRow>()

  if (error || !data) return null
  return toRecord(data)
}

/**
 * The conditional-UPDATE settlement write (§10.2).
 *
 * Returns null when zero rows were updated — meaning another worker already
 * settled this order. That is a correct outcome, not an error.
 */
export async function settleOrderRow(
  orderRef: string,
  paymentStatus: 'succeeded' | 'failed' | 'requires_review',
  apTransactionId: string | null,
): Promise<string | null> {
  const { data, error } = await getServiceClient().rpc('settle_airpay_order', {
    p_order_ref: orderRef,
    p_payment_status: paymentStatus,
    p_ap_transactionid: apTransactionId,
  })

  if (error) throw new Error(`settle_airpay_order failed: ${error.code ?? 'unknown'}`)
  return typeof data === 'string' ? data : null
}

export async function cancelOrderRow(orderRef: string): Promise<string | null> {
  const { data, error } = await getServiceClient().rpc('cancel_airpay_order', {
    p_order_ref: orderRef,
  })

  if (error) throw new Error(`cancel_airpay_order failed: ${error.code ?? 'unknown'}`)
  return typeof data === 'string' ? data : null
}

/**
 * Unsettled Airpay orders inside the reconciliation window (§16), oldest first.
 */
export async function findUnsettledOrders(
  minAgeMs: number,
  maxAgeMs: number,
  batchSize: number,
): Promise<readonly OrderRecord[]> {
  const now = Date.now()
  const { data, error } = await getServiceClient()
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('payment_method', 'airpay')
    .eq('status', 'pending_payment')
    .lte('created_at', new Date(now - minAgeMs).toISOString())
    .gte('created_at', new Date(now - maxAgeMs).toISOString())
    .order('created_at', { ascending: true })
    .limit(batchSize)
    .returns<OrderRow[]>()

  if (error || !data) return []
  return data.map(toRecord)
}
