import { describe, expect, it } from 'vitest'

import {
  EMPTY_CONTACT,
  isCheckoutContactValid,
  normalisePhone,
  splitName,
  validateCheckoutContact,
} from './contact'

/**
 * The drawer-side mirror of api/_lib/contact.ts. It exists so the shopper is
 * told what is missing in the cart rather than on Airpay's error page; the
 * server rule remains the authoritative one.
 */

describe('validateCheckoutContact', () => {
  it('refuses an empty form — the state that caused the gateway refusal', () => {
    const errors = validateCheckoutContact(EMPTY_CONTACT)
    expect(errors.email).toBeDefined()
    expect(isCheckoutContactValid(EMPTY_CONTACT)).toBe(false)
  })

  it('accepts an email alone', () => {
    expect(isCheckoutContactValid({ name: '', email: 'a@b.com', phone: '' })).toBe(true)
  })

  it('accepts a phone alone', () => {
    expect(isCheckoutContactValid({ name: '', email: '', phone: '9876543210' })).toBe(true)
  })

  it('reports a malformed value even when the other field would suffice', () => {
    const errors = validateCheckoutContact({ name: '', email: 'nope', phone: '9876543210' })
    expect(errors.email).toBeDefined()
    expect(errors.phone).toBeUndefined()
  })

  it('flags a malformed phone number', () => {
    const errors = validateCheckoutContact({ name: '', email: '', phone: '123' })
    expect(errors.phone).toBeDefined()
  })
})

describe('normalisePhone', () => {
  it('matches the server normalisation', () => {
    expect(normalisePhone('+91 98765-43210')).toBe('919876543210')
    expect(normalisePhone('  ')).toBe('')
    expect(normalisePhone('abc')).toBe('')
  })
})

describe('splitName', () => {
  it('splits into the two fields the Airpay payload takes', () => {
    expect(splitName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' })
    expect(splitName('  Ada  King  Lovelace ')).toEqual({
      firstName: 'Ada',
      lastName: 'King Lovelace',
    })
    expect(splitName('Ada')).toEqual({ firstName: 'Ada', lastName: '' })
    expect(splitName('   ')).toEqual({ firstName: '', lastName: '' })
  })
})
