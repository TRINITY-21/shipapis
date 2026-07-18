import type { FC } from 'hono/jsx'

import { catalogCounts, dataTier } from '../../data/catalog'

export const HonestyBanner: FC<{ path?: string }> = ({ path }) => {
  const { total, monitored, catalogued } = catalogCounts()
  if (catalogued === 0) return null
  return (
    <div class="honesty-band" role="note">
      <div class="wrap honesty-band-inner">
        <p class="honesty-band-copy">
          <span class="k honesty-band-k">{dataTier() === 'dev-seed' ? 'MONITORING RAMP-UP' : 'COVERAGE'}</span>
          <b class="num">{monitored}</b> of <b class="num">{total}</b> APIs probed on our schedule
          {catalogued > 0 && (
            <>
              {' '}
              · <b class="num">{catalogued}</b> catalogued from public lists
              {path !== '/browse' && (
                <>
                  {' '}
                  (<a href="/browse">see probed</a>)
                </>
              )}
            </>
          )}
          . Scores and uptime appear only after we probe an API.
          {dataTier() === 'dev-seed' && (
            <>
              {' '}
              Verify freshness at <a href="/data/status.json">/data/status.json</a>.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
