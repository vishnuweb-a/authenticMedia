/**
 * Cart feature.
 *
 * Reference: inspiration/cart(screenshot).png. The cart is a slide-over drawer
 * over a dimmed page, never a route. Shared state already exists in
 * src/stores (useCart), and checkout goes through the PaymentService interface
 * in src/services/payment — the Airpay integration point.
 *
 * The drawer needs dialog semantics: role="dialog", aria-modal, a focus trap,
 * Esc to close, focus restored to the cart button, and background scroll lock.
 * Line items have no quantity stepper — delete is the only line action.
 */
export {}
