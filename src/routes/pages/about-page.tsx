import {
  AboutHero,
  AboutNarrative,
  ApproachSection,
  CapabilitiesSection,
  ClosingCtaSection,
} from '@/features/about'

/**
 * About — who Authentic Media is.
 *
 * Reference: inspiration/about-us(screenshot).png. The hero, the narrative and
 * the closing CTA band are verified against the capture; the two middle
 * sections reconstruct the ~49% blank region it left behind
 * (REFERENCE-LIMITATIONS.md → About Blank Region). The footer below is the
 * global one from AppShell.
 */
export function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutNarrative />
      <CapabilitiesSection />
      <ApproachSection />
      <ClosingCtaSection />
    </>
  )
}
