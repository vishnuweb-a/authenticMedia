import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'
import { CoreServicesSection, Hero, MicroServicesSection } from '@/features/home'

/**
 * Home — the landing page.
 *
 * Reference: inspiration/home.png. Section order is verified against the
 * capture; the footer below is the global one from AppShell (the capture is
 * truncated before reaching it).
 */
export function HomePage() {
  useDocumentMeta(
    'Authentic Media — IT and Digital Services for Businesses',
    'Fixed-price IT and digital services for businesses from Authentic Media and IT Sector Private Limited, ordered online and delivered remotely.',
    ROUTES.home,
  )

  return (
    <>
      <Hero />
      <CoreServicesSection />
      <MicroServicesSection />
    </>
  )
}
