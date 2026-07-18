import type { FC } from 'hono/jsx'
import { catAllShapeChanges, catApis, catDeadApis, catalogCounts } from '../../data/catalog'
import { categories, type ApiEntry, type LifecycleStatus } from '../../data/seed'
import { Chev } from '../components/Chev'
import { Layout } from '../layout/Layout'
import { STATUS_LABEL } from '../lib/constants'
import { breadcrumbLd } from '../lib/seo'
import { StatBar, StateBlock } from './state-parts'

export const StatePage: FC = () => {
  const counts = catalogCounts()
  const total = counts.total
  const count = (pred: (a: ApiEntry) => boolean) => catApis().filter(pred).length
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  const keyless = count((a) => a.auth === 'none' || a.auth === 'userAgent')
  const changes = catAllShapeChanges()
  const statuses: LifecycleStatus[] = ['healthy', 'new', 'resurrected', 'degraded', 'dying', 'unmonitored', 'dead']
  const stColor: Record<LifecycleStatus, string> = {
    healthy: 'var(--st-healthy)', new: 'var(--st-new)', resurrected: 'var(--st-resurrected)',
    degraded: 'var(--st-degraded)', dying: 'var(--st-dying)', unmonitored: 'var(--st-unmonitored)', dead: 'var(--st-dead)',
  }
  const auths: Array<[string, ApiEntry['auth']]> = [['No key', 'none'], ['User-Agent', 'userAgent'], ['API key', 'apiKey'], ['OAuth', 'oauth']]
  const agents: Array<[string, ApiEntry['agentAccess'], string]> = [
    ['Reachable server-side', 'ok', 'var(--st-healthy)'], ['Bot-walled', 'blocked', 'var(--st-dead)'], ['Unconfirmed', 'unknown', 'var(--st-unmonitored)'],
  ]
  const topCats = [...categories]
    .map((c) => ({ c, n: catApis().filter((a) => a.category === c.slug).length }))
    .sort((x, y) => y.n - x.n)
    .slice(0, 8)
  const corsYes = count((a) => a.cors === 'yes')
  const commercial = count((a) => a.commercialUse === 'yes')
  const monitored = counts.monitored
  const scheduled = counts.scheduled
  const dead = catDeadApis().length

  return (
    <Layout
      title="The State of Free APIs — a live data report · shipapis"
      desc={`A data report on ${total} catalogued free APIs — ${scheduled} on our probe schedule, ${monitored} probed with live data. Keyless access, CORS, commercial use, and mortality figures from our catalog, not provider claims.`}
      path="/state"
      jsonLd={[breadcrumbLd([['Home', '/'], ['State of Free APIs']])]}
    >
      <div class="wrap state-page">
        <section class="state-hero-plate">
          <div class="state-meta">
            <span class="k state-meta-id">
              <span class="live-dot" aria-hidden="true" />
              DATA REPORT · {categories.length} CATEGORIES
            </span>
            <a class="k state-meta-link" href="/data/status.json">
              FRESHNESS · /data/status.json
              <Chev />
            </a>
          </div>
          <div class="state-hero-grid">
            <div class="state-hero-copy">
              <h1>
                The State of Free APIs.
                <span class="dim">Measured, not guessed.</span>
              </h1>
              <p>
                {scheduled} APIs on our probe schedule, {monitored} probed with live data, {total} catalogued in
                total — {keyless} usable with no key. Health figures below come from probed APIs; queued rows
                are counted but not health-scored yet.
              </p>
            </div>
            <div class="state-kpis" aria-label="Headline figures">
              <span class="ms">
                <b class="num">{monitored}</b>
                <span class="k">Probed by us</span>
              </span>
              <span class="ms">
                <b class="num">{total}</b>
                <span class="k">In catalog</span>
              </span>
              <span class="ms">
                <b class="num">{pct(keyless)}<span class="unit">%</span></b>
                <span class="k">Need no API key</span>
              </span>
              <span class="ms">
                <b class="num">{pct(corsYes)}<span class="unit">%</span></b>
                <span class="k">CORS-enabled</span>
              </span>
              <span class="ms">
                <b class={`num${dead ? ' down' : ''}`}>{dead}</b>
                <span class="k">Declared dead</span>
              </span>
            </div>
          </div>
        </section>

        <div class="state-layout">
          <div class="state-col">
            <StateBlock title="Lifecycle status">
              {statuses
                .filter((s) => count((a) => a.status === s) > 0)
                .map((s) => (
                  <StatBar
                    label={STATUS_LABEL[s]}
                    n={count((a) => a.status === s)}
                    total={total}
                    color={stColor[s]}
                    href={
                      s === 'unmonitored'
                        ? '/browse'
                        : s === 'dead'
                          ? '/graveyard'
                          : s === 'healthy' || s === 'new' || s === 'resurrected'
                            ? '/browse'
                            : s === 'degraded' || s === 'dying'
                              ? '/signals'
                              : undefined
                    }
                  />
                ))}
            </StateBlock>
            <StateBlock title="Authentication">
              {auths
                .filter(([, val]) => count((a) => a.auth === val) > 0)
                .map(([label, val]) => (
                  <StatBar
                    label={label}
                    n={count((a) => a.auth === val)}
                    total={total}
                    color="var(--accent)"
                    href={`/browse?facet=auth-${val}`}
                  />
                ))}
            </StateBlock>
            <StateBlock title="Agent / server-side access">
              {agents
                .filter(([, val]) => count((a) => a.agentAccess === val) > 0)
                .map(([label, val, color]) => (
                  <StatBar
                    label={label}
                    n={count((a) => a.agentAccess === val)}
                    total={total}
                    color={color}
                  />
                ))}
            </StateBlock>
          </div>
          <div class="state-col">
            <StateBlock title="Buildability">
              <StatBar
                label="CORS-enabled"
                n={corsYes}
                total={total}
                color="var(--st-healthy)"
                href="/browse?facet=cors"
              />
              <StatBar
                label="Commercial-use OK"
                n={commercial}
                total={total}
                color="var(--st-healthy)"
              />
              <StatBar label="No card required" n={count((a) => !a.requiresCard)} total={total} color="var(--st-healthy)" />
              <StatBar label="HTTPS" n={count((a) => a.https)} total={total} color="var(--st-healthy)" />
            </StateBlock>
            <StateBlock title="Biggest categories">
              {topCats.map(({ c, n }) => (
                <StatBar
                  label={`${c.emoji} ${c.name}`}
                  n={n}
                  total={total}
                  color="var(--accent)"
                  href={`/c/${c.slug}`}
                />
              ))}
            </StateBlock>
            <StateBlock title="Change &amp; mortality">
              <StatBar label="Probed by us" n={monitored} total={total} color="var(--st-healthy)" href="/browse" />
              <StatBar label="Catalogued only" n={counts.catalogued} total={total} color="var(--st-unmonitored)" href="/browse" />
              <StatBar label="Schema changes" n={changes.length} total={total} color="var(--st-degraded)" href="/changelog" />
              <StatBar label="Declared dead" n={dead} total={total} color="var(--st-dead)" href="/graveyard" />
              <p class="state-note comment">
                Probed figures come from our checker; catalogued-only rows have metadata only. Read{' '}
                <a href="/methodology">the methodology</a>, subscribe at{' '}
                <a href="/changes.xml">/changes.xml</a>, or pull data from{' '}
                <a href="/data/index.json?probed=true">/data/index.json?probed=true</a>.
              </p>
            </StateBlock>
          </div>
        </div>
      </div>
    </Layout>
  )
}
