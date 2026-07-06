import type { FC } from 'hono/jsx'
import { catBySlug, catalogCounts } from '../../../data/catalog'
import { homeApiListPreview } from '../../../data/shapes'
import { esc, hlJson } from '../../lib/format'
import { Chev } from '../Chev'

const META_ENDPOINTS = [
  { path: '/api/v1/best?task=', desc: 'One probed answer + curl', tag: 'start here' },
  { path: '/api/v1/apis', desc: 'List with filters & pagination' },
  { path: '/api/v1/apis/{slug}', desc: 'Full record + sample JSON' },
  { path: '/mcp', desc: 'MCP — best_api, search_apis, get_api' },
] as const

const hrefFor = (path: string) => {
  if (path === '/mcp') return '/agents#mcp'
  if (path.includes('{slug}')) return '/api/v1/apis/open-meteo'
  if (path.endsWith('?task=')) return '/api/v1/best?task=weather+forecast'
  return path
}

/** The Signal — meta-API surface + email when the catalog moves. One section, not two. */
export const SignalSection: FC = () => {
  const coverage = catalogCounts()
  const featured = ['open-meteo', 'sunrise-sunset'].map((s) => catBySlug().get(s)!)
  const curl = `curl 'https://shipapis.dev/api/v1/apis?category=weather&auth=none&limit=2'`
  const preview = homeApiListPreview(featured, { category: 'weather', auth: 'none', limit: 2 })

  return (
    <section class="signal-section" aria-labelledby="signal-h">
      <div class="wrap">
        <header class="signal-head">
          <span class="k signal-eyebrow">THE SIGNAL</span>
          <h2 id="signal-h">This directory is itself a free API.</h2>
          <p class="signal-lead">
            Query the catalog, health scores, and routes — same data as the site, no key.
          </p>
          <dl class="signal-stats" aria-label="Catalog coverage">
            <div class="signal-stat">
              <dt class="k">APIs in catalog</dt>
              <dd class="num">{coverage.total.toLocaleString()}</dd>
            </div>
            <div class="signal-stat">
              <dt class="k">APIs · on schedule</dt>
              <dd class="num">{coverage.scheduled.toLocaleString()}</dd>
            </div>
            <div class="signal-stat">
              <dt class="k">APIs · probed</dt>
              <dd class="num">{coverage.monitored.toLocaleString()}</dd>
            </div>
            <div class="signal-stat">
              <dt class="k">Routes · documented</dt>
              <dd class="num">{coverage.routesDocumented.toLocaleString()}</dd>
            </div>
          </dl>
        </header>

        <div class="signal-platform platform platform-compact">
          <div class="platform-grid">
            <div class="platform-side">
              <span class="k">Meta-API · v1 · no auth</span>
              <nav class="meta-eps" aria-label="shipapis meta-API routes">
                {META_ENDPOINTS.map((ep) => (
                  <a class={`meta-ep${'tag' in ep ? ' meta-ep-primary' : ''}`} href={hrefFor(ep.path)}>
                    <span class="meta-ep-line">
                      <span class="ep-method ep-method-get">GET</span>
                      <code class="meta-ep-path">{ep.path}</code>
                      {'tag' in ep && <span class="meta-ep-tag">{ep.tag}</span>}
                    </span>
                    <span class="meta-ep-desc">{ep.desc}</span>
                  </a>
                ))}
                <a class="meta-ep meta-ep-more" href="/agents">
                  <span class="meta-ep-desc">+ search, history, snapshots, OpenAPI →</span>
                </a>
              </nav>
              <div class="platform-actions">
                <a class="btn btn-accent" href="/agents">
                  Read the docs<Chev />
                </a>
                <a class="btn" href="/agents#mcp">
                  MCP config
                </a>
              </div>
            </div>

            <div class="platform-showcase">
              <div class="platform-showcase-head">
                <span class="k">Example response</span>
                <button class="ep-copy" type="button" data-copy={curl}>
                  COPY QUERY
                </button>
              </div>
              <div class="codeblock platform-code">
                <button class="copy" data-copy={curl}>
                  COPY
                </button>
                <pre>
                  <code
                    dangerouslySetInnerHTML={{
                      __html: `<span class="j-punc">$</span> ${esc(curl)}\n\n${hlJson(preview)}\n<span class="j-punc">// trimmed for UI — full envelope + pagination at /agents</span>`,
                    }}
                  />
                </pre>
              </div>
            </div>
          </div>
        </div>

        <div class="signal-subscribe" aria-labelledby="signal-sub-h">
          <h3 id="signal-sub-h">When the catalog moves, you hear about it.</h3>
          <p>
            New APIs we start probing, notable deaths, schema drift — a short email when our checks
            surface something real. Not a drip campaign.
          </p>
          <form class="newsletter signal-form" id="newsletter-home">
            <div class="signal-field">
              <input
                type="email"
                name="email"
                required
                placeholder="you@ship.dev"
                aria-label="Email address"
                autocomplete="email"
                spellcheck={false}
              />
              <button type="submit" class="signal-submit">
                Subscribe
              </button>
            </div>
            <p class="signal-foot">// one-click out · no fixed schedule</p>
          </form>
        </div>
      </div>
    </section>
  )
}
