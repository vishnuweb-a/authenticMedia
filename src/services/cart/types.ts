import type { CartItem } from '@/types'
import type { ServiceResult } from '@/services/result'

/**
 * The cart persistence boundary.
 *
 * Every operation returns the full cart so the caller never has to guess what
 * the server did — re-adding an existing service is a no-op server-side, and
 * the returned list is the authority.
 */
export interface CartService {
  getCart(): Promise<ServiceResult<readonly CartItem[]>>
  addItem(serviceSlug: string): Promise<ServiceResult<readonly CartItem[]>>
  removeItem(serviceSlug: string): Promise<ServiceResult<readonly CartItem[]>>
  clear(): Promise<ServiceResult<readonly CartItem[]>>
}
