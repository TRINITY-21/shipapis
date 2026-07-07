import type { FC } from 'hono/jsx'
import { pickApiOfTheDay } from '../../data/api-of-the-day'
import { catApis, catApisInCategory, catDeadApis, catGlobalStats, catLiveApis } from '../../data/catalog'
import { categories, recentSignals, uptimePct, type ApiEntry } from '../../data/seed'
import { AgentPrompt } from '../components/AgentPrompt'
import { ApiGlyph } from '../components/ApiGlyph'
import { BarsLegend } from '../components/BarsLegend'
import { Chev } from '../components/Chev'
import { Chips } from '../components/Chips'
import { ListEmpty } from '../components/ListEmpty'
import { ScoreRing } from '../components/ScoreRing'
import { StatusBadge } from '../components/StatusBadge'
import { UptimeBars } from '../components/UptimeBars'
import { SignalSection } from '../components/home/SignalSection'
import { ApiRow } from '../components/list/ApiRow'
import { RowHead } from '../components/list/RowHead'
import { Layout } from '../layout/Layout'
import { daysSinceAdded, sweepLabel, todayLabel } from '../lib/format'
import { scoreRingProps } from '../lib/score-ring'
import { ORG_LD, WEBSITE_LD } from '../lib/seo'

export const Home: FC = () => {
  const live = catLiveApis().sort((a, b) => b.healthScore - a.healthScore)
  const dead = catDeadApis()
  // Spotlight dedupe: an API shown once (AOTD or an earlier rail) never repeats further down.
  const aotdPick = pickApiOfTheDay(catApis())
  const aotd = aotdPick.api
  const aotdRing = scoreRingProps(aotd)
  const picked = new Set<string>([aotd.slug])
  const take = (arr: ApiEntry[], n: number) => {
    const out: ApiEntry[] = []
    for (const a of arr) {
      if (out.length >= n) break
      if (!picked.has(a.slug)) {
        out.push(a)
        picked.add(a.slug)
      }
    }
    return out
  }
  const reliable = take([...live].sort((a, b) => Number(uptimePct(b, 30)) - Number(uptimePct(a, 30))), 3)
  const fastest = take(live.filter((a) => a.p50 > 0).sort((a, b) => a.p50 - b.p50), 3)
  const fresh = take(
    live.filter((a) => daysSinceAdded(a) <= 30).sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    3,
  )
  const stats = catGlobalStats()
  return (
    <Layout title="Free public APIs with live health checks & uptime · shipapis" path="/" jsonLd={[WEBSITE_LD, ORG_LD]}>
      <section class="mast">
        <div class="wrap">
          <div class="mast-grid">
            <div class="mast-copy">
              <h1 class="hero-h">
                the free-api directory<br />
                <span class="alive">with a pulse</span><span class="cursor" aria-hidden="true" />
              </h1>
              <p class="hero-lead">
                Free public APIs — weather, photos, exchange rates and more — with live health checks,
                real uptime and latency, docs links and auth rules. Plus a graveyard when they die.
              </p>
              <div class="prompt">
                <span class="ps" aria-hidden="true">$</span>
                <input id="q" type="search" data-palette-launch aria-label="Search APIs" placeholder="weather, photos, exchange rates…" autocomplete="off" spellcheck={false} />
                <kbd>/</kbd>
                <kbd class="m-hide">⌘K</kbd>
              </div>
              <span id="sr-count" class="sr-only" aria-live="polite" />
              <nav class="quick" aria-label="Common filters">
                <a class="facet" href="/browse?facet=monitored">Probed by us</a>
                <a class="facet" href="/browse?facet=auth-none">No key</a>
                <a class="facet" href="/browse?facet=auth-apiKey">Free key</a>
                <a class="facet" href="/browse?facet=cors">Browser OK</a>
              </nav>
              <p class="hero-agent k">
                New to APIs? <a href="/start">Start here<Chev /></a>
              </p>
              <p class="hero-agent k">
                Building with AI? <a href="/agents">Wire shipapis in<Chev /></a>
                {' · '}
                <a href="/llms.txt">llms.txt</a>
                {' · '}
                <a href="/data/status.json">status.json</a>
              </p>
            </div>

            <aside class="signals" aria-label="Live monitoring feed">
              <div class="signals-head">
                <span class="dot-static" aria-hidden="true" />
                <span class="k">LIVE SIGNALS</span>
                <span class="k">SWEEP · {sweepLabel(stats.sweepMin)}</span>
              </div>
              {recentSignals.slice(0, 4).map((s) => (
                <a class="sig" href={`/api/${s.slug}`}>
                  <i class={`sig-dot ${s.kind}`} aria-hidden="true" />
                  <ApiGlyph slug={s.slug} variant="inline" class="emoji" />
                  <b>{s.name}</b>
                  <span class="num">{s.detail}</span>
                  <span class="ago">{s.ago}</span>
                </a>
              ))}
              <a class="k signals-more" href="/signals">VIEW ALL SIGNALS<Chev /></a>
              <div class="signals-stats">
                <a class="ms" href="/browse?facet=monitored" title={`${stats.scheduled} of ${stats.tracked} APIs are on our health-check schedule; ${stats.monitored} have live probe data`}>
                  <b class="num">
                    <span data-count={stats.scheduled}>{stats.scheduled}</span>
                    <span class="stat-denom"> / {stats.tracked}</span>
                  </b>
                  <span class="k">APIs · on probe schedule</span>
                </a>
                <a class="ms" href="/browse" title="Documented HTTP routes across all catalog APIs">
                  <b class="num"><span data-count={stats.routesDocumented}>{stats.routesDocumented.toLocaleString()}</span></b>
                  <span class="k">Routes · in catalog</span>
                </a>
                <a class="ms" href="/methodology" title="Scheduled HTTP probes across probed APIs in the last 24 hours">
                  <b class="num"><span data-count={stats.checks24h}>{stats.checks24h.toLocaleString()}</span></b>
                  <span class="k">Probe checks · 24h</span>
                </a>
                <a class="ms" href="/graveyard" title="APIs declared dead after sustained probe failures">
                  <b class="num down"><span data-count={dead.length}>{dead.length}</span></b>
                  <span class="k">Dead APIs · graveyard</span>
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section class="section" id="directory">
        <div class="wrap">
          <div class="agent-home">
            <AgentPrompt />
          </div>
          <div id="rails">
            <div class="aotd">
              <h2 class="k aotd-h">API OF THE DAY · {todayLabel()}</h2>
              <div class="aotd-top">
                <ApiGlyph api={aotd} displayPx={56} />
                <div class="aotd-title">
                  <h3><a href={`/api/${aotd.slug}`}>{aotd.name}</a></h3>
                  <p>{aotd.tagline}</p>
                </div>
                <div class="aotd-score">
                  <ScoreRing {...aotdRing} lg />
                  <span class="k">HEALTH</span>
                </div>
              </div>
              <p class="aotd-why comment">{aotdPick.why}</p>
              <div class="card-meta">
                <StatusBadge status={aotd.status} />
                <span class="chip"><b>{uptimePct(aotd)}%</b>&nbsp;90D</span>
                <span class="chip"><b>{aotd.p50}</b>&nbsp;MS P50</span>
                <Chips api={aotd} compact />
              </div>
              <div class="aotd-chart m-hide">
                <span class="k">UPTIME · 90 DAYS</span>
                <UptimeBars api={aotd} days={90} tall />
              </div>
              <div class="aotd-chart m-only">
                <span class="k">UPTIME · 30 DAYS</span>
                <UptimeBars api={aotd} days={30} tall />
              </div>
              <div class="aotd-foot">
                <BarsLegend />
                <a class="btn btn-accent" href={`/api/${aotd.slug}`}>Try {aotd.name} live<Chev /></a>
              </div>
            </div>
            <div class="board">
              <div class="board-head">
                <h2>Most reliable · 30 days</h2>
                <span class="k"><a href="/browse?sort=reliable">VIEW ALL<Chev /></a></span>
              </div>
              <div class="rows">
                <RowHead />
                {reliable.map((a) => (
                  <ApiRow api={a} />
                ))}
              </div>
              <div class="board-head">
                <h2>Fastest · P50</h2>
                <span class="k"><a href="/browse?sort=fastest">VIEW ALL<Chev /></a></span>
              </div>
              <div class="rows">
                {fastest.map((a) => (
                  <ApiRow api={a} />
                ))}
              </div>
              {fresh.length > 0 && (
                <>
                  <div class="board-head">
                    <h2>Newly added</h2>
                    <span class="k"><a href="/browse?sort=newest">VIEW ALL<Chev /></a></span>
                  </div>
                  <div class="rows">
                    {fresh.map((a) => (
                      <ApiRow api={a} added />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div id="results" hidden>
            <div class="board">
              <div class="board-head">
                <h2>Search results</h2>
                <button class="facet" data-clear-search>Clear ✕</button>
                <span class="k" id="q-count" aria-live="polite">{catApis().length} APIS TRACKED</span>
              </div>
              <div class="rows">
                {catApis().map((a) => (
                  <ApiRow api={a} />
                ))}
              </div>
            </div>
            <ListEmpty home />
          </div>
        </div>
      </section>

      <section class="section" id="categories">
        <div class="wrap">
          <div class="section-head">
            <h2>Category index</h2>
          </div>
          <div class="toc">
            {categories.map((c) => {
              const inCat = catApisInCategory(c.slug)
              const n = inCat.length
              const shaky = inCat.filter((a) => a.status === 'degraded' || a.status === 'dying').length
              const hasDying = inCat.some((a) => a.status === 'dying')
              const tombs = inCat.filter((a) => a.status === 'dead').length
              return (
                <a href={`/c/${c.slug}`}>
                  <span class="toc-name"><span class="emoji" aria-hidden="true">{c.emoji}</span>{c.name}</span>
                  <span class="leader" aria-hidden="true" />
                  <span class="num">
                    {n} API{n === 1 ? '' : 'S'}
                    {shaky > 0 && <span class="toc-flag warn"> · {shaky} {hasDying ? 'DYING' : 'DEGRADED'}</span>}
                    {tombs > 0 && <span class="toc-flag down"> · {tombs} DEAD</span>}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {dead.length > 0 && (
        <section class="section">
          <div class="wrap">
            <div class="section-head">
              <h2>The graveyard</h2>
              <span class="k"><a href="/graveyard">VISIT<Chev /></a></span>
            </div>
            <div class="gy-band">
              {dead.slice(-3).reverse().map((a) => (
                <a class="gy-row" href={`/api/${a.slug}`}>
                  <span class="who">
                    <span class="glyph" aria-hidden="true">🪦</span>
                    <span>
                      <b>{a.name}</b>
                      <span class="dates">† {a.diedAt}</span>
                    </span>
                  </span>
                  <span class="epitaph">{a.epitaph}</span>
                  <span class="num">{a.shapeChanges[a.shapeChanges.length - 1]?.summary.split(' — ')[0].toUpperCase() ?? 'UNKNOWN'}</span>
                </a>
              ))}
            </div>
            <span class="gy-count-inline">
              <b class="num" data-count={dead.length}>{dead.length}</b> deaths on record — each archived with its
              final response shape, so you know exactly why that old tutorial broke.
            </span>
          </div>
        </section>
      )}

      <SignalSection />

    </Layout>
  )
}
