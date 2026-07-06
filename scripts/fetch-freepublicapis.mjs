// Fetch the full freepublicapis.com catalog (tags/all ≈ 606 listings) via their JSON API.
// Site: https://www.freepublicapis.com/tags/all — all entries are marketed as free/keyless.
//
// run:  node scripts/fetch-freepublicapis.mjs
//       node scripts/fetch-freepublicapis.mjs --write-batch

import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadSeedIndex } from './lib/apimap-gap.mjs'
import { hostKey, slugify } from './lib/publicapis-io.mjs'

const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology; freepublicapis.com)'
const API_URL = 'https://www.freepublicapis.com/api/apis?limit=5000'

const args = process.argv.slice(2).filter((a) => !a.startsWith('#'))
const WRITE_BATCH = args.includes('--write-batch')

const OUT = fileURLToPath(new URL('./import/freepublicapis-scraped.json', import.meta.url))
const GAP_OUT = fileURLToPath(new URL('./import/freepublicapis-gaps.json', import.meta.url))
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

const { PROBE_HINTS } = await import('./lib/probe-hints.mjs')

function haveRow(row, seedIndex) {
  const host = hostKey(row.docsUrl || row.baseUrl)
  if (!host) return false
  if (seedIndex.seedSlugs.has(row.slug)) return true
  return [...seedIndex.seedHosts].some((h) => host === h || host.endsWith(h) || h.endsWith(host))
}

function findHint(c) {
  const hay = `${c.name} ${c.docsUrl} ${c.description}`
  for (const h of PROBE_HINTS) {
    if (h.match.test(hay)) return h
  }
  return null
}

function toCandidate(a) {
  const docsUrl = (a.documentation || '').trim()
  const hint = findHint({ name: a.title, docsUrl, description: a.description })
  const baseUrl = hint?.baseUrl?.replace(/\/+$/, '') ?? docsUrl.replace(/\/+$/, '')
  const sampleEndpoint = hint?.sampleEndpoint?.startsWith('/')
    ? hint.sampleEndpoint
    : hint?.sampleEndpoint
      ? `/${hint.sampleEndpoint}`
      : '/'
  return {
    slug: slugify(a.title, a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    name: a.title,
    emoji: a.emoji || '🔌',
    tagline: (a.description || '').slice(0, 80),
    description: a.description || '',
    sourceCategory: hint?.sourceCategory ?? 'Open Data',
    docsUrl,
    baseUrl,
    sampleEndpoint,
    auth: 'none',
    fpaId: a.id,
    fpaHealth: a.health ?? 0,
    fpaPopularity: a.popularity ?? 0,
    fpaMethods: a.methods ?? 1,
    fpaAvgLatency: a.avg_latency ?? null,
    fpaSource: a.source,
    source: 'freepublicapis.com',
  }
}

const res = await fetch(API_URL, {
  headers: { 'User-Agent': UA, accept: 'application/json' },
  signal: AbortSignal.timeout(60_000),
})
if (!res.ok) throw new Error(`freepublicapis fetch HTTP ${res.status}`)
const raw = await res.json()
if (!Array.isArray(raw)) throw new Error('unexpected response shape')

const seen = new Set()
const scraped = []
for (const a of raw) {
  const docs = (a.documentation || '').trim()
  if (!docs || !docs.startsWith('http')) continue
  const host = hostKey(docs)
  if (!host || seen.has(host)) continue
  seen.add(host)
  scraped.push(toCandidate(a))
}

scraped.sort((a, b) => (b.fpaHealth - a.fpaHealth) || (b.fpaPopularity - a.fpaPopularity))

writeFileSync(OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  source: 'https://www.freepublicapis.com/tags/all',
  api: API_URL,
  total: scraped.length,
  apis: scraped,
}, null, 2))

const seedIndex = loadSeedIndex(SEED, IMPORTED)
const gaps = scraped.filter((r) => !haveRow(r, seedIndex))

writeFileSync(GAP_OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  missing: gaps.length,
  candidates: gaps,
}, null, 2))

if (WRITE_BATCH) {
  const picked = gaps.slice(0, 50)
  const nums = readdirSync(IMPORT_DIR)
    .map((f) => /^batch-input-(\d+)\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  const batchPath = fileURLToPath(new URL(`./import/batch-input-${next}.json`, import.meta.url))
  writeFileSync(batchPath, JSON.stringify({
    source: 'freepublicapis.com',
    authFilter: 'none',
    candidates: picked,
  }, null, 2))
  console.log(`wrote ${batchPath} (${picked.length} candidates)`)
}

console.log(`freepublicapis.com: ${scraped.length} APIs (from ${raw.length} rows)`)
console.log(`  missing from seed: ${gaps.length}`)
console.log(`\nTop gaps by site health score:`)
for (const c of gaps.slice(0, 15)) {
  console.log(`  ${String(c.fpaHealth).padStart(2)} health | ${c.fpaPopularity} pop | ${c.name}`)
}
console.log(`\nwrote ${OUT}`)
console.log(`wrote ${GAP_OUT}`)
