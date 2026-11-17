export { authService } from './auth'
export type { AuthService, SignInInput, SignUpInput } from './auth'

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

export {
  createAirpayPayment,
  createIsgpayPayment,
  fetchIsgpayAvailability,
  fetchIsgpayOrderStatus,
  fetchOrderStatus,
  ISGPAY_REF_RE,
  ISGPAY_SANDBOX_URL,
  openPaymentWindow,
  PAYMENT_WINDOW_NAME,
  paymentService,
  submitToAirpay,
  submitToIsgpay,
} from './payment'
export type {
  AirpayHandoff,
  AirpayMerchantChoice,
  CreateAirpayPaymentInput,
  CreateIsgpayPaymentInput,
  IsgpayHandoff,
  CreatePaymentInput,
  OrderPaymentState,
  OrderStatusResult,
  PaymentResult,
  PaymentService,
  PaymentStatus,
} from './payment'

export { err, ok } from './result'
export type { ServiceError, ServiceResult } from './result'
