// Fast parallel probe of hint-backed + curated no-auth targets.
// run: node scripts/probe-quick-batch.mjs [--batch 71]

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROBE_HINTS } from './lib/probe-hints.mjs'
import { emojiFor, isPostmanCollection, probeUrl, slugify, trimJson } from './lib/probe-utils.mjs'

const BATCH = Number(process.argv.find((a, i) => process.argv[i - 1] === '--batch') || '71')
const OUT = fileURLToPath(new URL(`./import/batch-${String(BATCH).padStart(2, '0')}.json`, import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

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

const seedSrc = readFileSync(SEED, 'utf8') + readFileSync(IMPORTED, 'utf8')
const seedHosts = new Set()
for (const m of seedSrc.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) {
  try {
    for (const a of hostAliases(new URL(m[1]).hostname)) seedHosts.add(a)
  } catch { /* */ }
}

function hostsKnown(url) {
  try {
    return hostAliases(new URL(url).hostname).some((a) => seedHosts.has(a))
  } catch { return false }
}

const EXTRA = [
  { name: 'CountAPI', emoji: '🔢', baseUrl: 'https://api.countapi.xyz', sampleEndpoint: '/hit/test-shipapis/visits', sourceCategory: 'Development', tagline: 'Simple distributed counters in the cloud', description: 'CountAPI creates namespace/key counters you can increment and read over plain GET requests. No signup for basic use — handy for demo analytics, vote tallies and lightweight metrics.' },
  { name: 'Photon', emoji: '🗺', baseUrl: 'https://photon.komoot.io', sampleEndpoint: '/api/?q=Berlin&limit=1', sourceCategory: 'Geocoding', tagline: 'OpenStreetMap geocoding as JSON', description: 'Photon is Komoot\'s open geocoder built on OSM data. Search places by name and get coordinates, bounding boxes and OSM tags. Keyless, fast, and widely used in mapping apps.' },
  { name: 'RxNorm', emoji: '💊', baseUrl: 'https://rxnav.nlm.nih.gov/REST', sampleEndpoint: '/rxcui.json?name=aspirin', sourceCategory: 'Health', tagline: 'Normalized US drug names and RxCUIs', description: 'NIH RxNorm API maps drug names to standardized RxCUIs and related concepts. The REST interface returns JSON for lookups by name, NDC or RxCUI. Public domain health data, no key at modest rates.' },
  { name: 'DailyMed', emoji: '📋', baseUrl: 'https://dailymed.nlm.nih.gov/dailymed/services/v2', sampleEndpoint: '/spls.json?pagesize=1', sourceCategory: 'Health', tagline: 'FDA drug labeling and package inserts', description: 'DailyMed publishes structured drug labeling from the FDA as JSON. List SPLs, search by name, or fetch a specific label\'s sections. Open NIH data with no API key on read routes.' },
  { name: 'Open Targets', emoji: '🧬', baseUrl: 'https://api.platform.opentargets.org/api/v4/graphql', sampleEndpoint: '/graphql', sourceCategory: 'Health', tagline: 'Drug–target–disease association graph', description: 'Open Targets Platform links genes, diseases and compounds for drug discovery research. GraphQL POST is the main interface; the schema endpoint returns JSON introspection without auth.' },
  { name: 'DeFi Llama', emoji: '🦙', baseUrl: 'https://api.llama.fi', sampleEndpoint: '/protocols', sourceCategory: 'Cryptocurrency', tagline: 'DeFi protocol TVL rankings', description: 'DeFi Llama aggregates total value locked across chains and protocols. The /protocols list is keyless JSON — useful for crypto dashboards and research.' },
  { name: 'Blockstream Explorer', emoji: '⛓', baseUrl: 'https://blockstream.info/api', sampleEndpoint: '/blocks/tip/height', sourceCategory: 'Cryptocurrency', tagline: 'Bitcoin blockchain REST API', description: 'Blockstream\'s Esplora API exposes blocks, transactions and addresses on Bitcoin mainnet. Read endpoints like tip height and block hash work without authentication.' },
  { name: 'ClinicalTrials.gov', emoji: '🩺', baseUrl: 'https://clinicaltrials.gov/api/v2', sampleEndpoint: '/studies?query.cond=cancer&pageSize=1', sourceCategory: 'Health', tagline: 'US clinical trial registry search', description: 'NIH ClinicalTrials.gov v2 API returns structured study records — conditions, interventions, locations and status. Public JSON with no API key on read endpoints.' },
  { name: 'Wikidata', emoji: '🧠', baseUrl: 'https://www.wikidata.org/w/api.php', sampleEndpoint: '?action=wbsearchentities&search=python&language=en&format=json&limit=1', sourceCategory: 'Open Data', tagline: 'Search Wikidata entities as JSON', description: 'MediaWiki action API over Wikidata — search entities, fetch labels and descriptions. No key; send a descriptive User-Agent per Wikimedia policy.' },
  { name: 'TCGdex', emoji: '🃏', baseUrl: 'https://api.tcgdex.net/v2/en', sampleEndpoint: '/cards?name=pikachu', sourceCategory: 'Games & Comics', tagline: 'Multilingual Pokémon TCG card data', description: 'Open Pokémon TCG database with cards, sets and rarities in many languages. Keyless JSON search and lookup — cache responses in production.' },
  { name: 'Kroki', emoji: '📐', baseUrl: 'https://kroki.io', sampleEndpoint: '/health', sourceCategory: 'Development', tagline: 'Diagram-as-code health check', description: 'Kroki renders Mermaid, PlantUML and more to images. The /health route returns service status as JSON; diagram POST routes return binary media.' },
  { name: 'caldays', emoji: '📅', baseUrl: 'https://caldays.com/api', sampleEndpoint: '/holidays?country=US&year=2026', sourceCategory: 'Calendar', tagline: 'Public holidays for 195+ countries', description: 'Country and year holiday lists as JSON. No API key on the public holidays route — useful for scheduling and payroll tools.' },
  { name: 'FreeIPAPI', emoji: '📍', baseUrl: 'https://freeipapi.com/api', sampleEndpoint: '/json/8.8.8.8', sourceCategory: 'Geocoding', tagline: 'Free IP geolocation JSON', description: 'City, region, country and timezone from an IPv4 or IPv6 address. No key on the public JSON routes.' },
  { name: 'Httpbingo', emoji: '🔁', baseUrl: 'https://httpbingo.org', sampleEndpoint: '/json', sourceCategory: 'Development', tagline: 'HTTP echo with HTTP/3 support', description: 'Community httpbin mirror on Cloudflare with QUIC support. /json and /get return request metadata as JSON for client debugging.' },
  { name: 'ip-fast.com', emoji: '⚡', baseUrl: 'https://api.ip-fast.com', sampleEndpoint: '/json/8.8.8.8', sourceCategory: 'Geocoding', tagline: 'Fast IP geolocation JSON', description: 'Lightweight IP-to-location API returning country, city, coordinates and ASN as JSON. No authentication on the public JSON routes.' },
  { name: 'RSS to JSON', emoji: '📰', baseUrl: 'https://rss-to-json-serverless-api.vercel.app/api', sampleEndpoint: '/?rss_url=https://hnrss.org/frontpage', sourceCategory: 'Development', tagline: 'Convert any RSS feed to JSON', description: 'Pass an RSS URL as a query parameter and get parsed items as JSON — title, link, pubDate and content. Handy for feed readers and aggregation without XML parsing.' },
  { name: 'is.gd', emoji: '🔗', baseUrl: 'https://is.gd', sampleEndpoint: '/create.php?format=json&url=https://example.com', sourceCategory: 'Development', tagline: 'Simple URL shortener API', description: 'is.gd shortens URLs via a single GET and returns the short link as JSON when format=json is set. No API key for basic use — one of the oldest keyless shortener APIs.' },
  { name: 'goQR.me', emoji: '📱', baseUrl: 'https://api.qrserver.com/v1', sampleEndpoint: '/create-qr-code/?size=150x150&data=Hello&format=json', sourceCategory: 'Development', tagline: 'Generate QR codes via GET', description: 'QR Server API creates QR code images from text or URLs. Returns image metadata as JSON when format=json — no signup required for basic generation.' },
  { name: 'EVA IP', emoji: '🌐', baseUrl: 'https://eva.pingutil.com', sampleEndpoint: '/api/v1/8.8.8.8', sourceCategory: 'Geocoding', tagline: 'IP geolocation with security flags', description: 'EVA returns IP location, ISP, timezone and basic security indicators as JSON. Keyless public endpoint suitable for quick geo lookups in scripts and demos.' },
  { name: 'College Scorecard', emoji: '🎓', baseUrl: 'https://api.data.gov/ed/collegescorecard/v1', sampleEndpoint: '/schools.json?api_key=DEMO_KEY&school.name=Harvard&per_page=1', sourceCategory: 'Government', tagline: 'US college outcomes and cost data', description: 'US Department of Education College Scorecard API returns earnings, debt and completion stats for US institutions. DEMO_KEY works for testing without registration.' },
  { name: 'Tenders Guru PL', emoji: '🏛', baseUrl: 'https://tenders.guru/pl/api', sampleEndpoint: '/tenders?limit=1', sourceCategory: 'Government', tagline: 'Polish public procurement notices', description: 'Tenders Guru aggregates open procurement data across EU countries. The Poland API returns recent tenders as JSON with title, value and deadline — no key on read routes.' },
  { name: 'Tenders Guru HU', emoji: '🏛', baseUrl: 'https://tenders.guru/hu/api', sampleEndpoint: '/tenders?limit=1', sourceCategory: 'Government', tagline: 'Hungarian public procurement notices', description: 'Hungarian tender listings from the Tenders Guru open-data project. Paginated JSON with contract metadata — keyless read access for civic tech and journalism tools.' },
  { name: 'Digimon API', emoji: '🦖', baseUrl: 'https://digimon-api.vercel.app/api', sampleEndpoint: '/digimon', sourceCategory: 'Games & Comics', tagline: 'Digimon list and details', description: 'Paginated creature lists on Vercel. Keyless JSON for retro gaming fan sites.' },
  { name: 'STAPI', emoji: '🖖', baseUrl: 'https://stapi.co/api/v1/rest', sampleEndpoint: '/character/search?pageNumber=0&pageSize=1', sourceCategory: 'Entertainment', tagline: 'Star Trek character database', description: 'Read-only Star Trek characters, species and episodes. Paginated JSON search with no authentication.' },
  { name: 'Harry Potter API', emoji: '⚡', baseUrl: 'https://hp-api.onrender.com/api', sampleEndpoint: '/characters', sourceCategory: 'Games & Comics', tagline: 'Harry Potter characters and houses', description: 'Unofficial character metadata with house, wand and patronus info. Fan-hosted JSON API — cache responses since uptime may vary.' },
  { name: 'AmiiboAPI', emoji: '🎮', baseUrl: 'https://amiiboapi.com', sampleEndpoint: '/api/amiibo/?name=mario', sourceCategory: 'Games & Comics', tagline: 'Nintendo Amiibo figure database', description: 'Search Amiibo figures by name, game series or character. Returns JSON with release dates, images and compatible games. Community-maintained, no key.' },
  { name: 'Anime Facts', emoji: '📺', baseUrl: 'https://anime-facts-rest-api.herokuapp.com', sampleEndpoint: '/api/v1/0', sourceCategory: 'Anime', tagline: 'Random facts about popular anime', description: 'Returns a numbered fact about a specific anime series. Index the /api/v1/{id} routes for shows like One Piece or Naruto. Keyless JSON for weebs and bots.' },
  { name: 'Bleach Poems', emoji: '📜', baseUrl: 'https://bleach-poems-api.codeberg.page', sampleEndpoint: '/api/poem', sourceCategory: 'Books', tagline: 'Random poems from Bleach', description: 'Fan API serving random poem excerpts from the Bleach manga/anime. Compact JSON with title and text — niche but reliably keyless.' },
  { name: 'Runyankole Bible', emoji: '📖', baseUrl: 'https://runyankole-bible-api.vercel.app', sampleEndpoint: '/api/books', sourceCategory: 'Books', tagline: 'Runyankole Bible books and verses', description: 'Bible API for the Runyankole translation — list books, fetch chapters and verses as JSON. Open religious text API hosted on Vercel, no authentication.' },
  { name: 'Thirukkural', emoji: '📜', baseUrl: 'https://api-thirukkural.web.app', sampleEndpoint: '/kural/1', sourceCategory: 'Books', tagline: 'Tamil Thirukkural couplets', description: 'Ancient Tamil text by number with translations. Cultural open data, no key.' },
  { name: '7Timer!', emoji: '🌤', baseUrl: 'http://www.7timer.info', sampleEndpoint: '/bin/api.pl?lon=13.4&lat=52.5&product=civil&output=json', sourceCategory: 'Weather', tagline: 'Numeric weather forecast for any lat/lon', description: 'Machine-readable forecasts from a GFS-derived model. No key; legacy host may be HTTP-only.' },
  { name: 'Pirate Weather', emoji: '🏴‍☠️', baseUrl: 'https://api.pirateweather.net', sampleEndpoint: '/forecast/40.7128,-74.0060', sourceCategory: 'Weather', tagline: 'Dark Sky-compatible weather API', description: 'Open-source weather API using Dark Sky response format. Free tier without a key for non-commercial use — drop-in replacement for deprecated Dark Sky clients.' },
  { name: 'Blockchair', emoji: '⛓', baseUrl: 'https://api.blockchair.com', sampleEndpoint: '/bitcoin/stats', sourceCategory: 'Cryptocurrency', tagline: 'Bitcoin blockchain statistics', description: 'Blockchair exposes chain stats, blocks and transactions. The /bitcoin/stats route returns network metrics as JSON; higher limits with a free API key.' },
  { name: 'ViaCEP', emoji: '🇧🇷', baseUrl: 'https://viacep.com.br/ws', sampleEndpoint: '/01001000/json/', sourceCategory: 'Geocoding', tagline: 'Brazilian CEP to address JSON', description: 'Resolves Brazilian postal codes (CEP) to street, district, city and state. High availability, no key — the standard CEP lookup API in Brazil.' },
  { name: 'postcodes.io', emoji: '🇬🇧', baseUrl: 'https://api.postcodes.io', sampleEndpoint: '/postcodes/SW1A1AA', sourceCategory: 'Geocoding', tagline: 'UK postcode lookup', description: 'Lat/lng, constituencies and NHS regions for UK postcodes. Open source and fast.' },
  { name: 'Adoptium', emoji: '☕', baseUrl: 'https://api.adoptium.net/v3', sampleEndpoint: '/info/release_versions', sourceCategory: 'Development', tagline: 'Temurin JDK release metadata', description: 'Java versions, binaries and checksums for Temurin builds. No auth on read endpoints.' },
  { name: 'Datasette', emoji: '🗃', baseUrl: 'https://datasette.io', sampleEndpoint: '/content.json', sourceCategory: 'Open Data', tagline: 'Datasette ecosystem metadata', description: 'Datasette publishes SQLite databases as read-only JSON APIs. The project site exposes its table-of-contents JSON at /content.json.' },
  { name: 'Decathlon Sports', emoji: '🏃', baseUrl: 'https://api.decathlon.net/sports/v1', sampleEndpoint: '/sports?limit=1', sourceCategory: 'Sports & Fitness', tagline: 'Decathlon sport taxonomy', description: 'Official Decathlon API listing sports categories and metadata. Public read routes return JSON for fitness apps and retail integrations.' },
  { name: 'FAA N-Number', emoji: '✈️', baseUrl: 'https://registry.faa.gov/aircraftinquiry', sampleEndpoint: '/Search/NNumberResult?NNumberTxt=N12345&format=json', sourceCategory: 'Transportation', tagline: 'US aircraft registry lookup', description: 'FAA registry search by N-number returns aircraft make, model, owner and status as JSON. US public aviation data — may require browser-like headers.' },
  { name: 'Launch Library 2', emoji: '🚀', baseUrl: 'https://ll.thespacedevs.com/2.4.0', sampleEndpoint: '/launch/upcoming/?limit=1', sourceCategory: 'Science & Math', tagline: 'Upcoming rocket launches worldwide', description: 'The Space Devs maintain a comprehensive launch calendar. Upcoming and past launches with vehicle, pad and mission details as paginated JSON. Free tier without a key.' },
  { name: 'Open Notify People', emoji: '🛰', baseUrl: 'http://api.open-notify.org', sampleEndpoint: '/astros.json', sourceCategory: 'Science & Math', tagline: 'Who is currently in space', description: 'Open Notify returns the count and names of astronauts currently aboard the ISS and other craft. Simple keyless JSON — companion to the ISS position API.' },
]

// dedupe EXTRA by host
const seen = new Set()
const targets = []
for (const h of PROBE_HINTS) {
  if (hostsKnown(h.baseUrl)) continue
  const key = hostKey(h.baseUrl)
  if (seen.has(key)) continue
  seen.add(key)
  targets.push(h)
}
for (const e of EXTRA) {
  if (hostsKnown(e.baseUrl)) continue
  const key = hostKey(e.baseUrl)
  if (seen.has(key)) continue
  seen.add(key)
  targets.push(e)
}

console.log(`probing ${targets.length} quick targets...`)

const verified = []
const skipped = []

async function probeOne(h) {
  const url = h.baseUrl.replace(/\/+$/, '') + (h.sampleEndpoint.startsWith('/') ? h.sampleEndpoint : '/' + h.sampleEndpoint)
  const r = await probeUrl(url)
  if (r.httpStatus === 200 && r.json && !isPostmanCollection(r.json)) {
    return {
      name: h.name,
      slug: slugify(h.name),
      emoji: h.emoji || emojiFor(h.sourceCategory),
      tagline: (h.tagline || h.name).slice(0, 80),
      description: h.description || `${h.name} — keyless JSON API verified by live probe.`,
      sourceCategory: h.sourceCategory,
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
      notes: `quick-probe; ${url}`,
    }
  }
  return null
}

const CONC = 10
let i = 0
async function worker() {
  while (i < targets.length) {
    const idx = i++
    const h = targets[idx]
    try {
      const entry = await probeOne(h)
      if (entry) {
        verified.push(entry)
        process.stdout.write(`  ✓ ${entry.slug}\n`)
      } else {
        skipped.push({ name: h.name, reason: 'no 200 JSON' })
      }
    } catch (e) {
      skipped.push({ name: h.name, reason: String(e) })
    }
  }
}

await Promise.all(Array.from({ length: CONC }, () => worker()))

// merge with existing batch if probe-all already started it
let batch = { batch: BATCH, verified: [], skipped: [] }
if (existsSync(OUT)) {
  try {
    batch = JSON.parse(readFileSync(OUT, 'utf8'))
  } catch { /* fresh */ }
}
const existingSlugs = new Set((batch.verified || []).map((v) => v.slug))
const existingHosts = new Set((batch.verified || []).map((v) => hostKey(v.baseUrl)))
for (const v of verified) {
  if (existingSlugs.has(v.slug) || existingHosts.has(hostKey(v.baseUrl))) continue
  batch.verified.push(v)
}
batch.skipped = [...(batch.skipped || []), ...skipped]

writeFileSync(OUT, JSON.stringify(batch, null, 2) + '\n')
console.log(`\nwrote ${OUT}: ${batch.verified.length} verified (+${verified.length} this run), ${skipped.length} skipped`)
