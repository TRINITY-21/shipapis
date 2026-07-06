// The health checker — the product's supply chain (MASTERPLAN Δ6 week 2).
//
// Cron #1 (*/15): sweep up to 45 due endpoints. "Due" = active AND not checked in COOLDOWN_MIN
// (12h — the Δ3 etiquette floor / per-endpoint cadence). The */15 is only the sweep *heartbeat*
// that covers the whole catalog 45 at a time (the 50-subrequest free-tier cap); each endpoint is
// re-tested ~2×/day. At ~4.9k endpoints that's ≈9.8k checks/day — ~10% of D1's 100k daily writes,
// and the shard query is covered by idx_endpoints_due so reads are ~45 rows/run.
// Cron #2 (nightly): raw checks → checks_daily rollup, 30-day retention purge, health-score +
// lifecycle recompute with §6.3 grace rules. Never parses bodies (10ms CPU budget) except a
// ≤2KB sniff on 403/429/503 to classify bot challenges — "unverifiable", never "down" (§6.4).
// check_tier (Δ4): endpoint = 2xx JSON health · reachability = 401/403 auth wall · docs = docs_url up.

import { corsVerifiedFromHeaders, rateFromHeaders } from '../lib/metadata-probe'
import type { Env } from './env'

export type { Env } from './env'

const PROBE_ORIGIN = 'https://shipapis.dev'

type CheckTier = 'endpoint' | 'reachability' | 'docs' | 'listed'

const UA = 'shipapisbot/1.0 (+https://shipapis.dev/methodology)'
// Per-endpoint cadence: re-check an endpoint at most every 12h (2 samples/day). This is the knob that
// throttles how often each API is probed — NOT the */15 cron, which is only the sweep heartbeat that
// covers all endpoints 45 at a time (the 50-subrequest free-tier cap). 2×/day keeps a real uptime
// signal, stays polite to third-party/donation-funded APIs, and holds writes far under 100k/day.
const COOLDOWN_MIN = 720
const BATCH = 45 // + a handful of D1 binding calls stays under the 50-subrequest cap
const CONCURRENCY = 5
const TIMEOUT_MS = 5_000
const RETENTION_DAYS = 30

type FailureKind = 'timeout' | 'dns' | 'http4xx' | 'http5xx' | 'bot_challenge' | null

interface DueEndpoint {
  id: number
  api_id: number
  method: string
  url_template: string
  check_tier: CheckTier
  docs_url: string | null
}

const AUTH_QUERY_KEYS = ['api_key', 'apikey', 'key', 'token', 'app_id', 'app_key', 'access_token']

function stripAuthParams(url: string): string {
  try {
    const u = new URL(url)
    for (const k of AUTH_QUERY_KEYS) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return url
  }
}

interface ProbeMeta {
  cors_verified: 0 | 1 | null
  rate_limit_notes: string | null
  https: 0 | 1 | null
}

interface CheckResult {
  endpoint_id: number
  api_id: number
  ts: string
  status_code: number | null
  ok: 0 | 1
  latency_ms: number | null
  failure_kind: FailureKind
  /** §6.2: on 429/Retry-After, downshift this endpoint to ~4 checks/day. */
  downshift: boolean
  /** Structural hash of the JSON response + its signature — null when the body wasn't JSON/parseable. */
  shape_hash?: string | null
  shape_sig?: Record<string, string> | null
  meta: ProbeMeta
}

const CHALLENGE_MARKERS = ['just a moment', 'challenge-platform', 'attention required', 'cf-chl', 'px-captcha', '_pxhd']

/* ---------- response-shape capture (Feature 1: the schema-drift changelog) ----------
 * On OK JSON responses we hash the STRUCTURE (paths + types, values ignored). A changed hash vs
 * the last capture is a schema change — recorded in shape_changes. The changelog nobody else has,
 * because you have to actually call the API over time to produce it. */

const SHAPE_MAX_BYTES = 512 * 1024

/** Structural signature: a flat sorted path→type map. Arrays sampled by their first element. */
function shapeSignature(v: unknown, path = '', out: Record<string, string> = {}): Record<string, string> {
  if (path) out[path] = Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v
  if (Array.isArray(v)) {
    if (v.length) shapeSignature(v[0], `${path}[]`, out)
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v as object).sort()) {
      shapeSignature((v as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out)
    }
  }
  return out
}

/** FNV-1a over the canonical signature → short hex. Same value ⇒ same shape. */
function hashSig(sig: Record<string, string>): string {
  const canon = Object.keys(sig).sort().map((k) => `${k}:${sig[k]}`).join('|')
  let h = 2166136261
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

/** Human diff between two signatures: "+field:type" added · "~field:old→new" retyped · "−field" removed. */
function summarizeDiff(oldSig: Record<string, string>, newSig: Record<string, string>): string {
  const ch: string[] = []
  for (const k of Object.keys(newSig)) {
    if (!(k in oldSig)) ch.push(`+${k}:${newSig[k]}`)
    else if (oldSig[k] !== newSig[k]) ch.push(`~${k}:${oldSig[k]}→${newSig[k]}`)
  }
  for (const k of Object.keys(oldSig)) if (!(k in newSig)) ch.push(`−${k}`)
  const head = ch.slice(0, 8).join(', ')
  return ch.length > 8 ? `${head} …(+${ch.length - 8} more)` : head || 'shape changed'
}

const safeParseSig = (s: string | null | undefined): Record<string, string> => {
  try {
    return s ? (JSON.parse(s) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

async function probe(e: DueEndpoint): Promise<CheckResult> {
  const ts = new Date().toISOString()
  const started = Date.now()
  const tier = e.check_tier
  const target =
    tier === 'docs' && e.docs_url ? e.docs_url : tier === 'reachability' ? stripAuthParams(e.url_template) : e.url_template
  const accept = tier === 'docs' ? 'text/html,application/json,*/*' : 'application/json, */*'
  try {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(target, {
        method: e.method || 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: accept, Origin: PROBE_ORIGIN },
      })
    } finally {
      clearTimeout(tid)
    }
    const latency = Date.now() - started
    const s = res.status
    const meta: ProbeMeta = {
      cors_verified: corsVerifiedFromHeaders(res.headers),
      rate_limit_notes: rateFromHeaders(res.headers),
      https: target.startsWith('https://') ? 1 : 0,
    }
    const base = { endpoint_id: e.id, api_id: e.api_id, ts, status_code: s, latency_ms: latency, meta }

    if (tier === 'reachability' && (s === 401 || s === 403)) {
      let challenged = res.headers.get('cf-mitigated') === 'challenge'
      if (!challenged) {
        try {
          const head = (await res.text()).slice(0, 2048).toLowerCase()
          challenged = CHALLENGE_MARKERS.some((m) => head.includes(m))
        } catch {
          /* body unreadable */
        }
      } else {
        res.body?.cancel()
      }
      if (!challenged) return { ...base, ok: 1, failure_kind: null, downshift: false }
    }

    if (s < 400) {
      if (tier === 'docs') {
        res.body?.cancel()
        return { ...base, ok: 1, failure_kind: null, downshift: false }
      }
      // Capture the response SHAPE on OK JSON (bounded read) so we can detect schema drift over time.
      let shape_hash: string | null = null
      let shape_sig: Record<string, string> | null = null
      const ct = res.headers.get('content-type') ?? ''
      const clen = Number(res.headers.get('content-length') ?? 0)
      if (/json/i.test(ct) && (!clen || clen <= SHAPE_MAX_BYTES)) {
        try {
          const text = await res.text()
          if (text.length <= SHAPE_MAX_BYTES) {
            shape_sig = shapeSignature(JSON.parse(text))
            shape_hash = hashSig(shape_sig)
          }
        } catch {
          /* not JSON / truncated — skip shape tracking this round, still a healthy check */
        }
      } else {
        res.body?.cancel()
      }
      return { ...base, ok: 1, failure_kind: null, downshift: false, shape_hash, shape_sig }
    }

    // Challenge sniff — only on the statuses challenges actually use, body capped at 2KB.
    let challenged = res.headers.get('cf-mitigated') === 'challenge'
    if (!challenged && (s === 403 || s === 429 || s === 503)) {
      try {
        const head = (await res.text()).slice(0, 2048).toLowerCase()
        challenged = CHALLENGE_MARKERS.some((m) => head.includes(m))
      } catch {
        /* body unreadable — keep status-based classification */
      }
    } else {
      res.body?.cancel()
    }

    const downshift = s === 429 || res.headers.has('retry-after')
    if (challenged) return { ...base, ok: 0, failure_kind: 'bot_challenge', downshift }
    return { ...base, ok: 0, failure_kind: s >= 500 ? 'http5xx' : 'http4xx', downshift }
  } catch (err) {
    const timeout = err instanceof Error && err.name === 'AbortError'
    return {
      endpoint_id: e.id,
      api_id: e.api_id,
      ts,
      status_code: null,
      ok: 0,
      latency_ms: timeout ? TIMEOUT_MS : null,
      failure_kind: timeout ? 'timeout' : 'dns',
      downshift: false,
      meta: { cors_verified: null, rate_limit_notes: null, https: null },
    }
  }
}

export async function runSweep(env: Env): Promise<{ checked: number }> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - COOLDOWN_MIN * 60_000).toISOString()
  const due = await env.DB.prepare(
    `select e.id, e.api_id, e.method, e.url_template, a.check_tier, a.docs_url
     from endpoints e join apis a on a.id = e.api_id
     where e.active = 1 and a.check_opt_out = 0 and a.check_tier != 'listed' and e.last_checked_at < ?
     order by e.last_checked_at asc limit ?`,
  )
    .bind(cutoff, BATCH)
    .all<DueEndpoint>()

  const endpoints = due.results ?? []
  if (!endpoints.length) return { checked: 0 }

  const results: CheckResult[] = []
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, endpoints.length) }, async () => {
      while (i < endpoints.length) {
        const e = endpoints[i++]
        results.push(await probe(e))
      }
    }),
  )

  const nowIso = now.toISOString()
  // Downshifted endpoints get last_checked_at stamped ~4.5h in the future: with the 90-min
  // cooldown that defers the next probe ~6h (≈4/day) without needing a separate column.
  const downshiftIso = new Date(now.getTime() + 4.5 * 3_600_000).toISOString()

  const stmts: D1PreparedStatement[] = []
  const insert = env.DB.prepare(
    'insert into checks (endpoint_id, ts, status_code, ok, latency_ms, failure_kind) values (?, ?, ?, ?, ?, ?)',
  )
  const touchEndpoint = env.DB.prepare('update endpoints set last_checked_at = ? where id = ?')
  for (const r of results) {
    stmts.push(insert.bind(r.endpoint_id, r.ts, r.status_code, r.ok, r.latency_ms, r.failure_kind))
    stmts.push(touchEndpoint.bind(r.downshift ? downshiftIso : nowIso, r.endpoint_id))
  }
  // monitored_since is set by the FIRST real check — the Δ2 honesty gate flipping open per record.
  // agent_access: a bot_challenge on any of an API's endpoints marks it 'blocked'; else a clean probe
  // marks it 'ok'; a transient failure (timeout/dns/5xx) leaves the prior verdict untouched (coalesce null).
  const touchApi = env.DB.prepare(
    `update apis set
       last_checked_at = ?,
       monitored_since = coalesce(monitored_since, ?),
       agent_access = coalesce(?, agent_access),
       cors_verified = case when ? is not null then ? else cors_verified end,
       https = coalesce(?, https),
       rate_limit_notes = case
         when ? is not null and (
           rate_limit_notes is null or trim(rate_limit_notes) = ''
           or lower(trim(rate_limit_notes)) in ('unpublished', 'none published', 'not published', 'unknown')
         ) then ?
         else rate_limit_notes
       end
     where id = ?`,
  )
  for (const apiId of new Set(results.map((r) => r.api_id))) {
    const rs = results.filter((r) => r.api_id === apiId)
    const access = rs.some((r) => r.failure_kind === 'bot_challenge') ? 'blocked' : rs.some((r) => r.ok) ? 'ok' : null
    const probed = rs.filter((r) => r.meta.cors_verified != null)
    const cors =
      probed.length === 0 ? null : probed.some((r) => r.meta.cors_verified === 1) ? 1 : 0
    const https = rs.find((r) => r.meta.https != null)?.meta.https ?? null
    const rate = rs.map((r) => r.meta.rate_limit_notes).find((v) => v) ?? null
    stmts.push(touchApi.bind(nowIso, nowIso.slice(0, 10), access, cors, cors, https, rate, rate, apiId))
  }

  // Schema-drift: compare each captured shape to the last stored one (one grouped read for the batch).
  // First capture per endpoint = baseline (no change row); a differing hash = a shape_changes entry.
  const shaped = results.filter((r) => r.shape_hash)
  if (shaped.length) {
    const ids = [...new Set(shaped.map((r) => r.endpoint_id))]
    const prev = await env.DB.prepare(
      `select endpoint_id, hash, schema_json, max(captured_at) as captured_at
       from response_shapes where endpoint_id in (${ids.map(() => '?').join(',')}) group by endpoint_id`,
    )
      .bind(...ids)
      .all<{ endpoint_id: number; hash: string; schema_json: string }>()
    const prevBy = new Map((prev.results ?? []).map((p) => [p.endpoint_id, p]))
    const insShape = env.DB.prepare(
      'insert into response_shapes (endpoint_id, captured_at, schema_json, sample_json_redacted, hash) values (?, ?, ?, NULL, ?)',
    )
    const insChange = env.DB.prepare(
      'insert into shape_changes (endpoint_id, ts, old_hash, new_hash, diff_summary) values (?, ?, ?, ?, ?)',
    )
    for (const r of shaped) {
      const p = prevBy.get(r.endpoint_id)
      const sigJson = JSON.stringify(r.shape_sig)
      if (!p) {
        stmts.push(insShape.bind(r.endpoint_id, r.ts, sigJson, r.shape_hash)) // baseline capture
      } else if (p.hash !== r.shape_hash) {
        stmts.push(insShape.bind(r.endpoint_id, r.ts, sigJson, r.shape_hash))
        stmts.push(insChange.bind(r.endpoint_id, r.ts, p.hash, r.shape_hash, summarizeDiff(safeParseSig(p.schema_json), r.shape_sig!)))
      }
    }
  }

  await env.DB.batch(stmts)
  return { checked: results.length }
}

/* ---------- nightly rollup + lifecycle (cron #2) ---------- */

const dayOf = (ts: string) => ts.slice(0, 10)
const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** Materialize the compact 90-day health series (uptime90 / latency48 / p50 / p95) that loadCatalog
 *  used to compute live per request. Computing it here (nightly) lets the hot read path skip the
 *  90-day checks_daily join entirely — the read-cost fix. Same algorithm loadCatalog used, so the
 *  rendered sparklines/scores are unchanged. `days` are endpoint-day rows, grouped here by calendar day. */
function buildDaySeries(days: { day: string; up: number; ms: number | null; p95: number | null; n: number }[]): string {
  const byDay = new Map<string, { up: number[]; avg: number[]; p95: number[] }>()
  for (const d of days) {
    let b = byDay.get(d.day)
    if (!b) byDay.set(d.day, (b = { up: [], avg: [], p95: [] }))
    b.up.push(d.up)
    if (d.ms != null) b.avg.push(d.ms)
    if (d.p95 != null) b.p95.push(d.p95)
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const axis = Array.from({ length: 90 }, (_, i) => daysAgoIso(89 - i).slice(0, 10))
  const u = axis.map((day) => {
    const b = byDay.get(day)
    return b ? Math.round(mean(b.up)! * 1000) / 1000 : -1
  })
  const latSeries = axis.map((day) => mean(byDay.get(day)?.avg ?? [])).filter((v): v is number => v != null)
  const l = latSeries.slice(-48).map((v) => Math.round(v))
  const p95Series = axis.map((day) => mean(byDay.get(day)?.p95 ?? [])).filter((v): v is number => v != null)
  const sortedLat = [...l].sort((a, b) => a - b)
  const p50 = sortedLat.length ? sortedLat[Math.min(sortedLat.length - 1, Math.floor(0.5 * sortedLat.length))] : 0
  const p95 = p95Series.length ? Math.round(Math.max(...p95Series)) : p50
  return JSON.stringify({ u, l, p50, p95 })
}

export async function runRollup(env: Env): Promise<void> {
  // 1) Roll up the last 2 UTC days (REPLACE = idempotent; keeps today's partials fresh too).
  const since = daysAgoIso(1).slice(0, 10)
  const raw = await env.DB.prepare(
    `select endpoint_id, ts, ok, latency_ms from checks where ts >= ? order by endpoint_id`,
  )
    .bind(since)
    .all<{ endpoint_id: number; ts: string; ok: number; latency_ms: number | null }>()

  const buckets = new Map<string, { endpoint_id: number; day: string; oks: number; n: number; lat: number[] }>()
  for (const c of raw.results ?? []) {
    const key = `${c.endpoint_id}|${dayOf(c.ts)}`
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { endpoint_id: c.endpoint_id, day: dayOf(c.ts), oks: 0, n: 0, lat: [] }))
    b.n++
    if (c.ok) {
      b.oks++
      if (c.latency_ms != null) b.lat.push(c.latency_ms)
    }
  }
  const rollup = env.DB.prepare(
    'insert or replace into checks_daily (endpoint_id, day, uptime_pct, avg_ms, p95_ms, checks_n) values (?, ?, ?, ?, ?, ?)',
  )
  const stmts: D1PreparedStatement[] = []
  for (const b of buckets.values()) {
    const sorted = [...b.lat].sort((x, y) => x - y)
    const avg = sorted.length ? Math.round(sorted.reduce((x, y) => x + y, 0) / sorted.length) : null
    const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null
    stmts.push(rollup.bind(b.endpoint_id, b.day, b.n ? b.oks / b.n : 0, avg, p95, b.n))
  }

  // 2) Retention: raw rows past 30 days (rollups keep the history; protects the 500MB DB).
  stmts.push(env.DB.prepare('delete from checks where ts < ?').bind(daysAgoIso(RETENTION_DAYS)))
  if (stmts.length) await env.DB.batch(stmts)

  await recomputeHealth(env)
}

/** §6.3 grace before judgment + §6.6 published formula (uptime 60 / latency 20 / stability 20).
 *  DEAD requires ≥30 days of ~100% failure — structurally impossible to overclaim early. */
async function recomputeHealth(env: Env): Promise<void> {
  const monitored = await env.DB.prepare(
    `select id, status, monitored_since, check_tier from apis where monitored_since is not null and check_opt_out = 0`,
  ).all<{ id: number; status: string; monitored_since: string; check_tier: CheckTier }>()
  if (!monitored.results?.length) return

  const day90 = daysAgoIso(90).slice(0, 10)
  const daily = await env.DB.prepare(
    `select e.api_id, d.day, d.uptime_pct, d.avg_ms, d.p95_ms, d.checks_n
     from checks_daily d join endpoints e on e.id = d.endpoint_id
     where d.day >= ?`,
  )
    .bind(day90)
    .all<{ api_id: number; day: string; uptime_pct: number; avg_ms: number | null; p95_ms: number | null; checks_n: number }>()

  const recent = await env.DB.prepare(
    `select e.api_id, c.ok, c.ts from checks c join endpoints e on e.id = c.endpoint_id
     where c.ts >= ? order by c.ts asc`,
  )
    .bind(daysAgoIso(1))
    .all<{ api_id: number; ok: number; ts: string }>()

  const drift = await env.DB.prepare(
    `select e.api_id, count(*) as n from shape_changes s join endpoints e on e.id = s.endpoint_id
     where s.ts >= ? group by e.api_id`,
  )
    .bind(day90)
    .all<{ api_id: number; n: number }>()

  const byApi = new Map<number, { days: { day: string; up: number; ms: number | null; p95: number | null; n: number }[]; last: number[]; drift: number }>()
  const entry = (id: number) => {
    let v = byApi.get(id)
    if (!v) byApi.set(id, (v = { days: [], last: [], drift: 0 }))
    return v
  }
  for (const d of daily.results ?? []) entry(d.api_id).days.push({ day: d.day, up: d.uptime_pct, ms: d.avg_ms, p95: d.p95_ms, n: d.checks_n })
  for (const c of recent.results ?? []) entry(c.api_id).last.push(c.ok)
  for (const s of drift.results ?? []) entry(s.api_id).drift = s.n

  const today = new Date().toISOString().slice(0, 10)
  const upd = env.DB.prepare(
    'update apis set health_score = ?, status = ?, verified_at = ?, tombstoned_at = coalesce(tombstoned_at, ?), health_series = ? where id = ?',
  )
  const stmts: D1PreparedStatement[] = []

  for (const api of monitored.results) {
    const v = byApi.get(api.id) ?? { days: [], last: [], drift: 0 }
    const totN = v.days.reduce((s, d) => s + d.n, 0)
    if (!totN && !v.last.length) continue // monitored but no rolled-up data yet — leave as-is
    const seriesJson = buildDaySeries(v.days) // materialized 90-day series → cheap reads on the hot path

    const uptime = totN ? v.days.reduce((s, d) => s + d.up * d.n, 0) / totN : v.last.reduce((s, o) => s + o, 0) / v.last.length
    const last3 = v.last.slice(-3)
    const daysMonitored = Math.floor((Date.now() - new Date(api.monitored_since).getTime()) / 86_400_000)
    const window = (n: number) => v.days.filter((d) => d.day >= daysAgoIso(n).slice(0, 10))
    const avgUp = (ds: { up: number; n: number }[]) => {
      const n = ds.reduce((s, d) => s + d.n, 0)
      return n ? ds.reduce((s, d) => s + d.up * d.n, 0) / n : 1
    }
    const w7 = window(7)
    const w30 = window(30)
    const failing3 = last3.length === 3 && last3.every((o) => !o)

    const lifecycle = () => {
      let status = api.status
      if (api.status === 'dead') {
        if (last3.length === 3 && last3.every((o) => o)) status = 'resurrected'
      } else if (daysMonitored >= 30 && w30.length >= 25 && avgUp(w30) <= 0.02) {
        status = 'dead'
      } else if (daysMonitored >= 7 && w7.length >= 5 && avgUp(w7) < 0.5) {
        status = 'dying'
      } else if (failing3) {
        status = 'degraded'
      } else if (daysMonitored < 14) {
        status = 'new'
      } else {
        status = 'healthy'
      }
      return status
    }

    if (api.check_tier === 'reachability' || api.check_tier === 'docs') {
      const status = lifecycle()
      stmts.push(upd.bind(null, status, today, status === 'dead' ? today : null, seriesJson, api.id))
      continue
    }

    const msSamples = v.days.filter((d) => d.ms != null)
    const avgMs = msSamples.length ? msSamples.reduce((s, d) => s + (d.ms as number), 0) / msSamples.length : 300
    const latencyFactor = Math.max(0, Math.min(1, 1 - (avgMs - 120) / 1200))
    const stability = Math.max(0, 1 - v.drift * 0.12)
    const health = Math.round((uptime * 0.6 + latencyFactor * 0.2 + stability * 0.2) * 100)
    const status = lifecycle()

    stmts.push(upd.bind(status === 'dead' ? 0 : health, status, today, status === 'dead' ? today : null, seriesJson, api.id))
  }

  // Denormalized category counts (cheap, keeps hub pages one indexed read).
  stmts.push(env.DB.prepare('update categories set api_count = (select count(*) from apis where category_id = categories.id)'))
  if (stmts.length) await env.DB.batch(stmts)
}
