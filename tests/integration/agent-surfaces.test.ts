import { beforeAll, describe, expect, it } from 'vitest'
import { getJson, getText, req, rpc } from '../helpers/app'

let sampleSlug: string
beforeAll(async () => {
  const { body } = await getJson('/api/v1/apis?limit=1')
  sampleSlug = body.results[0].slug
})

describe('/data ladder', () => {
  it('index.json returns minimal discovery records with coverage', async () => {
    const { res, body } = await getJson('/data/index.json')
    expect(res.status).toBe(200)
    expect(Array.isArray(body.apis)).toBe(true)
    expect(body.apis[0]).toHaveProperty('slug')
    expect(body.meta.coverage).toHaveProperty('total')
    expect(body.meta.probed_only).toBe(false)
  })

  it('index.json?probed=true narrows to probed APIs', async () => {
    const full = (await getJson('/data/index.json')).body
    const probed = (await getJson('/data/index.json?probed=true')).body
    expect(probed.meta.probed_only).toBe(true)
    expect(probed.apis.length).toBeLessThanOrEqual(full.apis.length)
    expect(probed.apis.every((a: any) => a.status !== 'unmonitored')).toBe(true)
  })

  it('apis.json returns full records', async () => {
    const { res, body } = await getJson('/data/apis.json')
    expect(res.status).toBe(200)
    expect(body.apis[0]).toHaveProperty('sample_response')
  })

  it('health.json is keyed by slug with an ok flag', async () => {
    const { res, body } = await getJson('/data/health.json')
    expect(res.status).toBe(200)
    expect(body.apis[sampleSlug]).toHaveProperty('ok')
    expect(body.apis[sampleSlug]).toHaveProperty('status')
  })

  it('status.json reports monitoring provenance', async () => {
    const { res, body } = await getJson('/data/status.json')
    expect(res.status).toBe(200)
    expect(body.monitoring.data_tier).toBe('dev-seed')
    expect(body.monitoring.catalog).toHaveProperty('by_status')
    expect(body.monitoring.planned_cadence.per_api).toMatch(/12 hours/)
  })

  it('category slices resolve and validate the filename', async () => {
    const { res, body } = await getJson('/data/categories/weather.json')
    expect(res.status).toBe(200)
    expect(body.apis.every((a: any) => a.category === 'weather')).toBe(true)

    expect((await getJson('/data/categories/nope.json')).res.status).toBe(404)
    expect((await getJson('/data/categories/weather')).res.status).toBe(404) // not .json
  })

  it('apis.csv emits a CSV with the expected header', async () => {
    const { res, text } = await getText('/data/apis.csv')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(text.split('\n')[0]).toContain('slug,name,category')
  })
})

describe('text/xml agent surfaces', () => {
  it('llms.txt is plain text mentioning shipapis', async () => {
    const { res, text } = await getText('/llms.txt')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text.toLowerCase()).toContain('shipapis')
  })

  it('agents.md is markdown', async () => {
    const { res, text } = await getText('/agents.md')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/markdown')
    expect(text.length).toBeGreaterThan(100)
  })

  it('robots.txt allows crawling, welcomes AI crawlers, and points at the sitemap', async () => {
    const { res, text } = await getText('/robots.txt')
    expect(res.status).toBe(200)
    expect(text).toContain('User-agent: *')
    // AI answer-engine crawlers are explicitly named (some only honor their own record).
    for (const bot of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect(text, bot).toContain(`User-agent: ${bot}`)
    }
    expect(text).toContain('Sitemap: https://shipapis.dev/sitemap.xml')
  })

  it('sitemap.xml is a well-formed urlset with real per-URL lastmod', async () => {
    const { res, text } = await getText('/sitemap.xml')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('xml')
    expect(text).toContain('<urlset')
    expect(text).toContain('https://shipapis.dev/api/')
    expect(text).toContain('https://shipapis.dev/c/')
    // Data-tracking pages carry an ISO lastmod (data-derived, not a uniform fake stamp).
    expect(text).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/)
    // Compare pages are gated to monitored pairs, so the sitemap never explodes into thin templates.
    const compareCount = (text.match(/\/compare\//g) ?? []).length
    expect(compareCount).toBeLessThan(2000)
  })

  it('feed.xml is an RSS/XML feed', async () => {
    const { res, text } = await getText('/feed.xml')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('xml')
  })
})

describe('machine-readable specs', () => {
  it('openapi.json is a valid 3.1 spec covering the v1 routes', async () => {
    const { res, body } = await getJson('/openapi.json')
    expect(res.status).toBe(200)
    expect(body.openapi).toBe('3.1.0')
    expect(body.paths).toHaveProperty('/api/v1/apis')
    expect(body.paths).toHaveProperty('/api/v1/search')
    expect(body.servers[0].url).toBe('https://shipapis.dev')
  })

  it('.well-known/api-catalog is an RFC 9727 linkset', async () => {
    const { res, body } = await getJson('/.well-known/api-catalog')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('linkset+json')
    expect(Array.isArray(body.linkset)).toBe(true)
    expect(body.linkset[0]['service-desc'][0].href).toContain('/openapi.json')
  })
})

describe('machine headers & CORS', () => {
  it('sets baseline security headers on HTML', async () => {
    const res = await req('/')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(res.headers.get('strict-transport-security')).toContain('max-age=')
  })

  it('serves the IndexNow ownership key file', async () => {
    const { res, text } = await getText('/shipapis-indexnow-7f3c9a2e.txt')
    expect(res.status).toBe(200)
    expect(text.trim()).toBe('shipapis-indexnow-7f3c9a2e')
  })

  it('sets an open CORS header on machine routes', async () => {
    const res = await req('/data/index.json')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('answers CORS preflight with 204', async () => {
    const res = await req('/data/index.json', { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('MCP server (/mcp)', () => {
  it('GET returns discovery metadata with open CORS (middleware must wrap /mcp)', async () => {
    const { res, body } = await getJson('/mcp')
    expect(res.status).toBe(200)
    expect(body.name).toBe('shipapis')
    expect(body.tools).toContain('best_api')
    expect(body.tools.length).toBe(6)
    // Regression guard: /mcp must be registered AFTER the app.use() middleware so withCatalog
    // (the D1 read path) and machineHeaders (CORS) apply. ACAO proves machineHeaders ran.
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('never caches the POST RPC endpoint and sets CORS', async () => {
    const res = await rpc('ping')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('handles initialize', async () => {
    const res = await rpc('initialize')
    const body = await res.json()
    expect(body.result.serverInfo.name).toBe('shipapis')
    expect(body.result.protocolVersion).toBeTruthy()
  })

  it('lists all six tools', async () => {
    const res = await rpc('tools/list')
    const body = await res.json()
    const names = body.result.tools.map((t: any) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['best_api', 'search_apis', 'get_api', 'get_api_health', 'list_categories', 'suggest_api_for_task']),
    )
  })

  it('calls best_api and returns structured content', async () => {
    const res = await rpc('tools/call', { name: 'best_api', arguments: { task: 'current weather forecast' } })
    const body = await res.json()
    expect(body.result.isError).toBe(false)
    expect(body.result.structuredContent.best).toHaveProperty('slug')
  })

  it('calls get_api for a known slug', async () => {
    const res = await rpc('tools/call', { name: 'get_api', arguments: { slug: sampleSlug } })
    const body = await res.json()
    expect(body.result.structuredContent.api.slug).toBe(sampleSlug)
  })

  it('calls get_api_health with a usable verdict', async () => {
    const res = await rpc('tools/call', { name: 'get_api_health', arguments: { slug: sampleSlug } })
    const body = await res.json()
    expect(body.result.structuredContent.slug).toBe(sampleSlug)
    expect(body.result.structuredContent).toHaveProperty('verdict')
    expect(body.result.structuredContent).toHaveProperty('uptime_pct_90d')
  })

  it('calls list_categories', async () => {
    const res = await rpc('tools/call', { name: 'list_categories', arguments: {} })
    const body = await res.json()
    expect(body.result.structuredContent.count).toBeGreaterThan(0)
    expect(Array.isArray(body.result.structuredContent.categories)).toBe(true)
  })

  it('calls suggest_api_for_task', async () => {
    const res = await rpc('tools/call', { name: 'suggest_api_for_task', arguments: { description: 'convert USD to EUR' } })
    const body = await res.json()
    expect(body.result.structuredContent).toHaveProperty('suggestions')
  })

  it('returns a tool-level not_found for an unknown slug (isError=true)', async () => {
    const res = await rpc('tools/call', { name: 'get_api', arguments: { slug: 'no-such-slug' } })
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.structuredContent.error).toBe('not_found')
  })

  it('flags an unknown tool with a JSON-RPC error', async () => {
    const res = await rpc('tools/call', { name: 'does_not_exist', arguments: {} })
    const body = await res.json()
    expect(body.error.code).toBe(-32602)
  })

  it('returns a parse error for non-JSON bodies', async () => {
    const res = await req('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe(-32700)
  })

  it('accepts a notification (no id) with 202 and no body', async () => {
    const res = await req('/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    })
    expect(res.status).toBe(202)
  })

  it('rejects an unknown method', async () => {
    const res = await rpc('no/such/method')
    const body = await res.json()
    expect(body.error.code).toBe(-32601)
  })
})

describe('routing middleware', () => {
  it('applies the default edge cache to HTML pages', async () => {
    const res = await req('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('stale-while-revalidate')
  })

  it('301-redirects duplicate slashes to the canonical path', async () => {
    const res = await req('/data//index.json')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toContain('/data/index.json')
  })

  it('301-redirects a trailing slash away', async () => {
    const res = await req('/api/v1/categories/')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toMatch(/\/api\/v1\/categories$/)
  })
})
