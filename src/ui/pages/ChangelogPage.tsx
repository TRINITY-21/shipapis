import type { FC } from 'hono/jsx'
import { catAllShapeChanges } from '../../data/catalog'
import { ApiGlyph } from '../components/ApiGlyph'
import { Layout } from '../layout/Layout'
import { breadcrumbLd } from '../lib/seo'

export const ChangelogPage: FC = () => {
  const changes = catAllShapeChanges()
  const apisChanged = new Set(changes.map((c) => c.slug)).size
  return (
    <Layout
      title="API Schema Changelog — response-shape changes, dated · shipapis"
      desc={`${changes.length} response-shape changes we detected across free APIs — the breaking-change feed nobody else has. Subscribe to catch a schema change before your code does.`}
      path="/changelog"
      jsonLd={[breadcrumbLd([['Home', '/'], ['Schema Changelog']])]}
    >
      <section class="gy-head">
        <div class="wrap gy-head-grid">
          <div>
            <h1>
              APIs change shape.<br />
              <span class="dim">We catch it, and date it.</span>
            </h1>
            <p>
              We re-hash every API's response structure on each health check. When the shape drifts —
              a field renamed, retyped, added or removed — it lands here, dated, so a breaking change
              reaches you before it reaches production. Subscribe:{' '}
              <a href="/changes.xml" class="muted">/changes.xml</a> (all) · per-API feeds at{' '}
              <span class="muted">/api/{'{slug}'}/changes.xml</span>
            </p>
          </div>
          <div class="mast-stats gy-stats">
            <span class="ms">
              <b class="num">{changes.length}</b>
              <span class="k">Changes on record</span>
            </span>
            <span class="ms">
              <b class="num">{apisChanged}</b>
              <span class="k">APIs affected</span>
            </span>
          </div>
        </div>
      </section>
      <div class="wrap gy-body">
        {changes.length ? (
          <div class="gy-band gy-ledger">
            {changes.map((c) => (
              <a class="gy-row" href={`/api/${c.slug}#shape`}>
                <span class="who">
                  <ApiGlyph slug={c.slug} />
                  <span>
                    <b>{c.name}</b>
                    <span class="dates">{c.date} · {c.category}</span>
                  </span>
                </span>
                <span class="epitaph">{c.summary}</span>
              </a>
            ))}
          </div>
        ) : (
          <p class="tl-empty">
            <b>All stable.</b> No schema drift detected across the catalog yet — every monitored API is
            returning the same response shape it did at its last check.
          </p>
        )}
      </div>
    </Layout>
  )
}
