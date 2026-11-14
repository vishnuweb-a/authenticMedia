import { describe, expect, it } from 'vitest'

import { SITE } from '@/lib/site'
import { buildEnquiryMailto } from './contact.service'

describe('buildEnquiryMailto', () => {
  it('addresses the company and encodes every field', () => {
    const url = buildEnquiryMailto({
      name: ' Asha & Co ',
      email: 'asha@example.com',
      message: 'Need an SEO audit?\nThanks',
    })
    expect(url.startsWith(`mailto:${SITE.email}?subject=`)).toBe(true)

    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    expect(params.get('subject')).toBe('Website enquiry from Asha & Co')
    expect(params.get('body')).toBe('Need an SEO audit?\nThanks\n\n— Asha & Co (asha@example.com)')
  })
})
