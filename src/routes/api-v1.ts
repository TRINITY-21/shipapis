import type { Hono } from 'hono'
import { catApis, catBySlug, catLiveApis, isMonitored } from '../data/catalog'
import { apiListEnvelope, bestApiForTask, categoryCounts, fullShape, listShape, payloadMeta, searchApis } from '../data/shapes'
import type { Env } from '../workers/env'

const probedQuery = (raw?: string) => raw === 'true' || raw === '1'

export function registerApiV1(app: Hono<{ Bindings: Env }>) {
  app.get('/api/v1/apis', (c) => {
    let list = [...catApis()]
    const { category, auth, cors, status, agent, commercial, sort, probed, limit: limitRaw, offset: offsetRaw } = c.req.query()
    if (category) list = list.filter((a) => a.category === category)
    if (auth) list = list.filter((a) => a.auth === auth)
    if (cors) list = list.filter((a) => a.cors === cors)
    if (status) list = list.filter((a) => a.status === status)
    if (agent) list = list.filter((a) => a.agentAccess === agent)
    if (commercial) list = list.filter((a) => a.commercialUse === commercial)
    if (probedQuery(probed)) list = list.filter(isMonitored)
    if (sort === 'health' || !sort) list.sort((a, b) => b.healthScore - a.healthScore)
    if (sort === 'latency') list.sort((a, b) => (a.p50 || 1e9) - (b.p50 || 1e9))
    const limit = limitRaw ? Math.min(Math.max(1, Number(limitRaw) || 25), 100) : undefined
    const offset = offsetRaw ? Math.max(0, Number(offsetRaw) || 0) : 0
    const total = list.length
    const page = limit != null ? list.slice(offset, offset + limit) : offset > 0 ? list.slice(offset) : list
    const query = {
      ...(category ? { category } : {}),
      ...(auth ? { auth } : {}),
      ...(cors ? { cors } : {}),
      ...(status ? { status } : {}),
      ...(agent ? { agent } : {}),
      ...(commercial ? { commercial } : {}),
      ...(sort ? { sort } : {}),
      ...(probedQuery(probed) ? { probed: true } : {}),
      ...(limit != null ? { limit } : {}),
      ...(offset > 0 ? { offset } : {}),
    }
    return c.json(
      apiListEnvelope(page, {
        total,
        query,
        path: '/api/v1/apis',
        requestUrl: c.req.url,
      }),
    )
  })

  app.get('/api/v1/apis/:slug/history', (c) => {
    const api = catBySlug().get(c.req.param('slug'))
    if (!api) return c.json({ error: 'not_found' }, 404)
    const now = new Date()
    const axis = Array.from({ length: 90 }, (_, i) =>
      new Date(now.getTime() - (89 - i) * 86_400_000).toISOString().slice(0, 10),
    )
    return c.json({
      meta: payloadMeta(),
      slug: api.slug,
      days: axis.map((day, i) => ({ day, uptime: (api.uptime90?.[i] ?? -1) < 0 ? null : api.uptime90![i] })),
      latency_recent_ms: api.latency48 ?? [],
    })
  })

  app.get('/api/v1/apis/:slug', (c) => {
    const api = catBySlug().get(c.req.param('slug'))
    if (!api) return c.json({ error: 'not_found' }, 404)
    return c.json({ meta: payloadMeta(), ...fullShape(api) })
  })

  app.get('/api/v1/search', (c) => {
    const { q, category, auth, cors, status, limit, probed } = c.req.query()
    if (!q) {
      return c.json(
        { error: 'missing_query', hint: 'GET /api/v1/search?q=keywords — filters: category, auth, cors, status, probed=true, limit' },
        400,
      )
    }
    const cap = Math.min(Math.max(1, Number(limit) || 10), 25)
    const results = searchApis(q, { category, auth, cors, status, probed: probedQuery(probed) }, cap)
    return c.json(
      apiListEnvelope(results, {
        total: results.length,
        query: {
          q,
          ...(category ? { category } : {}),
          ...(auth ? { auth } : {}),
          ...(cors ? { cors } : {}),
          ...(status ? { status } : {}),
          ...(probedQuery(probed) ? { probed: true } : {}),
          limit: cap,
        },
        path: '/api/v1/search',
        requestUrl: c.req.url,
        hint: 'Ranked keyword search — integration-ready records. GET /api/v1/apis/{slug} for sample JSON.',
      }),
    )
  })

  app.get('/api/v1/best', (c) => {
    const { task, category, auth, cors, agent, commercial, include_catalogued } = c.req.query()
    if (!task) {
      return c.json(
        {
          error: 'missing_task',
          hint: 'GET /api/v1/best?task=what+you+are+building — prefers probed APIs. Filters: auth, cors, agent, commercial, category. Add include_catalogued=true to allow catalogued-only fallback.',
        },
        400,
      )
    }
    const { best, alternatives, note } = bestApiForTask(
      task,
      { category, auth, cors, agent, commercial },
      { include_catalogued: probedQuery(include_catalogued) },
    )
    if (!best) return c.json({ meta: payloadMeta(), error: 'no_match', hint: note }, 404)
    return c.json({
      meta: payloadMeta(),
      note,
      best: fullShape(best),
      alternatives: alternatives.map(listShape),
    })
  })

  app.get('/api/v1/categories', (c) => {
    const results = categoryCounts()
    return c.json({ meta: payloadMeta(), count: results.length, results })
  })

  app.get('/api/v1/random', (c) => {
    const pool = catLiveApis().filter((a) => a.status === 'healthy' || a.status === 'new' || a.status === 'resurrected')
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (!pick) return c.json({ meta: payloadMeta(), error: 'no_match' }, 404)
    return c.json({ meta: payloadMeta(), ...fullShape(pick) })
  })
}
