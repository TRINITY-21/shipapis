import { describe, expect, it } from 'vitest'
import {
  apiListEnvelope,
  coverageSnapshot,
  fullShape,
  homeApiListPreview,
  indexShape,
  listShape,
  payloadMeta,
  slimShape,
} from '../../src/data/shapes'
import { makeApi, makeApis } from '../helpers/fixtures'

describe('payloadMeta', () => {
  it('carries the honesty header on every payload', () => {
    const meta = payloadMeta()
    expect(new Date(meta.generated as string).toString()).not.toBe('Invalid Date')
    expect(meta.data_tier).toBe('dev-seed') // no request scope → seed catalog
    expect(meta.source).toBe('https://shipapis.dev')
    expect(meta.license).toMatch(/CC-BY/)
  })
  it('merges extra fields', () => {
    expect(payloadMeta({ api_version: '1' }).api_version).toBe('1')
  })
})

describe('record shapes', () => {
  it('indexShape nulls the health sentinel', () => {
    const monitored = indexShape(makeApi({ status: 'healthy', healthScore: 77 }))
    const unmonitored = indexShape(makeApi({ status: 'unmonitored', auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' }))
    expect(monitored.health).toBe(77)
    expect(unmonitored.health).toBeNull()
  })

  it('slimShape exposes discovery fields with null p50 when unprobed', () => {
    const s = slimShape(makeApi({ status: 'unmonitored', auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' }))
    expect(s).toMatchObject({ base_url: 'https://api.example.com', monitored_since: null })
    expect(s.p50_ms).toBeNull()
    expect(s.checked_at).toBeNull() // unmonitored → no synthetic check time
  })

  it('listShape carries integration fields, capped endpoints and self links', () => {
    const api = makeApi({ slug: 'demo', status: 'healthy' })
    const l = listShape(api)
    expect(l.slug).toBe('demo')
    expect(l.probed).toBe(true)
    expect(l.sample_curl).toContain('curl "')
    expect(l.endpoints.length).toBeLessThanOrEqual(5)
    expect(l.links.self).toBe('https://shipapis.dev/api/v1/apis/demo')
    expect(l.links.history).toBe('https://shipapis.dev/api/v1/apis/demo/history')
    expect(l.links.badge).toBe('https://shipapis.dev/badge/demo.svg')
  })

  it('fullShape includes sample response, endpoints and page/badge urls', () => {
    const api = makeApi({ slug: 'demo', sample: { hello: 'world' } })
    const f = fullShape(api)
    expect(f.sample_response).toEqual({ hello: 'world' })
    expect(f.page_url).toBe('https://shipapis.dev/api/demo')
    expect(f.badge_url).toBe('https://shipapis.dev/badge/demo.svg')
    expect(Array.isArray(f.shape_changes)).toBe(true)
    expect(f).not.toHaveProperty('died_at')
  })

  it('fullShape surfaces the epitaph only for dead APIs', () => {
    const dead = fullShape(makeApi({ slug: 'gone', status: 'dead', diedAt: '2026-05-01', epitaph: 'RIP' }))
    expect(dead.died_at).toBe('2026-05-01')
    expect(dead.epitaph).toBe('RIP')
  })
})

describe('apiListEnvelope', () => {
  it('computes pagination and a next link when more pages remain', () => {
    const page = makeApis([{ slug: 'a' }, { slug: 'b' }])
    const env = apiListEnvelope(page, {
      total: 5,
      query: { category: 'weather', limit: 2, offset: 0, probed: false },
      path: '/api/v1/apis',
      requestUrl: 'https://shipapis.dev/api/v1/apis?category=weather&limit=2',
    })
    expect(env.pagination).toMatchObject({ total: 5, count: 2, limit: 2, offset: 0, has_more: true })
    expect(env.links.next).toContain('offset=2')
    expect(env.links.next).toContain('limit=2')
    expect(env.count).toBe(2)
    expect(env.results.map((r) => r.slug)).toEqual(['a', 'b'])
    expect(env.query).toHaveProperty('category', 'weather')
    expect(env.query).not.toHaveProperty('probed') // false is dropped from applied query
    expect(env.meta.api_version).toBe('1')
  })

  it('omits the next link on the last page', () => {
    const page = makeApis([{ slug: 'a' }, { slug: 'b' }])
    const env = apiListEnvelope(page, {
      total: 2,
      query: { limit: 2, offset: 0 },
      path: '/api/v1/apis',
      requestUrl: 'https://shipapis.dev/api/v1/apis',
    })
    expect(env.pagination.has_more).toBe(false)
    expect(env.links).not.toHaveProperty('next')
  })

  it('reports an unpaginated list with a null limit', () => {
    const page = makeApis([{ slug: 'a' }])
    const env = apiListEnvelope(page, {
      total: 1,
      query: {},
      path: '/api/v1/apis',
      requestUrl: 'https://shipapis.dev/api/v1/apis',
    })
    expect(env.pagination.limit).toBeNull()
    expect(env.pagination.has_more).toBe(false)
  })
})

describe('homeApiListPreview', () => {
  it('produces a trimmed preview with coverage meta', () => {
    const preview = homeApiListPreview(makeApis([{ slug: 'a' }, { slug: 'b' }]), { sort: 'health' })
    expect(preview.count).toBe(2)
    expect(preview.results[0]).toHaveProperty('sample_curl')
    expect(preview.results[0].endpoints.length).toBeLessThanOrEqual(2)
    expect(preview.meta).toHaveProperty('coverage')
  })
})

describe('coverageSnapshot (real catalog)', () => {
  it('reports consistent coverage totals', () => {
    const c = coverageSnapshot()
    expect(c.total).toBeGreaterThan(50)
    expect(c.probed).toBeLessThanOrEqual(c.scheduled)
    expect(c.scheduled).toBeLessThanOrEqual(c.total)
  })
})
