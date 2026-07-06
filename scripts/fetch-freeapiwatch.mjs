// Fetch the curated FreeAPI.watch catalog via their public JSON API.
// Docs: https://freeapi.watch/api/
//
// run:  node scripts/fetch-freeapiwatch.mjs
//       node scripts/fetch-freeapiwatch.mjs --no-auth-only
//       node scripts/fetch-freeapiwatch.mjs --write-batch
//       node scripts/fetch-freeapiwatch.mjs --from-cache          # gaps/batch from last scrape
//       node scripts/fetch-freeapiwatch.mjs --include-graveyard

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Agent, fetch as undiciFetch } from 'undici'
import { loadSeedIndex } from './lib/apimap-gap.mjs'
import { hostKey, slugify } from './lib/publicapis-io.mjs'

const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology; freeapi.watch)'
const API_URL = 'https://freeapi-builder.a10ayassine.workers.dev/api/v1/apis'
const DOCS_URL = 'https://freeapi.watch/api/'

const args = process.argv.slice(2).filter((a) => !a.startsWith('#'))
const NO_AUTH_ONLY = args.includes('--no-auth-only')
const WRITE_BATCH = args.includes('--write-batch')
const INCLUDE_GRAVEYARD = args.includes('--include-graveyard')
const FROM_CACHE = args.includes('--from-cache')

const OUT = fileURLToPath(new URL('./import/freeapiwatch-scraped.json', import.meta.url))
const GAP_OUT = fileURLToPath(new URL('./import/freeapiwatch-gaps.json', import.meta.url))
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

const { PROBE_HINTS } = await import('./lib/probe-hints.mjs')

const FETCH_AGENT = new Agent({ connect: { timeout: 30_000 } })

const CATEGORY_LABEL = {
  weather: 'Weather',
  finance: 'Finance',
  geocoding: 'Geocoding',
  development: 'Development',
  entertainment: 'Entertainment',
  books: 'Books',
  food: 'Food & Drink',
  government: 'Government',
  health: 'Health',
  music: 'Music',
  news: 'News',
  photography: 'Photography',
  science: 'Science & Math',
  security: 'Security',
  social: 'Social',
  sports: 'Sports & Fitness',
  transportation: 'Transportation',
  video: 'Video',
  animals: 'Animals',
  anime: 'Anime',
  games: 'Games & Comics',
}

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

function mapAuth(raw) {
  const a = String(raw ?? '').toLowerCase()
  if (a === 'none' || a === 'no') return 'none'
  if (a.includes('oauth')) return 'oauth'
  return 'apiKey'
}

function labelCategory(cat) {
  if (!cat) return 'Open Data'
  const key = cat.toLowerCase().trim()
  if (CATEGORY_LABEL[key]) return CATEGORY_LABEL[key]
  return key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function splitHealthUrl(healthUrl, fallbackBase) {
  if (!healthUrl?.startsWith('http')) {
    return { baseUrl: fallbackBase.replace(/\/+$/, ''), sampleEndpoint: '/' }
  }
  try {
    const u = new URL(healthUrl)
    const base = `${u.origin}`
    const path = `${u.pathname}${u.search}` || '/'
    return {
      baseUrl: base,
      sampleEndpoint: path.length > 160 ? u.pathname || '/' : path,
    }
  } catch {
    return { baseUrl: fallbackBase.replace(/\/+$/, ''), sampleEndpoint: '/' }
  }
}

function toCandidate(a) {
  const auth = mapAuth(a.auth_type)
  const docsUrl = (a.docs_url || a.base_url || '').trim()
  const hint = findHint({ name: a.name, docsUrl, baseUrl: a.base_url, description: a.description })
  const fromHealth = splitHealthUrl(a.health_url, a.base_url || docsUrl)
  const baseUrl = hint?.baseUrl?.replace(/\/+$/, '') ?? fromHealth.baseUrl
  const sampleEndpoint = hint?.sampleEndpoint?.startsWith('/')
    ? hint.sampleEndpoint
    : hint?.sampleEndpoint
      ? `/${hint.sampleEndpoint}`
      : fromHealth.sampleEndpoint
  const alive = a.latest_check?.alive === 1
  return {
    slug: slugify(a.name, a.slug),
    name: a.name,
    tagline: (a.description || '').slice(0, 80),
    description: a.description || '',
    sourceCategory: hint?.sourceCategory ?? labelCategory(a.category),
    docsUrl,
    baseUrl,
    sampleEndpoint,
    auth,
    fawSlug: a.slug,
    fawCategory: a.category,
    fawStatus: a.status,
    fawAuth: a.auth_type,
    fawFreeTierScore: a.free_tier_score ?? 0,
    fawFreeTierText: a.free_tier_text ?? '',
    fawHealthUrl: a.health_url,
    fawAlive: alive,
    source: 'freeapi.watch',
  }
}

async function fetchFeed() {
  const tries = 4
  let lastErr
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await undiciFetch(API_URL, {
        headers: { 'User-Agent': UA, accept: 'application/json' },
        signal: AbortSignal.timeout(90_000),
        dispatcher: FETCH_AGENT,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    } catch (e) {
      lastErr = e
      if (attempt < tries) {
        const wait = attempt * 2500
        process.stderr.write(`  fetch attempt ${attempt}/${tries} failed (${e.cause?.code ?? e.message}); retry in ${wait}ms\n`)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw lastErr
}

function loadCache() {
  if (!existsSync(OUT)) return null
  const j = JSON.parse(readFileSync(OUT, 'utf8'))
  if (!Array.isArray(j.apis) || !j.apis.length) return null
  return j
}

function buildScraped(list) {
  const filtered = list.filter((a) => INCLUDE_GRAVEYARD || a.status === 'active')
  const seen = new Set()
  const scraped = []
  for (const a of filtered) {
    const docs = (a.docs_url || a.base_url || '').trim()
    if (!docs || !docs.startsWith('http')) continue
    const host = hostKey(docs)
    if (!host || seen.has(host)) continue
    seen.add(host)
    scraped.push(toCandidate(a))
  }
  scraped.sort((a, b) => (b.fawFreeTierScore - a.fawFreeTierScore) || a.name.localeCompare(b.name))
  return { scraped, feedTotal: list.length }
}

let scraped
let feedTotal
let usedCache = false

if (FROM_CACHE) {
  const cached = loadCache()
  if (!cached) throw new Error(`--from-cache requires ${OUT}`)
  scraped = cached.apis
  feedTotal = cached.total ?? scraped.length
  usedCache = true
  process.stderr.write(`using cache ${OUT} (${scraped.length} APIs, fetched ${cached.fetchedAt})\n`)
} else {
  try {
    const raw = await fetchFeed()
    const list = raw.apis
    if (!Array.isArray(list)) throw new Error('unexpected response shape — expected { apis: [] }')
    ;({ scraped, feedTotal } = buildScraped(list))
    writeFileSync(OUT, JSON.stringify({
      fetchedAt: new Date().toISOString(),
      source: DOCS_URL,
      api: API_URL,
      total: scraped.length,
      byAuth: Object.fromEntries(
        ['none', 'userAgent', 'apiKey', 'oauth', 'unknown'].map((k) => [k, scraped.filter((r) => r.auth === k).length]),
      ),
      byStatus: Object.fromEntries(
        ['active', 'dead', 'paid'].map((k) => [k, scraped.filter((r) => r.fawStatus === k).length]),
      ),
      apis: scraped,
    }, null, 2))
  } catch (e) {
    const cached = loadCache()
    if (!cached) throw e
    scraped = cached.apis
    feedTotal = cached.total ?? scraped.length
    usedCache = true
    process.stderr.write(`live fetch failed (${e.cause?.code ?? e.message}); using cache from ${cached.fetchedAt}\n`)
  }
}

const seedIndex = loadSeedIndex(SEED, IMPORTED)
const gaps = scraped
  .filter((r) => !haveRow(r, seedIndex))
  .filter((r) => !NO_AUTH_ONLY || r.auth === 'none')
  .sort((a, b) => (b.fawFreeTierScore - a.fawFreeTierScore) || a.name.localeCompare(b.name))

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
    source: 'freeapi.watch',
    authFilter: 'none',
    candidates: pool,
  }, null, 2))
  console.log(`wrote ${batchPath} (${pool.length} keyless candidates)`)
}

const mode = usedCache ? 'cached' : 'live'
console.log(`\nfreeapi.watch (${mode}): ${scraped.length} APIs (${feedTotal} in feed, active-only${INCLUDE_GRAVEYARD ? ' + graveyard' : ''})`)
console.log(`  auth: none ${scraped.filter((r) => r.auth === 'none').length}, apiKey ${scraped.filter((r) => r.auth === 'apiKey').length}, oauth ${scraped.filter((r) => r.auth === 'oauth').length}`)
console.log(`  missing from seed: ${gaps.length}${NO_AUTH_ONLY ? ' (keyless only)' : ''}`)
console.log(`\nTop keyless gaps (by free-tier score):`)
for (const c of gaps.filter((r) => r.auth === 'none').slice(0, 15)) {
  const up = c.fawAlive ? 'up' : 'down'
  console.log(`  ${String(c.fawFreeTierScore).padStart(2)} tier | ${up.padEnd(4)} | ${c.name}`)
}
if (!usedCache) console.log(`\nwrote ${OUT}`)
console.log(`wrote ${GAP_OUT}`)
