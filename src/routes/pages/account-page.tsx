import { AccountPanel } from '@/features/auth'
import { useDocumentMeta } from '@/features/legal'
import { ROUTES } from '@/routes/paths'

export function AccountPage() {
  useDocumentMeta('My account — Authentic Media', 'Your Authentic Media account.', ROUTES.account)
  return <AccountPanel />
}
