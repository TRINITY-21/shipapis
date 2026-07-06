// shipapis-spike — MASTERPLAN §12 spikes #1/#2, measured from REAL Worker egress.
//   GET /              usage
//   GET /run?batch=N   probe one interleaved batch (≤45 fetches; 50-subrequest hard cap)
// No storage bindings — results are returned to the caller; keep the JSON outputs.
// Keep classification in sync with ../local-run.mjs (the residential-egress twin).

import { ENDPOINTS, type SpikeEndpoint } from '../endpoints'

const UA = 'shipapisbot-spike/0.1 (+https://shipapis.dev/methodology)'
const TIMEOUT_MS = 5_000
const CONCURRENCY = 5
const MAX_PER_BATCH = 45
const BODY_CAP = 2_048 // only read bodies when the status suggests a challenge, and never more than this

export type FailClass =
  | 'ok_2xx'
  | 'auth_wall_401_403'
  | 'http_4xx'
  | 'http_5xx'
  | 'timeout'
  | 'dns_or_network'
  | 'bot_challenge'

export interface ProbeResult {
  slug: string
  auth: SpikeEndpoint['auth']
  status_code: number | null
  class: FailClass
  latency_ms: number
  signal?: string // which challenge marker (or network error) fired — evidence for the readout
}

// Batches are interleaved (index % numBatches) so every batch is a representative
// keyless/keyed mix and no batch exceeds the subrequest cap.
const NUM_BATCHES = Math.ceil(ENDPOINTS.length / MAX_PER_BATCH)
const batchOf = (n: number) => ENDPOINTS.filter((_, i) => i % NUM_BATCHES === n)

// --- bot-challenge detection -------------------------------------------------
// Only these statuses warrant a body sniff; everything else gets its body cancelled unread.
const CHALLENGE_STATUSES = new Set([403, 429, 503])
// Lowercased markers: Cloudflare challenge/block pages, Akamai deny pages, PerimeterX/HUMAN.
const BODY_MARKERS = [
  'just a moment', // Cloudflare managed-challenge <title>
  'challenge-platform', // Cloudflare challenge script path
  'attention required', // Cloudflare block page <title>
  'cf-browser-verification',
  '_cf_chl',
  'cf_chl_',
  'ddos protection by',
  'reference&#32;#', // Akamai deny page
  'reference #',
  'errors.edgesuite.net',
  'px-captcha', // PerimeterX / HUMAN
  '_pxhd',
  'perimeterx',
]

function challengeSignal(res: Response, body: string): string | null {
  const mitigated = res.headers.get('cf-mitigated')
  if (mitigated) return `cf-mitigated: ${mitigated}` // definitive Cloudflare signal
  const server = (res.headers.get('server') ?? '').toLowerCase()
  if (server.includes('akamaighost')) return 'server: AkamaiGHost'
  const b = body.toLowerCase()
  for (const m of BODY_MARKERS) if (b.includes(m)) return `body: ${m}`
  // A bare `server: cloudflare` 403 with no marker is ambiguous (the origin may sit behind
  // CF and be refusing on its own) — deliberately NOT classified as a challenge.
  return null
}

async function readCapped(res: Response, cap: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let n = 0
  try {
    while (n < cap) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      n += value.length
    }
  } catch {
    // aborted mid-read — classify on whatever we got
  } finally {
    reader.cancel().catch(() => {})
  }
  let out = ''
  const dec = new TextDecoder()
  for (const c of chunks) out += dec.decode(c, { stream: true })
  return out.slice(0, cap)
}

// --- probe --------------------------------------------------------------------
async function probe(e: SpikeEndpoint): Promise<ProbeResult> {
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
    let cls: FailClass
    let signal: string | undefined
    if (CHALLENGE_STATUSES.has(res.status)) {
      const sig = challengeSignal(res, await readCapped(res, BODY_CAP))
      if (sig) {
        cls = 'bot_challenge'
        signal = sig
      } else {
        cls = res.status === 403 ? 'auth_wall_401_403' : res.status === 503 ? 'http_5xx' : 'http_4xx'
      }
    } else {
      res.body?.cancel().catch(() => {}) // free the connection; never parse healthy bodies
      cls =
        res.status < 300 // 3xx can't survive redirect:'follow'; lump with ok
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

async function runPool(list: SpikeEndpoint[]): Promise<ProbeResult[]> {
  const out: ProbeResult[] = new Array(list.length)
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

// --- aggregation -----------------------------------------------------------------
function aggregate(results: ProbeResult[]) {
  const by_class: Record<FailClass, number> = {
    ok_2xx: 0,
    auth_wall_401_403: 0,
    http_4xx: 0,
    http_5xx: 0,
    timeout: 0,
    dns_or_network: 0,
    bot_challenge: 0,
  }
  const by_auth: Record<SpikeEndpoint['auth'], number> = { none: 0, 'keyed-demo': 0, keyed: 0 }
  let keyless_checkable = 0 // keyless (none|keyed-demo) AND 2xx — the live-testable population
  let keyed_server_up = 0 // keyed AND any HTTP answer — link-verified tier at best
  let keyless_now_walled = 0 // auth:'none' hitting an auth wall — ecosystem drift, worth eyeballing
  let unverifiable = 0 // bot_challenge | timeout | dns_or_network
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
  const pct = (x: number) => Math.round((x / n) * 1000) / 10
  return {
    headline: {
      // Spike #1 — >10–15% sustained across runs ⇒ plan a fallback runner (MASTERPLAN §12)
      bot_challenge_rate_pct: pct(by_class.bot_challenge),
      // Spike #2 — <50% ⇒ ship live-tested vs link-verified tiers
      keyless_checkable_rate_pct: pct(keyless_checkable),
    },
    counts: { by_class, by_auth, keyless_checkable, keyed_server_up, keyless_now_walled, unverifiable },
  }
}

// --- worker -------------------------------------------------------------------------
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2) + '\n', {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/') {
      return json({
        name: 'shipapis-spike',
        purpose: 'MASTERPLAN §12 spikes #1/#2 — bot-challenge rate and keyless-checkable rate from real Worker egress',
        usage: `GET /run?batch=N with N in 0..${NUM_BATCHES - 1} (batches are interleaved slices of ${ENDPOINTS.length} endpoints)`,
        etiquette: 'single GET per endpoint per run, no retries, 5s timeout, UA ' + UA,
        protocol: 'run all batches a few times daily for 3 days; keep every JSON output; see spike/README.md',
      })
    }

    if (url.pathname === '/run') {
      const batch = Number(url.searchParams.get('batch') ?? '0')
      if (!Number.isInteger(batch) || batch < 0 || batch >= NUM_BATCHES) {
        return json({ error: `batch must be an integer in 0..${NUM_BATCHES - 1}` }, 400)
      }
      const list = batchOf(batch)
      const t0 = Date.now()
      const results = await runPool(list)
      const { headline, counts } = aggregate(results)
      return json({
        meta: {
          source: 'worker',
          colo: (request as Request & { cf?: { colo?: string } }).cf?.colo ?? null,
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
      })
    }

    return json({ error: 'not found — try GET / or GET /run?batch=0' }, 404)
  },
}
