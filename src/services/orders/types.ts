import type { ServiceResult } from '@/services/result'

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'in_progress'
  | 'delivered'
  | 'cancelled'
  | 'failed'

export type OrderPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

/** A purchase-time snapshot, not a live catalogue read. */
export interface OrderItem {
  serviceSlug: string
  title: string
  icon: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface Order {
  id: string
  /** Human-facing reference, e.g. AM-7F3K2Q9D. */
  reference: string
  status: OrderStatus
  subtotal: number
  total: number
  currency: 'INR'
  createdAt: string
  paymentStatus: OrderPaymentStatus | null
  items: readonly OrderItem[]
}

export interface OrderSummary {
  id: string
  reference: string
  status: OrderStatus
  total: number
  createdAt: string
  itemCount: number
}

/** Contact details captured at checkout. */
export interface CreateOrderInput {
  serviceSlugs: readonly string[]
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

/**
 * The order boundary.
 *
 * createOrder deliberately takes only service slugs: the authoritative price is
 * resolved by the database, never sent by the browser (CLAUDE.md §11).
 */
export interface OrderService {
  createOrder(input: CreateOrderInput): Promise<ServiceResult<Order>>
  getOrder(orderId: string): Promise<ServiceResult<Order | null>>
  listOrders(): Promise<ServiceResult<readonly OrderSummary[]>>
}
