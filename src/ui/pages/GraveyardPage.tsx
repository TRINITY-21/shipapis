import type { FC } from 'hono/jsx'
import { catDeadApis, catLiveApis } from '../../data/catalog'
import { uptimePct } from '../../data/seed'
import { ApiGlyph } from '../components/ApiGlyph'
import { Layout } from '../layout/Layout'
import { breadcrumbLd, itemListLd } from '../lib/seo'

export const GraveyardPage: FC = () => {
  const dead = catDeadApis()
  // The watch list — failing now, not yet judged (§6.3 grace rules). Deaths are rarely sudden.
  const watch = catLiveApis()
    .filter((a) => a.status === 'dying' || a.status === 'degraded')
    .sort((a, b) =>
      a.status === b.status
        ? Number(uptimePct(a, 30)) - Number(uptimePct(b, 30))
        : a.status === 'dying' ? -1 : 1,
    )
  return (
    <Layout
      title="The API Graveyard — dead & deprecated free APIs · shipapis"
      desc={`${dead.length} dead free APIs — retired, deprecated or shut down — each dated and archived with its final response shape, so you know exactly why that old tutorial broke.`}
      path="/graveyard"
      jsonLd={[breadcrumbLd([['Home', '/'], ['The API Graveyard']]), itemListLd('Dead free APIs, archived', dead)]}
    >
      <section class="gy-head">
        <div class="wrap gy-head-grid">
          <div>
            <h1>
              Every free API dies.<br />
              <span class="dim">We keep the records.</span>
            </h1>
            <p>
              When an API fails ~100% of checks for 30 days it is declared dead and archived here with
              its final known response shape — so old tutorials can be understood, and updated. Dead
              APIs stay listed, marked DEAD, until their pages stop helping people. Deaths feed:{' '}
              <a href="/graveyard.xml" class="muted">/graveyard.xml</a>
            </p>
          </div>
          <div class="mast-stats gy-stats">
            <span class="ms">
              <b class="num down">{dead.length}</b>
              <span class="k">Deaths on record</span>
            </span>
            <span class="ms">
              <b class="num">{dead.map((a) => a.diedAt!).sort().at(-1) ?? '—'}</b>
              <span class="k">Last death</span>
            </span>
          </div>
        </div>
      </section>
      <div class="wrap gy-body">
        <div class="gy-band gy-ledger">
          {dead.map((a) => (
            <a class="gy-row" href={`/api/${a.slug}`}>
              <span class="who">
                <span class="glyph" aria-hidden="true">🪦</span>
                <span>
                  <b>{a.name}</b>
                  <span class="dates">listed {a.addedAt} · † {a.diedAt}</span>
                </span>
              </span>
              <span class="epitaph">{a.epitaph}</span>
              <span class="num">{a.shapeChanges[a.shapeChanges.length - 1]?.summary.split(' — ')[0].toUpperCase() ?? 'UNKNOWN'}</span>
            </a>
          ))}
        </div>

        {watch.length > 0 && (
          <div class="gy-watch">
            <div class="section-head">
              <h2>The watch list</h2>
              <span class="k">FAILING NOW · DEAD AFTER 30 DAYS AT ~100% FAILURE</span>
            </div>
            <p class="comment gy-watch-note">deaths are rarely sudden — these are failing checks today.</p>
            <div class="gy-band">
              {watch.map((a) => (
                <a class="gy-row" href={`/api/${a.slug}`}>
                  <span class="who">
                    <ApiGlyph slug={a.slug} displayPx={30} />
                    <span>
                      <b>{a.name}</b>
                      <span class="dates">30D UPTIME · {uptimePct(a, 30)}%</span>
                    </span>
                  </span>
                  <span class="epitaph gy-tag">{a.tagline}</span>
                  <span class={`num${a.status === 'degraded' ? ' warn' : ''}`}>{a.status.toUpperCase()}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
