import { describe, expect, it } from 'vitest'

describe('test harness smoke', () => {
  it('runs and imports pure logic', async () => {
    const { median } = await import('../src/ui/lib/math')
    expect(median([1, 2, 3])).toBe(2)
  })

  it('imports the seed catalog (module eval works)', async () => {
    const seed = await import('../src/data/seed')
    expect(seed.apis.length).toBeGreaterThan(50)
    expect(seed.categories.length).toBeGreaterThan(5)
  })

  it('dispatches a request through the Hono app with no D1 binding (seed fallback)', async () => {
    const { app } = await import('../src/app')
    const res = await app.fetch(new Request('https://shipapis.dev/api/v1/categories'), { DB: undefined } as never)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { count: number; results: unknown[] }
    expect(body.count).toBeGreaterThan(0)
    expect(Array.isArray(body.results)).toBe(true)
  })
})
