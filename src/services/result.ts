/**
 * The shared result shape for every service call.
 *
 * Services return failures as values rather than throwing so that UI code is
 * forced by the type system to render an error state (AGENTS.md §19–20).
 */
export type ServiceResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ServiceError }

export interface ServiceError {
  /** Stable, machine-readable code for branching. */
  code: string
  /** Human-readable message safe to display to a user. */
  message: string
}

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

export function err<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}
