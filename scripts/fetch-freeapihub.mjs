// Scrape https://freeapihub.com/apis via sitemap + per-API detail pages (RSC payload).
// No public JSON API — each /apis/{slug} page embeds auth, baseUrl, docsUrl, category.
//
// run:  node scripts/fetch-freeapihub.mjs
//       node scripts/fetch-freeapihub.mjs --no-auth-only
//       node scripts/fetch-freeapihub.mjs --write-batch
//       node scripts/fetch-freeapihub.mjs --concurrency 10

import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadSeedIndex } from './lib/apimap-gap.mjs'
import {
    LIST_URL,
    SITEMAP_URL,
    fetchPage,
    mapAuth,
    mapPool,
    parseApiPage,
    parseSitemapApiSlugs,
} from './lib/freeapihub.mjs'
import { hostKey, slugify } from './lib/publicapis-io.mjs'

const args = process.argv.slice(2).filter((a) => !a.startsWith('#'))
const NO_AUTH_ONLY = args.includes('--no-auth-only')
const WRITE_BATCH = args.includes('--write-batch')
const CONCURRENCY = Number(args.find((a, i) => args[i - 1] === '--concurrency') || '8')

const OUT = fileURLToPath(new URL('./import/freeapihub-scraped.json', import.meta.url))
const GAP_OUT = fileURLToPath(new URL('./import/freeapihub-gaps.json', import.meta.url))
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
  const hay = `${c.name} ${c.docsUrl} ${c.baseUrl} ${c.description}`
  for (const h of PROBE_HINTS) {
    if (h.match.test(hay)) return h
  }
  return null
}

function sampleFromBase(baseUrl) {
  if (!baseUrl) return '/'
  try {
    const u = new URL(baseUrl)
    const path = u.pathname.replace(/\/+$/, '') || '/'
    return path.length > 48 ? '/' : path
  } catch {
    return '/'
  }
}

function toCandidate(raw) {
  const auth = mapAuth(raw.auth, raw.access)
  const docsUrl = (raw.docsUrl || '').trim()
  const baseUrl = (raw.baseUrl || docsUrl).replace(/\/+$/, '')
  const hint = findHint({ name: raw.name, docsUrl, baseUrl, description: raw.description })
  return {
    slug: slugify(raw.name, raw.slug),
    name: raw.name,
    tagline: (raw.description || '').slice(0, 80),
    description: raw.description || '',
    sourceCategory: hint?.sourceCategory ?? raw.category ?? 'Development',
    docsUrl,
    baseUrl: hint?.baseUrl?.replace(/\/+$/, '') ?? baseUrl,
    sampleEndpoint: hint?.sampleEndpoint?.startsWith('/')
      ? hint.sampleEndpoint
      : hint?.sampleEndpoint
        ? `/${hint.sampleEndpoint}`
        : sampleFromBase(baseUrl),
    auth,
    access: raw.access,
    fahAuth: raw.auth,
    fahSlug: raw.slug,
    fahCategory: raw.category,
    source: 'freeapihub.com',
  }
}

process.stderr.write(`fetching sitemap ${SITEMAP_URL}\n`)
const sitemapXml = await fetchPage(SITEMAP_URL)
const slugs = parseSitemapApiSlugs(sitemapXml)
process.stderr.write(`  ${slugs.length} API slugs in sitemap\n`)

const parsed = await mapPool(slugs, CONCURRENCY, async (slug, idx) => {
  if (idx % 25 === 0) process.stderr.write(`  scrape ${idx + 1}/${slugs.length}\n`)
  try {
    const html = await fetchPage(`${LIST_URL}/${slug}`)
    return parseApiPage(html, slug)
  } catch (e) {
    process.stderr.write(`  skip ${slug}: ${e.message}\n`)
    return null
  }
})

const seen = new Set()
const scraped = []
for (const raw of parsed) {
  if (!raw?.docsUrl || !raw.name) continue
  const host = hostKey(raw.docsUrl)
  if (!host || seen.has(host)) continue
  seen.add(host)
  scraped.push(toCandidate(raw))
}

scraped.sort((a, b) => a.name.localeCompare(b.name))

writeFileSync(OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  source: LIST_URL,
  sitemap: SITEMAP_URL,
  total: scraped.length,
  byAuth: Object.fromEntries(
    ['none', 'userAgent', 'apiKey', 'oauth', 'unknown'].map((k) => [k, scraped.filter((r) => r.auth === k).length]),
  ),
  apis: scraped,
}, null, 2))

const seedIndex = loadSeedIndex(SEED, IMPORTED)
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
  writeFileSync(batchPath, JSON.stringify({
    source: 'freeapihub.com',
    authFilter: 'none',
    candidates: pool,
  }, null, 2))
  console.log(`wrote ${batchPath} (${pool.length} keyless candidates)`)
}

console.log(`\nfreeapihub.com: ${scraped.length} unique hosts (${slugs.length} sitemap slugs)`)
console.log(`  auth: none ${scraped.filter((r) => r.auth === 'none').length}, apiKey ${scraped.filter((r) => r.auth === 'apiKey').length}, oauth ${scraped.filter((r) => r.auth === 'oauth').length}`)
console.log(`  missing from seed: ${gaps.length}${NO_AUTH_ONLY ? ' (keyless only)' : ''}`)
console.log(`\nTop keyless gaps:`)
for (const c of gaps.filter((r) => r.auth === 'none').slice(0, 15)) {
  console.log(`  • ${c.name} — ${c.docsUrl}`)
}
console.log(`\nwrote ${OUT}`)
console.log(`wrote ${GAP_OUT}`)
