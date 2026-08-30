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
  return (
    <>
      <ContactHero />
      <DirectContactSection />
      <ContactFormSection />
    </>
  )
}
