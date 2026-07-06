// Gap-fill from apimap.dev — all categories, sorted by score within each.
// Maps apimap endpoint lists into probe candidates for auto-verify-batch / probe-all.
//
// run:  node scripts/fetch-apimap-gaps.mjs
//       node scripts/fetch-apimap-gaps.mjs --category weather,finance
//       node scripts/fetch-apimap-gaps.mjs --write-batch          # top 50 keyless gaps globally
//       node scripts/fetch-apimap-gaps.mjs --write-batch --all    # top 50 gaps (any auth)

import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
    APIMAP_CATEGORIES,
    CATEGORY_EMOJI,
    haveApi,
    loadSeedIndex,
    toCandidate,
} from './lib/apimap-gap.mjs'

const args = process.argv.slice(2).filter((a) => !a.startsWith('#'))
const WRITE_BATCH = args.includes('--write-batch')
const BATCH_ALL_AUTH = args.includes('--all')

function parseCategories(argv) {
  const eq = argv.find((a) => a.startsWith('--category='))
  if (eq) return eq.slice('--category='.length)
  const i = argv.indexOf('--category')
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  return null
}

const catArg = parseCategories(args)
const categories = catArg
  ? catArg.split(',').map((c) => c.trim()).filter((c) => APIMAP_CATEGORIES.includes(c))
  : APIMAP_CATEGORIES

if (catArg && !categories.length) {
  console.error(`Unknown category in "${catArg}". Valid: ${APIMAP_CATEGORIES.join(', ')}`)
  process.exit(1)
}

const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const COMBINED_OUT = fileURLToPath(new URL('./import/apimap-gaps.json', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology; apimap-gaps)'

async function fetchJson(url, tries = 3) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(45_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      lastErr = e
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
    }
  }
  throw lastErr
}

const seedIndex = loadSeedIndex(SEED, IMPORTED)
const byCategory = {}
const allMissing = []

for (const category of categories) {
  const url = `https://apimap.dev/api/categories/${category}.json`
  let data
  try {
    data = await fetchJson(url)
  } catch (e) {
    console.warn(`skip ${category}: ${e.message}`)
    continue
  }
  const missing = (data.apis ?? [])
    .filter((a) => !haveApi(a, seedIndex))
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))
  const candidates = missing.map((a) => toCandidate(a, category))
  byCategory[category] = {
    label: data.meta?.label ?? category,
    total: data.apis?.length ?? 0,
    missing: missing.length,
    candidates,
  }
  allMissing.push(...candidates)

  const catOut = fileURLToPath(new URL(`./import/apimap-gap-${category}.json`, import.meta.url))
  writeFileSync(catOut, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    category,
    total: data.apis?.length ?? 0,
    missing: missing.length,
    candidates,
  }, null, 2))
}

allMissing.sort((a, b) => b.apimapScore - a.apimapScore)
writeFileSync(COMBINED_OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  categories: categories.length,
  totalMissing: allMissing.length,
  byCategory: Object.fromEntries(
    Object.entries(byCategory).map(([k, v]) => [k, { total: v.total, missing: v.missing }]),
  ),
  candidates: allMissing,
}, null, 2))

if (WRITE_BATCH) {
  const pool = BATCH_ALL_AUTH ? allMissing : allMissing.filter((c) => c.auth === 'none')
  const picked = pool.slice(0, 50)
  const nums = readdirSync(IMPORT_DIR)
    .map((f) => /^batch-input-(\d+)\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  const batchPath = fileURLToPath(new URL(`./import/batch-input-${next}.json`, import.meta.url))
  writeFileSync(batchPath, JSON.stringify({
    source: 'apimap-gaps',
    authFilter: BATCH_ALL_AUTH ? 'all' : 'none',
    candidates: picked,
  }, null, 2))
  console.log(`wrote ${batchPath} (${picked.length} candidates)`)
}

console.log(`apimap gaps — ${allMissing.length} missing across ${categories.length} categories\n`)
for (const category of categories) {
  const row = byCategory[category]
  if (!row) continue
  const emoji = CATEGORY_EMOJI[category] ?? '•'
  console.log(`${emoji} ${row.label}: ${row.missing}/${row.total} missing`)
  for (const c of row.candidates.slice(0, 5)) {
    console.log(`     ${String(c.apimapScore).padStart(2)} | ${c.auth.padEnd(6)} | ${c.endpointCount} eps | ${c.name}`)
  }
  if (row.candidates.length > 5) console.log(`     … +${row.candidates.length - 5} more`)
  console.log()
}

console.log(`Global top 10 missing (any category):`)
for (const c of allMissing.slice(0, 10)) {
  console.log(`  ${String(c.apimapScore).padStart(2)} | ${c.apimapCategory.padEnd(14)} | ${c.auth.padEnd(6)} | ${c.name}`)
}
console.log(`\nwrote ${COMBINED_OUT} + per-category apimap-gap-*.json in scripts/import/`)
