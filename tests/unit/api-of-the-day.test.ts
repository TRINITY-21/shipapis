import { describe, expect, it } from 'vitest'
import { aotdDateIso, pickApiOfTheDay } from '../../src/data/api-of-the-day'
import { makeApis } from '../helpers/fixtures'

describe('aotdDateIso', () => {
  it('returns the UTC calendar date', () => {
    expect(aotdDateIso(new Date('2026-07-04T23:30:00Z'))).toBe('2026-07-04')
  })
})

describe('pickApiOfTheDay', () => {
  const pool = makeApis([
    { slug: 'alpha', status: 'healthy', auth: 'none' },
    { slug: 'bravo', status: 'healthy', auth: 'none' },
    { slug: 'charlie', status: 'healthy', auth: 'none' },
  ])

  it('is deterministic for a given date', () => {
    const a = pickApiOfTheDay(pool, '2026-07-04')
    const b = pickApiOfTheDay(pool, '2026-07-04')
    expect(a.slug).toBe(b.slug)
    expect(a.date).toBe('2026-07-04')
  })

  it('picks from the provided pool', () => {
    const pick = pickApiOfTheDay(pool, '2026-07-04')
    expect(pool.map((p) => p.slug)).toContain(pick.slug)
  })

  it('rotates across dates (not always the same API)', () => {
    const slugs = new Set(
      ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06'].map(
        (d) => pickApiOfTheDay(pool, d).slug,
      ),
    )
    expect(slugs.size).toBeGreaterThan(1)
  })

  it('composes a why-string with the tagline and perks', () => {
    const pick = pickApiOfTheDay(pool, '2026-07-04')
    expect(pick.why).toContain(pick.api.tagline)
    expect(pick.why).toMatch(/no key|CORS|commercial|HTTPS/)
  })

  it('excludes dead APIs from the pool', () => {
    const withDead = makeApis([
      { slug: 'live', status: 'healthy', auth: 'none' },
      { slug: 'gone', status: 'dead', auth: 'none' },
    ])
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => pickApiOfTheDay(withDead, `2026-07-${String(i + 1).padStart(2, '0')}`).slug),
    )
    expect(seen.has('gone')).toBe(false)
  })
})
