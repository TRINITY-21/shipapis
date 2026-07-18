import type { Hono } from 'hono'
import { catBySlug } from '../data/catalog'
import { categoryBySlug } from '../data/seed'
import {
    AboutPage,
    BrowsePage,
    CategoryPage,
    ChangelogPage,
    ComparePage,
    DetailPage,
    DevelopersPage,
    GraveyardPage,
    Home,
    MethodologyPage,
    NotFound,
    PrivacyPage,
    SignalsPage,
    StartPage,
    StatePage,
    SubmitPage,
    TermsPage,
} from '../ui/pages'
import type { Env } from '../workers/env'

export function registerPages(app: Hono<{ Bindings: Env }>) {
  app.get('/', (c) => c.html(<Home />))

  app.get('/browse', (c) => {
    const sort = c.req.query('sort')
    // Probed-only is the default view, served AT /browse rather than redirected to
    // /browse?facet=monitored — every browse variant canonicalises to /browse, so that target has to
    // be a 200. Pointing a canonical at a redirect leaves Google with no indexable browse URL.
    // ?facet=all opts out; a deep-linked ?q= is read client-side and needs nothing from us.
    const facet = c.req.query('facet') ?? 'monitored'
    return c.html(<BrowsePage sort={sort} facet={facet} />)
  })

  app.get('/c/:slug', (c) => {
    const slug = c.req.param('slug')
    if (!categoryBySlug.has(slug)) return c.html(<NotFound />, 404)
    return c.html(<CategoryPage slug={slug} />)
  })

  app.get('/api/:slug', (c) => {
    const api = catBySlug().get(c.req.param('slug'))
    if (!api) return c.html(<NotFound />, 404)
    return c.html(<DetailPage api={api} />)
  })

  app.get('/compare/:a/:b', (c) => {
    const a = catBySlug().get(c.req.param('a'))
    const b = catBySlug().get(c.req.param('b'))
    if (!a || !b) return c.html(<NotFound />, 404)
    return c.html(<ComparePage a={a} b={b} />)
  })

  app.get('/graveyard', (c) => c.html(<GraveyardPage />))
  app.get('/signals', (c) => c.html(<SignalsPage />))
  app.get('/changelog', (c) => c.html(<ChangelogPage />))
  app.get('/state', (c) => c.html(<StatePage />))
  app.get('/start', (c) => c.html(<StartPage />))
  app.get('/agents', (c) => c.html(<DevelopersPage />))
  // /developers is the pre-rename URL — 301 so any old inbound links consolidate onto /agents
  // instead of leaving a duplicate 200 (the canonical already points here, but a 301 is stronger).
  app.get('/developers', (c) => c.redirect('/agents', 301))
  app.get('/methodology', (c) => c.html(<MethodologyPage />))
  app.get('/submit', (c) => c.html(<SubmitPage siteKey={c.env.TURNSTILE_SITEKEY} />))
  app.get('/about', (c) => c.html(<AboutPage />))
  app.get('/privacy', (c) => c.html(<PrivacyPage />))
  app.get('/terms', (c) => c.html(<TermsPage />))

  app.notFound((c) => c.html(<NotFound />, 404))
}
