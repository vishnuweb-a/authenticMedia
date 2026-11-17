/**
 * Organisation details.
 *
 * Every value here is verified in the reference captures (SCREEN-MAP.md →
 * Contact / Footer). Treat it as content, not as invented placeholder copy.
 */
export const SITE = {
  legalName: 'Authentic Media and IT Sector Private Limited',
  shortName: 'Authentic Media',
  description:
    'IT and digital services for businesses: audits, maintenance, automation, branding and consulting, ordered online and delivered remotely.',
  email: 'contact@authenticmedia.fun',
  phone: '7669438261',
  website: 'authenticmedia.fun',
  address: {
    lines: [
      'Unit No. 44, Fourth Floor, Tower A,',
      'Plot No. A-16, Ithum Heights,',
      'Sector 62, Noida, Uttar Pradesh – 201301, India',
    ],
    single:
      'Unit No. 44, Fourth Floor, Tower A, Plot No. A-16, Ithum Heights, Sector 62, Noida, Uttar Pradesh – 201301, India',
  },
  copyrightYear: 2026,
} as const

export interface Director {
  name: string
  designation: string
  /** Verified professional background only — leave out anything unconfirmed. */
  background?: string
  /** Director Identification Number, if the company chooses to publish it. */
  din?: string
}

export interface GrievanceOfficer {
  name: string
  designation: string
  email: string
  phone: string
}

/**
 * Statutory disclosures requested by the merchant-onboarding audit
 * (authenticmedia.report.pdf §4.2).
 *
 * ⚠ BLOCKED ON MERCHANT INPUT. Every value must be copied from the company's
 * own documents (certificate of incorporation, GST certificate, board records)
 * — never guessed. A null / empty value is simply not rendered, so the site
 * never shows a placeholder or an invented number. Fill these in and every
 * page that discloses them (footer, About, Grievance Redressal) updates.
 */
export const LEGAL: {
  cin: string | null
  gstin: string | null
  /** Registered office per MCA records; the operating address is SITE.address. */
  registeredOffice: string | null
  directors: readonly Director[]
  grievanceOfficer: GrievanceOfficer | null
} = {
  cin: 'U73100DL2024PTC432840',
  gstin: '09ABACA8829R1ZU',
  registeredOffice:
    'Shop No. S-5, S/F, Plot No. 2, LSC-1, Manish Global Mall, District Court Complex, Dwarka, South West Delhi, Delhi – 110075, India',
  directors: [
    { name: 'Aliya Khan', designation: 'Director' },
    { name: 'Afsheen Khan', designation: 'Director' },
  ],
  grievanceOfficer: {
    name: 'Aliya Khan',
    designation: 'Director',
    email: SITE.email,
    phone: SITE.phone,
  },
}
