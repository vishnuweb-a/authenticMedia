import { describe, expect, it } from 'vitest'

import { safeRedirect } from './safe-redirect'

describe('safeRedirect', () => {
  it('keeps internal paths', () => {
    expect(safeRedirect('/services')).toBe('/services')
    expect(safeRedirect('/services?a=1#x')).toBe('/services?a=1#x')
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    String.raw`/\evil.example`,
    'javascript:alert(1)',
    'evil',
    '/a\nb',
    '/login',
    '/register?x=1',
    undefined,
    42,
  ])('rejects %s', (value) => {
    expect(safeRedirect(value)).toBe('/account')
  })
})
