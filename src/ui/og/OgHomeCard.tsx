import type { FC } from 'hono/jsx'
import { catDeadApis, catGlobalStats, catalogCounts } from '../../data/catalog'
import { Logo } from '../components/Logo'
import { OgShell } from './OgShell'

export const OgHomeCard: FC = () => {
  const counts = catalogCounts()
  const stats = catGlobalStats()
  return (
  <OgShell>
    <div class="og">
      <div class="og-meta">
        <span class="k"><b>●</b>&nbsp; FREE API DIRECTORY · {counts.monitored} PROBED</span>
        <span class="k">{counts.total} CATALOGUED</span>
      </div>
      <div class="og-home-title">
        <div class="og-brand">
          <Logo size={72} />
          <span>shipapis</span>
        </div>
        <h1>
          the free-api directory<br />
          <span class="alive">with a pulse</span><span class="cursor og-cursor" aria-hidden="true" />
        </h1>
      </div>
      <div class="og-stats">
        <span class="ms">
          <b class="num">{counts.monitored}</b>
          <span class="k">Probed by us</span>
        </span>
        <span class="ms">
          <b class="num">{stats.checks24h.toLocaleString()}</b>
          <span class="k">Checks · last 24h</span>
        </span>
        <span class="ms">
          <b class="num">{stats.medianLatency}<span class="unit">ms</span></b>
          <span class="k">Median latency · 24h</span>
        </span>
        <span class="ms">
          <b class="num down">{catDeadApis().length}</b>
          <span class="k">Deaths on record</span>
        </span>
      </div>
      <div class="og-foot">
        <span class="num">shipapis.dev</span>
        <span class="k">HEALTH DATA ON PROBED APIS</span>
      </div>
    </div>
  </OgShell>
  )
}

/* ---------- about & legal — prose pages in the same ledger grammar ---------- */
