/**
 * A purchasable item in the catalogue.
 *
 * The reference shows two tiers sharing one data shape and one card component:
 * core services (broad retainers, muted CTA) and micro-services (fixed-scope
 * tasks with a deliverables checklist, gradient CTA).
 */
export type ServiceTier = 'core' | 'micro'

export interface Service {
  id: string
  title: string
  /** Prose description. Core-service cards render this. */
  description: string
  /** Violet one-line subtitle. Micro-service cards render this instead. */
  subtitle?: string
  /** Checklist of deliverables. Micro-service cards only. */
  features?: readonly string[]
  /** Whole rupees, e.g. 849 renders as "@₹849". */
  price: number
  tier: ServiceTier
  /** Key into the icon registry — never a raw emoji character. */
  icon: string
  /**
   * Optional gradient pill in the card's top-right corner, e.g. "POPULAR".
   * Verified on the Branding & Content card in the Services capture; no other
   * card carries one, so this stays optional rather than becoming a required
   * discriminator.
   */
  badge?: string
}
