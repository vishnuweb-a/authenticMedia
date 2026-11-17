import { describe, expect, it } from 'vitest'

import { validateConfirm, validateEmail, validateName, validatePassword } from './validation'

describe('auth validation', () => {
  it('rejects invalid emails and accepts valid ones', () => {
    expect(validateEmail('')).toBeDefined()
    expect(validateEmail('not-an-email')).toBeDefined()
    expect(validateEmail('a@b')).toBeDefined()
    expect(validateEmail(' user@example.com ')).toBeUndefined()
  })

  it('enforces password strength', () => {
    expect(validatePassword('short1')).toBeDefined()
    expect(validatePassword('allletters')).toBeDefined()
    expect(validatePassword('12345678')).toBeDefined()
    expect(validatePassword('a'.repeat(73) + '1')).toBeDefined()
    expect(validatePassword('goodpass1')).toBeUndefined()
  })

  it('checks confirmation and name', () => {
    expect(validateConfirm('abc12345', 'abc12346')).toBeDefined()
    expect(validateConfirm('abc12345', 'abc12345')).toBeUndefined()
    expect(validateName('A')).toBeDefined()
    expect(validateName('Asha Rao')).toBeUndefined()
  })
})
