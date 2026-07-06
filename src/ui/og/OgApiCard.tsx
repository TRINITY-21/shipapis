import type { FC } from 'hono/jsx'
import { isMonitored } from '../../data/catalog'
import { categoryBySlug, uptimePct, type ApiEntry } from '../../data/seed'
import { ApiGlyph } from '../components/ApiGlyph'
import { ScoreRing } from '../components/ScoreRing'
import { StatusBadge } from '../components/StatusBadge'
import { UptimeBars } from '../components/UptimeBars'
import { scoreRingProps } from '../lib/score-ring'
import { OgShell } from './OgShell'

export const OgApiCard: FC<{ api: ApiEntry }> = ({ api }) => {
  const cat = categoryBySlug.get(api.category)!
  return (
    <OgShell>
      <div class="og">
        <div class="og-meta">
          <span class="k"><b>●</b>&nbsp; SHIPAPIS — FREE API DIRECTORY</span>
          <span class="k">{isMonitored(api) ? 'PROBED ON OUR SCHEDULE' : 'CATALOGUED'}</span>
        </div>
        <div class="og-title">
          <ApiGlyph api={api} absolute displayPx={100} />
          <div class="og-name">
            <h1>{api.name}</h1>
            <p>{api.tagline}</p>
          </div>
          <div class="og-score">
            <ScoreRing {...scoreRingProps(api)} lg />
            <span class="k">HEALTH</span>
          </div>
        </div>
        <div class="og-chips">
          <StatusBadge status={api.status} checkTier={api.checkTier} />
          <span class="chip"><b>{uptimePct(api)}%</b>&nbsp;90D</span>
          {api.p50 > 0 && <span class="chip"><b>{api.p50}</b>&nbsp;MS P50</span>}
          <span class="chip">AUTH <b class={api.auth === 'none' ? 'yes' : 'meh'}>{api.auth === 'userAgent' ? 'USER-AGENT' : api.auth.toUpperCase()}</b></span>
          <span class="chip">{cat.name.toUpperCase()}</span>
        </div>
        <div class="og-chart">
          <span class="k">UPTIME · LAST 30 DAYS</span>
          <UptimeBars api={api} days={30} tall />
        </div>
        <div class="og-foot">
          <span class="num">shipapis.dev/api/{api.slug}</span>
          <span class="k">{isMonitored(api) ? 'PROBED · HEALTH TRACKED' : 'CATALOGUED · NOT PROBED YET'}</span>
        </div>
      </div>
    </OgShell>
  )
}
