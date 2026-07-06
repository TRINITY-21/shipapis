// Path heuristics + descriptions for multi-endpoint catalogs (no network, no recipe imports).

/** @typedef {{ method?: string, path: string, description: string, monitored?: boolean }} EndpointRow */

export const MIN_ENDPOINTS = 3
export const MAX_ENDPOINTS = 6

const SEGMENT_HINTS = {
  random: 'Random item from the collection.',
  search: 'Search by query parameters.',
  health: 'Health check — confirms the service is up.',
  healthz: 'Kubernetes-style health probe.',
  ping: 'Lightweight ping endpoint.',
  status: 'Service status metadata.',
  fact: 'Single random fact.',
  facts: 'One or more random facts.',
  breeds: 'Breed or category catalog.',
  quote: 'Random quote.',
  quotes: 'Quote collection.',
  jokes: 'Joke or humor content.',
  joke: 'Single joke response.',
  users: 'User records or directory.',
  user: 'Single user profile.',
  posts: 'Blog or feed posts.',
  products: 'Product listing.',
  countries: 'Country metadata list.',
  regions: 'Geographic regions.',
  locations: 'Location search or listing.',
  forecast: 'Weather or time forecast for coordinates.',
  convert: 'Currency or unit conversion.',
  rates: 'Exchange or interest rates.',
  price: 'Current price quote.',
  ticker: 'Market ticker data.',
  trending: 'Trending items right now.',
  popular: 'Popular items ranked by usage.',
  top: 'Top-ranked results.',
  chart: 'Chart or leaderboard data.',
  latest: 'Most recent entries.',
  today: "Today's data snapshot.",
  now: 'Current snapshot.',
  feed: 'Activity or news feed.',
  list: 'Paginated list of resources.',
  all: 'Full collection dump.',
  metadata: 'Schema or metadata descriptor.',
  info: 'API or service information.',
  version: 'Version string or build info.',
  languages: 'Supported language codes.',
  episodes: 'Episode list for a series.',
  seasons: 'Season listing.',
  films: 'Film catalog.',
  movies: 'Movie records.',
  shows: 'TV show records.',
  anime: 'Anime title metadata.',
  characters: 'Character listing.',
  people: 'People or cast records.',
  planets: 'Planet or location records.',
  starships: 'Starship or vehicle records.',
  games: 'Game title metadata.',
  artists: 'Artist profiles.',
  albums: 'Album records.',
  tracks: 'Track listing.',
  lyrics: 'Lyrics lookup.',
  images: 'Image assets or gallery.',
  photos: 'Photo collection.',
  news: 'News articles or headlines.',
  events: 'Event calendar or listing.',
  stats: 'Aggregate statistics.',
  metrics: 'Operational metrics.',
  elevation: 'Terrain elevation data.',
  air: 'Air quality readings.',
  quality: 'Quality index or score.',
  providers: 'Streaming or service providers.',
  sources: 'Data sources catalog.',
  configuration: 'API configuration and limits.',
}

/** @param {string} path @param {string} [name] */
export function describePath(path, name) {
  const q = path.includes('?') ? path.slice(path.indexOf('?') + 1) : ''
  const pathname = path.split('?')[0] || '/'
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''

  if (/^[\d]+$/.test(last)) {
    const resource = segments[segments.length - 2] || 'resource'
    return `${titleCase(resource.replace(/[-_]/g, ' '))} details by ID (example: ${last}).`
  }
  if (/^[0-9a-f-]{36}$/i.test(last)) {
    return `Record lookup by UUID (${last.slice(0, 8)}…).`
  }

  for (const [key, desc] of Object.entries(SEGMENT_HINTS)) {
    if (segments.some((s) => s.toLowerCase() === key) || last.toLowerCase() === key) return desc
  }

  if (q.includes('search') || q.includes('query') || q.includes('q=')) {
    return 'Search results filtered by query parameters.'
  }
  if (q.includes('latitude') || q.includes('lat=')) return 'Geospatial query by coordinates.'
  if (q.includes('api_key') || q.includes('apikey')) return 'Authenticated route — API key required in query.'

  if (segments.length === 0) return `${name || 'API'} root or index route.`
  const resource = segments[segments.length - 1].replace(/[-_.]/g, ' ')
  return `${titleCase(resource)} — documented GET route.`
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function normPath(p) {
  if (!p) return '/'
  return p.startsWith('/') ? p : `/${p}`
}

/** @param {object} spec @param {string} sample */
export function heuristicPaths(spec, sample) {
  const out = new Set([normPath(sample)])
  const pathname = sample.split('?')[0]
  const segs = pathname.split('/').filter(Boolean)

  if (segs.length && /^[\d]+$/.test(segs[segs.length - 1])) {
    const parent = '/' + segs.slice(0, -1).join('/')
    if (parent.length > 1) out.add(parent)
    out.add(parent + '/1')
  }

  const lower = sample.toLowerCase()
  const pairs = [
    ['/fact', '/facts'],
    ['/quote', '/quotes/random'],
    ['/joke', '/jokes/random'],
    ['/random', '/list'],
    ['/breed', '/breeds'],
    ['/breeds', '/breeds/random'],
    ['/ping', '/health'],
    ['/health', '/status'],
    ['/status', '/ping'],
  ]
  for (const [a, b] of pairs) {
    if (lower.includes(a)) out.add(b)
    if (lower.includes(b)) out.add(a)
  }

  if (segs.length >= 2) {
    const resource = segs[0]
    out.add(`/${resource}`)
    out.add(`/${resource}/1`)
    out.add(`/${resource}?limit=10`)
    out.add(`/${resource}/search?q=test`)
  }

  const vMatch = pathname.match(/^(\/v\d+)/)
  if (vMatch) {
    out.add(`${vMatch[1]}/`)
    out.add(`${vMatch[1]}/search`)
    out.add(`${vMatch[1]}/popular`)
  }

  if (sample.includes('?')) {
    const base = pathname
    out.add(`${base}?limit=5`)
    out.add(`${base}?page=1`)
  }

  return [...out].filter((p) => p && p !== '').slice(0, MAX_ENDPOINTS)
}

/** @param {EndpointRow[]} endpoints @param {string} sampleEndpoint */
export function finalizeEndpoints(endpoints, sampleEndpoint) {
  const sample = normPath(sampleEndpoint)
  const list = endpoints.map((e) => ({ method: e.method || 'GET', ...e, path: normPath(e.path) }))
  if (!list.some((e) => e.monitored)) {
    const i = list.findIndex((e) => e.path === sample)
    if (i >= 0) list[i].monitored = true
    else if (list[0]) list[0].monitored = true
  }
  return list.slice(0, MAX_ENDPOINTS)
}

/** @param {{ slug: string, name: string, baseUrl: string, sampleEndpoint: string, tagline?: string }} spec */
export function expandEndpointsSync(spec) {
  const sample = normPath(spec.sampleEndpoint)
  /** @type {Map<string, EndpointRow>} */
  const byPath = new Map()
  const add = (path, description, monitored = false) => {
    const p = normPath(path)
    if (!p || p.length > 200) return
    if (!byPath.has(p)) byPath.set(p, { method: 'GET', path: p, description: description.slice(0, 140), monitored })
    else if (monitored) byPath.get(p).monitored = true
  }
  add(sample, spec.tagline || describePath(sample, spec.name), true)
  for (const p of heuristicPaths(spec, sample)) add(p, describePath(p, spec.name))
  if (byPath.size < MIN_ENDPOINTS) {
    const stem = sample.split('?')[0].replace(/\d+/g, '1')
    add(stem, describePath(stem, spec.name))
    add(stem + '?limit=5', 'Paginated variant with limit parameter.')
    const parent = stem.replace(/\/1$/, '')
    if (parent.length > 1) add(parent, 'Collection listing for this resource.')
  }
  return finalizeEndpoints([...byPath.values()], sample)
}
