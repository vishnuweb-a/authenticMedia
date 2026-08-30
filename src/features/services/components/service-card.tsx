import { Button, Card } from '@/components/ui'
import { ServiceIcon, isServiceIconName } from '@/components/shared'
import { formatInr } from '@/lib/format'
import { useAddToCart } from '../hooks/use-add-to-cart'
import type { ServiceCardProps } from '../types/services.types'

/**
 * Core-service card: bare glyph, title, prose description, **muted** pill.
 *
 * The reference draws these icons without the rounded tile that micro-service
 * cards use, and pairs them with the subdued `cart` pill rather than the
 * gradient — a deliberate hierarchy between the two tiers that must not be
 * collapsed (DESIGN-SYSTEM.md → Button / CTA System).
 *
 * Shared by Home (first six entries) and Services (the full list), so it lives
 * with the catalogue it renders rather than inside either page's feature.
 */
export function ServiceCard({ service }: ServiceCardProps) {
  const { isAdded, add } = useAddToCart(service)

  return (
    <Card
      id={`service-${service.id}`}
      interactive
      // scroll-mt clears the sticky header when search deep-links to this card.
      className="relative flex h-full scroll-mt-24 flex-col"
    >
      {service.badge && (
        // Measured at ~76×24px CSS, inset ~17px from the card's top-right on the
        // Branding & Content card — the only badged entry in the capture.
        <p className="bg-gradient-primary absolute top-5 right-5 rounded-pill px-3 py-1 text-[11px] leading-none font-bold tracking-[0.08em] text-text uppercase">
          {service.badge}
        </p>
      )}

      {isServiceIconName(service.icon) && <ServiceIcon name={service.icon} className="size-9" />}

      <h3 className="mt-6 text-[21px]">{service.title}</h3>

      <p className="mt-4 text-[15px] text-text-muted">{service.description}</p>

      {/* mt-auto keeps the pill on the card floor so a row of cards aligns. */}
      <div className="mt-auto pt-7">
        <Button
          variant="cart"
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
