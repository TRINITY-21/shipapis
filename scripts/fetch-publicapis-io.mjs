// Scrape publicapis.io category pages and report gaps vs our seed.
// The curated /api-collection/no-auth-apis URL is 404 — we derive keyless APIs by
// joining scraped entries with auth flags from the MIT public-apis cache.
//
// run:  node scripts/fetch-publicapis-io.mjs
//       node scripts/fetch-publicapis-io.mjs --no-auth-only
//       node scripts/fetch-publicapis-io.mjs --write-batch

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadSeedIndex } from './lib/apimap-gap.mjs'
import {
    authIndexFromCache,
    CATEGORIES,
    fetchCategory,
    hostKey,
    inferAuth,
    slugify,
} from './lib/publicapis-io.mjs'

// Reuse apimap seed index shape — add haveApi wrapper for publicapis rows
function haveRow(row, seedIndex) {
  const host = hostKey(row.website || row.docsUrl || row.baseUrl)
  if (!host) return false
  if (seedIndex.seedSlugs.has(row.slug)) return true
  return [...seedIndex.seedHosts].some((h) => host === h || host.endsWith(h) || h.endsWith(host))
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('#'))
const NO_AUTH_ONLY = args.includes('--no-auth-only')
const WRITE_BATCH = args.includes('--write-batch')

const OUT = fileURLToPath(new URL('./import/publicapis-io-scraped.json', import.meta.url))
const GAP_OUT = fileURLToPath(new URL('./import/publicapis-io-gaps.json', import.meta.url))
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const CACHE = fileURLToPath(new URL('./import/src-freeapis-publicapis.json', import.meta.url))

const seedIndex = loadSeedIndex(SEED, IMPORTED)
const authByHost = existsSync(CACHE)
  ? authIndexFromCache(JSON.parse(readFileSync(CACHE, 'utf8')).candidates ?? [])
  : new Map()

const seen = new Set()
const scraped = []

for (const cat of CATEGORIES) {
  let apis
  try {
    apis = await fetchCategory(cat)
    process.stderr.write(`  ${cat}: ${apis.length}\n`)
  } catch (e) {
    console.warn(`skip ${cat}: ${e.message}`)
    continue
  }
  for (const a of apis) {
    const website = (a.website || '').trim()
    if (!website || !website.startsWith('http')) continue
    const host = hostKey(website)
    if (!host || seen.has(host)) continue
    seen.add(host)
    const auth = inferAuth(website, authByHost)
    scraped.push({
      slug: slugify(a.title, a.slug),
      name: a.title,
      tagline: (a.description || '').slice(0, 80),
      description: a.description || '',
      sourceCategory: a.category || cat,
      docsUrl: website,
      baseUrl: website.replace(/\/+$/, ''),
      sampleEndpoint: '/',
      auth,
      apimapCategory: cat,
      publicapisSlug: a.slug,
    })
  }
}

writeFileSync(OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  source: 'publicapis.io',
  note: 'no-auth collection URL is 404; auth inferred from MIT public-apis cache by host',
  total: scraped.length,
  byAuth: Object.fromEntries(
    ['none', 'userAgent', 'apiKey', 'oauth', 'unknown'].map((k) => [k, scraped.filter((r) => r.auth === k).length]),
  ),
  apis: scraped,
}, null, 2))

const gaps = scraped
  .filter((r) => !haveRow(r, seedIndex))
  .filter((r) => !NO_AUTH_ONLY || r.auth === 'none')
  .sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(GAP_OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  filter: NO_AUTH_ONLY ? 'no-auth-only' : 'all',
  missing: gaps.length,
  candidates: gaps,
}, null, 2))

if (WRITE_BATCH) {
  const pool = gaps.filter((r) => r.auth === 'none').slice(0, 50)
  const nums = readdirSync(IMPORT_DIR)
    .map((f) => /^batch-input-(\d+)\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  const batchPath = fileURLToPath(new URL(`./import/batch-input-${next}.json`, import.meta.url))
  writeFileSync(batchPath, JSON.stringify({ source: 'publicapis.io', authFilter: 'none', candidates: pool }, null, 2))
  console.log(`wrote ${batchPath} (${pool.length} keyless candidates)`)
}

console.log(`\npublicapis.io scraped: ${scraped.length} unique hosts`)
console.log(`  auth: none ${scraped.filter((r) => r.auth === 'none').length}, apiKey ${scraped.filter((r) => r.auth === 'apiKey').length}, unknown ${scraped.filter((r) => r.auth === 'unknown').length}`)
console.log(`  missing from seed: ${gaps.length}${NO_AUTH_ONLY ? ' (keyless only)' : ''}`)
console.log(`\nTop keyless gaps:`)
for (const c of gaps.filter((r) => r.auth === 'none').slice(0, 15)) {
  console.log(`  • ${c.name} — ${c.docsUrl}`)
}
console.log(`\nwrote ${OUT}`)
console.log(`wrote ${GAP_OUT}`)
