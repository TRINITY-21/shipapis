// /mcp — stateless MCP server over streamable HTTP (plain JSON responses, no sessions, no SSE).
// MASTERPLAN Δ3: current stable protocol semantics tolerated (initialize accepted, session headers
// ignored), stateless per the 2026-07-28 direction. Five search-shaped tools — never one per API.
// Anti-apimap insurance: this module must answer for real on every deploy (scripts/check-links.mjs
// hits it; a dedicated smoke test lands with CI).

import type { Context } from 'hono'
import { catBySlug, isMonitored } from '../data/catalog'
import { categories } from '../data/seed'
import {
    bestApiForTask,
    categoryCounts,
    checkedAtIso,
    dataTier,
    fullShape,
    listShape,
    payloadMeta,
    searchApis,
    uptimeNum,
} from '../data/shapes'

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = {
  name: 'shipapis',
  title: 'shipapis — free API directory with probed health data',
  version: '0.1.0',
}

const instructions = () =>
  [
    'shipapis is a directory of free public APIs — probed endpoints carry live health data; catalogued-only rows have status unmonitored.',
    'Start: best_api {task} for one probed answer + curl + fallbacks. Or GET /data/status.json for coverage.',
    "Then get_api for the full record before codegen. Treat status 'healthy' OR 'new' as usable ('new' = probed recently, live but little history); avoid 'dead'/'dying'/'degraded'. Don't require 'healthy' alone — a young catalog is mostly 'new'. Never guess base URLs.",
    'search_apis supports probed:true to skip catalogued-only imports. suggest_api_for_task ranks candidates.',
    dataTier() === 'monitored'
      ? "Data tier is 'monitored': verify recency via each record's checked_at."
      : "Data tier is 'dev-seed': treat health numbers as placeholders until data_tier reads 'monitored'.",
  ].join(' ')

/* ---------- tool registry ---------- */

interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  run: (args: Record<string, unknown>) => unknown
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

const bool = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1'

const TOOLS: ToolDef[] = [
  {
    name: 'best_api',
    description:
      'Return the SINGLE best free API for a task — prefers probed APIs on our check schedule. Includes copy-ready curl and fallback alternatives. Catalogued-only fallback is explicitly labeled when no probed match exists.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'What you are building (e.g. "geocode an address", "current BTC price")' },
        auth: { type: 'string', enum: ['none', 'apiKey', 'oauth', 'userAgent'] },
        cors: { type: 'string', enum: ['yes', 'no', 'unknown'] },
        agent: { type: 'string', enum: ['ok', 'blocked', 'unknown'] },
        commercial: { type: 'string', enum: ['yes', 'no', 'unclear'] },
        category: { type: 'string', description: 'Category slug' },
        include_catalogued: { type: 'boolean', description: 'Allow catalogued-only (unmonitored) APIs when no probed match exists. Default: still returned as fallback but note warns you.' },
      },
      required: ['task'],
    },
    run: (args) => {
      const { best, alternatives, note } = bestApiForTask(str(args.task) ?? '', {
        auth: str(args.auth), cors: str(args.cors), agent: str(args.agent), commercial: str(args.commercial), category: str(args.category),
      }, { include_catalogued: bool(args.include_catalogued) })
      if (!best) return { error: 'no_match', hint: note }
      return {
        meta: payloadMeta(),
        note,
        best: fullShape(best),
        alternatives: alternatives.map(listShape),
      }
    },
  },
  {
    name: 'search_apis',
    description:
      'Search the catalog by keyword. Returns integration-ready records (base_url, sample_curl, top endpoints). Set probed:true to exclude catalogued-only imports. Use get_api on a slug for sample JSON + full endpoint list.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords — name, topic or category (e.g. "weather forecast", "crypto prices")' },
        category: { type: 'string', description: `Filter by category slug: ${categories.map((c) => c.slug).join(', ')}` },
        auth: { type: 'string', enum: ['none', 'apiKey', 'oauth', 'userAgent'] },
        cors: { type: 'string', enum: ['yes', 'no', 'unknown'] },
        agent: { type: 'string', enum: ['ok', 'blocked', 'unknown'] },
        status: { type: 'string', description: 'Lifecycle status: healthy, degraded, dying, dead, new, resurrected, unmonitored' },
        probed: { type: 'boolean', description: 'When true, only APIs on our probe schedule (excludes catalogued-only)' },
        limit: { type: 'number', description: 'Max results, default 10, cap 25' },
      },
      required: ['query'],
    },
    run: (args) => {
      const results = searchApis(
        str(args.query) ?? '',
        {
          category: str(args.category), auth: str(args.auth), cors: str(args.cors), status: str(args.status),
          agent: str(args.agent), probed: bool(args.probed) || undefined,
        },
        num(args.limit) ?? 10,
      )
      return {
        meta: payloadMeta(),
        count: results.length,
        results: results.map(listShape),
        ...(results.length === 0
          ? { hint: `No match. Try broader keywords or list_categories — categories: ${categories.map((c) => c.slug).join(', ')}` }
          : { hint: 'Records include sample_curl and top endpoints. Call get_api {slug} for sample JSON + schema history.' }),
      }
    },
  },
  {
    name: 'get_api',
    description:
      'Full integration record for one API by slug: base_url, auth mechanics, free-tier fine print, commercial-use verdict, copy-ready curl, sample response, schema-change history, live health.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'API slug from search_apis results' } },
      required: ['slug'],
    },
    run: (args) => {
      const api = catBySlug().get(str(args.slug) ?? '')
      if (!api) return { error: 'not_found', hint: 'Unknown slug — find valid slugs via search_apis or list_categories.' }
      return { meta: payloadMeta(), api: fullShape(api) }
    },
  },
  {
    name: 'get_api_health',
    description:
      'Health detail for one API: lifecycle status, health score, 90/30-day uptime, latency percentiles, recent schema changes. Check this before committing to a provider.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', description: 'API slug' } },
      required: ['slug'],
    },
    run: (args) => {
      const api = catBySlug().get(str(args.slug) ?? '')
      if (!api) return { error: 'not_found', hint: 'Unknown slug — find valid slugs via search_apis.' }
      return {
        meta: payloadMeta(),
        slug: api.slug,
        name: api.name,
        status: api.status,
        health: api.healthScore < 0 ? null : api.healthScore, // -1 = unmonitored, not a real score
        uptime_pct_90d: uptimeNum(api, 90),
        uptime_pct_30d: uptimeNum(api, 30),
        p50_ms: api.p50 || null,
        p95_ms: api.p95 || null,
        checked_at: checkedAtIso(api),
        monitored_since: api.monitoredSince,
        shape_changes: api.shapeChanges,
        ...(api.diedAt ? { died_at: api.diedAt } : {}),
        verdict:
          api.status === 'unmonitored'
            ? 'Not probed by shipapis yet — no health history. Use docs_url; do not cite health/uptime fields.'
            : api.status === 'healthy'
            ? 'Safe to build on.'
            : api.status === 'dead'
              ? 'Dead — do not use. Ask search_apis for a live alternative in the same category.'
              : 'Unstable — have a fallback, or pick a healthy alternative from the same category.',
      }
    },
  },
  {
    name: 'list_categories',
    description: 'All catalog categories with API counts — the map of what the directory covers.',
    inputSchema: { type: 'object', properties: {} },
    run: () => ({ meta: payloadMeta(), count: categories.length, categories: categoryCounts() }),
  },
  {
    name: 'suggest_api_for_task',
    description:
      'Describe what you are building in plain language ("show weather for a city", "convert USD to EUR") and get ranked, health-checked API suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'The task, in plain language' },
        probed: { type: 'boolean', description: 'When true, only probed APIs (excludes catalogued-only)' },
        limit: { type: 'number', description: 'Max suggestions, default 5' },
      },
      required: ['description'],
    },
    run: (args) => {
      const results = searchApis(str(args.description) ?? '', { probed: bool(args.probed) || undefined }, num(args.limit) ?? 8)
      const probed = results.filter(isMonitored)
      const pool = bool(args.probed) ? probed : probed.length ? probed : results
      const live = pool.filter((a) => a.status !== 'dead').slice(0, num(args.limit) ?? 5)
      return {
        meta: payloadMeta(),
        count: live.length,
        suggestions: live.map((a) => ({
          ...listShape(a),
          why: a.tagline,
          next: `get_api {"slug":"${a.slug}"} for sample JSON + full endpoint list`,
        })),
        ...(live.length === 0
          ? { hint: `Nothing matched. The catalog currently covers: ${categories.map((c) => c.name).join(', ')}.` }
          : {}),
      }
    },
  },
]

/* ---------- JSON-RPC plumbing ---------- */

type RpcId = string | number | null
interface RpcRequest {
  jsonrpc?: string
  id?: RpcId
  method?: string
  params?: Record<string, unknown>
}

const rpcResult = (id: RpcId, result: unknown) => ({ jsonrpc: '2.0', id, result })
const rpcError = (id: RpcId, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })

function handleRpc(req: RpcRequest): Record<string, unknown> | null {
  const id = req.id ?? null
  const isNotification = req.id === undefined
  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return isNotification ? null : rpcError(id, -32600, 'Invalid Request')
  }
  if (req.method.startsWith('notifications/')) return null

  switch (req.method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: instructions(),
      })
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      })
    case 'tools/call': {
      const name = str(req.params?.name)
      const tool = TOOLS.find((t) => t.name === name)
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name ?? '(missing name)'}`)
      try {
        const payload = tool.run((req.params?.arguments as Record<string, unknown>) ?? {})
        const isErr = typeof payload === 'object' && payload !== null && 'error' in payload
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload,
          isError: isErr,
        })
      } catch (e) {
        return rpcResult(id, {
          content: [{ type: 'text', text: `Tool failed: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        })
      }
    }
    default:
      return isNotification ? null : rpcError(id, -32601, `Method not found: ${req.method}`)
  }
}

/* ---------- HTTP transport (stateless: session headers accepted and ignored) ---------- */

export async function mcpPost(c: Context): Promise<Response> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(rpcError(null, -32700, 'Parse error: body must be JSON-RPC 2.0'), 400)
  }
  const messages = Array.isArray(body) ? body : [body]
  if (messages.length === 0) return c.json(rpcError(null, -32600, 'Invalid Request: empty batch'), 400)
  const responses = messages
    .map((m) => handleRpc(m as RpcRequest))
    .filter((r): r is Record<string, unknown> => r !== null)
  if (responses.length === 0) return c.body(null, 202) // notifications only
  return c.json(Array.isArray(body) ? responses : responses[0])
}

/** GET /mcp — discovery JSON for clients that probe before POSTing RPC. */
export function mcpGet(c: Context): Response {
  return c.json({
    name: SERVER_INFO.name,
    transport: 'streamable-http',
    protocol: PROTOCOL_VERSION,
    message: 'POST JSON-RPC 2.0 to this endpoint. SSE streaming is not offered; responses are plain JSON.',
    tools: TOOLS.map((t) => t.name),
    install: 'claude mcp add --transport http shipapis https://shipapis.dev/mcp',
  })
}
