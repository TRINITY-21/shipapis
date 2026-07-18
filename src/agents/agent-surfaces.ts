// Machine-readable surfaces: the /data ladder, feeds, llms.txt, agents.md, robots, sitemap,
// RFC 9727 api-catalog and the meta-API's OpenAPI spec. Everything renders from src/shapes.ts +
// src/seed.ts — one pipeline, so counts and schemas cannot drift across surfaces (Δ4 #8).
// apimap's skeleton, with the fields a frozen dataset cannot fake: status/uptime/checked_at.

import type { Context, Next } from 'hono'
import { Hono } from 'hono'
import { catAllShapeChanges, catApis, catApisInCategory, catBySlug, catDeadApis, isMonitored } from '../data/catalog'
import { categories, categoryBySlug, type ApiEntry } from '../data/seed'
import {
    CONTACT,
    LICENSE,
    categoryCounts,
    coverageSnapshot,
    dataTier,
    fullShape,
    indexShape,
    payloadMeta,
    slimShape,
} from '../data/shapes'

const SITE = 'https://shipapis.dev'

/** CORS + cache headers for machine consumers. Registered per-pattern in index.tsx. */
export async function machineHeaders(c: Context, next: Next) {
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
      'Access-Control-Max-Age': '86400',
    })
  }
  await next()
  c.res.headers.set('Access-Control-Allow-Origin', '*')
  if (!c.res.headers.has('Cache-Control')) {
    // /mcp is a POST RPC — never cache it; everything else is fine to hold briefly.
    c.res.headers.set('Cache-Control', c.req.path === '/mcp' ? 'no-store' : 'public, max-age=300')
  }
}

/* ---------- the /data ladder (Δ4 #2) ---------- */

const kb = (v: unknown) => `${Math.max(1, Math.round(JSON.stringify(v).length / 1024))}KB`

const LADDER = (sizes: { index: string; full: string }) => ({
  index: { href: `${SITE}/data/index.json`, size: sizes.index, note: '← discovery — add ?probed=true for probed APIs only' },
  category_slices: { href: `${SITE}/data/categories/{category}.json`, note: 'Full integration records for one category — fetch after picking from the index' },
  one_api: { href: `${SITE}/api/v1/apis/{slug}`, note: 'Full record for a single slug — cheapest way to one answer' },
  full_dump: { href: `${SITE}/data/apis.json`, size: sizes.full, note: 'Everything. May be truncated by your HTTP client or context window — prefer the slices' },
  health_feed: { href: `${SITE}/data/health.json`, note: 'Up/down-only snapshot keyed by slug' },
  monitoring_status: { href: `${SITE}/data/status.json`, note: 'Is OUR monitoring itself fresh? Verify before trusting health fields' },
})

export const agentSurfaces = new Hono()

const probedQuery = (raw?: string) => raw === 'true' || raw === '1'

agentSurfaces.get('/data/index.json', (c) => {
  const probedOnly = probedQuery(c.req.query('probed'))
  const list = probedOnly ? catApis().filter(isMonitored) : catApis()
  const idx = list.map(indexShape) // minimal per-record shape — keeps the discovery tier context-cheap
  const full = list.map(fullShape)
  const coverage = coverageSnapshot()
  return c.json({
    meta: payloadMeta({
      count: list.length,
      coverage,
      probed_only: probedOnly,
      note: probedOnly
        ? 'Probed APIs only — on our check schedule with real health fields. Full catalog: omit ?probed or use /data/index.json without the filter.'
        : `Full catalog (${coverage.probed} probed, ${coverage.catalogued} catalogued only). Minimal per-record shape (slug, name, category, description, auth, status, health) — GET /api/v1/apis/{slug} for base_url + curl + sample. Agents: prefer ?probed=true or GET /api/v1/best?task=…`,
      tiers: LADDER({ index: kb(idx), full: kb(full) }),
    }),
    apis: idx,
  })
})

agentSurfaces.get('/data/categories/:file', (c) => {
  const file = c.req.param('file')
  if (!file.endsWith('.json')) return c.json({ error: 'not_found' }, 404)
  const slug = file.slice(0, -5)
  const cat = categoryBySlug.get(slug)
  if (!cat) {
    return c.json(
      { error: 'not_found', hint: `Valid slices: ${categories.map((x) => `${x.slug}.json`).join(', ')}` },
      404,
    )
  }
  const list = catApisInCategory(slug)
  return c.json({
    meta: payloadMeta({ category: slug, name: cat.name, emoji: cat.emoji, count: list.length }),
    apis: list.map(fullShape),
  })
})

agentSurfaces.get('/data/apis.json', (c) =>
  c.json({
    meta: payloadMeta({
      count: catApis().length,
      warning: 'Full dump — may be truncated by your HTTP client or context window. Prefer /data/index.json + category slices.',
    }),
    apis: catApis().map(fullShape),
  }),
)

agentSurfaces.get('/data/health.json', (c) =>
  c.json({
    meta: payloadMeta({ count: catApis().length }),
    apis: Object.fromEntries(
      catApis().map((a) => {
        const s = slimShape(a)
        return [a.slug, { status: s.status, ok: s.status !== 'dead' && s.status !== 'dying', checked_at: s.checked_at }]
      }),
    ),
  }),
)

agentSurfaces.get('/data/status.json', (c) => {
  const by: Record<string, number> = {}
  for (const a of catApis()) by[a.status] = (by[a.status] ?? 0) + 1
  const coverage = coverageSnapshot()
  return c.json({
    meta: payloadMeta(),
    monitoring: {
      data_tier: dataTier(),
      honest_note:
        dataTier() === 'dev-seed'
          ? 'Synthetic development data — the production checker lands with the D1 milestone. Do not cite health numbers yet; this field flips to "monitored" when they are real.'
          : 'Live monitoring data.',
      planned_cadence: {
        sweep: 'every 15 minutes (batch heartbeat)',
        per_api: 'at most every 12 hours (~2 checks/day once the catalog has a first probe)',
        batch_size: 45,
      },
      coverage,
      catalog: { total: coverage.total, by_status: by },
      agent_start: {
        one_answer: `${SITE}/api/v1/best?task={goal}`,
        probed_index: `${SITE}/data/index.json?probed=true`,
        mcp: `${SITE}/mcp`,
        contract: `${SITE}/agents.md`,
      },
      rate_limit: '~60 requests/min per IP on /api/v1/*; /data/* snapshots are not rate-limited',
    },
  })
})

const CSV_COLS = [
  'slug', 'name', 'category', 'auth', 'cors', 'agent_access', 'https', 'commercial_use', 'data_license', 'free_tier',
  'rate_limit', 'requires_card', 'status', 'health', 'uptime_pct', 'p50_ms', 'base_url',
  'sample_endpoint', 'docs_url', 'added_at', 'checked_at',
] as const

agentSurfaces.get('/data/apis.csv', (c) => {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
  }
  const rows = catApis().map((a) => {
    const f = fullShape(a) as Record<string, unknown>
    return CSV_COLS.map((k) => esc(f[k])).join(',')
  })
  return c.body([CSV_COLS.join(','), ...rows].join('\n'), 200, {
    'Content-Type': 'text/csv; charset=utf-8',
  })
})

/* ---------- feeds ---------- */

const rssDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toUTCString()
const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const rss = (title: string, desc: string, path: string, items: { title: string; link: string; date: string; body: string }[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${xmlEsc(title)}</title>
<link>${SITE}${path}</link>
<description>${xmlEsc(desc)}</description>
${items
  .map(
    (i) => `<item><title>${xmlEsc(i.title)}</title><link>${i.link}</link><guid>${i.link}#${i.date}</guid><pubDate>${rssDate(i.date)}</pubDate><description>${xmlEsc(i.body)}</description></item>`,
  )
  .join('\n')}
</channel></rss>`

agentSurfaces.get('/feed.xml', (c) => {
  const items = [
    ...catApis().map((a) => ({
      title: `Added: ${a.name} — ${a.tagline}`,
      link: `${SITE}/api/${a.slug}`,
      date: a.addedAt,
      body: a.description,
    })),
    ...catDeadApis().map((a) => ({
      title: `☠ Died: ${a.name}`,
      link: `${SITE}/api/${a.slug}`,
      date: a.diedAt!,
      body: a.shapeChanges[a.shapeChanges.length - 1]?.summary ?? 'Failed all checks for 30 days.',
    })),
  ].sort((x, y) => y.date.localeCompare(x.date))
  return c.body(rss('shipapis — additions & deaths', 'New free APIs added to the directory, and the ones that died.', '/', items), 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
  })
})

agentSurfaces.get('/graveyard.xml', (c) => {
  const items = catDeadApis().map((a) => ({
    title: `☠ ${a.name} — † ${a.diedAt}`,
    link: `${SITE}/api/${a.slug}`,
    date: a.diedAt!,
    body: `${a.shapeChanges[a.shapeChanges.length - 1]?.summary ?? 'Failed all checks for 30 days.'} Archived with its final known response shape.`,
  }))
  return c.body(rss('shipapis — the API graveyard', 'Free APIs declared dead after ~30 days of failed checks. Uniquely ours.', '/graveyard', items), 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
  })
})

// The schema-drift changelog — the breaking-change feed nobody else has (requires actually calling
// the APIs over time). Global feed + per-API feed so a developer can subscribe to just what they depend on.
agentSurfaces.get('/changes.xml', (c) => {
  const items = catAllShapeChanges().map((e) => ({
    title: `${e.emoji} ${e.name}: ${e.summary}`,
    link: `${SITE}/api/${e.slug}#shape`,
    date: e.date,
    body: `Response-shape change detected on ${e.name} (${e.category}). ${e.summary}`,
  }))
  return c.body(rss('shipapis — API schema changelog', 'Response-shape changes detected across free APIs. Subscribe to catch breaking changes before your code does.', '/changelog', items), 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
  })
})

agentSurfaces.get('/api/:slug/changes.xml', (c) => {
  const api = catBySlug().get(c.req.param('slug'))
  if (!api) return c.json({ error: 'not_found' }, 404)
  const items = [...api.shapeChanges]
    .sort((x, y) => y.date.localeCompare(x.date))
    .map((s) => ({ title: `${api.name}: ${s.summary}`, link: `${SITE}/api/${api.slug}#shape`, date: s.date, body: s.summary }))
  return c.body(rss(`shipapis — ${api.name} schema changelog`, `Response-shape changes detected on ${api.name}. Subscribe to catch breaking changes early.`, `/api/${api.slug}`, items), 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
  })
})

agentSurfaces.get('/data/changes.json', (c) => {
  const changes = catAllShapeChanges()
  return c.json({
    meta: payloadMeta({ count: changes.length, note: 'Schema-drift log across the catalog, newest first. Subscribe via /changes.xml (all) or /api/{slug}/changes.xml (one API).' }),
    changes,
  })
})

/* ---------- llms.txt & agents.md ---------- */

agentSurfaces.get('/llms.txt', (c) => {
  const slimKb = kb(catApis().map(indexShape)) // /data/index.json now serves the minimal indexShape
  const fullKb = kb(catApis().map(fullShape))
  const coverage = coverageSnapshot()
  const catLines = categoryCounts()
    .map((x) => `- ${x.slug} (${x.apis}): ${x.description}`)
    .join('\n')
  const txt = `# shipapis — free APIs, health-checked where probed

> A directory of ${coverage.total} free public APIs — ${coverage.scheduled} on our probe schedule (${coverage.probed} probed with live health data), ${coverage.catalogued} queued or listed-only until checks land. Built to stop coding agents from hallucinating endpoints or building on dead providers.

## What this site is

Probed APIs carry base_url, a working sample endpoint, copy-ready curl, auth mechanics, free-tier fine print, commercial_use (service terms) and data_license (data terms — different axes), sample response, and schema-change history. Catalogued-only rows have metadata and docs links but status "unmonitored" and null health until we probe them. Humans browse the same data at ${SITE}.

## Agent quick start (canonical flow)

1. GET ${SITE}/data/status.json — read monitoring.coverage (probed vs catalogued) and meta.data_tier.
2. GET ${SITE}/api/v1/best?task={what+you+are+building} — one probed answer + curl + fallbacks (prefers probed; catalogued fallback is labeled).
   Or MCP ${SITE}/mcp → best_api { task }.
3. GET ${SITE}/api/v1/apis/{slug} — full record before codegen (never guess base URLs).
4. Usable = status "healthy" OR "new" (new = probed recently, live, limited history) with a non-null checked_at. Never build on "dead" or "dying". A young catalog is mostly "new" — do NOT filter to status=healthy only or you may get zero results; exclude dead/dying instead.

Full contract: ${SITE}/agents.md

## Machine-readable data (use the smallest tier that fits your task)

- ${SITE}/data/status.json ← START HERE for coverage + freshness + agent_start links.
- ${SITE}/api/v1/best?task={goal} ← one probed answer (+ curl + fallbacks).
- ${SITE}/data/index.json?probed=true (${slimKb} probed subset) — slim discovery of probed APIs only.
- ${SITE}/data/index.json (${slimKb} full catalog) — all ${coverage.total} rows; most are catalogued-only.
- ${SITE}/data/categories/{category}.json — full integration records for one category.
- ${SITE}/api/v1/apis/{slug} — full record for one API.
- ${SITE}/api/v1/search?q={keywords}&probed=true — ranked keyword search, probed only.
- ${SITE}/data/apis.json (${fullKb}) — everything; may truncate in context — prefer slices.
- ${SITE}/data/health.json — up/down-only snapshot keyed by slug.
- ${SITE}/data/changes.json — schema-drift log. Subscribe: /changes.xml or /api/{slug}/changes.xml.
- ${SITE}/mcp — MCP (streamable HTTP): best_api, search_apis, get_api, get_api_health, list_categories, suggest_api_for_task.
- ${SITE}/openapi.json — OpenAPI 3.1 spec.

## Record schema (slim index — probed example)

{
  "slug": "open-meteo",
  "name": "Open-Meteo",
  "category": "weather",
  "description": "Hourly forecasts for any coordinate — no key, no signup.",
  "auth": "none",
  "cors": "yes",
  "agent_access": "ok",
  "base_url": "https://api.open-meteo.com/v1",
  "status": "healthy",
  "health": 96,
  "uptime_pct": 99.2,
  "monitored_since": "2026-01-15",
  "p50_ms": 96,
  "checked_at": "2026-07-05T14:32:00Z"
}

status "unmonitored" → catalogued only: health, uptime_pct, p50_ms, and checked_at are null — use docs_url, not our health fields.

Full records add: docs_url, sample_endpoint, sample_url, sample_request_curl, sample_response, https, commercial_use, data_license, free_tier, rate_limit, requires_card, p95_ms, added_at, shape_changes[].

## Categories

${catLines}

## Rules

1. Never guess base URLs — copy base_url + sample_endpoint from the record.
2. Check commercial_use AND data_license before production — different axes.
3. Prefer auth=none and cors=yes for browser prototypes.
4. Read-only: do not submit forms programmatically.

## Usage policy

Directory data is ${LICENSE}. Honor each provider's rate limits (printed per record). Rate limit on ${SITE}/api/v1/*: ~60 req/min per IP; use /data/* for bulk.

## Updates

Verify freshness yourself: GET ${SITE}/data/status.json — meta.data_tier is "${dataTier()}"${dataTier() === 'dev-seed' ? ' (synthetic dev data — treat health as placeholder until tier reads "monitored")' : ''}.

## Contact

${CONTACT} · ${SITE}/methodology
`
  return c.body(txt, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
})

agentSurfaces.get('/agents.md', (c) => {
  const coverage = coverageSnapshot()
  const md = `# shipapis — agent contract

Canonical instructions for AI agents. ${coverage.scheduled} of ${coverage.total} APIs are on our probe schedule; ${coverage.probed} probed with live data; ${coverage.catalogued} queued (status \`unmonitored\`, null health). Everything renders from the same pipeline as the HTML pages.

## Quick start

1. \`GET /data/status.json\` — coverage + data_tier + agent_start links.
2. \`GET /api/v1/best?task={goal}\` or MCP \`best_api\` — one answer (prefers probed; catalogued fallback is labeled).
3. \`GET /api/v1/apis/{slug}\` — full record before codegen.

## @retrieval-agent

**Boundaries:** read-only; never submit forms; honor per-provider rate limits; check \`meta.data_tier\` + \`monitoring.coverage\` in /data/status.json.

| Goal | Endpoint |
|---|---|
| Coverage + freshness + entry links | GET /data/status.json |
| One best probed API for a task (+ curl + fallbacks) | GET /api/v1/best?task={goal} |
| Probed APIs only (slim index) | GET /data/index.json?probed=true |
| Full catalog (includes catalogued-only) | GET /data/index.json |
| Keyword search (add &probed=true to skip catalogued) | GET /api/v1/search?q={keywords} |
| Everything in one category | GET /data/categories/{category}.json |
| One API, full integration record | GET /api/v1/apis/{slug} |
| Is this API up? | GET /data/health.json or /api/v1/apis/{slug} |
| 90-day uptime + latency | GET /api/v1/apis/{slug}/history |
| Live probed alternative in a category | GET /api/v1/apis?category={cat}&probed=true (sorted by health; skip status dead/dying) |
| Schema changes | GET /changes.xml · GET /data/changes.json |
| Additions & deaths | GET /feed.xml · GET /graveyard.xml |

**Do not** guess base URLs. **Do not** cite health/uptime on \`status: "unmonitored"\` rows.

## @mcp-agent

\`${SITE}/mcp\` — streamable HTTP, no auth, stateless.

Tools: \`best_api\` · \`search_apis\` · \`get_api\` · \`get_api_health\` · \`list_categories\` · \`suggest_api_for_task\`

\`best_api\` and \`search_apis\` prefer probed APIs by default. Pass \`probed: true\` on search to exclude catalogued-only rows.

Claude Code: \`claude mcp add --transport http shipapis ${SITE}/mcp\`

\`\`\`json
{ "mcpServers": { "shipapis": { "url": "${SITE}/mcp" } } }
\`\`\`

## Data freshness

\`meta.data_tier\`: \`${dataTier()}\`.${dataTier() === 'dev-seed' ? ' Dev seed — health numbers are placeholders until tier reads `monitored`.' : ' Verify each record\'s `checked_at`.'}

Rate limit: ~60 req/min per IP on /api/v1/*; /data/* snapshots unlimited.

License: ${LICENSE}. Contact: ${CONTACT}.
`
  return c.body(md, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
})

/* ---------- robots, sitemap, api-catalog, openapi ---------- */

agentSurfaces.get('/robots.txt', (c) =>
  c.body(
    `# shipapis — crawl policy: everyone welcome, AI crawlers explicitly so.
# Agent entry points: /llms.txt · /agents.md · /data/index.json · /mcp
# /og-card/ paths are internal screenshot targets for the real OG images — skip them.

User-agent: *
Allow: /
Disallow: /og-card/
Disallow: /admin

# AI answer engines, assistants and training crawlers — retrieval and training both welcome.
# (One ruleset shared across the user-agents below; some AI bots only read their own record.)
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: anthropic-ai
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Amazonbot
User-agent: Meta-ExternalAgent
User-agent: cohere-ai
User-agent: DuckAssistBot
User-agent: CCBot
Allow: /
Disallow: /og-card/

Sitemap: ${SITE}/sitemap.xml
`,
    200,
    { 'Content-Type': 'text/plain; charset=utf-8' },
  ),
)

agentSurfaces.get('/sitemap.xml', (c) => {
  const apiLastmod = (a: ApiEntry) => {
    const dates = [a.addedAt, ...(a.diedAt ? [a.diedAt] : []), ...a.shapeChanges.map((s) => s.date)]
    return dates.sort().at(-1)!
  }
  const apis = catApis()
  // Real, data-derived lastmod only — uniform fake stamps are apimap's tell. Global freshness = the
  // most recent change anywhere; category freshness = the newest change among its members.
  const latest = apis.map(apiLastmod).sort().at(-1)
  const deadLatest = catDeadApis().map((a) => a.diedAt!).sort().at(-1)
  const catLastmod = (slug: string) => catApisInCategory(slug).map(apiLastmod).sort().at(-1)
  const loc = (path: string, lastmod?: string) =>
    `<url><loc>${SITE}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`

  // Pages whose content tracks the live catalog carry a real lastmod; static info pages carry none
  // (a lastmod we can't honestly source is worse than omitting it).
  const dynamicPaths: Array<readonly [string, string | undefined]> = [
    ['/', latest],
    ['/browse', latest],
    ['/state', latest],
    ['/signals', latest],
    ['/changelog', latest],
    ['/graveyard', deadLatest],
  ]
  const staticPaths = ['/start', '/agents', '/methodology', '/submit', '/about', '/privacy', '/terms']

  // Compare pages are submitted ONLY when we hold health data for BOTH APIs (and they share a
  // category — the loop enforces that). Between two unmonitored rows the sheet is a near-empty
  // template; shipping ~40k of those is the publicapis.io thin-page trap (MASTERPLAN §5.2). The
  // routes stay reachable for internal "VS" links — they're just kept out of the index until they
  // carry real signal. Slug-alphabetical matches each page's canonical, so no dup entries.
  const comparePaths = categories.flatMap((cat) => {
    const slugs = catApisInCategory(cat.slug).filter(isMonitored).map((a) => a.slug).sort()
    return slugs.flatMap((a, i) => slugs.slice(i + 1).map((b) => `/compare/${a}/${b}`))
  })

  const urls = [
    ...dynamicPaths.map(([p, lm]) => loc(p, lm)),
    ...staticPaths.map((p) => loc(p)),
    ...categories.map((cat) => loc(`/c/${cat.slug}`, catLastmod(cat.slug))),
    ...apis.map((a) => loc(`/api/${a.slug}`, apiLastmod(a))),
    ...comparePaths.map((p) => loc(p)),
  ]
  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
    200,
    { 'Content-Type': 'application/xml; charset=utf-8' },
  )
})

// RFC 9727 — one of a handful of real implementations on the internet (Δ4 #7). Zero expected traffic;
// exists so the flag is true, not aspirational.
agentSurfaces.get('/.well-known/api-catalog', (c) =>
  c.json(
    {
      linkset: [
        {
          anchor: `${SITE}/`,
          'service-desc': [{ href: `${SITE}/openapi.json`, type: 'application/openapi+json' }],
          'service-doc': [{ href: `${SITE}/agents`, type: 'text/html' }],
          'service-meta': [
            { href: `${SITE}/llms.txt`, type: 'text/plain' },
            { href: `${SITE}/agents.md`, type: 'text/markdown' },
            { href: `${SITE}/data/status.json`, type: 'application/json' },
          ],
        },
      ],
    },
    200,
    { 'Content-Type': 'application/linkset+json' },
  ),
)

agentSurfaces.get('/openapi.json', (c) => {
  const slimRef = { $ref: '#/components/schemas/SlimApi' }
  const listRef = { $ref: '#/components/schemas/ListApi' }
  const fullRef = { $ref: '#/components/schemas/FullApi' }
  const q = (name: string, description: string, schema: Record<string, unknown> = { type: 'string' }) => ({
    name, in: 'query', required: false, description, schema,
  })
  const slugParam = { name: 'slug', in: 'path', required: true, schema: { type: 'string' } }
  const ok = (schema: unknown, description = 'OK') => ({
    '200': { description, content: { 'application/json': { schema } } },
  })
  const listOf = (item: unknown) => ({
    type: 'object',
    properties: {
      meta: { type: 'object' },
      query: { type: 'object' },
      pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          count: { type: 'integer' },
          limit: { type: ['integer', 'null'] },
          offset: { type: 'integer' },
          has_more: { type: 'boolean' },
        },
      },
      links: { type: 'object' },
      count: { type: 'integer' },
      results: { type: 'array', items: item },
    },
  })
  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'shipapis meta-API',
      version: '1.0.0',
      description:
        'Free, no-auth JSON API over the shipapis catalog: free public APIs with live health data. Every payload carries meta.data_tier + meta.generated — verify freshness, do not assume it.',
      contact: { email: CONTACT, url: `${SITE}/agents` },
      license: { name: 'CC-BY-4.0', identifier: 'CC-BY-4.0' },
    },
    servers: [{ url: SITE }],
    paths: {
      '/api/v1/apis': {
        get: {
          summary: 'List APIs (integration-ready records)',
          parameters: [
            q('category', 'Category slug'), q('auth', 'none | apiKey | oauth | userAgent'), q('cors', 'yes | no | unknown'),
            q('agent', 'ok | blocked | unknown — server-side/agent reachability'), q('commercial', 'yes | no | unclear'),
            q('status', 'Lifecycle status'), q('sort', 'health (default) | latency'), q('probed', 'true — probed APIs only'),
            q('limit', 'Page size, max 100', { type: 'integer' }), q('offset', 'Pagination offset', { type: 'integer' }),
          ],
          responses: ok(listOf(listRef)),
        },
      },
      '/api/v1/apis/{slug}': {
        get: { summary: 'One API — full integration record', parameters: [slugParam], responses: { ...ok(fullRef), '404': { description: 'Unknown slug' } } },
      },
      '/api/v1/apis/{slug}/history': {
        get: { summary: 'Daily uptime + recent latency series', parameters: [slugParam], responses: { ...ok({ type: 'object' }), '404': { description: 'Unknown slug' } } },
      },
      '/api/v1/search': {
        get: {
          summary: 'Ranked keyword search (integration-ready records)',
          parameters: [
            { ...q('q', 'Keywords'), required: true }, q('category', 'Category slug'), q('auth', 'none | apiKey | oauth | userAgent'),
            q('cors', 'yes | no | unknown'), q('limit', 'Max results, cap 25', { type: 'integer' }), q('probed', 'true — probed APIs only'),
          ],
          responses: ok(listOf(listRef)),
        },
      },
      '/api/v1/best': {
        get: {
          summary: 'Single healthiest API for a task (+ ready curl + fallbacks)',
          parameters: [
            { ...q('task', 'What you are building, plain language'), required: true },
            q('auth', 'none | apiKey | oauth | userAgent'), q('cors', 'yes | no | unknown'),
            q('agent', 'ok | blocked | unknown'), q('commercial', 'yes | no | unclear'), q('category', 'Category slug'),
          ],
          responses: ok({ type: 'object', properties: { meta: { type: 'object' }, task: { type: 'string' }, note: { type: 'string' }, best: { oneOf: [fullRef, { type: 'null' }] }, alternatives: { type: 'array', items: listRef } } }),
        },
      },
      '/api/v1/categories': { get: { summary: 'Categories with counts', responses: ok({ type: 'object' }) } },
      '/api/v1/random': { get: { summary: 'One random healthy API', responses: ok(fullRef) } },
      '/data/index.json': { get: { summary: 'Slim discovery index — START HERE', responses: ok({ type: 'object' }) } },
      '/data/categories/{category}.json': {
        get: { summary: 'Full records for one category', parameters: [{ name: 'category', in: 'path', required: true, schema: { type: 'string' } }], responses: ok({ type: 'object' }) },
      },
      '/data/apis.json': { get: { summary: 'Full dump (prefer the slices)', responses: ok({ type: 'object' }) } },
      '/data/health.json': { get: { summary: 'Up/down snapshot keyed by slug', responses: ok({ type: 'object' }) } },
      '/data/status.json': { get: { summary: "shipapis' own monitoring freshness", responses: ok({ type: 'object' }) } },
    },
    components: {
      schemas: {
        SlimApi: {
          type: 'object',
          properties: {
            slug: { type: 'string' }, name: { type: 'string' }, emoji: { type: 'string' },
            logo_host: { type: ['string', 'null'], description: 'Provider hostname used for the favicon' },
            logo_url: { type: ['string', 'null'], description: 'Cached favicon URL on shipapis — null when no base_url/docs_url host' },
            category: { type: 'string' },
            description: { type: 'string' }, auth: { type: 'string', enum: ['none', 'apiKey', 'oauth', 'userAgent'] },
            cors: { type: 'string', enum: ['yes', 'no', 'unknown'] },
            agent_access: { type: 'string', enum: ['ok', 'blocked', 'unknown'] }, base_url: { type: 'string' },
            status: { type: 'string', enum: ['healthy', 'degraded', 'dying', 'dead', 'new', 'resurrected', 'unmonitored'] },
            health: { type: 'integer' }, uptime_pct: { type: ['number', 'null'] },
            monitored_since: { type: ['string', 'null'] }, p50_ms: { type: ['integer', 'null'] },
            checked_at: { type: 'string', format: 'date-time' },
          },
        },
        ListApi: {
          type: 'object',
          properties: {
            slug: { type: 'string' }, name: { type: 'string' }, emoji: { type: 'string' },
            logo_host: { type: ['string', 'null'] }, logo_url: { type: ['string', 'null'] },
            tagline: { type: 'string' },
            category: { type: 'string' }, auth: { type: 'string', enum: ['none', 'apiKey', 'oauth', 'userAgent'] },
            cors: { type: 'string', enum: ['yes', 'no', 'unknown'] }, https: { type: 'boolean' },
            agent_access: { type: 'string', enum: ['ok', 'blocked', 'unknown'] },
            commercial_use: { type: 'string', enum: ['yes', 'no', 'unclear'] }, requires_card: { type: 'boolean' },
            free_tier: { type: 'string' }, rate_limit: { type: 'string' },
            base_url: { type: 'string' }, docs_url: { type: 'string' },
            sample_endpoint: { type: 'string' }, sample_url: { type: 'string' }, sample_curl: { type: 'string' },
            endpoint_count: { type: 'integer' },
            endpoints: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  method: { type: 'string' }, path: { type: 'string' }, url: { type: 'string' },
                  description: { type: 'string' }, monitored: { type: 'boolean' },
                },
              },
            },
            status: { type: 'string' }, probed: { type: 'boolean' },
            health: { type: ['integer', 'null'] }, uptime_pct: { type: ['number', 'null'] },
            p50_ms: { type: ['integer', 'null'] }, p95_ms: { type: ['integer', 'null'] },
            checked_at: { type: ['string', 'null'], format: 'date-time' }, monitored_since: { type: ['string', 'null'] },
            links: {
              type: 'object',
              properties: {
                self: { type: 'string' }, history: { type: 'string' }, page: { type: 'string' }, badge: { type: 'string' },
                logo: { type: 'string', description: 'Same as logo_url — convenience link' },
              },
            },
          },
        },
        FullApi: {
          allOf: [
            slimRef,
            {
              type: 'object',
              properties: {
                tagline: { type: 'string' }, description: { type: 'string' }, docs_url: { type: 'string' },
                sample_endpoint: { type: 'string' }, sample_url: { type: 'string' }, sample_request_curl: { type: 'string' },
                sample_response: {}, https: { type: 'boolean' },
                commercial_use: { type: 'string', enum: ['yes', 'no', 'unclear'] }, data_license: { type: 'string' },
                free_tier: { type: 'string' }, rate_limit: { type: 'string' }, requires_card: { type: 'boolean' },
                p95_ms: { type: ['integer', 'null'] }, added_at: { type: 'string' },
                shape_changes: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, summary: { type: 'string' } } } },
                page_url: { type: 'string' }, badge_url: { type: 'string' },
              },
            },
          ],
        },
      },
    },
  })
})
