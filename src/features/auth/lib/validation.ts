const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const PASSWORD_MIN_LENGTH = 8

export function validateName(name: string): string | undefined {
  const value = name.trim()
  if (value.length < 2) return 'Enter your full name.'
  if (value.length > 80) return 'Name must be 80 characters or fewer.'
  return undefined
}

export function validateEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Enter your email address.'
  if (value.length > 254 || !EMAIL_RE.test(value)) return 'Enter a valid email address.'
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (password.length > 72) return 'Password must be 72 characters or fewer.'
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number.'
  }
  return undefined
}

export function validateConfirm(password: string, confirm: string): string | undefined {
  return password === confirm ? undefined : 'Passwords do not match.'
}
