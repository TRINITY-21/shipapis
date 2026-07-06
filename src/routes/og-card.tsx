import type { Hono } from 'hono'
import { catBySlug } from '../data/catalog'
import { categoryBySlug } from '../data/seed'
import { OgApiCard, OgCatCard, OgHomeCard } from '../ui/og'
import { NotFound } from '../ui/pages/NotFound'
import type { Env } from '../workers/env'

/** Internal screenshot targets — `scripts/og.mjs` → `public/og/*.png`. */
export function registerOgCard(app: Hono<{ Bindings: Env }>) {
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
