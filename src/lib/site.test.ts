import { afterEach, describe, expect, it, vi } from 'vitest'

import { LEGAL } from './site'

/**
 * LEGAL holds statutory disclosures that must come from the company's own
 * documents. These checks catch a typo or a placeholder before it is published;
 * they cannot prove a value is the company's real one.
 */
describe('LEGAL disclosures', () => {
  it('CIN is unset or a 21-character MCA CIN', () => {
    if (LEGAL.cin !== null) expect(LEGAL.cin).toMatch(/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/)
  })

  it('GSTIN is unset or a 15-character GSTIN', () => {
    if (LEGAL.gstin !== null) expect(LEGAL.gstin).toMatch(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
  })

  it('every director and the grievance officer is complete', () => {
    for (const d of LEGAL.directors) {
      expect(d.name.trim()).not.toBe('')
      expect(d.designation.trim()).not.toBe('')
      if (d.din !== undefined) expect(d.din).toMatch(/^\d{8}$/)
    }
    const officer = LEGAL.grievanceOfficer
    if (officer) {
      expect(officer.name.trim()).not.toBe('')
      expect(officer.designation.trim()).not.toBe('')
      expect(officer.email).toMatch(/^[^\s@]+@[^\s@]+\.\w+$/)
      expect(officer.phone.replace(/\D/g, '').length).toBeGreaterThanOrEqual(10)
    }
  })
})

describe('Grievance page follows LEGAL', () => {
  afterEach(() => {
    vi.doUnmock('./site')
    vi.resetModules()
  })

  const text = (doc: { sections: unknown }) => JSON.stringify(doc.sections)

  it('names nobody while no officer is designated', async () => {
    vi.resetModules()
    const { GRIEVANCE } = await import('@/features/legal/content/grievance')
    if (LEGAL.grievanceOfficer) return
    expect(text(GRIEVANCE)).toContain('will be published on this page')
    expect(text(GRIEVANCE)).not.toContain('Name:')
  })

  it('publishes the officer once LEGAL supplies one', async () => {
    vi.resetModules()
    vi.doMock('./site', async (orig) => {
      const real = await orig<typeof import('./site')>()
      return {
        ...real,
        LEGAL: {
          ...real.LEGAL,
          grievanceOfficer: { name: 'Test Officer', designation: 'Grievance Officer', email: 'go@example.com', phone: '9999999999' },
        },
      }
    })
    const { GRIEVANCE } = await import('@/features/legal/content/grievance')
    expect(text(GRIEVANCE)).toContain('Name: Test Officer')
    expect(text(GRIEVANCE)).toContain('mailto:go@example.com')
    expect(text(GRIEVANCE)).not.toContain('will be published on this page')
    // Escalation must reach the officer, not loop back to the general inbox.
    const escalation = JSON.stringify(GRIEVANCE.sections.find((s) => s.id === 'escalation'))
    expect(escalation).toContain('mailto:go@example.com')
  })
})

describe('every policy escalates through the Grievance Redressal page', () => {
  it('no policy tells the customer to escalate to the same inbox, and each links /grievance-redressal', async () => {
    const { TERMS } = await import('@/features/legal/content/terms')
    const { REFUND } = await import('@/features/legal/content/refund')
    const { SERVICE_DELIVERY } = await import('@/features/legal/content/service-delivery')
    for (const doc of [TERMS, REFUND, SERVICE_DELIVERY]) {
      const body = JSON.stringify(doc.sections)
      expect(body).not.toMatch(/escalate to the same address/i)
      expect(body).toContain('(/grievance-redressal)')
    }
  })
})

describe('published company details', () => {
  it('registered office is the Dwarka address and Noida stays the business address', async () => {
    const { SITE } = await import('./site')
    expect(LEGAL.registeredOffice).toContain('Manish Global Mall')
    expect(LEGAL.registeredOffice).toContain('Dwarka')
    expect(LEGAL.registeredOffice).toContain('110075')
    expect(SITE.address.single).toContain('Noida')
    expect(LEGAL.cin).toBe('U73100DL2024PTC432840')
    expect(LEGAL.gstin).toBe('09ABACA8829R1ZU')
    expect(LEGAL.directors.map((d) => d.name)).toEqual(['Aliya Khan', 'Afsheen Khan'])
  })

  it('grievance page names Aliya Khan with the company phone and email', async () => {
    vi.resetModules()
    const { GRIEVANCE } = await import('@/features/legal/content/grievance')
    const body = JSON.stringify(GRIEVANCE.sections)
    expect(body).toContain('Name: Aliya Khan')
    expect(body).toContain('7669438261')
    expect(body).toContain('mailto:contact@authenticmedia.fun')
  })
})
