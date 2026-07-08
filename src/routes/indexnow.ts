import type { Hono } from 'hono'
import { SITE } from '../ui/lib/constants'
import type { Env } from '../workers/env'

/** Public IndexNow key file — search engines verify ownership by GETting /{key}.txt */
export const INDEXNOW_KEY = 'shipapis-indexnow-7f3c9a2e'

/**
 * IndexNow — notify Bing (and other IndexNow hosts) when sitemap URLs change.
 * POST /indexnow with { "urls": ["https://shipapis.dev/api/foo"] } (or {"host", "key", "urlList"}).
 * When INDEXNOW_KEY secret/var is unset we still serve the key file for ownership; pinging is a
 * no-op without network — callers can POST directly to api.indexnow.org themselves.
 */
export function registerIndexNow(app: Hono<{ Bindings: Env }>) {
  app.get(`/${INDEXNOW_KEY}.txt`, (c) =>
    c.body(INDEXNOW_KEY, 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }),
  )

  app.post('/indexnow', async (c) => {
    let body: { urls?: string[]; urlList?: string[] }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ ok: false, error: 'Expected JSON body with urls[]' }, 400)
    }
    const raw = body.urls ?? body.urlList ?? []
    const urls = raw
      .filter((u): u is string => typeof u === 'string')
      .map((u) => u.trim())
      .filter((u) => u.startsWith(`${SITE}/`))
      .slice(0, 10_000)

    if (!urls.length) return c.json({ ok: false, error: 'No shipapis.dev urls to submit.' }, 400)

    const payload = {
      host: 'shipapis.dev',
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }

    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      })
      // IndexNow returns 200/202 on accept; 422/ etc. on reject — surface status, don't throw.
      return c.json({ ok: res.ok || res.status === 202, status: res.status, submitted: urls.length }, res.ok || res.status === 202 ? 200 : 502)
    } catch {
      return c.json({ ok: false, error: 'IndexNow host unreachable.' }, 502)
    }
  })
}
