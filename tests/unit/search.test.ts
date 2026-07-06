import { describe, expect, it } from 'vitest'
import {
  CONFIDENCE_FLOOR,
  bestApiForTask,
  categoryCounts,
  matchScore,
  scoreApi,
  searchApis,
} from '../../src/data/shapes'
import { makeApi } from '../helpers/fixtures'

// ---- matchScore: the pure lexical relevance scorer (fixture-driven, deterministic) ----
describe('matchScore', () => {
  it('scores an exact name or slug match at the unbeatable 140', () => {
    const api = makeApi({ name: 'Frankfurter', slug: 'frankfurter' })
    expect(matchScore(api, 'Frankfurter')).toBe(140)
    expect(matchScore(api, 'frankfurter')).toBe(140)
  })

  it('returns 0 for an empty or all-stopword query', () => {
    expect(matchScore(makeApi(), '')).toBe(0)
    expect(matchScore(makeApi(), 'the a of to')).toBe(0)
  })

  it('weights fields name(60) > category(30) > tagline(25) > description(12)', () => {
    const nameHit = makeApi({ name: 'Zephyrbird', slug: 'zbird', tagline: 't', description: 'd', category: 'developer' })
    const catHit = makeApi({ name: 'Test API', slug: 'x1', tagline: 't', description: 'd', category: 'science' })
    const tagHit = makeApi({ name: 'Zzz', slug: 'x2', tagline: 'zephyr forecast', description: 'd', category: 'developer' })
    const descHit = makeApi({ name: 'Zzz', slug: 'x3', tagline: 'x', description: 'zephyr thing', category: 'developer' })
    expect(matchScore(nameHit, 'zephyr')).toBe(60)
    expect(matchScore(catHit, 'science')).toBe(30)
    expect(matchScore(tagHit, 'zephyr')).toBe(25)
    expect(matchScore(descHit, 'zephyr')).toBe(12)
  })

  it('scores a synonym hit at 70% of a direct hit', () => {
    const direct = makeApi({ name: 'Zzz', slug: 'x1', tagline: 'exchange rates', category: 'developer' })
    const synonym = makeApi({ name: 'Zzz', slug: 'x2', tagline: 'exchange rates', category: 'developer' })
    expect(matchScore(direct, 'exchange')).toBe(25) // direct tagline hit
    expect(matchScore(synonym, 'currency')).toBe(18) // synonym (exchange) → round(25 * 0.7)
  })

  it('rewards covering more query words (coverage multiplier)', () => {
    const both = makeApi({ name: 'Zzz', slug: 'x1', tagline: 'alpha beta', category: 'developer' })
    const one = makeApi({ name: 'Zzz', slug: 'x2', tagline: 'alpha only', category: 'developer' })
    expect(matchScore(both, 'alpha beta')).toBe(50)
    expect(matchScore(one, 'alpha beta')).toBeLessThan(25) // coverage penalty
    expect(matchScore(both, 'alpha beta')).toBeGreaterThan(matchScore(one, 'alpha beta'))
  })

  it('adds a domain-intent bonus when the record is in the implied category', () => {
    const inFinance = makeApi({ name: 'Zzz', slug: 'x1', tagline: 'exchange rates', category: 'finance' })
    const inDev = makeApi({ name: 'Zzz', slug: 'x2', tagline: 'exchange rates', category: 'developer' })
    expect(matchScore(inFinance, 'currency')).toBe(42) // 18 synonym + 24 intent
    expect(matchScore(inFinance, 'currency') - matchScore(inDev, 'currency')).toBe(24)
  })

  it('does not let "concurrency" match "currency" (word-boundary safety)', () => {
    const api = makeApi({ name: 'Zzz', slug: 'x', tagline: 'about concurrency', category: 'developer' })
    expect(matchScore(api, 'currency')).toBe(0)
  })
})

describe('scoreApi', () => {
  const api = (status: 'healthy' | 'dead' | 'unmonitored') =>
    makeApi({ name: 'Zephyrbird', slug: 'zbird', status, auth: status === 'unmonitored' ? 'apiKey' : 'none', sampleEndpoint: '/d?api_key=YOUR_API_KEY' })

  it('adds a positive health boost for healthy records', () => {
    expect(scoreApi(api('healthy'), 'zephyr')).toBe(72) // 60 + 12
  })
  it('penalizes dead and unmonitored records', () => {
    expect(scoreApi(api('dead'), 'zephyr')).toBeLessThan(0) // 60 - 80
    expect(scoreApi(api('unmonitored'), 'zephyr')).toBe(42) // 60 - 18
  })
  it('returns 0 when nothing matches (no health boost applied)', () => {
    expect(scoreApi(api('healthy'), 'nonexistentxyz')).toBe(0)
  })

  it('exposes a confidence floor above a lone description hit', () => {
    expect(CONFIDENCE_FLOOR).toBe(16)
    expect(CONFIDENCE_FLOOR).toBeGreaterThan(12) // a description-only hit must not clear it
  })
})

// ---- searchApis / bestApiForTask: behavior over the real seed catalog ----
describe('searchApis (real catalog)', () => {
  it('returns relevant results for a common query', () => {
    const results = searchApis('weather')
    expect(results.length).toBeGreaterThan(0)
  })

  it('returns nothing for an empty query', () => {
    expect(searchApis('')).toEqual([])
  })

  it('honors the category filter', () => {
    const results = searchApis('data', { category: 'weather' })
    expect(results.every((a) => a.category === 'weather')).toBe(true)
  })

  it('honors the auth filter', () => {
    const results = searchApis('api', { auth: 'none' })
    expect(results.every((a) => a.auth === 'none')).toBe(true)
  })

  it('caps the result count at the requested limit (max 25)', () => {
    expect(searchApis('api', {}, 3).length).toBeLessThanOrEqual(3)
    expect(searchApis('api', {}, 999).length).toBeLessThanOrEqual(25)
  })

  it('never surfaces a dead API above a live match set', () => {
    const results = searchApis('weather')
    // dead entries are the lowest tier; if any appear they must be after live ones.
    const firstDead = results.findIndex((a) => a.status === 'dead')
    const lastLive = results.map((a) => a.status !== 'dead').lastIndexOf(true)
    if (firstDead !== -1) expect(firstDead).toBeGreaterThan(lastLive - 1)
  })
})

describe('bestApiForTask (real catalog)', () => {
  it('returns a confident best match for a real task', () => {
    const { best, note } = bestApiForTask('current weather forecast for a city')
    expect(best).not.toBeNull()
    expect(note).toContain('weather')
  })

  it('refuses to guess on an off-catalog query', () => {
    const { best, note } = bestApiForTask('quantum teleportation flux capacitor xyzzy')
    expect(best).toBeNull()
    expect(note).toMatch(/No confident match/i)
  })

  it('never returns a dead API as best', () => {
    for (const q of ['weather', 'currency exchange rates', 'crypto price', 'geocode address']) {
      const { best } = bestApiForTask(q)
      if (best) expect(best.status).not.toBe('dead')
    }
  })

  it('returns at most two alternatives', () => {
    const { alternatives } = bestApiForTask('weather forecast')
    expect(alternatives.length).toBeLessThanOrEqual(2)
  })
})

describe('categoryCounts (real catalog)', () => {
  it('lists every category with a non-negative count', () => {
    const counts = categoryCounts()
    expect(counts.length).toBeGreaterThan(5)
    for (const c of counts) {
      expect(c.slug).toBeTruthy()
      expect(c.apis).toBeGreaterThanOrEqual(0)
    }
  })
})
