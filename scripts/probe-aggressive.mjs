// Aggressive multi-pattern probe for remaining public-apis-live + directory keyless APIs.
// run: node scripts/probe-aggressive.mjs [--from-batch 77]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  probeUrl, slugify, trimJson, isPostmanCollection, emojiFor, UA, splitBaseAndEndpoint,
} from './lib/probe-utils.mjs'
import { PROBE_HINTS } from './lib/probe-hints.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '77')
const CONC = 16
const BATCH = 25
const IMPORT = fileURLToPath(new URL('./import/', import.meta.url))
const LIVE = fileURLToPath(new URL('./import/public-apis-live.json', import.meta.url))
const DIR = fileURLToPath(new URL('./directory-candidates.json', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMP = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

function aliases(host) {
  const h = host.replace(/^www\./, '')
  const o = new Set([h])
  if (h.startsWith('api.')) o.add(h.slice(4))
  else o.add(`api.${h}`)
  return [...o]
}

const known = new Set()
function reg(url) {
  try { for (const a of aliases(new URL(url).hostname)) known.add(a) } catch { /* */ }
}
for (const f of [SEED, IMP]) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) reg(m[1])
}
for (const f of readdirSync(IMPORT).filter((x) => /^batch-\d+\.json$/.test(x))) {
  for (const v of JSON.parse(readFileSync(IMPORT + f, 'utf8')).verified ?? []) reg(v.baseUrl)
}

function knownHost(url) {
  try { return aliases(new URL(url).hostname).some((h) => known.has(h)) } catch { return true }
}

function findHint(name, url) {
  const hay = `${name} ${url}`
  return PROBE_HINTS.find((h) => h.match.test(hay))
}

const PATTERNS = [
  '/', '/health', '/healthz', '/health/', '/status', '/ping', '/api', '/api/v1', '/api/v2',
  '/v1', '/v2', '/openapi.json', '/swagger.json', '/api-docs', '/docs.json',
  '/random', '/fact', '/facts', '/search', '/entries', '/list', '/all', '/data.json',
  '/feed.json', '/index.json', '/.well-known/openapi.json',
]

function urlsFor(base) {
  const out = new Set()
  try {
    const u = new URL(base)
    const host = u.hostname.replace(/^www\./, '')
    const bases = [u.origin, `https://api.${host}`, `https://${host}`]
    for (const b of bases) for (const p of PATTERNS) out.add(b.replace(/\/+$/, '') + p)
    if (/\.json(\?|$)/.test(base)) out.add(base)
  } catch { /* */ }
  return [...out]
}

const queue = []
const seen = new Set()

function enqueue(name, url, cat, desc) {
  if (knownHost(url)) return
  const key = new URL(url).hostname + '|' + name.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  queue.push({ name, url, cat, desc })
}

for (const a of JSON.parse(readFileSync(LIVE, 'utf8'))) {
  if (a.status !== 'up' || a.auth !== 'none' || !a.https) continue
  enqueue(a.name, a.url, a.category, a.description)
}

for (const c of JSON.parse(readFileSync(DIR, 'utf8')).candidates) {
  if (c.auth !== 'none' || !c.https) continue
  enqueue(c.name, c.docsUrl, c.sourceCategory, c.description)
}

console.log(`aggressive probe: ${queue.length} entries`)

const verified = []
let batchNo = FROM
let batchVerified = []

function flush() {
  if (!batchVerified.length) return
  writeFileSync(`${IMPORT}batch-${String(batchNo).padStart(2, '0')}.json`, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → batch-${batchNo} (${batchVerified.length})`)
  batchNo++
  batchVerified = []
}

async function go(item) {
  const hint = findHint(item.name, item.url)
  const urls = hint ? [hint.baseUrl.replace(/\/+$/, '') + hint.sampleEndpoint] : []
  urls.push(...urlsFor(item.url))

  for (const url of urls.slice(0, 30)) {
    const r = await probeUrl(url)
    if (r.httpStatus === 200 && r.json && !isPostmanCollection(r.json)) {
      const split = splitBaseAndEndpoint(url)
      if (!split) continue
      reg(split.baseUrl)
      const entry = {
        name: hint?.name || item.name,
        slug: slugify(hint?.name || item.name),
        emoji: hint?.emoji || emojiFor(item.cat),
        tagline: hint?.tagline || `${item.name} — keyless JSON API`,
        description: hint?.description || `${item.name}. ${item.desc || 'Verified by aggressive live probe.'}`,
        sourceCategory: item.cat || 'Development',
        docsUrl: item.url,
        baseUrl: split.baseUrl,
        sampleEndpoint: split.sampleEndpoint,
        latencyMs: r.latencyMs,
        corsObserved: r.corsObserved,
        httpStatus: 200,
        sampleJson: trimJson(r.json),
        freeTier: 'Free — limits not published',
        rateLimit: 'Unpublished',
        dataLicense: 'Unverified',
        commercialUse: 'unclear',
      }
      verified.push(entry)
      batchVerified.push(entry)
      process.stdout.write(`  ✓ ${entry.slug}\n`)
      if (batchVerified.length >= BATCH) flush()
      return
    }
  }
}

const work = [...queue]
await Promise.all(Array.from({ length: CONC }, async () => { for (let x; (x = work.shift()); ) await go(x) }))
flush()
console.log(`\ndone: ${verified.length} verified`)
