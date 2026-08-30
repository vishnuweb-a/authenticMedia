import { CoreServicesSection, Hero, MicroServicesSection } from '@/features/home'

/**
 * Home — the landing page.
 *
 * Reference: inspiration/home.png. Section order is verified against the
 * capture; the footer below is the global one from AppShell (the capture is
 * truncated before reaching it).
 */
export function HomePage() {
  return (
    <>
      <Hero />
      <CoreServicesSection />
      <MicroServicesSection />
    </>
  )
}
