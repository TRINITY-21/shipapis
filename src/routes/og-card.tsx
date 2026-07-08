import type { Hono } from 'hono'
import { catBySlug } from '../data/catalog'
import { categoryBySlug } from '../data/seed'
import { OgApiCard, OgCatCard, OgHomeCard } from '../ui/og'
import { NotFound } from '../ui/pages/NotFound'
import type { Env } from '../workers/env'

/** Internal screenshot targets — `scripts/og.mjs` → `public/og/*.png`. */
export function registerOgCard(app: Hono<{ Bindings: Env }>) {
  // OG-image fallback: pre-rendered cards are served straight from static assets and never reach
  // the Worker, so this only fires for cards not yet generated (the imported/unmonitored catalog,
  // which scripts/og.mjs hasn't been re-run over). Redirect them to the always-present site card so
  // every page's og:image / twitter:image resolves to a real 200 image instead of a 404. Re-running
  // scripts/og.mjs later makes the real per-API/category cards start winning automatically.
  app.get('/og/:file', (c) =>
    /^(api|cat)-.+\.png$/.test(c.req.param('file')) ? c.redirect('/og/home.png', 302) : c.notFound(),
  )
  app.get('/og-card/home', (c) => c.html(<OgHomeCard />))
  app.get('/og-card/api/:slug', (c) => {
    const api = catBySlug().get(c.req.param('slug'))
    if (!api) return c.html(<NotFound />, 404)
    return c.html(<OgApiCard api={api} />)
  })
  app.get('/og-card/cat/:slug', (c) => {
    const slug = c.req.param('slug')
    if (!categoryBySlug.has(slug)) return c.html(<NotFound />, 404)
    return c.html(<OgCatCard slug={slug} />)
  })
}
