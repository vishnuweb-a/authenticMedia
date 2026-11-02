import { describe, expect, it } from 'vitest'

import { ROUTES } from '@/routes/paths'
import { PRIVACY } from './privacy'
import { REFUND } from './refund'
import { SERVICE_DELIVERY } from './service-delivery'
import { TERMS } from './terms'

const DOCS = [TERMS, PRIVACY, REFUND, SERVICE_DELIVERY]
const KNOWN = new Set<string>(Object.values(ROUTES))

function texts(doc: (typeof DOCS)[number]): string[] {
  return [
    doc.intro,
    ...doc.sections.flatMap((s) => s.blocks.flatMap((b) => (typeof b === 'string' ? [b] : [...b.list]))),
  ]
}

describe('legal policies', () => {
  it.each(DOCS)('$title: unique section ids and a contact section', (doc) => {
    const ids = doc.sections.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('contact')
    expect(KNOWN.has(doc.path)).toBe(true)
  })

  it.each(DOCS)('$title: every internal link targets a real route', (doc) => {
    for (const text of texts(doc)) {
      for (const m of text.matchAll(/\]\((\/[^)]*)\)/g)) {
        expect(KNOWN.has(m[1] ?? '')).toBe(true)
      }
    }
  })

  it('Terms keep the 27 required sections', () => {
    expect(TERMS.sections).toHaveLength(27)
  })
})
