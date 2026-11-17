import { RegisterForm } from '@/features/auth'
import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

export function RegisterPage() {
  useDocumentMeta('Create an account — Authentic Media', 'Create your Authentic Media account.', ROUTES.register)
  return <RegisterForm />
}
