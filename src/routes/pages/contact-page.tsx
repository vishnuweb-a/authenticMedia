import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'
import { ContactFormSection, ContactHero, DirectContactSection } from '@/features/contact'

/**
 * Contact — how to reach Authentic Media.
 *
 * Reference: inspiration/contact-us(screenshot).png. The hero and the DIRECT
 * CONTACT block (rows plus the 24-hour notice) are verified against the
 * capture; the form below reconstructs the region the capture left blank
 * (REFERENCE-LIMITATIONS.md → Contact Form Gap). The footer is the global one
 * from AppShell.
 */
export function ContactPage() {
  useDocumentMeta(
    'Contact Us — Authentic Media',
    'Email, phone and registered office address of Authentic Media and IT Sector Private Limited, and an enquiry form.',
    ROUTES.contact,
  )

  return (
    <>
      <ContactHero />
      <DirectContactSection />
      <ContactFormSection />
    </>
  )
}
