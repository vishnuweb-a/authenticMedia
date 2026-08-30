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

function delay(ms = 900): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Frontend-only stand-in. It resolves locally and sends nothing anywhere — no
 * message actually reaches Authentic Media until a backend exists.
 *
 * Submitting the literal address `fail@example.com` returns a failure so the
 * error state is reachable during development.
 */
function createMockContactService(): ContactService {
  return {
    async submitEnquiry(values: ContactFormValues) {
      await delay()

      if (values.email.trim().toLowerCase() === 'fail@example.com') {
        return err(
          'submission_failed',
          "We couldn't send your message just now. Please try again.",
        )
      }

      return ok({
        enquiryId: `mock_${Date.now().toString(36)}`,
        receivedAt: new Date().toISOString(),
      })
    },
  }
}

export const contactService: ContactService = createMockContactService()
