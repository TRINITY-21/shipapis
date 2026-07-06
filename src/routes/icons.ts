import type { Hono } from 'hono'
import { brandLogoHost } from '../data/api-logo'
import type { Env } from '../workers/env'

const HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
const CACHE_VER = 'v3'

const iconSources = (host: string, sz: number) => {
  const page = encodeURIComponent(`https://${host}/`)
  const hi = [
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${page}&size=${sz}`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${sz}`,
  ]
  const lo =
    sz <= 32
      ? [
          `https://${host}/favicon.ico`,
          `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
        ]
      : [`https://${host}/favicon.ico`]
  return [...hi, ...lo]
}

function hostsToTry(host: string): string[] {
  const brand = brandLogoHost(host)
  return brand && brand !== host ? [brand, host] : [host]
}

export function registerIcons(app: Hono<{ Bindings: Env }>) {
  app.get('/icons/:host', async (c) => {
    const host = decodeURIComponent(c.req.param('host')).toLowerCase()
    if (!HOST_RE.test(host)) return c.text('bad host', 400)

    const sz = Math.min(128, Math.max(16, Number(c.req.query('sz')) || 64))
    const cache = caches.default
    const cacheKey = new Request(`https://icons.shipapis.dev/${CACHE_VER}/${host}?sz=${sz}`)
    const cached = await cache.match(cacheKey)
    if (cached) return cached

    const minBytes = sz >= 64 ? 900 : 32

    for (const h of hostsToTry(host)) {
      for (const url of iconSources(h, sz)) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'shipapisbot/1.0 (+https://shipapis.dev)' },
            cf: { cacheTtl: 604800 },
          })
          const type = res.headers.get('content-type') ?? ''
          if (!res.ok || !type.startsWith('image/')) continue
          const body = await res.arrayBuffer()
          if (body.byteLength < minBytes) continue
          const out = new Response(body, {
            headers: {
              'Content-Type': type.split(';')[0],
              'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
            },
          })
          c.executionCtx.waitUntil(cache.put(cacheKey, out.clone()))
          return out
        } catch {
          /* try next source */
        }
      }
    }

    return c.text('not found', 404)
  })
}
