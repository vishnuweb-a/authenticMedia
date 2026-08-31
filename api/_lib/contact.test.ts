import { describe, expect, it } from 'vitest'

import { hasContact, normaliseContact, normaliseEmail, normalisePhone } from './contact.js'

/**
 * ⚠ These guard the production failure "Either email or contact number is
 * mandatory": Airpay's hosted page rejected a handoff whose buyer_email and
 * buyer_phone were both empty strings.
 */

describe('normaliseEmail', () => {
  it('accepts a plausible address unchanged', () => {
    expect(normaliseEmail(' someone@example.com ')).toBe('someone@example.com')
  })

  it('rejects shapes that are certainly not addresses', () => {
    for (const bad of ['', 'someone', 'someone@', '@example.com', 'a b@c.com', 'x@y.z', 42, null]) {
      expect(normaliseEmail(bad)).toBe('')
    }
  })
})

describe('normalisePhone', () => {
  it('strips formatting to the digits Airpay takes', () => {
    expect(normalisePhone('+91 98765-43210')).toBe('919876543210')
    expect(normalisePhone('(022) 1234 5678')).toBe('02212345678')
  })

  it('rejects values that cannot be a number', () => {
    for (const bad of ['', '12345', 'not a phone', '1'.repeat(16), '98765abcde', null]) {
      expect(normalisePhone(bad)).toBe('')
    }
  })
})

describe('hasContact — Airpay requires EITHER email OR phone', () => {
  it('accepts email alone', () => {
    expect(hasContact(normaliseContact({ email: 'a@b.com' }))).toBe(true)
  })

  it('accepts phone alone', () => {
    expect(hasContact(normaliseContact({ phone: '9876543210' }))).toBe(true)
  })

  it('rejects neither — the exact production failure', () => {
    expect(hasContact(normaliseContact({}))).toBe(false)
    expect(hasContact(normaliseContact({ email: '', phone: '' }))).toBe(false)
    expect(hasContact(normaliseContact(undefined))).toBe(false)
    // Present but unusable is the same as absent: Airpay would refuse both.
    expect(hasContact(normaliseContact({ email: 'nope', phone: 'nope' }))).toBe(false)
  })

  it('does not require both', () => {
    const contact = normaliseContact({ email: 'a@b.com', phone: 'garbage' })
    expect(hasContact(contact)).toBe(true)
    expect(contact.phone).toBe('')
  })
})

describe('normaliseContact', () => {
  it('bounds the name fields and coerces non-strings', () => {
    const contact = normaliseContact({
      firstName: 'x'.repeat(200),
      lastName: 12345,
      email: 'a@b.com',
    })
    expect(contact.firstName).toHaveLength(60)
    expect(contact.lastName).toBe('')
  })
})
