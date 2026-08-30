/**
 * The shapes the browser actually exchanges with Supabase.
 *
 * Hand-authored rather than generated from the full schema: the browser only
 * touches the catalogue tables and the RPC surface, so a whole-schema dump
 * would be mostly dead weight and would leak table shapes the client can never
 * read (orders and payments are RPC-only for guests).
 */

/** A row of public.services joined to its category tier. */
export interface ServiceRow {
  slug: string
  title: string
  description: string
  subtitle: string | null
  features: string[]
  price_inr: number
  icon: string
  badge: string | null
  tier: string
  position: number
}

/** A row returned by the get_cart RPC. */
export interface CartRow {
  service_slug: string
  title: string
  description: string
  subtitle: string | null
  features: string[]
  price_inr: number
  icon: string
  badge: string | null
  tier: string
}

export interface OrderItemJson {
  serviceSlug: string
  title: string
  icon: string
  unitPrice: number
  quantity: number
  subtotal: number
}

/** A row returned by the get_order RPC. */
export interface OrderRow {
  id: string
  reference: string
  status: string
  subtotal_inr: number
  total_inr: number
  currency: string
  created_at: string
  payment_status: string | null
  payment_provider: string | null
  items: OrderItemJson[]
}

/** A row returned by the get_orders RPC. */
export interface OrderSummaryRow {
  id: string
  reference: string
  status: string
  total_inr: number
  created_at: string
  item_count: number
}
