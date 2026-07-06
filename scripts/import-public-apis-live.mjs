// Import verified keyless APIs from public-apis-live/apis.json (2872 reachability-checked).
// Probes each for live JSON, emits batch files.
// run: node scripts/import-public-apis-live.mjs [--from-batch 45] [--limit 600]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  probeUrl, guessEndpoints, extractProbeUrls, docsFetchUrl, splitBaseAndEndpoint,
  isPostmanCollection, slugify, trimJson, emojiFor, UA,
} from './lib/probe-utils.mjs'
import { PROBE_HINTS } from './lib/probe-hints.mjs'

const FROM_BATCH = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '45')
const LIMIT = Number(process.argv.find((a, i) => process.argv[i - 1] === '--limit') || '600')
const CONC = Number(process.argv.find((a, i) => process.argv[i - 1] === '--concurrency') || '14')
const BATCH_SIZE = 25
const MAX = 16
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const CACHE = fileURLToPath(new URL('./import/public-apis-live.json', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

function hostAliases(host) {
  const h = host.replace(/^www\./, '')
  const out = new Set([h])
  if (h.startsWith('api.')) out.add(h.slice(4))
  else out.add(`api.${h}`)
  return [...out]
}

function register(set, url) {
  try { for (const a of hostAliases(new URL(url).hostname)) set.add(a) } catch { /* */ }
}

const known = new Set()
for (const f of [SEED, IMPORTED]) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) register(known, m[1])
}
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-\d+\.json$/.test(x))) {
  for (const v of JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8')).verified ?? []) register(known, v.baseUrl)
}

let apis
try {
  apis = JSON.parse(readFileSync(CACHE, 'utf8'))
  console.log(`cached ${apis.length} apis`)
} catch {
  console.log('fetching public-apis-live apis.json...')
  const res = await fetch('https://unpkg.com/public-apis-live@0.3.0/apis.json', { headers: { 'user-agent': UA } })
  apis = await res.json()
  writeFileSync(CACHE, JSON.stringify(apis))
  console.log(`cached ${apis.length} apis`)
}

function findHint(a) {
  const hay = `${a.name} ${a.url} ${a.description}`
  for (const h of PROBE_HINTS) {
    if (h.match.test(hay)) return h
  }
  return null
}

const queue = apis.filter((a) => {
  if (a.status !== 'up' || a.auth !== 'none' || !a.https) return false
  try { return !hostAliases(new URL(a.url).hostname).some((h) => known.has(h)) } catch { return false }
}).slice(0, LIMIT)

console.log(`probing ${queue.length} public-apis-live entries`)

const verified = []
let batchNo = FROM_BATCH
let batchVerified = []

function flush() {
  if (!batchVerified.length) return
  const p = `${IMPORT_DIR}batch-${String(batchNo).padStart(2, '0')}.json`
  writeFileSync(p, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → ${p} (${batchVerified.length})`)
  batchNo++
  batchVerified = []
}

async function verify(a) {
  const hint = findHint(a)
  const urls = []
  if (hint) urls.push(hint.baseUrl.replace(/\/+$/, '') + hint.sampleEndpoint)
  urls.push(...guessEndpoints({ docsUrl: a.url, name: a.name }))
  if (/\.json(\?|$)/i.test(a.url)) urls.unshift(a.url)

  try {
    const res = await fetch(docsFetchUrl(a.url), {
      signal: AbortSignal.timeout(5000),
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
    })
    if (res.ok) urls.unshift(...extractProbeUrls(await res.text(), 16))
  } catch { /* */ }

  const tried = new Set()
  for (const raw of urls) {
    if (tried.size >= MAX) break
    const url = raw.trim()
    if (!url || tried.has(url)) continue
    tried.add(url)
    const r = await probeUrl(url)
    if (r.httpStatus === 200 && r.json && !isPostmanCollection(r.json)) {
      const split = splitBaseAndEndpoint(url)
      if (!split) continue
      register(known, split.baseUrl)
      const entry = {
        name: hint?.name || a.name,
        slug: slugify(hint?.name || a.name),
        emoji: hint?.emoji || emojiFor(a.category),
        tagline: hint?.tagline || `${a.name} — ${(a.description || '').slice(0, 50)}`,
        description: hint?.description || `${a.name} is a reachability-verified public API (public-apis-live). We confirmed JSON on a sample GET with no key. Category: ${a.category}.`,
        sourceCategory: a.category,
        docsUrl: a.url,
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
        notes: `public-apis-live ${a.id}; probed ${url}`,
      }
      verified.push(entry)
      batchVerified.push(entry)
      process.stdout.write(`  ✓ ${entry.slug}\n`)
      if (batchVerified.length >= BATCH_SIZE) flush()
      return
    }
  }
}

const work = [...queue]
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let a; (a = work.shift()); ) await verify(a)
}))
flush()
console.log(`\ndone: ${verified.length} verified from public-apis-live`)
