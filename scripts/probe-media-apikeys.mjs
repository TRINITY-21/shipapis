// Import free-tier media APIs that require an API key (TMDb-class).
// Probes with env keys when set; otherwise accepts 401/403 JSON auth walls as reachability proof.
//
// run: node scripts/probe-media-apikeys.mjs [--from-batch 105]
// Keys (optional): TMDB_API_KEY, FANART_API_KEY, TVDB_API_KEY, TRAKT_CLIENT_ID,
//   LASTFM_API_KEY, WATCHMODE_API_KEY, RAWG_API_KEY, TWITCH_CLIENT_ID, IGDB_CLIENT_ID

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GENERATED_HINTS } from './lib/generated-hints.mjs'
import { PROBE_HINTS } from './lib/probe-hints.mjs'
import {
    UA, docsFetchUrl, extractProbeUrls, guessEndpoints, isApiKeyProbeHit,
    isPostmanCollection, probeUrl, resolveHintRequest, slugify, splitBaseAndEndpoint, trimJson,
} from './lib/probe-utils.mjs'

const FROM = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '105')
const CONC = 16
const BATCH = 25
const IMPORT = fileURLToPath(new URL('./import/', import.meta.url))

const MEDIA_CATS = new Set([
  'Video', 'Music', 'Entertainment', 'Photography', 'Art & Design', 'Games & Comics', 'Anime',
])

/** Curated media apiKey APIs — probed even if absent from directory pool. */
const CURATED = [
  {
    name: 'TMDb',
    docsUrl: 'https://developer.themoviedb.org/docs',
    description: 'Community movie and TV metadata at scale.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    probeUrls: [
      'https://api.themoviedb.org/3/configuration',
      'https://api.themoviedb.org/3/movie/550?api_key=' + (process.env.TMDB_API_KEY || ''),
    ].filter((u) => !u.endsWith('=') || process.env.TMDB_API_KEY),
  },
  {
    name: 'Fanart.tv',
    docsUrl: 'https://fanart.tv/api-docs/',
    description: 'HD logos, posters and backgrounds for Plex/Kodi libraries.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    probeUrls: [
      'https://webservice.fanart.tv/v3/movies/550?api_key=' + (process.env.FANART_API_KEY || ''),
      'https://webservice.fanart.tv/v3/movies/550',
    ].filter((u) => !u.includes('api_key=') || process.env.FANART_API_KEY),
  },
  {
    name: 'Last.fm',
    docsUrl: 'https://www.last.fm/api',
    description: 'Music metadata and scrobbling from listener data.',
    sourceCategory: 'Music',
    auth: 'apiKey',
    probeUrls: [
      'https://ws.audioscrobbler.com/2.0/?method=artist.search&artist=cher&api_key=' + (process.env.LASTFM_API_KEY || 'x') + '&format=json',
    ],
  },
  {
    name: 'Watchmode',
    docsUrl: 'https://api.watchmode.com/docs/',
    description: 'Streaming availability across Netflix, Prime and more.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    probeUrls: [
      'https://api.watchmode.com/v1/sources/?apiKey=' + (process.env.WATCHMODE_API_KEY || ''),
      'https://api.watchmode.com/v1/sources/',
    ].filter((u) => !u.includes('apiKey=') || process.env.WATCHMODE_API_KEY),
  },
  {
    name: 'Trakt',
    docsUrl: 'https://trakt.docs.apiary.io/',
    description: 'Watch history, ratings and streaming links.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    headers: process.env.TRAKT_CLIENT_ID
      ? { 'trakt-api-key': process.env.TRAKT_CLIENT_ID, 'trakt-api-version': '2' }
      : {},
    probeUrls: ['https://api.trakt.tv/movies/trending?extended=full'],
  },
  {
    name: 'TheAudioDB',
    docsUrl: 'https://www.theaudiodb.com/api_guide.php',
    description: 'Music artist/album metadata — public test key `1` in URL path.',
    sourceCategory: 'Music',
    auth: 'apiKey',
    probeUrls: ['https://www.theaudiodb.com/api/v1/json/1/search.php?s=daft_punk'],
  },
  {
    name: 'Comic Vine',
    docsUrl: 'https://comicvine.gamespot.com/api/',
    description: 'Comics, characters and issue metadata from GameSpot.',
    sourceCategory: 'Games & Comics',
    auth: 'apiKey',
    probeUrls: [
      'https://comicvine.gamespot.com/api/characters/?api_key=' + (process.env.COMICVINE_API_KEY || '') + '&format=json&limit=1',
      'https://comicvine.gamespot.com/api/characters/?format=json&limit=1',
    ].filter((u) => !u.includes('api_key=&') || process.env.COMICVINE_API_KEY),
  },
  {
    name: 'Deezer',
    docsUrl: 'https://developers.deezer.com/api',
    description: 'Charts, artists and tracks — many routes need no OAuth.',
    sourceCategory: 'Music',
    auth: 'none',
    probeUrls: ['https://api.deezer.com/chart/0/tracks'],
  },
  {
    name: 'OMDb',
    docsUrl: 'https://www.omdbapi.com/',
    description: 'Open Movie Database — plot, cast and ratings by title or IMDb ID.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    probeUrls: ['https://www.omdbapi.com/?t=Inception&apikey=trilogy'],
  },
  {
    name: 'TVDB',
    docsUrl: 'https://thetvdb.com/api-information',
    description: 'TV series metadata and artwork IDs.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    probeUrls: ['https://api4.thetvdb.com/v4/languages'],
  },
  {
    name: 'RAWG',
    docsUrl: 'https://rawg.io/apidocs',
    description: 'Large video game database with screenshots and stores.',
    sourceCategory: 'Games & Comics',
    auth: 'apiKey',
    probeUrls: [
      'https://api.rawg.io/api/games?key=' + (process.env.RAWG_API_KEY || '') + '&page_size=1',
      'https://api.rawg.io/api/games?page_size=1',
    ].filter((u) => !u.includes('key=&') || process.env.RAWG_API_KEY),
  },
  {
    name: 'IGDB',
    docsUrl: 'https://api-docs.igdb.com/',
    description: 'Game metadata from Twitch/IGDB.',
    sourceCategory: 'Games & Comics',
    auth: 'apiKey',
    headers: process.env.TWITCH_CLIENT_ID
      ? { 'Client-ID': process.env.TWITCH_CLIENT_ID }
      : {},
    probeUrls: ['https://api.igdb.com/v4/games'],
  },
  {
    name: 'Twitch Helix',
    docsUrl: 'https://dev.twitch.tv/docs/api/',
    description: 'Twitch streams, games and users.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    headers: process.env.TWITCH_CLIENT_ID ? { 'Client-Id': process.env.TWITCH_CLIENT_ID } : {},
    probeUrls: ['https://api.twitch.tv/helix/games/top'],
  },
  {
    name: 'IMDb-API',
    docsUrl: 'https://imdb-api.com/',
    description: 'Unofficial IMDb metadata wrapper.',
    sourceCategory: 'Video',
    auth: 'apiKey',
    probeUrls: [
      'https://imdb-api.com/en/API/SearchMovie/knight',
      'https://imdb-api.com/API/SearchMovie/knight',
    ],
  },
  {
    name: 'Musixmatch',
    docsUrl: 'https://developer.musixmatch.com/',
    description: 'Lyrics and music metadata.',
    sourceCategory: 'Music',
    auth: 'apiKey',
    probeUrls: ['https://api.musixmatch.com/ws/1.1/chart.tracks.get?apikey=demo'],
  },
  {
    name: 'Spotify Web API',
    docsUrl: 'https://developer.spotify.com/documentation/web-api',
    description: 'Spotify catalog, playlists and user library.',
    sourceCategory: 'Music',
    auth: 'oauth',
    probeUrls: ['https://api.spotify.com/v1/browse/new-releases?limit=1'],
  },
]

const POOL_FILES = [
  fileURLToPath(new URL('./directory-candidates.json', import.meta.url)),
  fileURLToPath(new URL('./candidates.json', import.meta.url)),
]

function hostAliases(host) {
  const h = host.replace(/^www\./, '')
  const o = new Set([h])
  if (h.startsWith('api.')) o.add(h.slice(4))
  else o.add(`api.${h}`)
  return [...o]
}

const seed = readFileSync(fileURLToPath(new URL('../src/data/seed.ts', import.meta.url)), 'utf8')
  + readFileSync(fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url)), 'utf8')
const known = new Set()
for (const m of seed.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) {
  try { for (const a of hostAliases(new URL(m[1]).hostname)) known.add(a) } catch { /* */ }
}
for (const f of readdirSync(IMPORT).filter((x) => /^batch-\d+\.json$/.test(x))) {
  for (const v of JSON.parse(readFileSync(IMPORT + f, 'utf8')).verified ?? []) {
    try { for (const a of hostAliases(new URL(v.baseUrl).hostname)) known.add(a) } catch { /* */ }
  }
}

function hostsKnown(url) {
  return hostAliases(new URL(url).hostname).some((a) => known.has(a))
}

function findHint(c) {
  const hay = `${c.name} ${c.docsUrl} ${c.description || ''}`
  for (const h of [...PROBE_HINTS, ...GENERATED_HINTS]) {
    if (h.match?.test?.(hay)) return h
  }
  return null
}

const queue = []
const seen = new Set()

function enqueue(c) {
  try {
    if (hostsKnown(c.docsUrl || c.probeUrls?.[0])) return
    const key = (c.docsUrl || c.name) + '|' + c.name.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    queue.push(c)
  } catch { /* */ }
}

for (const c of CURATED) enqueue(c)

for (const p of POOL_FILES) {
  if (!existsSync(p)) continue
  for (const c of JSON.parse(readFileSync(p, 'utf8')).candidates ?? []) {
    if (!MEDIA_CATS.has(c.sourceCategory)) continue
    if (!['apiKey', 'oauth'].includes(c.auth)) continue
    enqueue(c)
  }
}

console.log(`media apiKey queue: ${queue.length}`)

let batchNo = FROM
let batchVerified = []
const verified = []

function flush() {
  if (!batchVerified.length) return
  writeFileSync(`${IMPORT}batch-${String(batchNo).padStart(2, '0')}.json`, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → batch-${batchNo} (${batchVerified.length})`)
  batchNo++
  batchVerified = []
}

async function tryUrl(url, headers = {}) {
  const r = await probeUrl(url, { headers })
  if (!isApiKeyProbeHit(r.httpStatus, r.json) || isPostmanCollection(r.json)) return null
  const split = splitBaseAndEndpoint(url)
  if (!split) return null
  return { ...r, ...split, probedUrl: url }
}

async function verify(c) {
  const hint = findHint(c)
  if (hint) {
    const req = resolveHintRequest(hint)
    if (req) {
      const hit = await tryUrl(req.url, req.headers)
      if (hit) return buildEntry(c, hint, hit, req.auth || hint.auth || 'apiKey')
    }
  }

  const urls = [...(c.probeUrls ?? []), ...guessEndpoints(c).slice(0, 8)]
  try {
    const res = await fetch(docsFetchUrl(c.docsUrl), {
      signal: AbortSignal.timeout(5000),
      headers: { 'user-agent': UA },
    })
    if (res.ok) urls.unshift(...extractProbeUrls(await res.text(), 6))
  } catch { /* */ }

  for (const url of urls) {
    const hit = await tryUrl(url, c.headers ?? {})
    if (hit) return buildEntry(c, hint, hit, c.auth || 'apiKey')
  }
  return null
}

function buildEntry(c, hint, hit, auth) {
  return {
    name: hint?.name || c.name,
    slug: slugify(hint?.name || c.name),
    emoji: hint?.emoji || (MEDIA_CATS.has(c.sourceCategory) && c.sourceCategory === 'Music' ? '🎵' : '🎬'),
    tagline: hint?.tagline || `${c.name} — free tier with API key`,
    description: hint?.description || c.description || `${c.name} offers a free JSON API tier. Register for an API key at the provider docs.`,
    sourceCategory: c.sourceCategory || hint?.sourceCategory || 'Video',
    docsUrl: c.docsUrl || hint?.docsUrl || hit.baseUrl,
    baseUrl: hit.baseUrl,
    sampleEndpoint: hit.sampleEndpoint.startsWith('/') ? hit.sampleEndpoint : `/${hit.sampleEndpoint}`,
    latencyMs: hit.latencyMs,
    corsObserved: hit.corsObserved,
    httpStatus: hit.httpStatus,
    sampleJson: trimJson(hit.json),
    freeTier: auth === 'oauth' ? 'OAuth app registration — free tier' : 'Free tier — API key required',
    rateLimit: 'Unpublished',
    dataLicense: 'Unverified',
    commercialUse: 'unclear',
    auth,
    notes: `media apiKey probe ${hit.probedUrl}`,
  }
}

const work = [...queue]
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let c; (c = work.shift()); ) {
    const entry = await verify(c)
    if (!entry) continue
    if (hostsKnown(entry.baseUrl)) continue
    for (const a of hostAliases(new URL(entry.baseUrl).hostname)) known.add(a)
    verified.push(entry)
    batchVerified.push(entry)
    process.stdout.write(`  ✓ ${entry.slug} (${entry.httpStatus})\n`)
    if (batchVerified.length >= BATCH) flush()
  }
}))

flush()
console.log(`\ndone: ${verified.length} media apiKey APIs`)
