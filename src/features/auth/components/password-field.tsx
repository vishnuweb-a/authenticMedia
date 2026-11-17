import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { Input, type InputProps } from '@/components/ui'

/** Password input with an accessible show/hide toggle. */
export function PasswordField(props: Omit<InputProps, 'type' | 'endAdornment'>) {
  const [isVisible, setIsVisible] = useState(false)
  const Icon = isVisible ? EyeOff : Eye

  return (
    <Input
      {...props}
      type={isVisible ? 'text' : 'password'}
      endAdornment={
        <button
          type="button"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
          className="inline-flex size-10 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text"
        >
          <Icon aria-hidden="true" className="size-5" />
        </button>
      }
    />
  )
}
