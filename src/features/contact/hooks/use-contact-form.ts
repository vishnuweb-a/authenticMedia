import { useCallback, useState, type FormEvent } from 'react'

import { contactService } from '../services/contact.service'
import type {
  ContactFormErrors,
  ContactFormStatus,
  ContactFormValues,
} from '../types/contact.types'

const EMPTY_VALUES: ContactFormValues = { name: '', email: '', message: '' }

/**
 * Deliberately permissive: it rejects the shapes that are certainly wrong
 * rather than trying to decide which addresses are real. The backend and the
 * confirmation email are what actually verify an address.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const MESSAGE_MIN_LENGTH = 10

export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'Please enter your name.'
  }

  const email = values.email.trim()
  if (!email) {
    errors.email = 'Please enter your email address.'
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Please enter a valid email address.'
  }

  const message = values.message.trim()
  if (!message) {
    errors.message = 'Please tell us how we can help.'
  } else if (message.length < MESSAGE_MIN_LENGTH) {
    errors.message = `Please use at least ${MESSAGE_MIN_LENGTH} characters.`
  }

  return errors
}

export interface UseContactFormResult {
  values: ContactFormValues
  errors: ContactFormErrors
  status: ContactFormStatus
  /** Submission failure only — field problems live in `errors`. */
  submitError: string | null
  setValue: (field: keyof ContactFormValues, value: string) => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
  reset: () => void
}

/**
 * Owns the contact form's values, validation and submission lifecycle.
 *
 * Validation runs on submit and then re-runs per field as the user types, so
 * nobody is told they are wrong before they have finished, but a corrected
 * field clears its own message immediately.
 */
export function useContactForm(): UseContactFormResult {
  const [values, setValues] = useState<ContactFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [status, setStatus] = useState<ContactFormStatus>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const setValue = useCallback(
    (field: keyof ContactFormValues, value: string) => {
      setValues((current) => {
        const next = { ...current, [field]: value }

        // Only re-validate once the user has tried to submit at least once.
        if (hasSubmitted) {
          setErrors(validateContactForm(next))
        }

        return next
      })
    },
    [hasSubmitted],
  )

  const reset = useCallback(() => {
    setValues(EMPTY_VALUES)
    setErrors({})
    setStatus('idle')
    setSubmitError(null)
    setHasSubmitted(false)
  }, [])

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setHasSubmitted(true)

      const nextErrors = validateContactForm(values)
      setErrors(nextErrors)

      if (Object.keys(nextErrors).length > 0) {
        setStatus('idle')
        setSubmitError(null)
        return
      }

      setStatus('submitting')
      setSubmitError(null)

      void contactService.submitEnquiry(values).then((result) => {
        if (result.ok) {
          setStatus('success')
          return
        }

        setStatus('error')
        setSubmitError(result.error.message)
      })
    },
    [values],
  )

  return { values, errors, status, submitError, setValue, handleSubmit, reset }
}
