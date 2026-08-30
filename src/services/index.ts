export { authService } from './auth'
export type { AuthService, SignInInput } from './auth'

export { catalogueRepository } from './catalogue'
export type { CatalogueRepository } from './catalogue'

export { cartService } from './cart'
export type { CartService } from './cart'

export { orderService } from './orders'
export type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderPaymentStatus,
  OrderService,
  OrderStatus,
  OrderSummary,
} from './orders'

export { airpayAdapter, paymentService } from './payment'
export type {
  CreatePaymentInput,
  PaymentResult,
  PaymentService,
  PaymentStatus,
} from './payment'

export { err, ok } from './result'
export type { ServiceError, ServiceResult } from './result'
