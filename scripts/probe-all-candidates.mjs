// Probe EVERY remaining keyless candidate before catalog import.
// Rule: HTTP 200 + parseable JSON body required — nothing ships without a live probe.
//
// run:  node scripts/probe-all-candidates.mjs
//       node scripts/probe-all-candidates.mjs --concurrency 12
//       node scripts/probe-all-candidates.mjs --from-batch 24   # resume batch numbering
//       node scripts/probe-all-candidates.mjs --thin-only     # focus on underfilled categories

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  UA,
  docsFetchUrl,
  emojiFor,
  extractProbeUrls,
  guessEndpoints,
  isOpenApiSpec,
  isPostmanCollection,
  probeUrl,
  resolveHintRequest,
  slugify,
  splitBaseAndEndpoint,
  trimJson,
  writeCopy,
} from './lib/probe-utils.mjs'

const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const HINTS_PATH = fileURLToPath(new URL('./lib/probe-hints.mjs', import.meta.url))
const CANDIDATES = fileURLToPath(new URL('./directory-candidates.json', import.meta.url))
const CANDIDATES_FALLBACK = fileURLToPath(new URL('./candidates.json', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const RUN_LOG = fileURLToPath(new URL('./import/probe-run.json', import.meta.url))

const CONCURRENCY = Number(process.argv.find((a, i) => process.argv[i - 1] === '--concurrency') || '10')
const FROM_BATCH = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '40')
const THIN_ONLY = process.argv.includes('--thin-only')
const INCLUDE_USER_AGENT = process.argv.includes('--include-user-agent')
const MAX_ATTEMPTS = Number(process.argv.find((a, i) => process.argv[i - 1] === '--max-attempts') || '20')
const BATCH_SIZE = 25

/** Source categories mapped to our thinnest catalog buckets. */
const THIN_SOURCE_CATS = new Set([
  'Security', 'Anti-Malware', 'Animals', 'Cryptocurrency', 'Blockchain',
  'Books', 'Dictionaries', 'Finance', 'Currency Exchange',
  'Transportation', 'Vehicle', 'Tracking',
  'Science & Math', 'Patent', 'Machine Learning',
  'Weather', 'Environment',
])

const { PROBE_HINTS } = await import('./lib/probe-hints.mjs')

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

const seedSrc = readFileSync(SEED, 'utf8') + readFileSync(IMPORTED, 'utf8')
const candPath = existsSync(CANDIDATES) ? CANDIDATES : CANDIDATES_FALLBACK
const poolFiles = [
  candPath,
  fileURLToPath(new URL('./import/free-apis-gaps.json', import.meta.url)),
  fileURLToPath(new URL('./import/freepublicapis-gaps.json', import.meta.url)),
  fileURLToPath(new URL('./import/publicapis-io-gaps.json', import.meta.url)),
  fileURLToPath(new URL('./import/apimap-gaps.json', import.meta.url)),
  fileURLToPath(new URL('./import/freeapihub-gaps.json', import.meta.url)),
  fileURLToPath(new URL('./import/freeapiwatch-gaps.json', import.meta.url)),
  fileURLToPath(new URL('./thorough-discovery.json', import.meta.url)),
  fileURLToPath(new URL('./extra-candidates.json', import.meta.url)),
]
const pool = []
for (const p of poolFiles) {
  if (!existsSync(p)) continue
  pool.push(...(JSON.parse(readFileSync(p, 'utf8')).candidates ?? []))
}
console.log(`candidate pool: merged (${pool.length} rows from ${poolFiles.filter(existsSync).length} files)`)
const seedHosts = new Set()
for (const m of seedSrc.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) {
  try {
    for (const a of hostAliases(new URL(m[1]).hostname)) seedHosts.add(a)
  } catch { /* */ }
}
const doneHosts = new Set(seedHosts)
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-\d+\.json$/.test(x))) {
  const j = JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8'))
  for (const v of j.verified ?? []) {
    registerHost(v.baseUrl)
  }
}

// dedupe hints: one per base host, skip already catalogued
const hintsByHost = new Map()
for (const h of PROBE_HINTS) {
  if (THIN_ONLY && !THIN_SOURCE_CATS.has(h.sourceCategory)) continue
  try {
    const host = hostKey(h.baseUrl)
    if (!hostsKnown(host) && !hintsByHost.has(host)) hintsByHost.set(host, h)
  } catch { /* */ }
}

function findHint(c) {
  const hay = `${c.name} ${c.docsUrl} ${c.description}`
  for (const h of PROBE_HINTS) {
    if (h.match.test(hay) && !hostsKnown(h.baseUrl)) return h
  }
  return null
}

function hostsKnown(urlOrHost) {
  const h = urlOrHost.includes('://') ? hostKey(urlOrHost) : urlOrHost.replace(/^www\./, '')
  return hostAliases(h).some((a) => doneHosts.has(a))
}

function registerHost(url) {
  for (const a of hostAliases(hostKey(url))) doneHosts.add(a)
}

async function probeCandidateUrls(urls) {
  const tried = new Set()
  for (const raw of urls) {
    if (tried.size >= MAX_ATTEMPTS) break
    const url = raw.trim()
    if (!url || tried.has(url)) continue
    tried.add(url)
    const r = await probeUrl(url)
    if (r.httpStatus === 200 && r.json != null && !isPostmanCollection(r.json) && !isOpenApiSpec(r.json)) {
      const split = splitBaseAndEndpoint(url)
      if (!split) continue
      return { ...r, ...split, probedUrl: url }
    }
  }
  return null
}

async function verifyCandidate(c) {
  const hint = findHint(c)
  if (hint) {
    const req = resolveHintRequest(hint)
    if (req) {
      const r = await probeUrl(req.url, { headers: req.headers })
      if (r.httpStatus === 200 && r.json && !isPostmanCollection(r.json) && !isOpenApiSpec(r.json)) {
        const ep = req.sampleEndpoint.startsWith('/') ? req.sampleEndpoint : `/${req.sampleEndpoint}`
        return {
          ok: true,
          entry: {
            name: hint.name,
            slug: slugify(hint.name),
            emoji: hint.emoji || emojiFor(c.sourceCategory),
            tagline: hint.tagline,
            description: hint.description,
            sourceCategory: hint.sourceCategory || c.sourceCategory,
            docsUrl: c.docsUrl || hint.docsUrl || hint.baseUrl,
            baseUrl: hint.baseUrl.replace(/\/+$/, ''),
            sampleEndpoint: ep,
            latencyMs: r.latencyMs,
            corsObserved: r.corsObserved,
            httpStatus: 200,
            sampleJson: trimJson(r.json),
            freeTier: req.auth === 'apiKey' ? 'Free tier — API key required' : 'Free — limits not published',
            rateLimit: 'Unpublished',
            dataLicense: 'Unverified',
            commercialUse: 'unclear',
            auth: req.auth,
          },
          host: hostKey(hint.baseUrl),
        }
      }
    }
  }

  const urls = []
  if (hint) {
    const req = resolveHintRequest(hint)
    if (req) urls.push(req.url)
  }
  urls.push(...guessEndpoints(c))

  // docs page mining (one fetch)
  try {
    const fetchUrl = docsFetchUrl(c.docsUrl)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(fetchUrl, {
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,text/plain,*/*' },
    })
    clearTimeout(t)
    if (res.ok) {
      const text = await res.text()
      urls.unshift(...extractProbeUrls(text))
    }
  } catch { /* docs dead */ }

  const hit = await probeCandidateUrls(urls)
  if (!hit) {
    return { ok: false, reason: 'no keyless JSON GET in ' + MAX_ATTEMPTS + ' attempts', host: hostKey(c.docsUrl) }
  }

  const copy = writeCopy(c)
  return {
    ok: true,
    host: hostKey(hit.baseUrl),
    entry: {
      name: c.name,
      slug: slugify(c.name),
      emoji: emojiFor(c.sourceCategory),
      tagline: copy.tagline,
      description: copy.description,
      sourceCategory: c.sourceCategory,
      docsUrl: c.docsUrl,
      baseUrl: hit.baseUrl,
      sampleEndpoint: hit.sampleEndpoint,
      latencyMs: hit.latencyMs,
      corsObserved: hit.corsObserved,
      httpStatus: 200,
      sampleJson: trimJson(hit.json),
      freeTier: 'Free — limits not published',
      rateLimit: 'Unpublished',
      dataLicense: 'Unverified',
      commercialUse: 'unclear',
      auth: c.auth === 'apiKey' ? 'apiKey' : 'none',
      notes: `Auto-probed ${hit.probedUrl}`,
    },
  }
}

// remaining keyless candidates, one row per docs host
const seen = new Set()
const queue = []
for (const c of pool) {
  if (c.auth !== 'none' && c.auth !== 'apiKey' && c.auth !== 'userAgent') continue
  if (c.auth === 'apiKey' && !findHint(c)) continue // only apiKey with a known demo endpoint recipe
  if (c.https === false) continue
  if (THIN_ONLY && !THIN_SOURCE_CATS.has(c.sourceCategory)) continue
  let host
  try { host = hostKey(c.docsUrl) } catch { continue }
  const key = host + '|' + c.name.toLowerCase()
  if (seen.has(key) || hostsKnown(host)) continue
  seen.add(key)
  queue.push(c)
}

// hint-only queue (not in candidates list but we have recipes)
for (const h of hintsByHost.values()) {
  const host = hostKey(h.baseUrl)
  if (hostsKnown(host)) continue
  queue.unshift({
    name: h.name,
    docsUrl: h.docsUrl || h.baseUrl,
    description: h.tagline,
    sourceCategory: h.sourceCategory,
    auth: h.auth || (h.keyEnv ? 'apiKey' : 'none'),
    https: true,
    _hintOnly: true,
  })
}

console.log(`probing ${queue.length} candidates (${CONCURRENCY} concurrent, max ${MAX_ATTEMPTS} attempts each${THIN_ONLY ? ', thin categories only' : ''})`)

const verified = []
const skipped = []
let batchNo = FROM_BATCH
let batchVerified = []

function flushBatch() {
  if (!batchVerified.length) return
  const outPath = `${IMPORT_DIR}batch-${String(batchNo).padStart(2, '0')}.json`
  writeFileSync(outPath, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → wrote ${outPath} (${batchVerified.length} verified)`)
  batchNo++
  batchVerified = []
}

async function worker(items) {
  for (let c; (c = items.shift()); ) {
    const result = await verifyCandidate(c)
    if (result.ok) {
      if (hostsKnown(result.host)) {
        skipped.push({ name: c.name, reason: 'duplicate host after probe' })
        continue
      }
      registerHost(result.entry.baseUrl)
      verified.push(result.entry)
      batchVerified.push(result.entry)
      process.stdout.write(`  ✓ ${result.entry.slug}\n`)
      if (batchVerified.length >= BATCH_SIZE) flushBatch()
    } else {
      skipped.push({ name: c.name, reason: result.reason })
    }
    if ((verified.length + skipped.length) % 50 === 0) {
      writeFileSync(
        RUN_LOG,
        JSON.stringify({ at: new Date().toISOString(), verified: verified.length, skipped: skipped.length, last: c.name }, null, 2),
      )
    }
  }
}

const work = [...queue]
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(work)))
flushBatch()

writeFileSync(
  RUN_LOG,
  JSON.stringify(
    {
      finished: new Date().toISOString(),
      probed: queue.length,
      verified: verified.length,
      skippedCount: skipped.length,
      batches: `batch-${String(FROM_BATCH).padStart(2, '0')}..${String(batchNo - 1).padStart(2, '0')}`,
      skipped,
    },
    null,
    2,
  ) + '\n',
)

console.log(`\ndone: ${verified.length} verified, ${skipped.length} skipped`)
console.log(`log: ${RUN_LOG}`)
console.log('next: npm run seed:assemble')
