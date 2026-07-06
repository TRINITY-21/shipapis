// Probe apiKey-labeled candidates — many free tiers work without a key on read routes.
// run: node scripts/probe-apikey-pool.mjs [--from-batch 80] [--limit 1200]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  probeUrl, guessEndpoints, docsFetchUrl, extractProbeUrls, splitBaseAndEndpoint,
  isPostmanCollection, slugify, trimJson, emojiFor, UA,
} from './lib/probe-utils.mjs'
import { PROBE_HINTS } from './lib/probe-hints.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '80')
const LIMIT = Number(process.argv.find((a, i) => process.argv[i - 1] === '--limit') || '1000')
const CONC = 14
const BATCH = 25
const IMPORT = fileURLToPath(new URL('./import/', import.meta.url))
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

const DEMO_SUFFIXES = [
  '', '?api_key=DEMO_KEY', '?apikey=DEMO_KEY', '?access_key=DEMO_KEY', '?key=DEMO_KEY',
  '?api_key=YOUR_API_KEY', '?token=3', '?api_key=test',
]

const queue = []
const seen = new Set()
for (const c of JSON.parse(readFileSync(DIR, 'utf8')).candidates) {
  if (c.auth !== 'apiKey' || !c.https) continue
  if (knownHost(c.docsUrl)) continue
  const key = new URL(c.docsUrl).hostname + '|' + c.name.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  queue.push(c)
  if (queue.length >= LIMIT) break
}

console.log(`probing ${queue.length} apiKey-labeled candidates`)

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

async function go(c) {
  const hint = PROBE_HINTS.find((h) => h.match.test(`${c.name} ${c.docsUrl}`))
  const urls = []
  if (hint) urls.push(hint.baseUrl.replace(/\/+$/, '') + hint.sampleEndpoint)
  urls.push(...guessEndpoints(c))
  try {
    const res = await fetch(docsFetchUrl(c.docsUrl), { signal: AbortSignal.timeout(5000), headers: { 'user-agent': UA } })
    if (res.ok) urls.unshift(...extractProbeUrls(await res.text(), 12))
  } catch { /* */ }

  const expanded = []
  for (const u of urls.slice(0, 12)) {
    expanded.push(u)
    for (const s of DEMO_SUFFIXES) if (s) expanded.push(u.replace(/\?.*$/, '') + (u.includes('?') ? '&' + s.slice(1) : s))
  }

  for (const url of expanded.slice(0, 24)) {
    if (/api_key=YOUR|password=|secret=/i.test(url)) continue
    const r = await probeUrl(url)
    if (r.httpStatus === 200 && r.json && !isPostmanCollection(r.json)) {
      const split = splitBaseAndEndpoint(url.replace(/\?api_key=DEMO_KEY.*$/i, '').replace(/\?access_key=DEMO_KEY.*$/i, ''))
      if (!split) continue
      reg(split.baseUrl)
      const entry = {
        name: c.name,
        slug: slugify(c.name),
        emoji: emojiFor(c.sourceCategory),
        tagline: `${c.name} — free-tier JSON endpoint`,
        description: `${c.name} offers a free API tier. We verified JSON on a sample GET (${c.sourceCategory}). Check provider docs for key requirements and limits.`,
        sourceCategory: c.sourceCategory,
        docsUrl: c.docsUrl,
        baseUrl: split.baseUrl,
        sampleEndpoint: split.sampleEndpoint,
        latencyMs: r.latencyMs,
        corsObserved: r.corsObserved,
        httpStatus: 200,
        sampleJson: trimJson(r.json),
        freeTier: 'Free tier — API key may be required for production',
        rateLimit: 'Unpublished',
        dataLicense: 'Unverified',
        commercialUse: 'unclear',
        auth: 'apiKey',
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
console.log(`\ndone: ${verified.length} verified (apiKey pool)`)
