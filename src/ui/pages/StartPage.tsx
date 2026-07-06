import type { FC } from 'hono/jsx'
import { catalogCounts, catApis, catBySlug } from '../../data/catalog'
import { categories } from '../../data/seed'
import { ApiGlyph } from '../components/ApiGlyph'
import { Chev } from '../components/Chev'
import { Layout } from '../layout/Layout'
import { WEATHER_SAMPLE } from '../lib/constants'
import { hlJson } from '../lib/format'
import { breadcrumbLd } from '../lib/seo'
import { ApiWireframe, StartChapterHead, StartFlowDiagram, StartMonitorDiagram, WebWireframe } from '../start/diagrams'

export const StartPage: FC = () => {
  const counts = catalogCounts()
  const cats = categories.map((c) => ({ c, n: catApis().filter((a) => a.category === c.slug).length })).filter((x) => x.n)
  const examples = (
    [
      ['🌤', 'A weather widget for any city', 'open-meteo'],
      ['💱', 'A currency converter', 'frankfurter'],
      ['🐶', 'A random-dog-photo button', 'dog-ceo'],
      ['🗺', 'A country picker with flags & capitals', 'rest-countries'],
    ] as Array<[string, string, string]>
  ).filter(([, , slug]) => catBySlug().get(slug))
  return (
    <Layout
      title="New to free APIs? Start here — shipapis"
      desc="Plain-English intro to free public APIs: what they are, how requests work, real examples, and hundreds of health-checked endpoints to try in your browser — no key required to start."
      path="/start"
      jsonLd={[breadcrumbLd([['Home', '/'], ['New to APIs']])]}
    >
      <section class="start-mast">
        <div class="wrap">
          <div class="start-mast-meta">
            <span class="k"><b>●</b> ONBOARDING</span>
            <span class="k">PLAIN-ENGLISH GUIDE</span>
            <a class="k start-mast-skip" href="/browse">
              SKIP TO DIRECTORY
              <Chev />
            </a>
          </div>
          <div class="start-mast-grid">
            <div class="start-mast-copy">
              <h1>
                new to free APIs?<br />
                <span class="alive">here's the whole idea.</span>
              </h1>
              <p class="start-mast-lead">
                An <b>API</b> is a machine-readable way to ask someone else's computer for fresh
                data — weather, exchange rates, photos, facts. You send a <b>request</b> to a web
                address; it sends back a <b>structured answer</b> your project can use.
              </p>
              <p class="comment start-mast-note">
                think of it as a waiter: you order "weather for London", the kitchen (the API) brings
                the numbers — not a full restaurant website.
              </p>
              <nav class="quick start-quick" aria-label="On this page">
                <a class="facet" href="#what">What is an API</a>
                <a class="facet" href="#how">How it works</a>
                <a class="facet" href="#sample">See JSON</a>
                <a class="facet" href="#build">Examples</a>
              </nav>
            </div>
            <aside class="start-mast-aside" aria-label="Directory at a glance">
              <div class="start-stat-grid">
                <span class="ms">
                  <b class="num" data-count={counts.total}>{counts.total}</b>
                  <span class="k">Catalogued</span>
                </span>
                <span class="ms">
                  <b class="num" data-count={counts.monitored}>{counts.monitored}</b>
                  <span class="k">Probed by us</span>
                </span>
                <span class="ms">
                  <b class="num" data-count={cats.length}>{cats.length}</b>
                  <span class="k">Topics</span>
                </span>
                <a class="ms start-stat-cta" href="/browse?facet=auth-none">
                  <b class="alive">No key</b>
                  <span class="k">Easiest to try<Chev /></span>
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <div class="wrap gy-body start-body">
        <section class="start-sec">
          <StartChapterHead n="01" id="what">What is an API?</StartChapterHead>
          <div class="start-band">
            <div class="start-prose">
              <p class="start-lead">
                A normal <b>website</b> is built for human eyes — layout, buttons, ads. An <b>API</b> is
                the same company's data shelf, opened for programs. Instead of HTML pages you get
                <b>JSON</b>: neat labeled fields like <code class="start-inline">temperature: 14.2</code>{' '}
                that software can read instantly.
              </p>
              <p class="start-lead">
                Thousands of organizations publish <b>free public APIs</b> — no payment for modest use,
                often no account. Students, hobby sites, and startups use them to add live features
                without running their own weather station or currency feed.
              </p>
            </div>
            <StartFlowDiagram />
          </div>
        </section>

        <section class="start-sec start-plate">
          <StartChapterHead n="02" id="how">How a request works</StartChapterHead>
          <ol class="start-steps">
            <li class="start-step">
              <span class="start-step-num">01</span>
              <div>
                <b>You choose a URL</b>
                <p>
                  Every API documents an address to call — like{' '}
                  <code class="start-inline">api.open-meteo.com/…/forecast</code>. That's the menu item.
                </p>
              </div>
            </li>
            <li class="start-step">
              <span class="start-step-num">02</span>
              <div>
                <b>You ask a question in the query</b>
                <p>
                  Parameters narrow it down: city, currency pair, how many results. The docs list what's
                  allowed — latitude, symbol, limit, etc.
                </p>
              </div>
            </li>
            <li class="start-step">
              <span class="start-step-num">03</span>
              <div>
                <b>The server answers with JSON</b>
                <p>
                  If it's working, you get a 200 response and a JSON body — text wrapped in{' '}
                  <code class="start-inline">{'{ }'}</code> brackets with keys and values.
                </p>
              </div>
            </li>
            <li class="start-step">
              <span class="start-step-num">04</span>
              <div>
                <b>Your project displays or stores it</b>
                <p>
                  A chart, a table, a chatbot, a phone widget — the API did the fetching; you decide
                  how it looks.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section class="start-sec" id="sample">
          <StartChapterHead n="03" id="sample-h">A real answer (weather)</StartChapterHead>
          <p class="start-lead">
            Paste a URL in your browser tab and you'll often see raw JSON. Here's what a small slice
            looks like — the kind of payload behind a "14°C in London" label:
          </p>
          <div class="codeblock start-sample">
            <span class="k">GET open-meteo.com/v1/forecast?latitude=51.5&amp;current_weather=true</span>
            <pre><code dangerouslySetInnerHTML={{ __html: hlJson(WEATHER_SAMPLE) }} /></pre>
          </div>
          <p class="comment start-sample-note">
            every listing here links to the provider docs and, when we probe it, a live sample you
            can run in the browser.
          </p>
        </section>

        <section class="start-sec start-plate">
          <StartChapterHead n="04" id="compare">Website vs API</StartChapterHead>
          <div class="start-cmp">
            <div class="start-cmp-col">
              <WebWireframe />
              <span class="k">website</span>
              <ul class="start-cmp-list">
                <li>Designed for people reading in a browser</li>
                <li>Pages, images, navigation, styling</li>
                <li>Example: a news homepage</li>
              </ul>
            </div>
            <div class="start-cmp-col">
              <ApiWireframe />
              <span class="k">api</span>
              <ul class="start-cmp-list">
                <li>Designed for apps and scripts fetching data</li>
                <li>Usually JSON — keys and values, no layout</li>
                <li>Example: the same site's headline feed as JSON</li>
              </ul>
            </div>
          </div>
        </section>

        <section class="start-sec">
          <StartChapterHead n="05" id="code">Do you need to code?</StartChapterHead>
          <div class="start-band">
            <div class="start-prose">
              <p class="start-lead">
                <b>No, to explore.</b> Open any API page here, read what it returns, and hit{' '}
                <b>Run live</b> when we support it — you'll see real JSON without writing a line.
              </p>
              <p class="start-lead">
                <b>A little, to ship.</b> Most projects use a few lines in JavaScript, Python, or
                similar to fetch the URL and place the result on screen. Tutorials usually start with
                "no key" APIs like the ones we flag in browse.
              </p>
              <p class="start-lead">
                <b>Filters that help beginners:</b>{' '}
                <a href="/browse?facet=auth-none">No key</a> ·{' '}
                <a href="/browse?facet=auth-apiKey">Free key</a> ·{' '}
                <a href="/browse?facet=cors">Browser OK</a> ·{' '}
                <a href="/browse?facet=monitored">Probed by us</a>
              </p>
            </div>
            <div class="start-callout">
              <span class="k">try right now</span>
              <p>Pick one example project — each opens a listing with docs, health, and a sample call.</p>
              <div class="start-callout-links">
                {examples.slice(0, 3).map(([emoji, idea, slug]) => (
                  <a href={`/api/${slug}`}>
                    <span aria-hidden="true">{emoji}</span> {idea}
                    <Chev />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section class="start-sec start-plate">
          <StartChapterHead n="06" id="shipapis">What shipapis adds</StartChapterHead>
          <div class="start-band">
            <div class="start-prose">
              <p class="start-lead">
                Directories alone are lists of links. We <b>probe</b> endpoints on a schedule — did it
                respond? how fast? did the JSON shape change? — and show uptime, latency, and a health
                score on every listing. When an API dies, we log it in the{' '}
                <a href="/graveyard">graveyard</a> so old tutorials make sense.
              </p>
              <p class="start-lead">
                <b>{counts.monitored}</b> APIs are actively probed today; <b>{counts.total - counts.monitored}</b>{' '}
                more are catalogued with docs links while we expand coverage. Filter for{' '}
                <a href="/browse?facet=monitored">probed</a> when you want numbers backed by checks.
              </p>
            </div>
            <StartMonitorDiagram />
          </div>
        </section>

        <section class="start-sec" id="build">
          <StartChapterHead n="07" id="build-h">What you can make</StartChapterHead>
          <div class="board start-board">
            <div class="rows">
            {examples.map(([, idea, slug]) => (
              <a class="start-row" href={`/api/${slug}`}>
                <ApiGlyph slug={slug} displayPx={36} />
                <span class="start-row-t">
                  <b>{idea}</b>
                  <span class="k">{catBySlug().get(slug)!.name} · open listing</span>
                </span>
                <Chev />
              </a>
            ))}
            </div>
          </div>
        </section>

        <section class="start-sec start-plate">
          <StartChapterHead n="08" id="topics">Pick a topic</StartChapterHead>
          <div class="toc start-toc">
            {cats.map(({ c, n }) => (
              <a href={`/c/${c.slug}`}>
                <span class="emoji" aria-hidden="true">{c.emoji}</span>
                <span class="toc-name">{c.name}</span>
                <span class="leader" aria-hidden="true" />
                <span class="num">{n}</span>
              </a>
            ))}
          </div>
        </section>

        <section class="start-sec">
          <StartChapterHead n="09" id="read">How to read a listing</StartChapterHead>
          <dl class="start-legend">
            <div><dt>Health score</dt><dd>0–100 blend of uptime, speed, and whether responses still match the documented shape. Higher is safer to depend on.</dd></div>
            <div><dt>Status</dt><dd><b>Healthy</b> = passing checks. <b>New</b> = recently added to monitoring — early scores still settling. <b>Dying / Dead</b> = failing or gone (see graveyard).</dd></div>
            <div><dt>Probed vs catalogued</dt><dd><b>Probed</b> = we run scheduled checks. <b>Catalogued</b> = verified docs link, not yet on the probe rotation.</dd></div>
            <div><dt>No key</dt><dd>No signup or API token required for basic use — the friendliest starting point.</dd></div>
            <div><dt>Browser OK (CORS)</dt><dd>Callable directly from a web page without your own backend proxy.</dd></div>
            <div><dt>Uptime</dt><dd>Share of our probes that succeeded over the last 90 days (probed APIs only).</dd></div>
          </dl>
        </section>

        <section class="start-close">
          <StartChapterHead n="10" id="next">Next steps</StartChapterHead>
          <p class="start-lead">You know what an API is — here's where to go from here.</p>
          <div class="start-actions">
            <a class="btn btn-accent" href="/browse?facet=auth-none">Browse no-key APIs<Chev /></a>
            <a class="btn" href="/browse">Full directory<Chev /></a>
            <a class="btn" href="/agents">For developers &amp; agents<Chev /></a>
          </div>
          <p class="comment start-foot">
            methodology and probe rules live on /methodology — this page is the plain-English layer on top.
          </p>
        </section>
      </div>
    </Layout>
  )
}
