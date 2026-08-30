import { cn } from '@/lib/cn'
import { SERVICE_ICONS, type ServiceIconName } from './service-icons'

export interface ServiceIconProps {
  name: ServiceIconName
  /** Wraps the glyph in the rounded violet tile seen on cards and contact rows. */
  tile?: boolean
  className?: string
}

/**
 * Decorative by default: the card title beside it already names the service, so
 * the glyph is hidden from assistive tech rather than announced twice.
 */
export function ServiceIcon({ name, tile = false, className }: ServiceIconProps) {
  const Icon = SERVICE_ICONS[name]

  if (!tile) {
    return <Icon aria-hidden="true" className={cn('size-7 text-primary-mid', className)} />
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-14 items-center justify-center rounded-tile',
        'border border-border bg-primary-start/12 text-primary-mid',
        className,
      )}
    >
      <Icon className="size-7" />
    </span>
  )
}
