import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Button, Input } from '@/components/ui'
import { ROUTES } from '@/routes/paths'
import { useAuth } from '@/stores'
import { AUTH_FEATURES } from '../config'
import { validateEmail } from '../lib/validation'
import { AuthShell, FormError } from './auth-shell'
import { PasswordField } from './password-field'

const LINK = 'font-semibold text-primary-mid hover:underline'

export function LoginForm() {
  const { state } = useLocation() as { state: { from?: unknown } | null }
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next = {
      email: validateEmail(email),
      password: password ? undefined : 'Enter your password.',
    }
    setErrors(next)
    setSubmitError(null)
    if (next.email || next.password) return

    setIsSubmitting(true)
    const result = await signIn({ email: email.trim(), password })
    // On success the guest guard sees the new session and redirects.
    if (!result.ok) {
      setSubmitError(result.error.message)
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to manage your account."
      footer={
        <>
          New to Authentic Media?{' '}
          <Link to={ROUTES.register} state={state} className={LINK}>
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={errors.email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {AUTH_FEATURES.passwordRecovery && (
          <Link to={ROUTES.forgotPassword} className={`${LINK} -mt-2 self-end text-sm`}>
            Forgot password?
          </Link>
        )}

        {submitError && <FormError>{submitError}</FormError>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
