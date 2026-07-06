import type { FC } from 'hono/jsx'
import { catApisInCategory, isMonitored } from '../../data/catalog'
import { categoryBySlug } from '../../data/seed'
import { median } from '../lib/math'
import { OgShell } from './OgShell'

export const OgCatCard: FC<{ slug: string }> = ({ slug }) => {
  const cat = categoryBySlug.get(slug)!
  const list = catApisInCategory(slug)
  const probed = list.filter(isMonitored)
  const healthy = probed.filter((a) => a.status === 'healthy').length
  const medP50 = Math.round(median(probed.filter((a) => a.p50 > 0).map((a) => a.p50)))
  return (
    <OgShell>
      <div class="og">
        <div class="og-meta">
          <span class="k"><b>●</b>&nbsp; SHIPAPIS — FREE API DIRECTORY</span>
          <span class="k">{probed.length} OF {list.length} PROBED</span>
        </div>
        <div class="og-title">
          <span class="glyph" aria-hidden="true">{cat.emoji}</span>
          <div class="og-name">
            <h1>Free {cat.name} APIs</h1>
            <p>{cat.blurb}</p>
          </div>
        </div>
        <div class="og-stats">
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
            <b class="num">{medP50 > 0 ? medP50 : '—'}{medP50 > 0 && <span class="unit">ms</span>}</b>
            <span class="k">Median P50</span>
          </span>
        </div>
        <div class="og-foot">
          <span class="num">shipapis.dev/c/{slug}</span>
          <span class="k">HEALTH DATA ON PROBED APIS</span>
        </div>
      </div>
    </OgShell>
  )
}
