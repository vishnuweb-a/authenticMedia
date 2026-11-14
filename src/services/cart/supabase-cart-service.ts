import { getGuestToken, supabase } from '@/lib/supabase'
import type { CartRow } from '@/lib/supabase'
import { err, ok } from '@/services/result'
import type { CartItem } from '@/types'
import type { CartService } from './types'

function toCartItem(row: CartRow): CartItem {
  return {
    serviceId: row.service_slug,
    title: row.title,
    price: row.price_inr,
    icon: row.icon,
  }
}

export interface ActivePrice {
  slug: string
  price_inr: number
}

/**
 * Keeps the cart identical to what create_airpay_order will charge: that RPC
 * prices ONLY `is_active` services at their current `price_inr` and silently
 * skips anything else. get_cart's definition is not in this repository, so it
 * is not trusted to do the same — a retired service is dropped from the cart
 * and every price is taken from the active catalogue row.
 */
export function reconcileCartRows(
  rows: readonly CartRow[],
  active: readonly ActivePrice[],
): CartItem[] {
  const prices = new Map(active.map((row) => [row.slug, row.price_inr]))
  return rows.flatMap((row) => {
    const price = prices.get(row.service_slug)
    return price === undefined ? [] : [{ ...toCartItem(row), price }]
  })
}

/**
 * Supabase-backed cart.
 *
 * Guests never touch the cart tables directly: RLS denies anonymous table
 * access, and these RPCs take the guest token as an explicit argument, so
 * ownership is proven on every call. The same RPCs accept a signed-in user, so
 * adding authentication later needs no change here or in the UI.
 *
 * Prices in the returned rows come from the catalogue join server-side — the
 * browser never supplies one.
 */
function createSupabaseCartService(): CartService {
  async function call(
    fn: 'get_cart' | 'add_cart_item' | 'remove_cart_item' | 'clear_cart',
    args: Record<string, string>,
    failureMessage: string,
  ) {
    if (!supabase) return err<readonly CartItem[]>('offline', 'Cart sync is unavailable.')

    const params = { ...args, p_guest_token: getGuestToken() }

    if (fn !== 'get_cart') {
      const { error } = await supabase.rpc(fn, params)
      if (error) return err<readonly CartItem[]>('cart_write_failed', failureMessage)
    }

    const { data, error } = await supabase.rpc('get_cart', {
      p_guest_token: getGuestToken(),
    })

    if (error) {
      return err<readonly CartItem[]>('cart_read_failed', 'We could not load your cart.')
    }

    const rows = (data ?? []) as CartRow[]
    if (rows.length === 0) return ok<readonly CartItem[]>([])

    // The same public, RLS-limited read the catalogue page makes (active rows only).
    const active = await supabase
      .from('services')
      .select('slug, price_inr')
      .eq('is_active', true)
      .in('slug', rows.map((row) => row.service_slug))

    // Without the catalogue the rows are shown as-is; checkout still refuses
    // to hand off if the server's amount differs from the displayed total.
    if (active.error) return ok<readonly CartItem[]>(rows.map(toCartItem))

    return ok<readonly CartItem[]>(reconcileCartRows(rows, (active.data ?? []) as ActivePrice[]))
  }

  return {
    getCart: () => call('get_cart', {}, 'We could not load your cart.'),
    addItem: (serviceSlug) =>
      call('add_cart_item', { p_service_slug: serviceSlug }, 'We could not add that service.'),
    removeItem: (serviceSlug) =>
      call('remove_cart_item', { p_service_slug: serviceSlug }, 'We could not remove that item.'),
    clear: () => call('clear_cart', {}, 'We could not clear your cart.'),
  }
}

export const supabaseCartService = createSupabaseCartService()
