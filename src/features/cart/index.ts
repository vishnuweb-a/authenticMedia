/**
 * Cart feature.
 *
 * Reference: inspiration/cart(screenshot).png. The cart is a slide-over drawer
 * over a dimmed page, never a route. Shared state lives in src/stores (useCart)
 * — this feature adds no cart state of its own — and checkout goes through the
 * PaymentService interface in src/services/payment, the Airpay integration
 * point. No provider SDK or credential exists in this frontend.
 */
export { CartDrawer } from './components'
