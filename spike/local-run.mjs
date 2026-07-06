// Residential-egress twin of the Worker spike — same endpoints, same UA, same timeout,
// same classification. Diff its per-slug classes against /run outputs to separate
// "this API blocks Cloudflare egress" from "this API is just down".
//   node --experimental-strip-types local-run.mjs [batch] > runs/local-$(date +%Y%m%dT%H%M).json
// (Node >= 23.6 needs no flag; 22.6–23.5 needs it — the .ts import relies on type stripping.)
// No batch arg = probe the full list. Keep classification in sync with src/index.ts.

import { ENDPOINTS } from './endpoints.ts'

const UA = 'shipapisbot-spike/0.1 (+https://shipapis.dev/methodology)'
const TIMEOUT_MS = 5_000
const CONCURRENCY = 5
const MAX_PER_BATCH = 45
const BODY_CAP = 2_048

const NUM_BATCHES = Math.ceil(ENDPOINTS.length / MAX_PER_BATCH)
const batchOf = (n) => ENDPOINTS.filter((_, i) => i % NUM_BATCHES === n)

const CHALLENGE_STATUSES = new Set([403, 429, 503])
const BODY_MARKERS = [
  'just a moment',
  'challenge-platform',
  'attention required',
  'cf-browser-verification',
  '_cf_chl',
  'cf_chl_',
  'ddos protection by',
  'reference&#32;#',
  'reference #',
  'errors.edgesuite.net',
  'px-captcha',
  '_pxhd',
  'perimeterx',
]

function challengeSignal(res, body) {
  const mitigated = res.headers.get('cf-mitigated')
  if (mitigated) return `cf-mitigated: ${mitigated}`
  const server = (res.headers.get('server') ?? '').toLowerCase()
  if (server.includes('akamaighost')) return 'server: AkamaiGHost'
  const b = body.toLowerCase()
  for (const m of BODY_MARKERS) if (b.includes(m)) return `body: ${m}`
  return null
}

async function readCapped(res, cap) {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks = []
  let n = 0
  try {
    while (n < cap) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      n += value.length
    }
  } catch {
    // aborted mid-read
  } finally {
    reader.cancel().catch(() => {})
  }
  let out = ''
  const dec = new TextDecoder()
  for (const c of chunks) out += dec.decode(c, { stream: true })
  return out.slice(0, cap)
}

async function probe(e) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const t0 = Date.now()
  try {
    const res = await fetch(e.url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: e.expects === 'json' ? 'application/json' : '*/*' },
    })
    const latency_ms = Date.now() - t0
    let cls
    let signal
    if (CHALLENGE_STATUSES.has(res.status)) {
      const sig = challengeSignal(res, await readCapped(res, BODY_CAP))
      if (sig) {
        cls = 'bot_challenge'
        signal = sig
      } else {
        cls = res.status === 403 ? 'auth_wall_401_403' : res.status === 503 ? 'http_5xx' : 'http_4xx'
      }
    } else {
      res.body?.cancel().catch(() => {})
      cls =
        res.status < 300
          ? 'ok_2xx'
          : res.status === 401
            ? 'auth_wall_401_403'
            : res.status < 500
              ? 'http_4xx'
              : 'http_5xx'
    }
    return { slug: e.slug, auth: e.auth, status_code: res.status, class: cls, latency_ms, ...(signal ? { signal } : {}) }
  } catch (err) {
    const timedOut = ctrl.signal.aborted
    return {
      slug: e.slug,
      auth: e.auth,
      status_code: null,
      class: timedOut ? 'timeout' : 'dns_or_network',
      latency_ms: Date.now() - t0,
      ...(timedOut ? {} : { signal: String(err instanceof Error ? err.message : err).slice(0, 120) }),
    }
  } finally {
    clearTimeout(timer)
  }
}

async function runPool(list) {
  const out = new Array(list.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
      while (next < list.length) {
        const i = next++
        out[i] = await probe(list[i])
      }
    }),
  )
  return out
}

function aggregate(results) {
  const by_class = { ok_2xx: 0, auth_wall_401_403: 0, http_4xx: 0, http_5xx: 0, timeout: 0, dns_or_network: 0, bot_challenge: 0 }
  const by_auth = { none: 0, 'keyed-demo': 0, keyed: 0 }
  let keyless_checkable = 0
  let keyed_server_up = 0
  let keyless_now_walled = 0
  let unverifiable = 0
  for (const r of results) {
    by_class[r.class]++
    by_auth[r.auth]++
    const keyless = r.auth !== 'keyed'
    if (keyless && r.class === 'ok_2xx') keyless_checkable++
    if (!keyless && r.status_code !== null && r.class !== 'bot_challenge') keyed_server_up++
    if (r.auth === 'none' && r.class === 'auth_wall_401_403') keyless_now_walled++
    if (r.class === 'bot_challenge' || r.class === 'timeout' || r.class === 'dns_or_network') unverifiable++
  }
  const n = results.length || 1
  const pct = (x) => Math.round((x / n) * 1000) / 10
  return {
    headline: { bot_challenge_rate_pct: pct(by_class.bot_challenge), keyless_checkable_rate_pct: pct(keyless_checkable) },
    counts: { by_class, by_auth, keyless_checkable, keyed_server_up, keyless_now_walled, unverifiable },
  }
}

// --- main ------------------------------------------------------------------------
const arg = process.argv[2]
let list = ENDPOINTS
let batch = 'all'
if (arg !== undefined) {
  batch = Number(arg)
  if (!Number.isInteger(batch) || batch < 0 || batch >= NUM_BATCHES) {
    console.error(`batch must be an integer in 0..${NUM_BATCHES - 1} (or omitted for the full list)`)
    process.exit(1)
  }
  list = batchOf(batch)
}

const t0 = Date.now()
const results = await runPool(list)
const { headline, counts } = aggregate(results)
console.log(
  JSON.stringify(
    {
      meta: {
        source: 'local',
        node: process.version,
        batch,
        batches_available: NUM_BATCHES,
        probed: results.length,
        total_endpoints: ENDPOINTS.length,
        ua: UA,
        ts: new Date().toISOString(),
        elapsed_ms: Date.now() - t0,
      },
      headline,
      counts,
      results,
    },
    null,
    2,
  ),
)
