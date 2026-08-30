import {
  CatalogueMicroServicesSection,
  CoreOfferingsSection,
  ServicesHero,
} from '@/features/services'

/**
 * Services — the complete catalogue.
 *
 * Reference: inspiration/services(iPhone 14 Pro Max).png. Section order is
 * verified against the capture down to the micro-services heading, where the
 * 16384px ceiling cuts it off; the footer below is the global one from AppShell
 * (REFERENCE-LIMITATIONS.md → Screenshot Truncation).
 */
export function ServicesPage() {
  return (
    <>
      <ServicesHero />
      <CoreOfferingsSection />
      <CatalogueMicroServicesSection />
    </>
  )
}
