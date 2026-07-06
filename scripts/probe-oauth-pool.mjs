// Probe oauth-labeled candidates — some expose public read routes without auth.
// run: node scripts/probe-oauth-pool.mjs [--from-batch 96] [--limit 400]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  probeUrl, guessEndpoints, docsFetchUrl, extractProbeUrls, splitBaseAndEndpoint,
  isPostmanCollection, slugify, trimJson, emojiFor, UA,
} from './lib/probe-utils.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '96')
const LIMIT = Number(process.argv.find((a, i) => process.argv[i - 1] === '--limit') || '400')
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

const queue = []
const seen = new Set()
for (const c of JSON.parse(readFileSync(DIR, 'utf8')).candidates) {
  if (c.auth !== 'oauth' || !c.https) continue
  if ([...aliases(new URL(c.docsUrl).hostname)].some((h) => known.has(h))) continue
  const key = new URL(c.docsUrl).hostname + '|' + c.name.toLowerCase()
  if (seen.has(key)) continue
  seen.add(key)
  queue.push(c)
  if (queue.length >= LIMIT) break
}

console.log(`probing ${queue.length} oauth candidates`)

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
  const urls = guessEndpoints(c)
  try {
    const res = await fetch(docsFetchUrl(c.docsUrl), { signal: AbortSignal.timeout(5000), headers: { 'user-agent': UA } })
    if (res.ok) urls.unshift(...extractProbeUrls(await res.text(), 12))
  } catch { /* */ }

  for (const url of urls.slice(0, 20)) {
    const r = await probeUrl(url)
    if (r.httpStatus === 200 && r.json && !isPostmanCollection(r.json)) {
      const split = splitBaseAndEndpoint(url)
      if (!split) continue
      reg(split.baseUrl)
      const entry = {
        name: c.name,
        slug: slugify(c.name),
        emoji: emojiFor(c.sourceCategory),
        tagline: `${c.name} — public JSON route`,
        description: `${c.name} listed as OAuth but exposes a keyless read route we verified (${c.sourceCategory}). Check docs for auth on write routes.`,
        sourceCategory: c.sourceCategory,
        docsUrl: c.docsUrl,
        baseUrl: split.baseUrl,
        sampleEndpoint: split.sampleEndpoint,
        latencyMs: r.latencyMs,
        corsObserved: r.corsObserved,
        httpStatus: 200,
        sampleJson: trimJson(r.json),
        auth: 'oauth',
        freeTier: 'OAuth — some read routes may be public',
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
console.log(`\ndone: ${verified.length} verified (oauth pool)`)
