import { ApproachSection } from '@/features/about'
import { useDocumentMeta } from '@/features/legal'
import { ServicesBrowser, ServicesHero } from '@/features/services'
import { ROUTES } from '@/routes/paths'

/**
 * Services — the complete catalogue.
 *
 * Reference: inspiration/services(iPhone 14 Pro Max).png. Section order is
 * verified against the capture down to the micro-services heading, where the
 * 16384px ceiling cuts it off; the footer below is the global one from AppShell
 * (REFERENCE-LIMITATIONS.md → Screenshot Truncation).
 */
export function ServicesPage() {
  useDocumentMeta(
    'Services — Authentic Media',
    'Every fixed-price IT and digital service from Authentic Media, with prices: maintenance, audits, integrations, automation, branding and consulting.',
    ROUTES.services,
  )

  return (
    <>
      <ServicesHero />
      <ServicesBrowser />
      {/* How ordering and delivery work (audit §4.4/§4.5) — shared with About. */}
      <ApproachSection />
    </>
  )
}
