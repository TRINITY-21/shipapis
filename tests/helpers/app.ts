// Dispatch requests straight through the Hono app with no D1 binding. The Worker's documented
// seed-fallback (src/data/catalog.ts) means the whole app runs under Node — real routing,
// middleware, envelopes and SSR — without workerd or a database.
import { app } from '../../src/app'

const SITE = 'https://shipapis.dev'
const ENV = { DB: undefined } as never
const CTX = { waitUntil: () => {}, passThroughOnException: () => {} } as never

/** Fetch a path through the app. Never follows redirects (so 301/302 are observable). */
export function req(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : `${SITE}${path}`
  return app.fetch(new Request(url, init), ENV, CTX)
}

export async function getJson<T = any>(path: string, init?: RequestInit): Promise<{ res: Response; body: T }> {
  const res = await req(path, init)
  const body = (await res.json()) as T
  return { res, body }
}

export async function getText(path: string, init?: RequestInit): Promise<{ res: Response; text: string }> {
  const res = await req(path, init)
  return { res, text: await res.text() }
}

/** POST a JSON-RPC 2.0 message to /mcp. */
export function rpc(method: string, params?: Record<string, unknown>, id: string | number | null = 1) {
  const body: Record<string, unknown> = { jsonrpc: '2.0', method }
  if (id !== undefined) body.id = id
  if (params) body.params = params
  return req('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
