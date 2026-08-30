import { Check } from 'lucide-react'

import { Button, Card } from '@/components/ui'
import { ServiceIcon, isServiceIconName } from '@/components/shared'
import { formatInr } from '@/lib/format'
import { useAddToCart } from '../hooks/use-add-to-cart'
import type { ServiceCardProps } from '../types/services.types'

/**
 * Micro-service card: icon **tile**, title, violet subtitle, a ✓ deliverables
 * list, then the **gradient** pill.
 *
 * A different anatomy and a different CTA treatment from ServiceCard — the two
 * tiers are visually distinct in the reference and stay that way here.
 */
export function MicroServiceCard({ service }: ServiceCardProps) {
  const { isAdded, add } = useAddToCart(service)

  return (
    <Card
      id={`service-${service.id}`}
      interactive
      // scroll-mt clears the sticky header when search deep-links to this card.
      className="flex h-full scroll-mt-24 flex-col"
    >
      {isServiceIconName(service.icon) && <ServiceIcon name={service.icon} tile />}

      <h3 className="mt-6 text-[19px]">{service.title}</h3>

      {service.subtitle && (
        <p className="mt-2 text-[15px] font-medium text-primary-mid">{service.subtitle}</p>
      )}

      {service.features && service.features.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2.5">
          {service.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-[15px] text-text-muted">
              <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary-mid" />
              {feature}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-7">
        <Button
          variant="primary"
          size="sm"
          onClick={add}
          disabled={isAdded}
          trailing={<span>@{formatInr(service.price)}</span>}
          aria-label={
            isAdded
              ? `${service.title} added to cart`
              : `Add ${service.title} to cart, ${formatInr(service.price)}`
          }
        >
          {isAdded ? 'Added' : 'Add to Cart'}
        </Button>
      </div>
    </Card>
  )
}
