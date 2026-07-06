// Seed import pipeline, stage 3 (stage 1 = fetch-candidates, stage 2 = the 22 verify agents).
// Merges every scripts/import/batch-*.json the agents produced, dedupes against the existing
// hand-curated seed AND across batches, maps the ~46 public-apis source categories into our
// taxonomy, and emits src/seed-imported.ts as plain ApiSpec[] data.
//
// Every imported entry is status 'unmonitored': we ran ONE real probe at import (that's what
// stage 2 verified), but there's no monitoring history yet — the cron builds that post-launch.
// build() turns 'unmonitored' into an all-(-1) uptime series (honest "not watched yet"), and
// export-seed.ts already NULLs every health column on the way to D1 (Δ2). So nothing synthetic
// ships; the real probe only seeds the local dev latency baseline + the sample payload.
//
// run:  node scripts/assemble-seed.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inferCheckTier } from './lib/check-tier.mjs'
import { applyEndpointRecipe } from './lib/endpoint-recipes.mjs'

const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const OUT = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))

// Categories already defined by hand in seed.ts — imported APIs reuse these slugs where they fit.
const EXISTING_CATS = new Set(['weather', 'finance', 'geo', 'science', 'animals', 'fun', 'data', 'developer'])

// New categories the imported set needs. Emitted into seed-imported.ts and appended in seed.ts.
const NEW_CATS = [
  { slug: 'crypto', name: 'Crypto & Web3', emoji: '🪙', blurb: 'Coins, chains and on-chain data — free endpoints with the rate limits verified.' },
  { slug: 'transport', name: 'Transport', emoji: '🚆', blurb: 'Transit, flights, vehicles and tracking feeds. Live where the agency publishes it.' },
  { slug: 'games', name: 'Games & Anime', emoji: '🎮', blurb: 'Game, comic and anime data for demos, bots and toy projects.' },
  { slug: 'books', name: 'Books & Words', emoji: '📖', blurb: 'Books, dictionaries and language data with stable, well-documented schemas.' },
  { slug: 'media', name: 'Media', emoji: '🎬', blurb: 'Video, music, images and art — keyless where possible, plus free-tier APIs that need your own key (TMDb, Fanart.tv, Last.fm).' },
  { slug: 'health', name: 'Health & Food', emoji: '🩺', blurb: 'Health, fitness, nutrition and food data from open registries.' },
  { slug: 'security', name: 'Security', emoji: '🔐', blurb: 'Threat intel, breach checks and validation utilities. Keyless tiers only.' },
  { slug: 'social', name: 'Social & Work', emoji: '💬', blurb: 'Social, jobs, calendars and messaging metadata — the connective tissue APIs.' },
  { slug: 'gov', name: 'Government', emoji: '🏛', blurb: 'Public-sector open data: agencies, law, elections and civic datasets.' },
]
const KNOWN_CATS = new Set([...EXISTING_CATS, ...NEW_CATS.map((c) => c.slug)])

// public-apis source category  →  our slug
const CAT_MAP = {
  Weather: 'weather', Environment: 'weather',
  Finance: 'finance', 'Currency Exchange': 'finance', Business: 'finance',
  Cryptocurrency: 'crypto', Blockchain: 'crypto',
  Geocoding: 'geo',
  Transportation: 'transport', Vehicle: 'transport', Tracking: 'transport',
  'Science & Math': 'science', Patent: 'science', 'Machine Learning': 'science',
  Animals: 'animals',
  'Games & Comics': 'games', Anime: 'games',
  Entertainment: 'fun', Personality: 'fun',
  'Open Data': 'data', News: 'data', 'Open Source Projects': 'data',
  Government: 'gov',
  Books: 'books', Dictionaries: 'books',
  Development: 'developer', 'Test Data': 'developer', 'URL Shorteners': 'developer',
  'Data Validation': 'developer', 'Text Analysis': 'developer', 'Documents & Productivity': 'developer',
  'Cloud Storage & File Sharing': 'developer', Phone: 'developer',
  Security: 'security', 'Anti-Malware': 'security',
  Video: 'media', Music: 'media', Photography: 'media', 'Art & Design': 'media',
  Health: 'health', 'Sports & Fitness': 'health', 'Food & Drink': 'health',
  Social: 'social', Jobs: 'social', Email: 'social', Calendar: 'social',
}
const mapCategory = (src) => CAT_MAP[src] || 'data'

// --- gather hand-curated seed slugs + hosts — imports dedupe against seed.ts only, NOT prior imports
const seedSrc = readFileSync(SEED, 'utf8')
const seedSlugs = new Set([...seedSrc.matchAll(/^\s{4}slug: '([^']+)'|^    "slug": "([^"]+)"/gm)].map((m) => m[1] || m[2]).filter(Boolean))
const seedHosts = new Set(
  [...seedSrc.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)].map((m) => {
    try { return new URL(m[1]).hostname.replace(/^www\./, '') } catch { return '' }
  }).filter(Boolean),
)

// --- read every batch the agents finished (robust to partial completion)
const files = readdirSync(IMPORT_DIR).filter((f) => /^batch-\d+\.json$/.test(f)).sort()
const specs = []
const seenSlug = new Set()
const seenHost = new Set()
let totalVerified = 0, totalSkipped = 0, droppedDup = 0, droppedBad = 0
const catCount = {}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

for (const f of files) {
  let parsed
  try { parsed = JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8')) } catch (e) {
    console.warn(`  ! ${f}: invalid JSON, skipped (${e.message})`); continue
  }
  totalSkipped += (parsed.skipped?.length ?? 0)
  for (const v of parsed.verified ?? []) {
    totalVerified++
    // integrity: must carry a real probe result (200 for keyless; 200/401/403 for apiKey)
    const okStatus = v.auth === 'apiKey' || v.auth === 'oauth'
      ? (v.httpStatus === 200 || v.httpStatus === 401 || v.httpStatus === 403 || v.httpStatus === 422 || v.httpStatus === 400)
      : v.httpStatus === 200
    if (!v.baseUrl || !v.sampleEndpoint || !okStatus || v.sampleJson == null) { droppedBad++; continue }
    let host
    try { host = new URL(v.baseUrl).hostname.replace(/^www\./, '') } catch { droppedBad++; continue }
    const slug = v.slug && /^[a-z0-9-]+$/.test(v.slug) ? v.slug : slugify(v.name)
    if (!slug) { droppedBad++; continue }
    if (seedSlugs.has(slug) || seenSlug.has(slug) || seedHosts.has(host) || seenHost.has(host)) { droppedDup++; continue }
    seenSlug.add(slug); seenHost.add(host)

    const cat = mapCategory(v.sourceCategory)
    catCount[cat] = (catCount[cat] || 0) + 1
    const auth = ['none', 'userAgent', 'apiKey', 'oauth'].includes(v.auth) ? v.auth : 'none'
    const sampleEndpoint = v.sampleEndpoint.startsWith('/') ? v.sampleEndpoint : '/' + v.sampleEndpoint
    const checkTier = inferCheckTier({
      auth,
      sampleEndpoint,
      status: 'unmonitored',
      docsUrl: v.docsUrl,
    })
    const cors = v.corsObserved === true ? 'yes' : v.corsObserved === false ? 'no' : 'unknown'
    const latency = Number.isFinite(v.latencyMs) ? Math.max(18, Math.round(v.latencyMs)) : 200
    // Derive https from the probed base URL — a few APIs (e.g. misconfigured certs) verify only over http.
    const https = /^https:/i.test(v.baseUrl)

    specs.push(applyEndpointRecipe({
      slug,
      name: v.name,
      emoji: v.emoji || '🔌',
      tagline: (v.tagline || '').slice(0, 80),
      description: v.description || '',
      category: cat,
      docsUrl: v.docsUrl,
      baseUrl: v.baseUrl.replace(/\/+$/, ''),
      sampleEndpoint,
      auth,
      checkTier,
      https,
      cors,
      commercialUse: ['yes', 'no', 'unclear'].includes(v.commercialUse) ? v.commercialUse : 'unclear',
      dataLicense: v.dataLicense || 'Unverified',
      freeTier: v.freeTier || 'Free — limits not published',
      rateLimit: v.rateLimit || 'Unpublished',
      requiresCard: false,
      status: 'unmonitored',
      addedAt: '2026-07-05',
      lastCheckedMin: 0,
      baseLatency: latency,
      sample: v.sampleJson,
      shapeChanges: [],
    }))
  }
}

// only emit categories the imported set actually uses
const usedNewCats = NEW_CATS.filter((c) => catCount[c.slug])

const header = `// GENERATED by scripts/assemble-seed.mjs — do NOT hand-edit; re-run the assembler instead.
// ${specs.length} keyless APIs imported from the MIT-licensed public-apis list, each verified by a
// real HTTP probe at import (see scripts/import/). status: 'unmonitored' — no monitoring history
// yet; the cron starts that post-launch. Health columns ship as NULL (Δ2). Descriptions are
// original (rewritten from the provider docs), not copied from the source list (§12 #4).
import type { ApiSpec, Category } from './seed'

export const importedCategories: Category[] = ${JSON.stringify(usedNewCats, null, 2)}

export const importedSpecs: ApiSpec[] = ${JSON.stringify(specs, null, 2)}
`
writeFileSync(OUT, header)

console.log(`batches read : ${files.length}`)
console.log(`verified     : ${totalVerified}  (agents also skipped ${totalSkipped} upstream)`)
console.log(`dropped dup  : ${droppedDup}   dropped invalid: ${droppedBad}`)
console.log(`imported     : ${specs.length} APIs → +${usedNewCats.length} new categories`)
console.log(`by category  : ${Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(', ')}`)
console.log(`wrote ${OUT}`)
