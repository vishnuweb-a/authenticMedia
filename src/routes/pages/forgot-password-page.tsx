import { ForgotPasswordForm } from '@/features/auth'
import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

export function ForgotPasswordPage() {
  useDocumentMeta('Reset your password — Authentic Media', 'Request a password reset link.', ROUTES.forgotPassword)
  return <ForgotPasswordForm />
}
