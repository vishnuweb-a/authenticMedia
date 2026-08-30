/**
 * Contact feature.
 *
 * Reference: inspiration/contact-us(screenshot).png. Verified from the capture:
 * the hero, the left-aligned DIRECT CONTACT block, all four contact rows, the
 * 24-hour response notice, and the full footer.
 *
 * The form did not render — the capture leaves ~960 CSS px blank between the
 * notice card and the footer (REFERENCE-LIMITATIONS.md → Contact Form Gap). It
 * is reconstructed from the hero's own verified "Fill out the form" line and
 * the surrounding visual language, and says so in its own header.
 *
 * Composition: hero → direct contact → form.
 *
 * Submission goes through ContactService, whose only implementation today is a
 * local mock. Nothing is sent anywhere: no backend, no Supabase, no email
 * provider.
 */
export { ContactChannelRow, ContactFormSection, ContactHero, DirectContactSection } from './components'
export {
  CONTACT_CHANNELS,
  CONTACT_DIRECT,
  CONTACT_FORM_CONTENT,
  CONTACT_HERO,
  CONTACT_RESPONSE_NOTICE,
} from './data/contact.data'
export { useContactForm, validateContactForm } from './hooks/use-contact-form'
export { contactService } from './services/contact.service'
export type { ContactEnquiry, ContactService } from './services/contact.service'
export type * from './types/contact.types'
