/**
 * A line in the cart.
 *
 * The reference cart shows no quantity stepper: services are single-purchase,
 * and delete is the only line action. Do not add a quantity field without a
 * requirement (SCREEN-MAP.md → Cart).
 */
export interface CartItem {
  /** Matches the id of the Service that was added. */
  serviceId: string
  title: string
  price: number
  icon: string
}
