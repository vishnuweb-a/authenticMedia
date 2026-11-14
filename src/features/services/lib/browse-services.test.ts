import { describe, expect, it } from 'vitest'

import { ALL_SERVICES } from '../data/catalogue.data'
import { browseServices } from './browse-services'

const base = { query: '', tier: 'all', sort: 'featured' } as const

describe('browseServices', () => {
  it('lists every service in catalogue order by default', () => {
    expect(browseServices(ALL_SERVICES, base)).toEqual([...ALL_SERVICES])
  })

  it('filters by tier', () => {
    const micro = browseServices(ALL_SERVICES, { ...base, tier: 'micro' })
    expect(micro.length).toBe(ALL_SERVICES.filter((s) => s.tier === 'micro').length)
    expect(micro.every((s) => s.tier === 'micro')).toBe(true)
  })

  it('searches titles, subtitles, descriptions and deliverables, case-insensitively', () => {
    expect(browseServices(ALL_SERVICES, { ...base, query: '  seo ' }).map((s) => s.id)).toContain('seo-audit-service')
    expect(browseServices(ALL_SERVICES, { ...base, query: 'DNS' }).map((s) => s.id)).toEqual(['cloud-hosting'])
    expect(browseServices(ALL_SERVICES, { ...base, query: 'zzzz' })).toEqual([])
  })

  it('sorts by price and name without mutating the input', () => {
    const before = [...ALL_SERVICES]
    const asc = browseServices(ALL_SERVICES, { ...base, sort: 'price-asc' }).map((s) => s.price)
    expect(asc).toEqual([...asc].sort((a, b) => a - b))
    const desc = browseServices(ALL_SERVICES, { ...base, sort: 'price-desc' }).map((s) => s.price)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
    const names = browseServices(ALL_SERVICES, { ...base, sort: 'name' }).map((s) => s.title)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(ALL_SERVICES).toEqual(before)
  })
})
