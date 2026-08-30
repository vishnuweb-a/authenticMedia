import { supabaseOrderService } from './supabase-order-service'
import type { OrderService } from './types'

export type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderPaymentStatus,
  OrderService,
  OrderStatus,
  OrderSummary,
} from './types'

/** The active order implementation. */
export const orderService: OrderService = supabaseOrderService
