import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

const FIELD_CLASSES =
  'w-full rounded-input border border-border bg-surface px-4 py-3 text-base text-text ' +
  'placeholder:text-text-subtle transition-colors ' +
  'focus-visible:border-primary-mid aria-invalid:border-red-400/70'

interface FieldShellProps {
  id: string
  label: string
  error?: string
  hint?: string
  children: (ids: { describedBy: string | undefined }) => React.ReactNode
}

/** Label + control + hint/error, wired together for screen readers. */
function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
      </label>
      {children({ describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, ...props }: InputProps) {
  const id = useId()

  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {({ describedBy }) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(FIELD_CLASSES, className)}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string
  error?: string
  hint?: string
}

export function Textarea({ label, error, hint, className, rows = 5, ...props }: TextareaProps) {
  const id = useId()

  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {({ describedBy }) => (
        <textarea
          id={id}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(FIELD_CLASSES, 'resize-y', className)}
          {...props}
        />
      )}
    </FieldShell>
  )
}
