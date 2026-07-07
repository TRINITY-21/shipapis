// Single source for every machine-readable record shape.
// llms.txt, /data/*, /api/v1/* and /mcp must all render from these helpers —
// count/schema drift across surfaces is the apimap failure mode (MASTERPLAN §2.3, Δ4 #8).

import { catApis, catalogCounts, dataTier, isMonitored } from './catalog'
import { apiLogoShape, apiLogoSrc } from './api-logo'
import { tierBlurb } from './check-tier'
import { categories, categoryBySlug, endpointUrl, uptimePct, type ApiEntry } from './seed'

/** 'dev-seed' until a real check lands, then 'monitored' — a per-request value from the D1 catalog.
 *  Payloads self-describe their provenance instead of gating features during development (Δ2, amended). */
export { dataTier }

export const CONTACT = 'hello@shipapis.dev'
export const LICENSE = 'CC-BY-4.0 — free to use, index and train on, with attribution to shipapis.dev'

export const sampleUrl = (a: ApiEntry) => `${a.baseUrl}${a.sampleEndpoint}`
export const curlFor = (a: ApiEntry) => `curl "${sampleUrl(a)}"` // quoted — unquoted & backgrounds the command

/** Synthetic in dev (derived from seed lastCheckedMin); the checker writes real ones.
 *  Unmonitored imports have no check yet — null, consistent with monitored_since. */
export const checkedAtIso = (a: ApiEntry): string | null =>
  a.status === 'unmonitored' ? null : new Date(Date.now() - a.lastCheckedMin * 60_000).toISOString()

export const uptimeNum = (a: ApiEntry, days = 90) => {
  const n = Number(uptimePct(a, days))
  return Number.isFinite(n) ? n : null
}

export const coverageSnapshot = () => {
  const c = catalogCounts()
  return { total: c.total, scheduled: c.scheduled, probed: c.monitored, queued: c.queued, catalogued: c.catalogued }
}

/** meta block carried by every machine payload — generated + data_tier are the honesty header. */
export const payloadMeta = (extra: Record<string, unknown> = {}) => ({
  generated: new Date().toISOString(),
  data_tier: dataTier(),
  source: 'https://shipapis.dev',
  license: LICENSE,
  ...extra,
})

/** Minimal DISCOVERY record — the /data/index.json unit at catalog scale. Just enough to pick a
 *  candidate (slug + what it is + can-I-use-it), then fetch the full record for base_url/curl/sample.
 *  Deliberately smaller than slimShape so an agent isn't forced to load ~30k tokens to discover.
 *  The size-budgeted ladder: indexShape → slimShape → listShape (/api/v1/apis) → fullShape (/api/v1/apis/{slug}). */
export const indexShape = (a: ApiEntry) => ({
  slug: a.slug,
  name: a.name,
  category: a.category,
  description: a.tagline,
  auth: a.auth,
  check_tier: a.checkTier,
  status: a.status,
  health: a.healthScore < 0 ? null : a.healthScore,
})

/** Slim discovery record — /data/index.json and lightweight discovery. */
export const slimShape = (a: ApiEntry) => ({
  slug: a.slug,
  name: a.name,
  emoji: a.emoji,
  ...apiLogoShape(a),
  category: a.category,
  description: a.tagline,
  auth: a.auth,
  check_tier: a.checkTier,
  cors: a.cors,
  agent_access: a.agentAccess, // ok | blocked | unknown — can a non-browser client reach it (WAF/bot-wall)?
  base_url: a.baseUrl,
  status: a.status,
  health: a.healthScore < 0 ? null : a.healthScore, // -1 sentinel = unmonitored, not a real score
  uptime_pct: uptimeNum(a),
  monitored_since: a.monitoredSince, // real ISO date from D1, or null until the first check
  p50_ms: a.p50 || null,
  checked_at: checkedAtIso(a),
})

const SITE = 'https://shipapis.dev'

/** Integration-ready list record — GET /api/v1/apis and /api/v1/search.
 *  Enough to wire an agent without a second hop; full sample JSON lives on GET /api/v1/apis/{slug}. */
export const listShape = (a: ApiEntry) => {
  const logo = apiLogoSrc(a, { absolute: true })
  return {
  slug: a.slug,
  name: a.name,
  emoji: a.emoji,
  ...apiLogoShape(a),
  tagline: a.tagline,
  category: a.category,
  auth: a.auth,
  check_tier: a.checkTier,
  cors: a.cors,
  https: a.https,
  agent_access: a.agentAccess,
  commercial_use: a.commercialUse,
  requires_card: a.requiresCard,
  free_tier: a.freeTier,
  rate_limit: a.rateLimit,
  base_url: a.baseUrl,
  docs_url: a.docsUrl,
  sample_endpoint: a.sampleEndpoint,
  sample_url: sampleUrl(a),
  sample_curl: curlFor(a),
  endpoint_count: a.endpoints.length,
  endpoints: a.endpoints.slice(0, 5).map((e) => ({
    method: e.method,
    path: e.path,
    url: endpointUrl(a.baseUrl, e.path),
    description: e.description,
    monitored: !!e.monitored,
  })),
  status: a.status,
  probed: isMonitored(a),
  health: a.healthScore < 0 ? null : a.healthScore,
  uptime_pct: uptimeNum(a),
  p50_ms: a.p50 || null,
  p95_ms: a.p95 || null,
  checked_at: checkedAtIso(a),
  monitored_since: a.monitoredSince,
  links: {
    self: `${SITE}/api/v1/apis/${a.slug}`,
    history: `${SITE}/api/v1/apis/${a.slug}/history`,
    page: `${SITE}/api/${a.slug}`,
    badge: `${SITE}/badge/${a.slug}.svg`,
    ...(logo ? { logo } : {}),
  },
}
}

/** Trimmed list preview for homepage UI — not the full apiListEnvelope. */
export function homeApiListPreview(
  apis: ApiEntry[],
  query: Record<string, string | number | boolean>,
) {
  return {
    meta: { data_tier: dataTier(), coverage: coverageSnapshot() },
    query,
    count: apis.length,
    results: apis.map((a) => ({
      slug: a.slug,
      name: a.name,
      logo_url: apiLogoSrc(a, { absolute: true }),
      health: a.healthScore < 0 ? null : a.healthScore,
      p50_ms: a.p50 || null,
      cors: a.cors,
      sample_curl: curlFor(a),
      endpoints: a.endpoints.slice(0, 2).map((e) => ({ method: e.method, path: e.path })),
    })),
  }
}

export interface ListQuery {
  q?: string
  category?: string
  auth?: string
  cors?: string
  status?: string
  agent?: string
  commercial?: string
  sort?: string
  probed?: boolean
  limit?: number
  offset?: number
}

/** Standard envelope for GET /api/v1/apis and /api/v1/search. */
export function apiListEnvelope(
  results: ApiEntry[],
  opts: {
    total: number
    query: ListQuery
    path: string
    requestUrl: string
    hint?: string
  },
) {
  const { total, query, path, requestUrl, hint } = opts
  const limit = query.limit
  const offset = query.offset ?? 0
  const coverage = coverageSnapshot()
  const applied = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v != null && v !== '' && v !== false),
  )
  const nextOffset = limit != null && offset + results.length < total ? offset + results.length : null
  const next =
    nextOffset != null
      ? `${SITE}${path}?${new URLSearchParams({
          ...Object.fromEntries(
            Object.entries(applied).map(([k, v]) => [k, String(v)]),
          ),
          limit: String(limit),
          offset: String(nextOffset),
        }).toString()}`
      : null

  return {
    meta: payloadMeta({
      api_version: '1',
      documentation: `${SITE}/agents`,
      openapi: `${SITE}/openapi.json`,
      coverage,
      hint:
        hint ??
        'Integration-ready records. GET /api/v1/apis/{slug} for sample JSON, full endpoint list, and schema history.',
    }),
    query: applied,
    pagination: {
      total,
      count: results.length,
      limit: limit ?? null,
      offset,
      has_more: nextOffset != null,
    },
    links: {
      self: requestUrl.startsWith('http') ? requestUrl : `${SITE}${requestUrl}`,
      ...(next ? { next } : {}),
      detail: `${SITE}/api/v1/apis/{slug}`,
      categories: `${SITE}/api/v1/categories`,
      status: `${SITE}/data/status.json`,
    },
    count: results.length,
    results: results.map(listShape),
  }
}

/** Full integration record — /api/v1/apis/{slug}, category slices, MCP get_api. */
export const fullShape = (a: ApiEntry) => ({
  ...slimShape(a),
  tagline: a.tagline,
  description: a.description,
  docs_url: a.docsUrl,
  sample_endpoint: a.sampleEndpoint,
  sample_url: sampleUrl(a),
  endpoints: a.endpoints.map((e) => ({
    method: e.method,
    path: e.path,
    url: endpointUrl(a.baseUrl, e.path),
    description: e.description,
    monitored: !!e.monitored,
  })),
  sample_request_curl: curlFor(a),
  sample_response: a.sample,
  https: a.https,
  commercial_use: a.commercialUse,
  data_license: a.dataLicense,
  free_tier: a.freeTier,
  rate_limit: a.rateLimit,
  requires_card: a.requiresCard,
  check_tier_note: tierBlurb(a.checkTier),
  p95_ms: a.p95 || null,
  added_at: a.addedAt,
  shape_changes: a.shapeChanges,
  ...(a.diedAt ? { died_at: a.diedAt, epitaph: a.epitaph ?? null } : {}),
  page_url: `https://shipapis.dev/api/${a.slug}`,
  badge_url: `https://shipapis.dev/badge/${a.slug}.svg`,
})

/* ---------- search & suggestion (shared by /api/v1/search and the MCP tools) ---------- */

const STATUS_BOOST: Record<string, number> = { healthy: 12, new: 8, resurrected: 6, degraded: -4, dying: -12, dead: -80, unmonitored: -18 }

// Filler words in task descriptions ("show weather for a city") — substring-matching these
// against every record is pure noise. Domain words (api, data, free, weather…) are NOT stopwords.
const STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'its', 'as', 'be', 'by',
  'from', 'with', 'that', 'this', 'any', 'some', 'how', 'what', 'which', 'i', 'me', 'my', 'we', 'you', 'your',
  'show', 'display', 'get', 'fetch', 'need', 'want', 'build', 'make', 'use', 'using', 'app', 'into',
  'do', 'so', 'no', 'up', 'if', 'am', 'was', 'were', 'their', 'there', 'then', 'than', 'where', 'when', 'who',
  // generic filler that creates phantom matches ("...as a service" hit "pick-an-agency"). Domain nouns stay.
  'service', 'services', 'online', 'platform', 'website', 'site', 'thing', 'things', 'stuff', 'provider', 'providers', 'system',
])

// Query term → the vocabulary the catalog ACTUALLY uses. Without this the matcher is purely lexical:
// "currency" never reaches Frankfurter ("FX/exchange rates") and noise wins. Synonym hits score lower
// than direct hits (below), so this rescues recall without wrecking precision. Extend as the catalog grows.
const SYNONYMS: Record<string, string[]> = {
  currency: ['fx', 'forex', 'exchange', 'rates', 'conversion', 'money'],
  convert: ['conversion', 'exchange', 'rates'],
  exchange: ['fx', 'forex', 'currency', 'rates'],
  forex: ['fx', 'currency', 'exchange'],
  euro: ['currency', 'fx', 'exchange'], usd: ['currency', 'fx'], eur: ['currency', 'fx'], gbp: ['currency', 'fx'],
  crypto: ['cryptocurrency', 'bitcoin', 'ethereum', 'coin', 'blockchain', 'token'],
  bitcoin: ['btc', 'crypto', 'cryptocurrency'], ethereum: ['eth', 'crypto', 'cryptocurrency'],
  email: ['mail', 'smtp', 'inbox', 'mailbox'], mail: ['email', 'smtp'],
  weather: ['forecast', 'temperature', 'climate', 'meteo', 'meteorological'],
  forecast: ['weather', 'temperature', 'climate'],
  location: ['geocode', 'geocoding', 'address', 'coordinates', 'latitude', 'longitude', 'geo'],
  geocode: ['geocoding', 'address', 'location', 'coordinates'], address: ['geocode', 'geocoding', 'location'],
  ip: ['geolocation', 'geoip', 'address'], translate: ['translation', 'language'],
  image: ['photo', 'picture', 'img'], photo: ['image', 'picture', 'img'],
  news: ['headlines', 'articles', 'press'], stock: ['stocks', 'equities', 'market', 'ticker', 'shares'],
  movie: ['film', 'cinema', 'movies'], music: ['song', 'track', 'lyrics', 'audio'],
  book: ['books', 'literature', 'isbn'], dictionary: ['definition', 'word', 'thesaurus'],
  country: ['countries', 'nation', 'nations', 'flag'], quote: ['quotes', 'quotation', 'saying'],
  joke: ['jokes', 'humor', 'humour'], color: ['colour', 'palette', 'hex'], qr: ['qrcode', 'barcode'],
  sms: ['text', 'message', 'phone'], space: ['nasa', 'astronomy', 'satellite', 'iss', 'planet'],
  sports: ['sport', 'football', 'soccer', 'basketball', 'nba', 'scores'],
  animal: ['animals', 'dog', 'cat', 'pet'], dog: ['dogs', 'canine'], cat: ['cats', 'feline'],
}

// Query term → the CATEGORY it most likely means. A currency query shouldn't lose to an IP-geolocation
// API just because that API happens to return a currency field. An in-category match earns a bonus
// (only when the record already has some lexical hit), so domain intent breaks lexical ties. Slugs must
// match src/seed.ts categories. Curated like SYNONYMS — extend as the catalog grows.
const CATEGORY_INTENT: Record<string, string[]> = {
  currency: ['finance'], convert: ['finance'], exchange: ['finance'], forex: ['finance'], fx: ['finance'],
  money: ['finance'], euro: ['finance'], usd: ['finance'], eur: ['finance'], gbp: ['finance'], rates: ['finance'],
  stock: ['finance'], stocks: ['finance'], market: ['finance'],
  crypto: ['crypto'], cryptocurrency: ['crypto'], bitcoin: ['crypto'], btc: ['crypto'], ethereum: ['crypto'],
  eth: ['crypto'], coin: ['crypto'], blockchain: ['crypto'], nft: ['crypto'], token: ['crypto'],
  weather: ['weather'], forecast: ['weather'], temperature: ['weather'], climate: ['weather'], rain: ['weather'],
  geocode: ['geo'], geocoding: ['geo'], address: ['geo'], location: ['geo'], coordinates: ['geo'], map: ['geo'], ip: ['geo'],
  dog: ['animals'], cat: ['animals'], animal: ['animals'], pet: ['animals'], dogs: ['animals'], cats: ['animals'],
  movie: ['media'], film: ['media'], music: ['media'], song: ['media'], lyrics: ['media'], image: ['media'],
  photo: ['media'], picture: ['media'], video: ['media'], art: ['media'],
  book: ['books'], dictionary: ['books'], word: ['books'], definition: ['books'], translate: ['books'],
  space: ['science'], nasa: ['science'], astronomy: ['science'], satellite: ['science'], planet: ['science'],
  game: ['games'], anime: ['anime'], manga: ['anime'], pokemon: ['games'], trivia: ['fun'],
  joke: ['fun'], quote: ['fun'], meme: ['fun'],
  email: ['developer', 'social'], sms: ['social'], phone: ['social'], jobs: ['social'],
  country: ['data'], countries: ['data'], news: ['data'], government: ['gov'],
  sports: ['health'], football: ['health'], nutrition: ['health'], food: ['health'], recipe: ['health'], fitness: ['health'],
  qr: ['developer'], screenshot: ['developer'], avatar: ['developer'], placeholder: ['developer'],
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Word-boundary prefix matchers for a token + its light stem, so "rates"→rate and
 *  "geocoding"→geocod both hit — but "concurrency" can never match "currency". */
const matchers = (t: string): RegExp[] => {
  const variants = new Set([t])
  const stem = t.replace(/(ing|ed|es|e|s)$/, '') // geocode→geocod matches "geocoding"; rates→rate
  if (stem.length >= 3) variants.add(stem)
  return [...variants].map((v) => new RegExp(`\\b${escapeRe(v)}`))
}

/** Pure LEXICAL relevance — how well the query words appear in the record, with NO health boost.
 *  This is what a relevance floor gates on: a lone description word (12) or synonym (8) is weak;
 *  a tagline/category/name hit (25/30/60) is real. Used by bestApiForTask to refuse weak "best" answers. */
export function matchScore(a: ApiEntry, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const tokens = [...new Set(q.split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !STOP.has(t)))]
  if (!tokens.length) return 0
  const name = a.name.toLowerCase()
  const cat = categoryBySlug.get(a.category)
  const hay = {
    name,
    slug: a.slug,
    tagline: a.tagline.toLowerCase(),
    description: a.description.toLowerCase(),
    category: `${a.category} ${cat?.name.toLowerCase() ?? ''}`,
  }
  if (name === q || a.slug === q) return 100 + 40 // exact name/slug — unbeatable, no coverage penalty
  let score = 0
  let matched = 0 // distinct query tokens that hit something — drives the coverage multiplier
  for (const t of tokens) {
    const direct = matchers(t)
    const syn = (SYNONYMS[t] ?? []).flatMap(matchers)
    const before = score
    // Direct hit → full points; else a synonym hit → 70%. Precision (direct) still beats recall (synonym).
    const hit = (field: string, pts: number) => {
      if (direct.some((re) => re.test(field))) score += pts
      else if (syn.length && syn.some((re) => re.test(field))) score += Math.round(pts * 0.7)
    }
    hit(hay.name, 60)
    hit(hay.slug, 40)
    hit(hay.category, 30)
    hit(hay.tagline, 25)
    hit(hay.description, 12)
    if (score > before) matched++
  }
  if (score === 0) return 0
  // Coverage: an API matching MORE of the query's words beats one that only hit a single common word
  // ("bitcoin price" → a crypto API covering both, not a vehicle API that only owns "prices").
  const coverage = matched / tokens.length
  score *= 0.45 + 0.55 * coverage
  // Domain intent: a lexical match INSIDE the category the query implies gets a bump, so intent breaks
  // ties (currency → finance beats an IP API that merely returns a currency field).
  const intended = new Set(tokens.flatMap((t) => CATEGORY_INTENT[t] ?? []))
  if (intended.has(a.category)) score += 24
  return Math.round(score)
}

/** Relevance + a health nudge — the ranking score for search lists (prefer healthy among matches). */
export function scoreApi(a: ApiEntry, query: string): number {
  const m = matchScore(a, query)
  return m > 0 ? m + (STATUS_BOOST[a.status] ?? 0) : 0
}

/** A "best answer" must clear this LEXICAL bar — below it, we say "no confident match" rather than
 *  return a healthy-but-irrelevant API. 16 = a tagline/category/name hit passes; a lone description
 *  word (12) or single synonym (≤8) does not. This is what stops "quantum teleportation" → pick-an-agency. */
export const CONFIDENCE_FLOOR = 16

export interface SearchFilters {
  category?: string
  auth?: string
  cors?: string
  status?: string
  agent?: string // agentAccess: ok | blocked | unknown
  commercial?: string // commercialUse: yes | no | unclear
  /** When true, only APIs on our probe schedule (status !== unmonitored). */
  probed?: boolean
}

const applyFilters = (pool: ApiEntry[], filters: SearchFilters) => {
  let list = pool
  if (filters.category) list = list.filter((a) => a.category === filters.category)
  if (filters.auth) list = list.filter((a) => a.auth === filters.auth)
  if (filters.cors) list = list.filter((a) => a.cors === filters.cors)
  if (filters.status) list = list.filter((a) => a.status === filters.status)
  if (filters.agent) list = list.filter((a) => a.agentAccess === filters.agent)
  if (filters.commercial) list = list.filter((a) => a.commercialUse === filters.commercial)
  if (filters.probed) list = list.filter(isMonitored)
  return list
}

export function searchApis(query: string, filters: SearchFilters = {}, limit = 10): ApiEntry[] {
  const pool = applyFilters([...catApis()], filters)
  const tier = (a: ApiEntry) => (a.status === 'dead' ? 0 : a.status === 'unmonitored' ? 1 : 2)
  return pool
    .map((a) => ({ a, s: scoreApi(a, query) }))
    .filter((x) => x.s > 0)
    .sort(
      (x, y) =>
        y.s - x.s ||
        tier(y.a) - tier(x.a) ||
        y.a.healthScore - x.a.healthScore,
    )
    .slice(0, Math.min(limit, 25))
    .map((x) => x.a)
}

/* ---------- best-for-task routing (GET /api/v1/best · MCP best_api) ----------
 * The agent-native answer: not a list to rank yourself, but the single healthiest API that
 * matches a task, plus fallbacks. Only possible because we know which ones are up right now. */

// Winner preference when several match: a healthy API beats a new one beats an unchecked one
// beats a degraded one beats a dying one. Dead is excluded entirely before this applies.
const BEST_TIER: Record<string, number> = { healthy: 4, new: 3, resurrected: 3, unmonitored: 2, degraded: 1, dying: 0 }

export function bestApiForTask(
  query: string,
  filters: SearchFilters = {},
  opts: { include_catalogued?: boolean } = {},
): { best: ApiEntry | null; alternatives: ApiEntry[]; note: string } {
  const includeCatalogued = opts.include_catalogued === true
  let ranked = searchApis(query, filters, 24).filter((a) => a.status !== 'dead')
  const probed = ranked.filter(isMonitored)
  let cataloguedFallback = false
  if (!includeCatalogued && probed.length > 0) ranked = probed
  else if (!includeCatalogued && probed.length === 0 && ranked.length > 0) cataloguedFallback = true

  // Relevance floor — the whole point of a "one answer" tool is that it can say "no confident match"
  // instead of returning a healthy-but-irrelevant API. Gate on LEXICAL relevance (matchScore), not the
  // health-boosted score, so a genuinely-off query ("quantum teleportation") gets an honest null.
  const relevant = ranked.map((a) => ({ a, m: matchScore(a, query) })).filter((x) => x.m >= CONFIDENCE_FLOOR)
  if (!relevant.length) {
    const near = ranked.length ? ` (closest was "${ranked[0].name}", but not a confident fit)` : ''
    return {
      best: null,
      alternatives: [],
      note: `No confident match for “${query}”${near}. shipapis may not cover this yet — GET /api/v1/categories to see what's covered, or rephrase with a concrete noun (e.g. "weather", "currency", "geocoding"). Do NOT build on a guess.`,
    }
  }
  // Rank RELEVANCE-FIRST, with status tier + health as boosters. A clearly-more-relevant API beats a
  // merely-healthier one (fixes "weather widget" picking sensor boxes purely because they scored 97);
  // among similar relevance, prefer healthy + probed.
  const rankVal = (x: { a: ApiEntry; m: number }) =>
    x.m + (BEST_TIER[x.a.status] ?? 0) * 6 + Math.max(0, x.a.healthScore) * 0.15
  const sorted = relevant.sort((x, y) => rankVal(y) - rankVal(x)).map((x) => x.a)
  const best = sorted[0]
  const alternatives = sorted.slice(1, 3)
  const solid = best.status === 'healthy' || best.status === 'new' || best.status === 'resurrected'

  if (best.status === 'unmonitored' || cataloguedFallback) {
    return {
      best,
      alternatives,
      note: `No probed API matched “${query}”. “${best.name}” is catalogued only — shipapis has not health-checked it. Use docs_url; ignore health/uptime fields. Pass include_catalogued=true to request this explicitly.`,
    }
  }
  if (solid) {
    return {
      best,
      alternatives,
      note: `Best probed match for “${query}”.${alternatives.length ? ' Fallbacks included if it fails.' : ''}`,
    }
  }
  return {
    best,
    alternatives,
    note: `No fully-healthy probed match for “${query}”. Strongest probed option is “${best.name}” (status: ${best.status}) — keep a fallback${alternatives.length ? '; alternatives included' : ''}.`,
  }
}

export const categoryCounts = () => {
  const apis = catApis()
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
    description: c.blurb,
    apis: apis.filter((a) => a.category === c.slug).length,
  }))
}
