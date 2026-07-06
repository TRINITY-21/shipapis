// Probe apiKey candidates that ship a free/demo/public key in the URL path or query.
// run: node scripts/probe-apikey-batch.mjs [--from-batch 55] [--limit 400]

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GENERATED_HINTS } from './lib/generated-hints.mjs'
import { PROBE_HINTS } from './lib/probe-hints.mjs'
import {
    UA,
    docsFetchUrl, extractProbeUrls,
    guessEndpoints,
    isApiKeyProbeHit,
    probeUrl,
    resolveHintRequest,
    slugify,
    splitBaseAndEndpoint,
    trimJson
} from './lib/probe-utils.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '55')
const LIMIT = Number(process.argv.find((a, i) => process.argv[i - 1] === '--limit') || '500')
const CONC = 20
const BATCH_SIZE = 25
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))

const FREE_APIS_ONLY = process.argv.includes('--free-apis')
const MEDIA_PRIORITY = process.argv.includes('--media-priority')

const ALL_POOL_FILES = [
  { path: fileURLToPath(new URL('./import/free-apis-gaps.json', import.meta.url)), tag: 'free-apis' },
  { path: fileURLToPath(new URL('./import/src-freeapis-publicapis.json', import.meta.url)), tag: 'free-apis' },
  { path: fileURLToPath(new URL('./directory-candidates.json', import.meta.url)), tag: 'directory' },
  { path: fileURLToPath(new URL('./thorough-discovery.json', import.meta.url)), tag: 'discovery' },
  { path: fileURLToPath(new URL('./candidates.json', import.meta.url)), tag: 'candidates' },
]
const POOL_FILES = FREE_APIS_ONLY
  ? ALL_POOL_FILES.filter((f) => f.tag === 'free-apis').map((f) => f.path)
  : ALL_POOL_FILES.map((f) => f.path)

const MEDIA_CATS = new Set([
  'Video', 'Music', 'Entertainment', 'Photography', 'Art & Design', 'Games & Comics', 'Anime',
])

function hostKey(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}
function hostAliases(host) {
  const h = host.replace(/^www\./, '')
  const out = new Set([h])
  if (h.startsWith('api.')) out.add(h.slice(4))
  else out.add(`api.${h}`)
  return [...out]
}

const seed = readFileSync(fileURLToPath(new URL('../src/data/seed.ts', import.meta.url)), 'utf8')
  + readFileSync(fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url)), 'utf8')
const known = new Set()
for (const m of seed.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) {
  try { for (const a of hostAliases(new URL(m[1]).hostname)) known.add(a) } catch { /* */ }
}
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-\d+\.json$/.test(x))) {
  for (const v of JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8')).verified ?? []) {
    try { for (const a of hostAliases(new URL(v.baseUrl).hostname)) known.add(a) } catch { /* */ }
  }
}

function hostsKnown(url) {
  return hostAliases(hostKey(url)).some((a) => known.has(a))
}

function findHint(c) {
  const hay = `${c.name} ${c.docsUrl} ${c.description}`
  for (const h of [...PROBE_HINTS, ...GENERATED_HINTS]) {
    if (h.match?.test?.(hay) && !hostsKnown(h.baseUrl)) return h
  }
  return null
}

async function probeWithHint(hint) {
  const req = resolveHintRequest(hint)
  if (!req) return null
  const r = await probeUrl(req.url, { headers: req.headers })
  if (!isApiKeyProbeHit(r.httpStatus, r.json)) return null
  const split = splitBaseAndEndpoint(req.url)
  if (!split) return null
  return { ...r, ...split, probedUrl: req.url, auth: req.auth, sampleEndpoint: req.sampleEndpoint }
}

const DEMO_PATTERNS = [
  (base, path) => `${base}${path}${path.includes('?') ? '&' : '?'}api_key=DEMO_KEY`,
  (base, path) => `${base}${path}${path.includes('?') ? '&' : '?'}apikey=demo`,
  (base, path) => `${base}${path}${path.includes('?') ? '&' : '?'}key=demo`,
  (base, path) => `${base}${path}${path.includes('?') ? '&' : '?'}token=demo`,
  (base, path) => `${base}${path}${path.includes('?') ? '&' : '?'}app_id=demo&app_key=demo`,
]

const pool = []
for (const p of POOL_FILES) {
  if (!existsSync(p)) continue
  pool.push(...(JSON.parse(readFileSync(p, 'utf8')).candidates ?? []))
}

const queue = []
const seen = new Set()
for (const c of pool) {
  if (!['apiKey', 'oauth', 'userAgent'].includes(c.auth)) continue
  if (!c.https && c.https !== undefined) continue
  let host
  try { host = hostKey(c.docsUrl) } catch { continue }
  if (hostsKnown(host)) continue
  const key = host + '|' + c.name.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  queue.push(c)
}

function queueScore(c) {
  let s = 0
  if (c.source === 'free-apis.github.io') s += 4
  if (MEDIA_CATS.has(c.sourceCategory)) s += 3
  if (c.auth === 'oauth') s += 1
  if (c.description?.length > 30) s += 1
  return s
}

queue.sort((a, b) => queueScore(b) - queueScore(a))
const workQueue = queue.slice(0, LIMIT)

console.log(`apiKey probe queue: ${workQueue.length} (pool ${queue.length}${FREE_APIS_ONLY ? ', free-apis only' : ''}${MEDIA_PRIORITY ? ', media priority' : ''})`)

let batchNo = FROM
let batchVerified = []
const verified = []

function flush() {
  if (!batchVerified.length) return
  const path = `${IMPORT_DIR}batch-${String(batchNo).padStart(2, '0')}.json`
  writeFileSync(path, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → ${path} (${batchVerified.length})`)
  batchNo++
  batchVerified = []
}

async function tryUrls(urls) {
  for (const url of urls) {
    const r = await probeUrl(url)
    if (!isApiKeyProbeHit(r.httpStatus, r.json)) continue
    const split = splitBaseAndEndpoint(url)
    if (split) return { ...r, ...split, probedUrl: url }
  }
  return null
}

async function verify(c) {
  const hint = findHint(c)
  const urls = []
  if (hint) {
    const req = resolveHintRequest(hint)
    if (req) urls.push(req.url)
  }
  urls.push(...guessEndpoints(c).slice(0, 12))
  try {
    const res = await fetch(docsFetchUrl(c.docsUrl), {
      signal: AbortSignal.timeout(5000),
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
    })
    if (res.ok) urls.unshift(...extractProbeUrls(await res.text(), 8))
  } catch { /* */ }

  const expanded = [...urls]
  for (const url of urls.slice(0, 6)) {
    try {
      const u = new URL(url)
      const base = `${u.protocol}//${u.host}`
      const path = u.pathname + u.search
      for (const fn of DEMO_PATTERNS) expanded.push(fn(base, path))
    } catch { /* */ }
  }

  let hit = hint ? await probeWithHint(hint) : null
  if (!hit) hit = await tryUrls([...new Set(expanded)].slice(0, 24))
  if (!hit) return null

  return {
    name: hint?.name || c.name,
    slug: slugify(hint?.name || c.name),
    emoji: hint?.emoji || '🔑',
    tagline: hint?.tagline || `${c.name} — free tier with API key`,
    description: hint?.description || `${c.name} exposes a free-tier JSON API. Register for an API key if required; we verified a public or demo endpoint.`,
    sourceCategory: c.sourceCategory || hint?.sourceCategory || 'Development',
    docsUrl: c.docsUrl,
    baseUrl: hit.baseUrl,
    sampleEndpoint: hit.sampleEndpoint.startsWith('/') ? hit.sampleEndpoint : `/${hit.sampleEndpoint}`,
    latencyMs: hit.latencyMs,
    corsObserved: hit.corsObserved,
      httpStatus: hit.httpStatus,
    sampleJson: trimJson(hit.json),
    freeTier: 'Free tier — API key required',
    rateLimit: 'Unpublished',
    dataLicense: 'Unverified',
    commercialUse: 'unclear',
    auth: hit.auth || 'apiKey',
    notes: `apiKey probe ${hit.probedUrl}`,
  }
}

const work = [...workQueue]
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let c; (c = work.shift()); ) {
    const entry = await verify(c)
    if (!entry) continue
    if (hostsKnown(entry.baseUrl)) continue
    for (const a of hostAliases(hostKey(entry.baseUrl))) known.add(a)
    verified.push(entry)
    batchVerified.push(entry)
    process.stdout.write(`  ✓ ${entry.slug}\n`)
    if (batchVerified.length >= BATCH_SIZE) flush()
  }
}))

flush()
console.log(`\ndone: ${verified.length} apiKey APIs verified`)
