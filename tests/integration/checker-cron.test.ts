import { afterEach, describe, expect, it, vi } from 'vitest'
import { runRollup, runSweep } from '../../src/workers/checker'

// A minimal D1 fake: SELECTs are matched by a distinctive SQL substring and return canned rows;
// every prepared/bound write statement is captured (via batch or run) so we can assert what the
// checker wrote. bind() returns a NEW statement (like real D1) so batched inserts keep their args.
interface Route {
  match: (sql: string) => boolean
  rows: any[]
}
interface Captured {
  sql: string
  args: any[] | undefined
}

function makeD1(routes: Route[]) {
  const captured: Captured[] = []
  const prepare = (sql: string) => {
    const mk = (args: any[] | undefined): any => ({
      sql,
      args,
      bind: (...a: any[]) => mk(a),
      all: async () => ({ results: routes.find((r) => r.match(sql))?.rows ?? [] }),
      run: async () => {
        captured.push({ sql, args })
        return { success: true }
      },
    })
    return mk(undefined)
  }
  const db = {
    prepare,
    batch: async (stmts: Captured[]) => {
      for (const s of stmts) captured.push({ sql: s.sql, args: s.args })
      return stmts.map(() => ({ success: true }))
    },
  }
  return { env: { DB: db } as any, captured }
}

const has = (captured: Captured[], needle: string) => captured.filter((c) => c.sql.includes(needle))
const dAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

function mockFetch(map: Record<string, () => Response>) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url)
    const key = Object.keys(map).find((k) => u.startsWith(k))
    if (!key) return new Response('not found', { status: 404 })
    return map[key]()
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('runSweep', () => {
  it('returns 0 and writes nothing when no endpoints are due', async () => {
    const { env, captured } = makeD1([{ match: (s) => s.includes('e.active = 1'), rows: [] }])
    const out = await runSweep(env)
    expect(out.checked).toBe(0)
    expect(captured).toHaveLength(0)
  })

  it('probes due endpoints, records checks and captures a baseline shape', async () => {
    const { env, captured } = makeD1([
      {
        match: (s) => s.includes('e.active = 1'),
        rows: [
          { id: 1, api_id: 10, method: 'GET', url_template: 'https://api.example.com/json', check_tier: 'endpoint', docs_url: null },
          { id: 2, api_id: 11, method: 'GET', url_template: 'https://api.example.com/secure?key=x', check_tier: 'reachability', docs_url: null },
        ],
      },
      { match: (s) => s.includes('from response_shapes'), rows: [] }, // no prior shape → baseline
    ])
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'https://api.example.com/json': () =>
          new Response(JSON.stringify({ temp: 20, city: 'NYC' }), { status: 200, headers: { 'content-type': 'application/json' } }),
        // reachability probe strips the key; a 401 auth wall means the server is up.
        'https://api.example.com/secure': () => new Response('unauthorized', { status: 401 }),
      }),
    )

    const out = await runSweep(env)
    expect(out.checked).toBe(2)

    const checks = has(captured, 'insert into checks')
    expect(checks).toHaveLength(2)
    expect(checks.every((c) => c.args?.[3] === 1)).toBe(true) // ok = 1 for both (JSON 200 + 401 wall)

    // First shape capture per endpoint = a baseline row, and NO shape_changes entry.
    expect(has(captured, 'insert into response_shapes')).toHaveLength(1)
    expect(has(captured, 'insert into shape_changes')).toHaveLength(0)

    // Each API touched (monitored_since gate + agent_access/cors/https).
    expect(has(captured, 'update apis set').length).toBeGreaterThanOrEqual(2)
  })

  it('downshifts an endpoint that returns 429 (defers its next probe into the future)', async () => {
    const { env, captured } = makeD1([
      {
        match: (s) => s.includes('e.active = 1'),
        rows: [{ id: 5, api_id: 20, method: 'GET', url_template: 'https://api.example.com/rl', check_tier: 'endpoint', docs_url: null }],
      },
      { match: (s) => s.includes('from response_shapes'), rows: [] },
    ])
    vi.stubGlobal('fetch', mockFetch({ 'https://api.example.com/rl': () => new Response('slow down', { status: 429 }) }))

    await runSweep(env)
    const check = has(captured, 'insert into checks')[0]
    expect(check.args?.[3]).toBe(0) // ok = 0
    const touch = has(captured, 'update endpoints set last_checked_at')[0]
    // downshift stamps last_checked_at in the FUTURE so the cooldown defers the next probe.
    expect(new Date(touch.args?.[0]).getTime()).toBeGreaterThan(Date.now())
  })

  it('records a schema change when the response shape differs from the stored hash', async () => {
    const { env, captured } = makeD1([
      {
        match: (s) => s.includes('e.active = 1'),
        rows: [{ id: 7, api_id: 30, method: 'GET', url_template: 'https://api.example.com/drift', check_tier: 'endpoint', docs_url: null }],
      },
      {
        match: (s) => s.includes('from response_shapes'),
        // prior shape had only {a:number}; the new response adds a field → drift.
        rows: [{ endpoint_id: 7, hash: 'deadbeef', schema_json: JSON.stringify({ a: 'number' }) }],
      },
    ])
    vi.stubGlobal('fetch', mockFetch({
      'https://api.example.com/drift': () =>
        new Response(JSON.stringify({ a: 1, b: 'new' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    }))

    await runSweep(env)
    const changes = has(captured, 'insert into shape_changes')
    expect(changes).toHaveLength(1)
    expect(String(changes[0].args?.[4])).toContain('b') // diff summary mentions the new field
  })
})

describe('runRollup', () => {
  it('rolls raw checks into daily buckets, prunes old rows and recomputes health', async () => {
    const { env, captured } = makeD1([
      {
        match: (s) => s.includes('from checks where ts'),
        rows: [
          { endpoint_id: 1, ts: dAgo(0), ok: 1, latency_ms: 100 },
          { endpoint_id: 1, ts: dAgo(0), ok: 0, latency_ms: null },
        ],
      },
      // recomputeHealth reads: a monitored, endpoint-tier API with 10 days of clean rollups.
      {
        match: (s) => s.includes('monitored_since is not null'),
        rows: [{ id: 1, status: 'new', monitored_since: dAgo(10), check_tier: 'endpoint' }],
      },
      {
        match: (s) => s.includes('from checks_daily'),
        rows: Array.from({ length: 10 }, (_, i) => ({ api_id: 1, day: dAgo(i).slice(0, 10), uptime_pct: 1, avg_ms: 100, p95_ms: 150, checks_n: 10 })),
      },
      { match: (s) => s.includes('from checks c'), rows: [{ api_id: 1, ok: 1, ts: dAgo(0) }] },
      { match: (s) => s.includes('from shape_changes s'), rows: [] },
    ])

    await runRollup(env)

    // Daily rollup: one bucket for endpoint 1 today (uptime 0.5 over 2 checks).
    const rollup = has(captured, 'insert or replace into checks_daily')
    expect(rollup).toHaveLength(1)
    expect(rollup[0].args?.[2]).toBe(0.5)

    // Retention delete for old raw rows.
    expect(has(captured, 'delete from checks where ts')).toHaveLength(1)

    // recomputeHealth wrote a health score + lifecycle status for the monitored API.
    const health = has(captured, 'update apis set health_score')
    expect(health).toHaveLength(1)
    expect(typeof health[0].args?.[0]).toBe('number')
    expect(health[0].args?.[0]).toBeGreaterThan(0)
    expect(health[0].args?.[1]).toBe('new') // <14 days monitored → still "new"
  })
})
