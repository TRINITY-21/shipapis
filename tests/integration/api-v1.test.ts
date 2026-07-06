import { beforeAll, describe, expect, it } from 'vitest'
import { getJson } from '../helpers/app'

let sampleSlug: string

beforeAll(async () => {
  const { body } = await getJson('/api/v1/apis?limit=1')
  sampleSlug = body.results[0].slug
})

describe('GET /api/v1/apis', () => {
  it('returns the standard envelope', async () => {
    const { res, body } = await getJson('/api/v1/apis?limit=5')
    expect(res.status).toBe(200)
    expect(body.meta).toMatchObject({ api_version: '1', source: 'https://shipapis.dev' })
    expect(body.pagination).toMatchObject({ limit: 5, offset: 0 })
    expect(body.results.length).toBe(5)
    expect(body.count).toBe(5)
    expect(body.results[0]).toHaveProperty('slug')
    expect(body.results[0].links.self).toMatch(/\/api\/v1\/apis\//)
  })

  it('paginates with a next link when more remain', async () => {
    const { body } = await getJson('/api/v1/apis?limit=2&offset=0')
    expect(body.pagination.has_more).toBe(true)
    expect(body.links.next).toContain('offset=2')
  })

  it('filters by category', async () => {
    const { body } = await getJson('/api/v1/apis?category=weather&limit=100')
    expect(body.results.length).toBeGreaterThan(0)
    expect(body.results.every((a: any) => a.category === 'weather')).toBe(true)
  })

  it('filters by auth', async () => {
    const { body } = await getJson('/api/v1/apis?auth=none&limit=50')
    expect(body.results.every((a: any) => a.auth === 'none')).toBe(true)
  })

  it('filters to probed APIs only', async () => {
    const { body } = await getJson('/api/v1/apis?probed=true&limit=50')
    expect(body.results.every((a: any) => a.probed === true)).toBe(true)
  })

  it('caps limit at 100', async () => {
    const { body } = await getJson('/api/v1/apis?limit=99999')
    expect(body.pagination.limit).toBe(100)
  })

  it('sorts by latency without error', async () => {
    const { res, body } = await getJson('/api/v1/apis?sort=latency&limit=10')
    expect(res.status).toBe(200)
    const latencies = body.results.map((a: any) => a.p50_ms ?? Infinity)
    const sorted = [...latencies].sort((x, y) => x - y)
    expect(latencies).toEqual(sorted)
  })
})

describe('GET /api/v1/apis/:slug', () => {
  it('returns a full record for a known slug', async () => {
    const { res, body } = await getJson(`/api/v1/apis/${sampleSlug}`)
    expect(res.status).toBe(200)
    expect(body.slug).toBe(sampleSlug)
    expect(body).toHaveProperty('sample_response')
    expect(body.page_url).toBe(`https://shipapis.dev/api/${sampleSlug}`)
    expect(body.meta.data_tier).toBe('dev-seed')
  })

  it('404s for an unknown slug', async () => {
    const { res, body } = await getJson('/api/v1/apis/definitely-not-a-real-slug')
    expect(res.status).toBe(404)
    expect(body.error).toBe('not_found')
  })
})

describe('GET /api/v1/apis/:slug/history', () => {
  it('returns a 90-day axis and recent latency', async () => {
    const { res, body } = await getJson(`/api/v1/apis/${sampleSlug}/history`)
    expect(res.status).toBe(200)
    expect(body.slug).toBe(sampleSlug)
    expect(body.days).toHaveLength(90)
    expect(body.days[0]).toHaveProperty('day')
    expect(Array.isArray(body.latency_recent_ms)).toBe(true)
  })

  it('404s for an unknown slug', async () => {
    const { res } = await getJson('/api/v1/apis/nope/history')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/v1/search', () => {
  it('400s without a query', async () => {
    const { res, body } = await getJson('/api/v1/search')
    expect(res.status).toBe(400)
    expect(body.error).toBe('missing_query')
  })

  it('returns ranked results for a query', async () => {
    const { res, body } = await getJson('/api/v1/search?q=weather')
    expect(res.status).toBe(200)
    expect(body.count).toBeGreaterThan(0)
    expect(body.results[0]).toHaveProperty('slug')
  })

  it('caps the limit at 25', async () => {
    const { body } = await getJson('/api/v1/search?q=api&limit=999')
    expect(body.results.length).toBeLessThanOrEqual(25)
  })
})

describe('GET /api/v1/best', () => {
  it('400s without a task', async () => {
    const { res, body } = await getJson('/api/v1/best')
    expect(res.status).toBe(400)
    expect(body.error).toBe('missing_task')
  })

  it('returns a best match with a note for a real task', async () => {
    const { res, body } = await getJson('/api/v1/best?task=current+weather+for+a+city')
    expect(res.status).toBe(200)
    expect(body.best).toHaveProperty('slug')
    expect(Array.isArray(body.alternatives)).toBe(true)
    expect(body.note).toContain('weather')
  })

  it('404s with no_match for an off-catalog task', async () => {
    const { res, body } = await getJson('/api/v1/best?task=quantum+teleportation+flux+xyzzy')
    expect(res.status).toBe(404)
    expect(body.error).toBe('no_match')
  })
})

describe('GET /api/v1/categories & /random', () => {
  it('lists categories with counts', async () => {
    const { res, body } = await getJson('/api/v1/categories')
    expect(res.status).toBe(200)
    expect(body.count).toBeGreaterThan(0)
    expect(body.results[0]).toHaveProperty('apis')
  })

  it('returns a random live API', async () => {
    const { res, body } = await getJson('/api/v1/random')
    expect(res.status).toBe(200)
    expect(body).toHaveProperty('slug')
    expect(body.status).not.toBe('dead')
  })
})
