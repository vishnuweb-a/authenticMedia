import type { ServiceIconName } from '@/components/shared'

/** Eyebrow + split heading + sub-copy, matching the shared section pattern. */
export interface ContactSectionContent {
  eyebrow: string
  /** Heading text preceding the gradient accent. */
  title: string
  /** Gradient-filled accent fragment, rendered inside the same heading. */
  titleAccent: string
  description: string
}

/**
 * One row in the DIRECT CONTACT list: rounded violet icon tile, white label,
 * muted value.
 *
 * `href` is optional because the address row is not actionable — the other
 * three resolve to mailto:, tel: and an external URL.
 */
export interface ContactChannel {
  id: string
  icon: ServiceIconName
  label: string
  /** The value as it is written in the reference. */
  value: string
  href?: string
  /** Set for the website row so it opens in a new tab. */
  external?: boolean
}

/** The fields the reconstructed form collects. */
export interface ContactFormValues {
  name: string
  email: string
  message: string
}

/** Per-field messages, keyed by the field they belong to. */
export type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>

/**
 * The form's lifecycle. `error` carries a submission failure only — field-level
 * validation is held separately so the two cannot be confused.
 */
export type ContactFormStatus = 'idle' | 'submitting' | 'success' | 'error'
