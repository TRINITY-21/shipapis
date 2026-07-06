// Verify every PROBE_HINTS + GENERATED_HINTS entry not already in the catalog.
// Fast path to grow the seed — each hint has a known working endpoint.
//
// run: node scripts/bulk-verify-hints.mjs [--from-batch 50]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROBE_HINTS } from './lib/probe-hints.mjs'
import { GENERATED_HINTS } from './lib/generated-hints.mjs'
import {
  probeUrl, slugify, trimJson, isPostmanCollection, UA,
} from './lib/probe-utils.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '50')
const BATCH_SIZE = 25
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = readFileSync(fileURLToPath(new URL('../src/data/seed.ts', import.meta.url)), 'utf8')
  + readFileSync(fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url)), 'utf8')

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

const known = new Set()
for (const m of SEED.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) {
  try { for (const a of hostAliases(new URL(m[1]).hostname)) known.add(a) } catch { /* */ }
}
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-\d+\.json$/.test(x))) {
  for (const v of JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8')).verified ?? []) {
    try { for (const a of hostAliases(new URL(v.baseUrl).hostname)) known.add(a) } catch { /* */ }
  }
}

function hostsKnown(url) {
  const h = hostKey(url)
  return hostAliases(h).some((a) => known.has(a))
}

const hints = []
const seen = new Set()
for (const h of [...PROBE_HINTS, ...GENERATED_HINTS]) {
  if (!h?.baseUrl || !h?.sampleEndpoint) continue
  const host = hostKey(h.baseUrl)
  if (seen.has(host) || hostsKnown(h.baseUrl)) continue
  seen.add(host)
  hints.push(h)
}

console.log(`bulk-verify: ${hints.length} novel hints to probe`)

const verified = []
let batchNo = FROM
let batchVerified = []

function flush() {
  if (!batchVerified.length) return
  const path = `${IMPORT_DIR}batch-${String(batchNo).padStart(2, '0')}.json`
  writeFileSync(path, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → ${path} (${batchVerified.length})`)
  batchNo++
  batchVerified = []
}

for (const h of hints) {
  const url = h.baseUrl.replace(/\/+$/, '') + (h.sampleEndpoint.startsWith('/') ? h.sampleEndpoint : '/' + h.sampleEndpoint)
  const r = await probeUrl(url)
  if (r.httpStatus !== 200 || !r.json || isPostmanCollection(r.json)) continue

  const entry = {
    name: h.name,
    slug: slugify(h.name),
    emoji: h.emoji || '🔌',
    tagline: h.tagline || `${h.name} — verified JSON endpoint`,
    description: h.description || `${h.name} keyless JSON API.`,
    sourceCategory: h.sourceCategory || 'Development',
    docsUrl: h.docsUrl || h.baseUrl,
    baseUrl: h.baseUrl.replace(/\/+$/, ''),
    sampleEndpoint: h.sampleEndpoint.startsWith('/') ? h.sampleEndpoint : '/' + h.sampleEndpoint,
    latencyMs: r.latencyMs,
    corsObserved: r.corsObserved,
    httpStatus: 200,
    sampleJson: trimJson(r.json),
    freeTier: 'Free — limits not published',
    rateLimit: 'Unpublished',
    dataLicense: 'Unverified',
    commercialUse: 'unclear',
    auth: h.auth || 'none',
  }
  verified.push(entry)
  batchVerified.push(entry)
  for (const a of hostAliases(hostKey(h.baseUrl))) known.add(a)
  process.stdout.write(`  ✓ ${entry.slug}\n`)
  if (batchVerified.length >= BATCH_SIZE) flush()
}

flush()
console.log(`\ndone: ${verified.length} verified from hints`)
