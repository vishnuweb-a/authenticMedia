import { useState, type FormEvent } from 'react'

import { Section } from '@/components/layout'
import { Button, Card, Input } from '@/components/ui'
import { useAuth } from '@/stores'
import { useSignOut } from '../hooks/use-sign-out'
import { validateName } from '../lib/validation'
import { FormError } from './auth-shell'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Rendered only behind RequireAuth, so `user` is always present. */
export function AccountPanel() {
  const { user, updateName } = useAuth()
  const { signOut, isPending, error: signOutError } = useSignOut()
  const [name, setName] = useState(user?.name ?? '')
  const [nameError, setNameError] = useState<string | undefined>()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  if (!user) return null
  const joined = formatDate(user.createdAt)

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    const invalid = validateName(name)
    setNameError(invalid)
    setSaveError(null)
    setSaved(false)
    if (invalid) return

    setIsSaving(true)
    const result = await updateName(name.trim())
    setIsSaving(false)
    if (!result.ok) setSaveError(result.error.message)
    else setSaved(true)
  }

  return (
    <Section className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-[640px]">
        <h1 className="text-[32px] sm:text-4xl">My account</h1>

        <Card className="mt-8 p-6 sm:p-8">
          <h2 className="text-xl">Details</h2>
          <dl className="mt-5 grid gap-x-4 gap-y-3 text-[16px] sm:grid-cols-[160px_1fr]">
            <dt className="text-text-muted">Name</dt>
            <dd className="font-semibold break-words">{user.name}</dd>
            <dt className="text-text-muted">Email</dt>
            <dd className="font-semibold break-all">{user.email}</dd>
            <dt className="text-text-muted">Email status</dt>
            <dd className="font-semibold">{user.emailVerified ? 'Verified' : 'Email not verified'}</dd>
            <dt className="text-text-muted">Member since</dt>
            <dd className="font-semibold">{joined}</dd>
          </dl>
        </Card>

        <Card className="mt-6 p-6 sm:p-8">
          <h2 className="text-xl">Profile settings</h2>
          <form noValidate onSubmit={handleSave} className="mt-5 flex flex-col gap-5">
            <Input
              label="Display name"
              name="name"
              autoComplete="name"
              value={name}
              error={nameError}
              onChange={(event) => {
                setName(event.target.value)
                setSaved(false)
              }}
            />
            {saveError && <FormError>{saveError}</FormError>}
            {saved && (
              <p role="status" className="text-sm font-semibold text-primary-mid">
                Name updated.
              </p>
            )}
            <Button type="submit" size="sm" isLoading={isSaving} className="self-start">
              Save changes
            </Button>
          </form>
        </Card>

        <div className="mt-6 flex flex-col items-start gap-3">
          {signOutError && <FormError>{signOutError}</FormError>}
          <Button variant="secondary" size="sm" isLoading={isPending} onClick={signOut}>
            Log out
          </Button>
        </div>
      </div>
    </Section>
  )
}
