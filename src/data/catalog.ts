// Request-scoped catalog — the D1 read path.
//
// Catalog METADATA (name, urls, auth, cors, sample, endpoints, description…) is identical in the seed
// module and D1 for static fields; cors, rate limits, and commercial terms are overlaid from D1 when
// probed. HEALTH fields (status, health_score, uptime, latency, agent_access, monitored_since) are
// also overlaid from real D1 rows per request.
//
// Two safety properties:
//  • Seed fallback — if D1 is absent, errors, or has no rows, we return the seed catalog verbatim.
//    The app never depends on D1 being populated; it degrades to exactly today's behavior.
//  • data_tier honesty — 'dev-seed' until a real check has landed (any monitored_since), then 'monitored'.
//
// Delivery uses AsyncLocalStorage so sync SSR components read the request catalog without prop-drilling
// and without unsafe module globals (each request has its own async context).

import { AsyncLocalStorage } from 'node:async_hooks'
import { corsFromVerified, isRatePlaceholder } from '../lib/metadata-probe'
import { isProbeScheduled } from './check-tier'
import {
    build,
    apis as seedApis,
    bySlug as seedBySlug,
    type ApiEntry,
    type ChangeEvent,
    type LifecycleStatus,
} from './seed'

export interface Catalog {
  apis: ApiEntry[]
  bySlug: Map<string, ApiEntry>
  dataTier: 'dev-seed' | 'monitored'
}

const SEED_CATALOG: Catalog = { apis: seedApis, bySlug: seedBySlug, dataTier: 'dev-seed' }

const als = new AsyncLocalStorage<Catalog>()

/** The catalog for the current request, or the seed catalog outside a request scope. */
export function currentCatalog(): Catalog {
  return als.getStore() ?? SEED_CATALOG
}

// Request-scoped accessors — the seed-module drop-ins. Call once at the top of a component/handler.
export const catApis = (): ApiEntry[] => currentCatalog().apis
export const catBySlug = (): Map<string, ApiEntry> => currentCatalog().bySlug
export const dataTier = (): Catalog['dataTier'] => currentCatalog().dataTier
export const catLiveApis = (): ApiEntry[] => currentCatalog().apis.filter((a) => a.status !== 'dead')
export const catDeadApis = (): ApiEntry[] => currentCatalog().apis.filter((a) => a.status === 'dead')
export const catApisInCategory = (slug: string): ApiEntry[] => currentCatalog().apis.filter((a) => a.category === slug)

export function catAllShapeChanges(): ChangeEvent[] {
  return currentCatalog()
    .apis.flatMap((a) => a.shapeChanges.map((s) => ({ slug: a.slug, name: a.name, emoji: a.emoji, category: a.category, date: s.date, summary: s.summary })))
    .sort((x, y) => y.date.localeCompare(x.date))
}

/** Queued on the checker cron (tier !== listed, not dead). */
export const isOnProbeSchedule = (a: ApiEntry) => isProbeScheduled(a.checkTier) && a.status !== 'dead'

/** Probed = on schedule and at least one real check has landed (or hand-curated demo status). */
export const isMonitored = (a: ApiEntry) =>
  isProbeScheduled(a.checkTier) && (a.status !== 'unmonitored' || a.monitoredSince != null)

export function catalogCounts() {
  const all = currentCatalog().apis
  const monitored = all.filter(isMonitored)
  const scheduled = all.filter(isOnProbeSchedule)
  const queued = all.filter((a) => isOnProbeSchedule(a) && a.status === 'unmonitored')
  const listedOnly = all.filter((a) => a.checkTier === 'listed')
  const routesDocumented = all.reduce((n, a) => n + a.endpoints.length, 0)
  return {
    total: all.length,
    scheduled: scheduled.length,
    monitored: monitored.length,
    queued: queued.length,
    listedOnly: listedOnly.length,
    catalogued: queued.length + listedOnly.length,
    routesDocumented,
    healthy: all.filter((a) => a.status === 'healthy').length,
    dead: all.filter((a) => a.status === 'dead').length,
  }
}

export function catGlobalStats() {
  const all = currentCatalog().apis
  const scheduled = all.filter(isOnProbeSchedule)
  const probed = all.filter(isMonitored)
  const p50s = probed.filter((a) => a.p50 > 0).map((a) => a.p50).sort((x, y) => x - y)
  const sweepMin = probed.length ? Math.min(...probed.map((a) => a.lastCheckedMin)) : null
  return {
    tracked: all.length,
    scheduled: scheduled.length,
    monitored: probed.length,
    routesDocumented: all.reduce((n, a) => n + a.endpoints.length, 0),
    checks24h: scheduled.length * 96,
    medianLatency: p50s[Math.floor(p50s.length / 2)] ?? 0,
    diedThisMonth: all.filter((a) => a.status === 'dead').length,
    sweepMin,
  }
}

/* Isolate-level memo: build the catalog from D1 at most once per TTL per isolate, not once per
   request. An isolate serves many requests, so this collapses the (potentially large) catalog read
   from per-request to per-minute-per-isolate. Health changes on the ~15-min cron, so 60s of
   staleness is imperceptible; combined with the edge cache in app.ts, D1 reads stay far under the
   free-tier 5M/day. The seed fallback is never memoized, so a transient D1 miss self-heals. */
let catalogMemo: { at: number; catalog: Catalog } | null = null
const CATALOG_MEMO_TTL_MS = 60_000

/** Run `fn` with a catalog built from D1 (or the seed fallback) in async-local scope. */
export async function withCatalog<T>(db: D1Database | undefined, fn: () => T | Promise<T>): Promise<T> {
  const now = Date.now()
  let catalog: Catalog
  if (db && catalogMemo && now - catalogMemo.at < CATALOG_MEMO_TTL_MS) {
    catalog = catalogMemo.catalog
  } else {
    catalog = await loadCatalog(db)
    if (db && catalog !== SEED_CATALOG) catalogMemo = { at: now, catalog }
  }
  return als.run(catalog, fn)
}

interface HealthRow {
  slug: string
  status: LifecycleStatus
  health_score: number | null
  monitored_since: string | null
  last_checked_at: string | null
  agent_access: 'ok' | 'blocked' | 'unknown'
  cors_verified: number | null
  https: number
  rate_limit_notes: string | null
  commercial_use: 'yes' | 'no' | 'unclear'
  free_tier_notes: string | null
}
interface DailyRow {
  slug: string
  day: string
  uptime_pct: number
  avg_ms: number | null
  p95_ms: number | null
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const percentile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0

/** Parse a materialized health_series blob (written by the checker's nightly recompute). */
const parseSeries = (s: string): { u: number[]; l: number[]; p50: number; p95: number } => {
  try {
    const p = JSON.parse(s) as { u?: number[]; l?: number[]; p50?: number; p95?: number }
    return { u: Array.isArray(p.u) ? p.u : [], l: Array.isArray(p.l) ? p.l : [], p50: p.p50 ?? 0, p95: p.p95 ?? 0 }
  } catch {
    return { u: [], l: [], p50: 0, p95: 0 }
  }
}

async function loadCatalog(db: D1Database | undefined): Promise<Catalog> {
  if (!db) return SEED_CATALOG
  try {
    const health = await db
      .prepare(
        'select slug, status, health_score, monitored_since, last_checked_at, agent_access, cors_verified, https, rate_limit_notes, commercial_use, free_tier_notes from apis',
      )
      .all<HealthRow>()
    const rows = health.results ?? []
    if (!rows.length) return SEED_CATALOG
    const healthBySlug = new Map(rows.map((r) => [r.slug, r]))

    // Materialized per-API health series (uptime90/latency48/p50/p95), written nightly by
    // recomputeHealth. One guarded query; a pre-migration DB (no column) or a not-yet-backfilled DB
    // falls through to the live 90-day checks_daily join below — the expensive read this replaces.
    let seriesBySlug = new Map<string, string>()
    try {
      const s = await db
        .prepare('select slug, health_series from apis where health_series is not null')
        .all<{ slug: string; health_series: string }>()
      seriesBySlug = new Map((s.results ?? []).map((r) => [r.slug, r.health_series]))
    } catch {
      /* health_series column not present yet — fall through to the checks_daily path */
    }
    const hasSeries = seriesBySlug.size > 0

    const now = new Date()
    // Fallback path only: 90-day daily rollups (one grouped read). Skipped once the series is materialized.
    const bySlugDay = new Map<string, Map<string, { up: number[]; avg: number[]; p95: number[] }>>()
    if (!hasSeries) {
      const since = isoDay(new Date(now.getTime() - 89 * 86_400_000))
      const daily = await db
        .prepare(
          `select a.slug as slug, d.day as day, d.uptime_pct as uptime_pct, d.avg_ms as avg_ms, d.p95_ms as p95_ms
           from checks_daily d join endpoints e on e.id = d.endpoint_id join apis a on a.id = e.api_id
           where d.day >= ?`,
        )
        .bind(since)
        .all<DailyRow>()
      for (const r of daily.results ?? []) {
        let byDay = bySlugDay.get(r.slug)
        if (!byDay) bySlugDay.set(r.slug, (byDay = new Map()))
        let b = byDay.get(r.day)
        if (!b) byDay.set(r.day, (b = { up: [], avg: [], p95: [] }))
        b.up.push(r.uptime_pct)
        if (r.avg_ms != null) b.avg.push(r.avg_ms)
        if (r.p95_ms != null) b.p95.push(r.p95_ms)
      }
    }

    const axis = Array.from({ length: 90 }, (_, i) => isoDay(new Date(now.getTime() - (89 - i) * 86_400_000)))
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

    const apisOut = seedApis.map((seed): ApiEntry => {
      const h = healthBySlug.get(seed.slug)
      if (!h) return seed // in seed but not D1 (shouldn't happen) — keep seed record
      let uptime90: number[]
      let latency48: number[]
      let p50: number
      let p95: number
      const ser = seriesBySlug.get(seed.slug)
      if (ser) {
        const s = parseSeries(ser)
        uptime90 = s.u
        latency48 = s.l
        p50 = s.p50
        p95 = s.p95
      } else {
        const byDay = bySlugDay.get(seed.slug)
        uptime90 = axis.map((day) => {
          const b = byDay?.get(day)
          return b ? Math.round(mean(b.up)! * 1000) / 1000 : -1
        })
        const latSeries = axis.map((day) => mean(byDay?.get(day)?.avg ?? [])).filter((v): v is number => v != null)
        latency48 = latSeries.slice(-48).map((v) => Math.round(v))
        const p95Series = axis.map((day) => mean(byDay?.get(day)?.p95 ?? [])).filter((v): v is number => v != null)
        const sortedLat = [...latency48].sort((a, b) => a - b)
        p50 = sortedLat.length ? percentile(sortedLat, 50) : 0
        p95 = p95Series.length ? Math.round(Math.max(...p95Series)) : p50
      }
      const lastCheckedMin = h.last_checked_at ? Math.max(0, Math.round((now.getTime() - Date.parse(h.last_checked_at)) / 60_000)) : seed.lastCheckedMin

      const corsProbed = h.cors_verified != null
      const cors = corsProbed ? corsFromVerified(h.cors_verified) : seed.cors
      const commercialUse = h.commercial_use
      const freeTier = h.free_tier_notes?.trim() || seed.freeTier
      const probed = h.monitored_since != null
      const rateLimit =
        h.rate_limit_notes && !isRatePlaceholder(h.rate_limit_notes) ? h.rate_limit_notes : seed.rateLimit
      const https = h.monitored_since ? Boolean(h.https) : seed.https
      const rateProbed = probed && !isRatePlaceholder(h.rate_limit_notes) && isRatePlaceholder(seed.rateLimit)

      return {
        ...seed,
        status: h.status,
        agentAccess: h.agent_access,
        cors,
        https,
        commercialUse,
        freeTier,
        rateLimit,
        metaProvenance: {
          auth: probed && seed.checkTier === 'reachability' ? 'probed' : 'documented',
          cors: corsProbed ? 'probed' : seed.cors === 'unknown' ? 'pending' : 'import',
          commercialUse: commercialUse === 'unclear' ? 'pending' : 'documented',
          https: probed ? 'probed' : 'documented',
          freeTier: freeTier && freeTier !== 'Unpublished' ? 'documented' : 'pending',
          rateLimit: rateProbed ? 'probed' : isRatePlaceholder(rateLimit) ? 'pending' : 'documented',
        },
        // real score when the rollup has computed one; -1 = not scored yet; dead pins to 0
        healthScore: h.status === 'dead' ? 0 : h.health_score ?? -1,
        uptime90,
        latency48,
        p50,
        p95,
        lastCheckedMin,
        monitoredSince: h.monitored_since,
      }
    })

    const dataTier: Catalog['dataTier'] = rows.some((r) => r.monitored_since) ? 'monitored' : 'dev-seed'
    return { apis: apisOut, bySlug: new Map(apisOut.map((a) => [a.slug, a])), dataTier }
  } catch {
    return SEED_CATALOG // any D1 hiccup → the app still serves, on seed data
  }
}

// re-export the pure builder for callers that only need it (keeps import graph shallow)
export { build }
