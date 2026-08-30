/**
 * Format a paise-free INR amount for display, e.g. 849 -> "₹849".
 *
 * Prices across the reference are whole rupees and always render with the ₹
 * symbol (see DESIGN-SYSTEM.md → Button / CTA System → Label format).
 */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}
