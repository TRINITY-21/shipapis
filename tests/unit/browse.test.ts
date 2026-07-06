import { describe, expect, it } from 'vitest'
import { browseSorted, facetTokens, searchText } from '../../src/ui/lib/browse'
import { makeApi } from '../helpers/fixtures'

describe('browseSorted', () => {
  it('default sort puts monitored first, then health score descending', () => {
    const hi = makeApi({ slug: 'hi', status: 'healthy', healthScore: 95 })
    const lo = makeApi({ slug: 'lo', status: 'healthy', healthScore: 60 })
    const cat = makeApi({ slug: 'cat', status: 'unmonitored' }) // not monitored
    const out = browseSorted([lo, cat, hi])
    expect(out.map((a) => a.slug)).toEqual(['hi', 'lo', 'cat'])
  })

  it('fastest sort lists probed low-latency first, no-latency records last', () => {
    const fast = makeApi({ slug: 'fast', status: 'healthy', baseLatency: 40 })
    const slow = makeApi({ slug: 'slow', status: 'healthy', baseLatency: 400 })
    const none = makeApi({ slug: 'none', status: 'unmonitored' }) // p50 == 0
    const out = browseSorted([slow, none, fast], 'fastest')
    expect(out[0].slug).toBe('fast')
    expect(out[1].slug).toBe('slow')
    expect(out[2].slug).toBe('none')
  })

  it('newest sort orders by addedAt descending', () => {
    const old = makeApi({ slug: 'old', addedAt: '2026-01-01' })
    const mid = makeApi({ slug: 'mid', addedAt: '2026-03-01' })
    const recent = makeApi({ slug: 'recent', addedAt: '2026-06-01' })
    const out = browseSorted([old, recent, mid], 'newest')
    expect(out.map((a) => a.slug)).toEqual(['recent', 'mid', 'old'])
  })

  it('does not mutate the input array', () => {
    const input = [makeApi({ slug: 'a' }), makeApi({ slug: 'b' })]
    const snapshot = input.map((a) => a.slug)
    browseSorted(input, 'newest')
    expect(input.map((a) => a.slug)).toEqual(snapshot)
  })
})

describe('facetTokens', () => {
  it('emits the expected facet tokens for a healthy keyless CORS API', () => {
    const api = makeApi({ auth: 'none', cors: 'yes', status: 'healthy', requiresCard: false, commercialUse: 'yes', category: 'weather' })
    const tokens = facetTokens(api).split(' ')
    expect(tokens).toContain('monitored')
    expect(tokens).toContain('healthy')
    expect(tokens).toContain('auth-none')
    expect(tokens).toContain('cors')
    expect(tokens).toContain('nocard')
    expect(tokens).toContain('commercial')
    expect(tokens).toContain('cat-weather')
  })

  it('marks catalogued (unmonitored) records', () => {
    const api = makeApi({ status: 'unmonitored', auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' })
    const tokens = facetTokens(api).split(' ')
    expect(tokens).toContain('catalogued')
    expect(tokens).toContain('auth-apiKey')
    expect(tokens).not.toContain('monitored')
  })
})

describe('searchText', () => {
  it('lowercases and folds human aliases for keyless APIs', () => {
    const api = makeApi({ name: 'Frankfurter', auth: 'none', requiresCard: false })
    const hay = searchText(api, 'Finance')
    expect(hay).toContain('frankfurter')
    expect(hay).toContain('no auth')
    expect(hay).toContain('keyless')
    expect(hay).toContain('finance')
    expect(hay).toBe(hay.toLowerCase())
  })

  it('includes api-key aliases when a key is required', () => {
    const api = makeApi({ auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' })
    expect(searchText(api, 'Weather')).toContain('signup')
  })
})
