import { LoginForm } from '@/features/auth'
import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

export function LoginPage() {
  useDocumentMeta('Sign in — Authentic Media', 'Sign in to your Authentic Media account.', ROUTES.login)
  return <LoginForm />
}
