import { User as UserIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { IconButton } from '@/components/ui'
import { useSignOut } from '@/features/auth/hooks/use-sign-out'
import { ROUTES } from '@/routes/paths'
import { useAuth } from '@/stores'

const LINK =
  'rounded-md text-[15px] font-medium text-text-muted transition-colors hover:text-text'

/**
 * Desktop/tablet header account control. Signed out: Login | Register.
 * Signed in: a profile button opening a disclosure menu (My Account, Log out).
 * While the stored session loads, the signed-out links are rendered invisibly so
 * the header neither shifts nor flashes the wrong state.
 */
export function AccountMenu() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div aria-hidden="true" className="invisible flex items-center gap-4">
        <span className={LINK}>Login</span>
        <span className={LINK}>Register</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center gap-4">
        <Link to={ROUTES.login} className={LINK}>
          Login
        </Link>
        <Link to={ROUTES.register} className={LINK}>
          Register
        </Link>
      </div>
    )
  }

  return <ProfileMenu name={user.name} />
}

function ProfileMenu({ name }: { name: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { signOut, isPending, error } = useSignOut()

  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      rootRef.current?.querySelector('button')?.focus()
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [isOpen])

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <IconButton
        label={`Account menu for ${name}`}
        aria-expanded={isOpen}
        aria-controls="account-menu"
        icon={<UserIcon aria-hidden="true" className="size-5" />}
        onClick={() => setIsOpen((open) => !open)}
      />

      <ul
        id="account-menu"
        hidden={!isOpen}
        className="absolute top-full right-0 z-50 mt-3 w-56 rounded-2xl border border-border bg-surface p-2 shadow-lg"
      >
        <li className="truncate px-3 py-2 text-sm text-text-subtle">{name}</li>
        <li>
          <Link
            to={ROUTES.account}
            onClick={() => setIsOpen(false)}
            className="block rounded-lg px-3 py-2 text-[15px] font-medium text-text-muted transition-colors hover:bg-primary-start/10 hover:text-text"
          >
            My Account
          </Link>
        </li>
        <li>
          <button
            type="button"
            disabled={isPending}
            onClick={signOut}
            className="block w-full rounded-lg px-3 py-2 text-left text-[15px] font-medium text-text-muted transition-colors hover:bg-primary-start/10 hover:text-text disabled:opacity-50"
          >
            {isPending ? 'Logging out…' : 'Log out'}
          </button>
          {error && (
            <p role="alert" className="px-3 pt-1 pb-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </li>
      </ul>
    </div>
  )
}

/** The same actions inside the mobile drawer, where there is room for plain rows. */
export function MobileAccountLinks({ onNavigate }: { onNavigate: () => void }) {
  const { user, isLoading } = useAuth()
  const { signOut, isPending, error } = useSignOut()
  const row =
    'block w-full rounded-lg px-2 py-2.5 text-left text-[15px] font-medium text-text-muted transition-colors hover:text-text'

  if (isLoading) return null

  return (
    <div className="mt-2 border-t border-border pt-4 sm:hidden">
      <h2 className="px-2 text-[13px] font-bold tracking-[0.12em] text-primary-mid uppercase">
        Account
      </h2>
      <ul className="mt-1 flex flex-col">
        {user ? (
          <>
            <li>
              <Link to={ROUTES.account} onClick={onNavigate} className={row}>
                My Account
              </Link>
            </li>
            <li>
              <button type="button" disabled={isPending} onClick={signOut} className={row}>
                {isPending ? 'Logging out…' : 'Log out'}
              </button>
              {error && (
                <p role="alert" className="px-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </li>
          </>
        ) : (
          <>
            <li>
              <Link to={ROUTES.login} onClick={onNavigate} className={row}>
                Login
              </Link>
            </li>
            <li>
              <Link to={ROUTES.register} onClick={onNavigate} className={row}>
                Register
              </Link>
            </li>
          </>
        )}
      </ul>
    </div>
  )
}
