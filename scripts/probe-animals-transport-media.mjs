// Targeted probe: thin animals + transport + apiKey media with public/demo keys.
// run: node scripts/probe-animals-transport-media.mjs [--batch 74]

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROBE_HINTS } from './lib/probe-hints.mjs'
import {
    UA,
    isPostmanCollection,
    probeUrl,
    slugify,
    trimJson,
} from './lib/probe-utils.mjs'

const BATCH = Number(process.argv.find((a, i) => process.argv[i - 1] === '--batch') || '74')
const OUT = fileURLToPath(new URL(`./import/batch-${String(BATCH).padStart(2, '0')}.json`, import.meta.url))
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
function hostsKnown(url) {
  return hostAliases(hostKey(url)).some((a) => known.has(a))
}

/** Built-in public/demo keys — no env required */
const APIKEY_TARGETS = [
  {
    name: 'OMDb', slug: 'omdb-import', emoji: '🎞', sourceCategory: 'Video', auth: 'apiKey',
    docsUrl: 'https://www.omdbapi.com/', baseUrl: 'http://www.omdbapi.com',
    sampleEndpoint: '/?t=Inception&apikey=trilogy',
    tagline: 'Movie metadata by title or IMDb ID',
    description: 'The Open Movie Database returns plot, cast, ratings and poster URLs. Free tier with a personal key; the public patron key `trilogy` works for light smoke tests.',
    freeTier: '1,000 req/day free key; patron key `trilogy` for prototyping',
    rateLimit: 'Patron key is shared — cache responses',
  },
  {
    name: 'NASA APOD', slug: 'nasa-apod-import', emoji: '🚀', sourceCategory: 'Science & Math', auth: 'apiKey',
    docsUrl: 'https://api.nasa.gov/', baseUrl: 'https://api.nasa.gov',
    sampleEndpoint: '/planetary/apod?api_key=DEMO_KEY',
    tagline: 'Astronomy Picture of the Day',
    description: 'NASA APOD returns the daily image with title, explanation and media URL. DEMO_KEY works instantly; register for higher limits.',
    freeTier: 'DEMO_KEY: 30/hour; free personal key: 1,000/hour',
    rateLimit: 'DEMO_KEY throttled',
  },
  {
    name: 'USDA FoodData Central', slug: 'usda-fdc', emoji: '🍎', sourceCategory: 'Food & Drink', auth: 'apiKey',
    docsUrl: 'https://fdc.nal.usda.gov/api-guide.html', baseUrl: 'https://api.nal.usda.gov/fdc/v1',
    sampleEndpoint: '/foods/search?query=apple&pageSize=1&api_key=DEMO_KEY',
    tagline: 'USDA food nutrient database',
    description: 'FoodData Central search returns nutrient profiles for branded and generic foods. DEMO_KEY works for testing; register for production volume.',
    freeTier: 'DEMO_KEY for light use',
    rateLimit: 'Unpublished',
  },
  {
    name: 'TheSportsDB', slug: 'thesportsdb', emoji: '🏟', sourceCategory: 'Sports & Fitness', auth: 'apiKey',
    docsUrl: 'https://www.thesportsdb.com/api.php', baseUrl: 'https://www.thesportsdb.com/api/v1/json/3',
    sampleEndpoint: '/searchteams.php?t=Arsenal',
    tagline: 'Sports teams, players and events',
    description: 'Crowd-sourced sports database with public test key `3` embedded in the URL path. Search teams, list seasons and fetch event details as JSON.',
    freeTier: 'Free test key `3` in docs examples',
    rateLimit: 'Unpublished',
  },
  {
    name: 'Spoonacular', slug: 'spoonacular', emoji: '🍳', sourceCategory: 'Food & Drink', auth: 'apiKey',
    docsUrl: 'https://spoonacular.com/food-api/docs', baseUrl: 'https://api.spoonacular.com',
    sampleEndpoint: '/recipes/complexSearch?query=pasta&number=1&apiKey=demo',
    tagline: 'Recipe search and nutrition data',
    description: 'Spoonacular covers recipes, ingredients and meal planning. Demo key works for smoke tests; register for production quotas.',
    freeTier: 'Demo key for testing',
    rateLimit: '150 points/day free tier with registered key',
  },
  {
    name: 'RAWG', slug: 'rawg', emoji: '🎮', sourceCategory: 'Games & Comics', auth: 'apiKey',
    docsUrl: 'https://rawg.io/apidocs', baseUrl: 'https://api.rawg.io/api',
    sampleEndpoint: '/games?key=YOUR_API_KEY&page_size=1',
    tagline: 'Video game database',
    description: 'RAWG indexes 500k+ games with screenshots, genres and stores. Free API key after signup — required in query string.',
    freeTier: 'Free personal API key',
    rateLimit: '20,000 req/month free',
    skipUnlessEnv: 'RAWG_API_KEY',
  },
  {
    name: 'TMDb', slug: 'tmdb-import', emoji: '🎬', sourceCategory: 'Video', auth: 'apiKey',
    docsUrl: 'https://developer.themoviedb.org/docs', baseUrl: 'https://api.themoviedb.org/3',
    sampleEndpoint: '/movie/550?api_key=',
    tagline: 'Community movie and TV metadata',
    description: 'The Movie Database covers films, shows, people and images. Free key after signup at themoviedb.org — attribution required.',
    freeTier: 'Free personal API key',
    rateLimit: '~50 req/sec documented',
    skipUnlessEnv: 'TMDB_API_KEY',
  },
  {
    name: 'Fanart.tv', slug: 'fanart-tv-import', emoji: '🖼', sourceCategory: 'Video', auth: 'apiKey',
    docsUrl: 'https://fanart.tv/api-docs/', baseUrl: 'https://webservice.fanart.tv/v3',
    sampleEndpoint: '/movies/550?api_key=',
    tagline: 'HD artwork for movies and TV',
    description: 'Fanart.tv serves logos, posters and backgrounds keyed by TMDB/TVDB IDs. Free API key after signup.',
    freeTier: 'Free personal API key',
    rateLimit: 'Unpublished',
    skipUnlessEnv: 'FANART_API_KEY',
  },
  {
    name: 'TVDB', slug: 'tvdb-import', emoji: '📺', sourceCategory: 'Video', auth: 'apiKey',
    docsUrl: 'https://thetvdb.com/api-information', baseUrl: 'https://api4.thetvdb.com/v4',
    sampleEndpoint: '/languages',
    tagline: 'TV series and episode metadata',
    description: 'TheTVDB v4 lists languages, series and episodes. Some read routes work with a bearer token from a free personal key.',
    freeTier: 'Free personal API key',
    rateLimit: 'Unpublished',
    skipUnlessEnv: 'TVDB_API_KEY',
  },
  {
    name: 'Last.fm', slug: 'lastfm', emoji: '🎵', sourceCategory: 'Music', auth: 'apiKey',
    docsUrl: 'https://www.last.fm/api', baseUrl: 'https://ws.audioscrobbler.com/2.0',
    sampleEndpoint: '/?method=artist.search&artist=cher&api_key=YOUR_API_KEY&format=json',
    tagline: 'Music scrobbling and metadata',
    description: 'Last.fm API returns artist, album and track metadata from listener data. Free API key after signup.',
    freeTier: 'Free personal API key',
    rateLimit: 'Unpublished',
    skipUnlessEnv: 'LASTFM_API_KEY',
  },
  {
    name: 'NewsAPI', slug: 'newsapi', emoji: '📰', sourceCategory: 'News', auth: 'apiKey',
    docsUrl: 'https://newsapi.org/docs', baseUrl: 'https://newsapi.org/v2',
    sampleEndpoint: '/top-headlines?country=us&pageSize=1&apiKey=YOUR_API_KEY',
    tagline: 'Headlines from 80k+ sources',
    description: 'NewsAPI aggregates breaking news and headlines. Developer key free for localhost; production requires paid plan.',
    freeTier: 'Free dev key (localhost only)',
    rateLimit: '100 req/day dev',
    skipUnlessEnv: 'NEWSAPI_KEY',
  },
  {
    name: 'Giphy', slug: 'giphy', emoji: '🎞', sourceCategory: 'Video', auth: 'apiKey',
    docsUrl: 'https://developers.giphy.com/docs/api/', baseUrl: 'https://api.giphy.com/v1/gifs',
    sampleEndpoint: '/trending?api_key=YOUR_API_KEY&limit=1',
    tagline: 'GIF search and trending',
    description: 'Giphy API returns GIF metadata and CDN URLs. Free beta key after signup — attribution required.',
    freeTier: 'Free beta API key',
    rateLimit: 'Unpublished',
    skipUnlessEnv: 'GIPHY_API_KEY',
  },
]

const THIN_HINTS = PROBE_HINTS.filter((h) =>
  /Animals|Transportation|Tracking|Vehicle|Security|Anime|Video|Music|Food|Cryptocurrency/i.test(h.sourceCategory ?? ''),
)

async function probeEntry(t) {
  let ep = t.sampleEndpoint ?? '/'
  if (t.skipUnlessEnv) {
    const key = process.env[t.skipUnlessEnv]
    if (!key) return null
    ep = ep.replace(/YOUR_API_KEY|api_key=$/, (m) => (m === 'api_key=' ? `api_key=${key}` : key))
  }
  const url = t.baseUrl.replace(/\/+$/, '') + (ep.startsWith('/') ? ep : '/' + ep)
  const headers = { 'user-agent': UA, accept: 'application/json' }
  if (t.skipUnlessEnv === 'TVDB_API_KEY' && process.env.TVDB_API_KEY) {
    headers.authorization = `Bearer ${process.env.TVDB_API_KEY}`
  }
  const r = await probeUrl(url, { headers })
  if (r.httpStatus === 200 && r.json && !isPostmanCollection(r.json)) {
    return {
      name: t.name,
      slug: t.slug || slugify(t.name),
      emoji: t.emoji || '🔌',
      tagline: (t.tagline || t.name).slice(0, 80),
      description: t.description || `${t.name} — verified JSON API.`,
      sourceCategory: t.sourceCategory,
      docsUrl: t.docsUrl || t.baseUrl,
      baseUrl: t.baseUrl.replace(/\/+$/, ''),
      sampleEndpoint: ep.startsWith('/') ? ep : '/' + ep,
      latencyMs: r.latencyMs,
      corsObserved: r.corsObserved,
      httpStatus: 200,
      sampleJson: trimJson(r.json),
      freeTier: t.freeTier || 'Free tier — key may be required',
      rateLimit: t.rateLimit || 'Unpublished',
      dataLicense: 'Unverified',
      commercialUse: 'unclear',
      auth: t.auth || 'none',
      notes: `animals-transport-media probe; ${url}`,
    }
  }
  return null
}

const verified = []
const skipped = []

// 1) apiKey with public keys
for (const t of APIKEY_TARGETS) {
  if (t.skipUnlessEnv && !process.env[t.skipUnlessEnv]) {
    skipped.push({ name: t.name, reason: `needs ${t.skipUnlessEnv}` })
    continue
  }
  if (hostsKnown(t.baseUrl) && !t.slug?.includes('-import')) {
    skipped.push({ name: t.name, reason: 'host in catalog' })
    continue
  }
  const entry = await probeEntry(t)
  if (entry && !hostsKnown(entry.baseUrl)) {
    verified.push(entry)
    for (const a of hostAliases(hostKey(entry.baseUrl))) known.add(a)
    process.stdout.write(`  ✓ ${entry.slug} (apiKey)\n`)
  } else skipped.push({ name: t.name, reason: entry ? 'duplicate' : 'probe failed' })
}

// 2) thin-category hints (animals + transport focus)
for (const h of THIN_HINTS) {
  if (hostsKnown(h.baseUrl)) continue
  if (!/Animals|Transportation|Tracking|Vehicle/i.test(h.sourceCategory ?? '')) continue
  const entry = await probeEntry({ ...h, auth: 'none' })
  if (entry) {
    verified.push(entry)
    for (const a of hostAliases(hostKey(entry.baseUrl))) known.add(a)
    process.stdout.write(`  ✓ ${entry.slug}\n`)
  } else skipped.push({ name: h.name, reason: 'probe failed' })
}

writeFileSync(OUT, JSON.stringify({ batch: BATCH, verified, skipped }, null, 2) + '\n')
console.log(`\nwrote ${OUT}: ${verified.length} verified, ${skipped.length} skipped`)
