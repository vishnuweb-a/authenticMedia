import { SITE } from '@/lib/site'
import type { ContactChannel, ContactSectionContent } from '../types/contact.types'

/**
 * Contact page copy.
 *
 * Provenance (REFERENCE-LIMITATIONS.md → Contact Form Gap):
 *
 *   [VERIFIED]      transcribed from inspiration/contact-us(screenshot).png.
 *   [RECONSTRUCTED] written for the region the capture left blank.
 *
 * Every contact value below is read from SITE rather than retyped, so the page,
 * the footer and any future backend all quote the same details. No phone,
 * email, address or business fact is invented here.
 */

/** [VERIFIED] — eyebrow pill, "Question?" gradient-filled, then the rule. */
export const CONTACT_HERO: ContactSectionContent = {
  eyebrow: 'GET IN TOUCH',
  title: 'Have a',
  titleAccent: 'Question?',
  description:
    "At Authentic Media, we believe in clear communication and quick support. Fill out the form or reach out directly — we'll get back to you as soon as possible.",
}

/**
 * [VERIFIED] — and note this section is **left aligned**, unlike the centred
 * hero. DESIGN-SYSTEM.md describes section headers as centred; the capture
 * shows otherwise here, and the screenshot is the visual source of truth.
 */
export const CONTACT_DIRECT: ContactSectionContent = {
  eyebrow: 'DIRECT CONTACT',
  title: "Let's start a",
  titleAccent: 'conversation.',
  description:
    'Whether you have a question, want to know more about our services, or are ready to start your project, our team is here to help you at every step.',
}

/** [VERIFIED] — four rows, in this order, with these labels and values. */
export const CONTACT_CHANNELS: readonly ContactChannel[] = [
  {
    id: 'email',
    icon: 'mail',
    label: 'Email',
    value: SITE.email,
    href: `mailto:${SITE.email}`,
  },
  {
    id: 'phone',
    icon: 'phone',
    label: 'Phone',
    value: SITE.phone,
    href: `tel:${SITE.phone}`,
  },
  {
    id: 'address',
    icon: 'pin',
    label: 'Address',
    value: SITE.address.single,
  },
  {
    id: 'website',
    icon: 'globe',
    label: 'Website',
    value: SITE.website,
    href: `https://${SITE.website}`,
    external: true,
  },
]

/** [VERIFIED] — the bordered notice below the rows. */
export const CONTACT_RESPONSE_NOTICE = {
  before: 'We typically respond within ',
  emphasis: '24 hours',
  after: ' on business days.',
} as const

/**
 * [RECONSTRUCTED] — the form region did not render in the capture, so its
 * heading and copy are written here rather than transcribed. The hero's own
 * verified line ("Fill out the form or reach out directly") is the only
 * evidence that a form exists at all.
 */
export const CONTACT_FORM_CONTENT = {
  eyebrow: 'SEND A MESSAGE',
  title: 'Tell us what you',
  titleAccent: 'need.',
  description:
    'Share a few details and the right person on our team will get back to you.',
  submitLabel: 'Send Message',
  successTitle: 'Message received',
  successBody:
    "Thanks for reaching out — we'll reply to the address you gave us within one business day.",
  successAction: 'Send another message',
} as const
