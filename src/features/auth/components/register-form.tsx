import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Button, Input } from '@/components/ui'
import { ROUTES } from '@/routes/paths'
import { useAuth } from '@/stores'
import {
  PASSWORD_MIN_LENGTH,
  validateConfirm,
  validateEmail,
  validateName,
  validatePassword,
} from '../lib/validation'
import { AuthShell, FormError } from './auth-shell'
import { PasswordField } from './password-field'

const LINK = 'font-semibold text-primary-mid hover:underline'

export function RegisterForm() {
  const { state } = useLocation() as { state: { from?: unknown } | null }
  const { signUp } = useAuth()
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
      confirm: validateConfirm(values.password, values.confirm),
    }
    setErrors(next)
    setSubmitError(null)
    if (Object.values(next).some(Boolean)) return

    setIsSubmitting(true)
    const result = await signUp({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
    })
    // On success the guest guard sees the new session and redirects (to /account by default).
    if (!result.ok) {
      setSubmitError(result.error.message)
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Register to keep your details in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to={ROUTES.login} state={state} className={LINK}>
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          label="Full name"
          name="name"
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={set('name')}
          placeholder="Your full name"
        />
        <Input
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={set('email')}
          placeholder="you@company.com"
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a number.`}
          onChange={set('password')}
        />
        <PasswordField
          label="Confirm password"
          name="confirm"
          autoComplete="new-password"
          value={values.confirm}
          error={errors.confirm}
          onChange={set('confirm')}
        />

        {submitError && <FormError>{submitError}</FormError>}

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
