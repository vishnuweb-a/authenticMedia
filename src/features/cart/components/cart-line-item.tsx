import { Trash2 } from 'lucide-react'

import { ServiceIcon, isServiceIconName } from '@/components/shared'
import { formatInr } from '@/lib/format'
import type { CartLineItemProps } from '../types/cart.types'

/**
 * One cart line: rounded icon tile, white title, violet price, red delete.
 *
 * Geometry is measured from cart(screenshot).png at @3x and divided by 3:
 * card 87px tall with 20px inset, a 47px icon tile, content starting 106px from
 * the drawer edge, and a 32px delete button. There is deliberately **no
 * quantity stepper** — services are single-purchase and delete is the only line
 * action (verified absence, SCREEN-MAP.md → Cart).
 */
export function CartLineItem({ item, onRemove }: CartLineItemProps) {
  return (
    <li className="flex h-[87px] items-center gap-4 rounded-2xl border border-border-drawer bg-surface-drawer-item px-4">
      {isServiceIconName(item.icon) && (
        <ServiceIcon
          name={item.icon}
          tile
          className="size-12 shrink-0 rounded-[15px] border-0 bg-surface-drawer-tile"
        />
      )}

      {/* min-w-0 lets a long service name truncate instead of widening the row. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight font-bold text-text">{item.title}</p>
        <p className="mt-1 text-[15px] leading-tight font-semibold text-primary-mid">
          {formatInr(item.price)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item.serviceId)}
        aria-label={`Remove ${item.title} from cart`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/20"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </li>
  )
}
