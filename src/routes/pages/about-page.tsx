import {
  AboutHero,
  AboutNarrative,
  ApproachSection,
  CapabilitiesSection,
  ClosingCtaSection,
  CompanyInfoSection,
  ContactOfficeSection,
  OperationsSection,
} from '@/features/about'
import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

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
  useDocumentMeta(
    'About Us — Authentic Media',
    'Who Authentic Media and IT Sector Private Limited is, what it does, how its fixed-price IT and digital services work, and how to reach it.',
    ROUTES.about,
  )

  // Who we are → what we do → how services work → operations → company → contact.
  return (
    <>
      <AboutHero />
      <AboutNarrative />
      <CapabilitiesSection />
      <ApproachSection />
      <OperationsSection />
      <CompanyInfoSection />
      <ContactOfficeSection />
      <ClosingCtaSection />
    </>
  )
}
