import { SITE } from '@/lib/site'
import { err, ok, type ServiceResult } from '@/services/result'
import type { ContactFormValues } from '../types/contact.types'

export interface ContactEnquiry {
  enquiryId: string
  receivedAt: string
}

/**
 * The contact boundary.
 *
 * A real submission will post to a backend that owns the mailbox and the
 * anti-abuse checks; no email provider, Supabase table or API key belongs in
 * this frontend (AGENTS.md §14, CLAUDE.md §8). Swapping the implementation
 * below for a networked one is the whole integration — no component changes.
 */
export interface ContactService {
  submitEnquiry(values: ContactFormValues): Promise<ServiceResult<ContactEnquiry>>
}

/** Builds the pre-filled email the visitor's mail app will open. */
export function buildEnquiryMailto(values: ContactFormValues): string {
  const subject = `Website enquiry from ${values.name.trim()}`
  const body = `${values.message.trim()}\n\n— ${values.name.trim()} (${values.email.trim()})`
  return `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * shortcut: there is no backend mailbox yet, so the enquiry is handed to the
 * visitor's own email app, pre-filled and addressed to us. Swap this for a
 * networked implementation when an /api/contact endpoint exists — no component
 * changes needed.
 */
function createMailtoContactService(): ContactService {
  return {
    async submitEnquiry(values: ContactFormValues) {
      try {
        window.location.href = buildEnquiryMailto(values)
      } catch {
        return err(
          'submission_failed',
          `We couldn't open your email app. Please email ${SITE.email} directly.`,
        )
      }
      return ok({ enquiryId: `mailto_${Date.now().toString(36)}`, receivedAt: new Date().toISOString() })
    },
  }
}

export const contactService: ContactService = createMailtoContactService()
