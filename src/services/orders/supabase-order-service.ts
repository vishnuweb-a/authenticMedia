import { getGuestToken, supabase } from '@/lib/supabase'
import type { OrderRow, OrderSummaryRow } from '@/lib/supabase'
import { err, ok } from '@/services/result'
import type {
  CreateOrderInput,
  Order,
  OrderPaymentStatus,
  OrderService,
  OrderStatus,
  OrderSummary,
} from './types'

const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'paid',
  'in_progress',
  'delivered',
  'cancelled',
  'failed',
]

const PAYMENT_STATUSES: readonly OrderPaymentStatus[] = [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]

/** Narrows a database string to the domain union without trusting it blindly. */
function toOrderStatus(value: string): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : 'pending_payment'
}

function toPaymentStatus(value: string | null): OrderPaymentStatus | null {
  if (!value) return null
  return PAYMENT_STATUSES.includes(value as OrderPaymentStatus)
    ? (value as OrderPaymentStatus)
    : null
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    reference: row.reference,
    status: toOrderStatus(row.status),
    subtotal: row.subtotal_inr,
    total: row.total_inr,
    currency: 'INR',
    createdAt: row.created_at,
    paymentStatus: toPaymentStatus(row.payment_status),
    items: row.items ?? [],
  }
}

const OFFLINE = 'Orders are unavailable right now. Please try again shortly.'

/**
 * Supabase-backed orders.
 *
 * create_order is a SECURITY DEFINER RPC: the browser passes service slugs and
 * contact details only, and the database resolves every price from the
 * catalogue and snapshots it onto the order lines.
 */
function createSupabaseOrderService(): OrderService {
  return {
    async createOrder(input: CreateOrderInput) {
      if (!supabase) return err<Order>('offline', OFFLINE)

      if (input.serviceSlugs.length === 0) {
        return err<Order>('empty_cart', 'Your cart is empty.')
      }

      const { data: orderId, error } = await supabase.rpc('create_order', {
        p_service_slugs: [...input.serviceSlugs],
        p_guest_token: getGuestToken(),
        p_contact_name: input.contactName ?? null,
        p_contact_email: input.contactEmail ?? null,
        p_contact_phone: input.contactPhone ?? null,
      })

      if (error || typeof orderId !== 'string') {
        return err<Order>('order_failed', error?.message ?? 'We could not create your order.')
      }

      const created = await this.getOrder(orderId)
      if (!created.ok) return created
      if (!created.data) return err<Order>('order_failed', 'We could not read back your order.')

      return ok(created.data)
    },

    async getOrder(orderId: string) {
      if (!supabase) return err<Order | null>('offline', OFFLINE)

      const { data, error } = await supabase.rpc('get_order', {
        p_order_id: orderId,
        p_guest_token: getGuestToken(),
      })

      if (error) return err<Order | null>('order_read_failed', 'We could not load that order.')

      const rows = (data ?? []) as OrderRow[]
      const row = rows[0]

      return ok(row ? toOrder(row) : null)
    },

    async listOrders() {
      if (!supabase) return err<readonly OrderSummary[]>('offline', OFFLINE)

      const { data, error } = await supabase.rpc('get_orders', {
        p_guest_token: getGuestToken(),
      })

      if (error) {
        return err<readonly OrderSummary[]>('order_read_failed', 'We could not load your orders.')
      }

      const rows = (data ?? []) as OrderSummaryRow[]

      return ok<readonly OrderSummary[]>(
        rows.map((row) => ({
          id: row.id,
          reference: row.reference,
          status: toOrderStatus(row.status),
          total: row.total_inr,
          createdAt: row.created_at,
          itemCount: row.item_count,
        })),
      )
    },
  }
}

export const supabaseOrderService = createSupabaseOrderService()
