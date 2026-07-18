import { Hono } from 'hono'
import { trimTrailingSlash } from 'hono/trailing-slash'
import { agentSurfaces, machineHeaders } from './agents/agent-surfaces'
import { withCatalog } from './data/catalog'
import { securityHeaders } from './middleware/security-headers'
import { registerAdmin } from './routes/admin'
import { registerApiV1 } from './routes/api-v1'
import { registerBadge } from './routes/badge'
import { registerIcons } from './routes/icons'
import { registerIndexNow } from './routes/indexnow'
import { registerMcp } from './routes/mcp'
import { registerOgCard } from './routes/og-card'
import { registerPages } from './routes/pages'
import { registerSubmit } from './routes/submit'
import { registerSubscribe } from './routes/subscribe'
import type { Env } from './workers/env'
import { shouldEmitAnalytics, withRequestConfig } from './workers/request-config'

export function createApp() {
  const app = new Hono<{ Bindings: Env }>()

  /* www → apex: 301 any www.shipapis.dev request to the bare domain, so there's one canonical host. */
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url)
    if (url.hostname === 'www.shipapis.dev') {
      url.hostname = 'shipapis.dev'
      return c.redirect(url.toString(), 301)
    }
    await next()
  })

  /* Edge-cache successful GET/HEAD responses so repeat traffic is served from Cloudflare's cache
     without invoking this Worker or reading D1 — the biggest lever for staying inside the free
     tier (100k req/day, 5M D1-reads/day). Health refreshes on the ~15-min cron, so a short shared
     TTL with stale-while-revalidate keeps pages fresh while collapsing origin load. Routes that set
     their own Cache-Control (icons, badges, machine surfaces) are left untouched by the guard. */
  app.use('*', async (c, next) => {
    await next()
    if (
      (c.req.method === 'GET' || c.req.method === 'HEAD') &&
      c.res.status === 200 &&
      !c.res.headers.has('Cache-Control')
    ) {
      c.res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    }
  })

  app.use('*', securityHeaders)

  /* /api//slug → /api/slug — collapse duplicate slashes before routing (301 canonical). */
  app.use('*', async (c, next) => {
    const url = new URL(c.req.url)
    const normalized = url.pathname.replace(/\/{2,}/g, '/')
    if (normalized !== url.pathname) {
      url.pathname = normalized
      if (c.req.method === 'GET' || c.req.method === 'HEAD') return c.redirect(url.toString(), 301)
    }
    await next()
  })

  app.use(trimTrailingSlash())
  app.use('*', async (c, next) => {
    // Analytics: prod host only, and never in `wrangler dev` (LOCAL_DEV in .dev.vars).
    const analytics = shouldEmitAnalytics(new URL(c.req.url).hostname, c.env.LOCAL_DEV === '1')
    return withRequestConfig({ gaMeasurementId: c.env.GA_MEASUREMENT_ID, analytics }, () =>
      withCatalog(c.env.DB, () => next()),
    )
  })

  app.use('/data/*', machineHeaders)
  app.use('/api/v1/*', machineHeaders)
  app.use('/mcp', machineHeaders)
  app.use('/.well-known/*', machineHeaders)
  app.use('/llms.txt', machineHeaders)
  app.use('/agents.md', machineHeaders)
  app.use('/robots.txt', machineHeaders)
  app.use('/sitemap.xml', machineHeaders)
  app.use('/feed.xml', machineHeaders)
  app.use('/graveyard.xml', machineHeaders)
  app.use('/changes.xml', machineHeaders)

  // Registered AFTER the middleware above so /mcp is wrapped by withCatalog (the D1 read path) and
  // machineHeaders (CORS + no-store) — Hono only applies middleware to routes registered after it.
  registerMcp(app)

  registerApiV1(app)
  app.route('/', agentSurfaces)
  registerIcons(app)
  registerSubmit(app)
  registerSubscribe(app)
  registerIndexNow(app)
  // Before registerPages so the console's routes are matched by their own handlers, and after the
  // withCatalog middleware above so the overview can read catalog counts.
  registerAdmin(app)
  registerPages(app)
  registerBadge(app)
  registerOgCard(app)

  return app
}

export const app = createApp()
