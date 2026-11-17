import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Button, Input } from '@/components/ui'
import { ROUTES } from '@/routes/paths'
import { authService } from '@/services'
import { validateEmail } from '../lib/validation'
import { AuthShell, FormError } from './auth-shell'

const LINK = 'font-semibold text-primary-mid hover:underline'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const invalid = validateEmail(email)
    setError(invalid)
    setSubmitError(null)
    if (invalid) return

    setIsSubmitting(true)
    const result = await authService.requestPasswordReset(email.trim())
    setIsSubmitting(false)
    if (!result.ok) setSubmitError(result.error.message)
    else setIsSent(true)
  }

  const backLink = (
    <Link to={ROUTES.login} className={LINK}>
      Back to sign in
    </Link>
  )

  if (isSent) {
    return (
      <AuthShell title="Check your email" footer={backLink}>
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <span
            aria-hidden="true"
            className="inline-flex size-12 items-center justify-center rounded-tile border border-border bg-primary-start/12 text-primary-mid"
          >
            <MailCheck className="size-6" />
          </span>
          <p className="text-[16px] leading-[1.65] text-text-muted">
            If an account exists for that address, a password reset link is on its way. The link
            expires after a short time.
          </p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we will send you a link to choose a new password."
      footer={backLink}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={error}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
        {submitError && <FormError>{submitError}</FormError>}
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  )
}
