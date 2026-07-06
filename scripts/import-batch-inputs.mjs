// Fast-import pre-researched candidates from batch-input-*.json (freeapi.watch etc.)
// Each entry already has baseUrl + sampleEndpoint — we re-probe once then emit batches.
// run: node scripts/import-batch-inputs.mjs [--from-batch 66]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  probeUrl, slugify, trimJson, isPostmanCollection, emojiFor, UA,
} from './lib/probe-utils.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '66')
const BATCH_SIZE = 25
const CONC = 20
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
  return hostAliases(hostKey(url)).some((a) => known.has(a))
}

const queue = []
const seen = new Set()
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-input-\d+\.json$/.test(x)).sort()) {
  const j = JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8'))
  for (const c of j.candidates ?? j.verified ?? []) {
    if (!c.baseUrl || !c.sampleEndpoint) continue
    const host = hostKey(c.baseUrl)
    if (hostsKnown(c.baseUrl)) continue
    const key = host + '|' + (c.slug || c.name).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    queue.push(c)
  }
}

console.log(`batch-input import: ${queue.length} novel candidates to probe`)

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

async function verify(c) {
  const urls = []
  if (c.fawHealthUrl) urls.push(c.fawHealthUrl)
  const ep = c.sampleEndpoint?.startsWith('/') ? c.sampleEndpoint : '/' + (c.sampleEndpoint || '')
  if (c.baseUrl && c.sampleEndpoint) urls.push(c.baseUrl.replace(/\/+$/, '') + ep)
  for (const url of [...new Set(urls)]) {
    const r = await probeUrl(url)
    if (r.httpStatus !== 200 || !r.json || isPostmanCollection(r.json)) continue
    const baseUrl = c.baseUrl.replace(/\/+$/, '')
    return {
    name: c.name,
    slug: c.slug || slugify(c.name),
    emoji: c.emoji || emojiFor(c.sourceCategory),
    tagline: (c.tagline || `${c.name} — verified JSON endpoint`).slice(0, 80),
    description: c.description || `${c.name} keyless JSON API.`,
    sourceCategory: c.sourceCategory || 'Development',
    docsUrl: c.docsUrl || c.baseUrl,
    baseUrl: c.baseUrl.replace(/\/+$/, ''),
    sampleEndpoint: ep,
    latencyMs: r.latencyMs,
    corsObserved: r.corsObserved,
    httpStatus: 200,
    sampleJson: trimJson(r.json),
    freeTier: c.freeTier || c.fawFreeTierText || 'Free — limits not published',
    rateLimit: c.rateLimit || 'Unpublished',
    dataLicense: 'Unverified',
    commercialUse: 'unclear',
    auth: c.auth || 'none',
    notes: `batch-input ${c.source || 'freeapi.watch'}`,
    }
  }
  return null
}

const work = [...queue]
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let c; (c = work.shift()); ) {
    const entry = await verify(c)
    if (!entry || hostsKnown(entry.baseUrl)) continue
    for (const a of hostAliases(hostKey(entry.baseUrl))) known.add(a)
    verified.push(entry)
    batchVerified.push(entry)
    process.stdout.write(`  ✓ ${entry.slug}\n`)
    if (batchVerified.length >= BATCH_SIZE) flush()
  }
}))

flush()
console.log(`\ndone: ${verified.length} verified from batch-input files`)
