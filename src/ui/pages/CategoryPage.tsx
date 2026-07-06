import type { FC } from 'hono/jsx'
import { catApisInCategory, isMonitored, isOnProbeSchedule } from '../../data/catalog'
import { categoryBySlug, uptimePct } from '../../data/seed'
import { Faq } from '../components/Faq'
import { FacetRow } from '../components/FacetRow'
import { ListEmpty } from '../components/ListEmpty'
import { ApiRow } from '../components/list/ApiRow'
import { RowHead } from '../components/list/RowHead'
import { Layout } from '../layout/Layout'
import { browseSorted } from '../lib/browse'
import { categoryFaqItems } from '../lib/faq'
import { median } from '../lib/math'
import { breadcrumbLd, faqLd, itemListLd } from '../lib/seo'

export const CategoryPage: FC<{ slug: string }> = ({ slug }) => {
  const cat = categoryBySlug.get(slug)!
  const list = browseSorted(catApisInCategory(slug))
  const scheduled = list.filter(isOnProbeSchedule)
  const probed = list.filter(isMonitored)
  const healthy = probed.filter((a) => a.status === 'healthy').length
  const attention = probed.filter((a) => a.status === 'degraded' || a.status === 'dying').length
  const medP50 = Math.round(median(probed.filter((a) => a.p50 > 0).map((a) => a.p50)))
  const medUp = median(probed.map((a) => Number(uptimePct(a, 30)))).toFixed(1)
  const faq = categoryFaqItems(cat, list)
  return (
    <Layout
      title={`Free ${cat.name} APIs — uptime & health checks · shipapis`}
      desc={`${list.length} free ${cat.name.toLowerCase()} API${list.length === 1 ? '' : 's'} in our catalog — ${scheduled.length} on our probe schedule, ${probed.length} probed. ${cat.blurb}`}
      path={`/c/${slug}`}
      og={`/og/cat-${slug}.png`}
      ogAlt={`Health stats for free ${cat.name} APIs on shipapis`}
      jsonLd={[
        breadcrumbLd([['Home', '/'], [`Free ${cat.name} APIs`]]),
        itemListLd(`Free ${cat.name} APIs`, list),
        faqLd(faq),
      ]}
    >
      <div class="wrap">
        <div class="page-head">
          <h1>
            <span class="glyph" aria-hidden="true">{cat.emoji}</span>
            Free {cat.name} APIs
          </h1>
          <p>
            {cat.blurb}{' '}
            <span class="k">
              {scheduled.length} of {list.length} on our probe schedule{probed.length < scheduled.length ? ` · ${probed.length} probed` : ''}.
            </span>
          </p>
        </div>
        <div class="cat-stats" role="group" aria-label={`${cat.name} category health summary`}>
          <span class="ms">
            <b class="num">{list.length}</b>
            <span class="k">In catalog</span>
          </span>
          <span class="ms">
            <b class="num">{probed.length}</b>
            <span class="k">Probed by us</span>
          </span>
          <span class="ms">
            <b class="num">{healthy}</b>
            <span class="k">Healthy now</span>
          </span>
          <span class="ms">
            <b class={`num${attention > 0 ? ' warn' : ''}`}>{attention}</b>
            <span class="k">Degraded / dying</span>
          </span>
          <span class="ms">
            <b class="num">{medP50 > 0 ? medP50 : '—'}{medP50 > 0 && <span class="unit">ms</span>}</b>
            <span class="k">Median P50</span>
          </span>
          <span class="ms">
            <b class="num">{medUp}<span class="unit">%</span></b>
            <span class="k">Median uptime · 30d</span>
          </span>
        </div>
        <span id="sr-count" class="sr-only" aria-live="polite" />
        <FacetRow count={list.length} />
        <div class="rows">
          <RowHead />
          {list.map((a) => (
            <ApiRow api={a} />
          ))}
        </div>
        <div class="mt-16">
          <ListEmpty />
        </div>
        <Faq heading={`Free ${cat.name} APIs — FAQ`} items={faq} />
      </div>
    </Layout>
  )
}
