import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  catGlobalStats,
  catalogCounts,
  isMonitored,
  isOnProbeSchedule,
} from '../../src/data/catalog'
import { apis as seedApis } from '../../src/data/seed'
import { makeApi } from '../helpers/fixtures'

describe('catalog counts (seed scope)', () => {
  it('reports internally consistent totals', () => {
    const c = catalogCounts()
    expect(c.total).toBeGreaterThan(50)
    expect(c.monitored).toBeLessThanOrEqual(c.scheduled)
    expect(c.scheduled).toBeLessThanOrEqual(c.total)
    expect(c.catalogued).toBe(c.queued + c.listedOnly)
    expect(c.routesDocumented).toBeGreaterThan(0)
  })

  it('exposes global stats', () => {
    const s = catGlobalStats()
    expect(s.tracked).toBe(seedApis.length)
    expect(s.medianLatency).toBeGreaterThanOrEqual(0)
  })
})

describe('isMonitored / isOnProbeSchedule', () => {
  it('treats a healthy endpoint-tier API as monitored + scheduled', () => {
    const api = makeApi({ status: 'healthy', auth: 'none' })
    expect(isOnProbeSchedule(api)).toBe(true)
    expect(isMonitored(api)).toBe(true)
  })

  it('treats an unmonitored import as scheduled but not yet monitored', () => {
    const api = makeApi({ status: 'unmonitored', auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' })
    expect(isOnProbeSchedule(api)).toBe(true)
    expect(isMonitored(api)).toBe(false)
  })

  it('treats a listed-only record as neither scheduled nor monitored', () => {
    const api = makeApi({ status: 'unmonitored', checkTier: 'listed' })
    expect(isOnProbeSchedule(api)).toBe(false)
    expect(isMonitored(api)).toBe(false)
  })

  it('excludes dead APIs from the probe schedule', () => {
    expect(isOnProbeSchedule(makeApi({ status: 'dead' }))).toBe(false)
  })
})

// ---- D1 read path (overlay + graceful fallback), isolated per test via module reset ----
const TARGET = seedApis[0].slug
const TARGET_NAME = seedApis[0].name

interface MockRows {
  health?: unknown[]
  series?: unknown[]
  daily?: unknown[]
}

function mockD1(rows: MockRows): D1Database {
  const make = (sql: string) => {
    const stmt = {
      bind: () => stmt,
      all: async () => {
        if (sql.includes('health_series')) return { results: rows.series ?? [] }
        if (sql.includes('from apis')) return { results: rows.health ?? [] }
        if (sql.includes('checks_daily')) return { results: rows.daily ?? [] }
        return { results: [] }
      },
    }
    return stmt
  }
  return { prepare: (sql: string) => make(sql) } as unknown as D1Database
}

describe('withCatalog (D1 overlay)', () => {
  beforeEach(() => vi.resetModules())

  it('overlays real D1 health onto seed metadata and flips data_tier', async () => {
    const cat = await import('../../src/data/catalog')
    const db = mockD1({
      health: [
        {
          slug: TARGET,
          status: 'degraded',
          health_score: 42,
          monitored_since: '2026-06-01',
          last_checked_at: '2026-07-04T00:00:00.000Z',
          agent_access: 'ok',
          cors_verified: 1,
          https: 1,
          rate_limit_notes: '100 req/window',
          commercial_use: 'yes',
          free_tier_notes: 'Free forever',
        },
      ],
    })
    const out = await cat.withCatalog(db, () => {
      const a = cat.catBySlug().get(TARGET)!
      return { name: a.name, status: a.status, health: a.healthScore, cors: a.cors, since: a.monitoredSince, tier: cat.dataTier() }
    })
    expect(out.name).toBe(TARGET_NAME) // static metadata preserved
    expect(out.status).toBe('degraded') // health overlaid
    expect(out.health).toBe(42)
    expect(out.cors).toBe('yes') // corsFromVerified(1)
    expect(out.since).toBe('2026-06-01')
    expect(out.tier).toBe('monitored') // a real check landed
  })

  it('falls back to the seed catalog when D1 returns no rows', async () => {
    const cat = await import('../../src/data/catalog')
    const tier = await cat.withCatalog(mockD1({ health: [] }), () => cat.dataTier())
    expect(tier).toBe('dev-seed')
  })

  it('degrades to seed data when D1 throws', async () => {
    const cat = await import('../../src/data/catalog')
    const db = { prepare: () => { throw new Error('D1 down') } } as unknown as D1Database
    const out = await cat.withCatalog(db, () => ({ tier: cat.dataTier(), n: cat.catApis().length }))
    expect(out.tier).toBe('dev-seed')
    expect(out.n).toBeGreaterThan(50)
  })

  it('serves seed data when there is no DB binding', async () => {
    const cat = await import('../../src/data/catalog')
    const n = await cat.withCatalog(undefined, () => cat.catApis().length)
    expect(n).toBeGreaterThan(50)
  })
})
