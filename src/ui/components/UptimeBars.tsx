import type { FC } from 'hono/jsx'

import { uptimePct, type ApiEntry } from '../../data/seed'
import { dayLabel } from '../lib/format'

export const UptimeBars: FC<{ api: ApiEntry; days?: number; tall?: boolean; anim?: boolean; mini?: boolean }> = ({
  api,
  days = 30,
  tall,
  anim,
  mini,
}) => {
  const slice = api.uptime90.slice(-days)
  const offset = 90 - days
  return (
    <div
      class={`bars${tall ? ' tall' : ''}${anim ? ' anim' : ''}${mini ? ' mini' : ''}`}
      role="img"
      aria-label={`Daily uptime, last ${days} days: ${uptimePct(api, days)}% of checks OK overall`}
    >
      <span class="sr-only">
        {api.name} uptime over the last {days} days: {uptimePct(api, days)}% of health checks succeeded.
      </span>
      {slice.map((v, i) => {
        if (v < 0) {
          return (
            <span
              class="b nodata"
              style={`height:100%;--i:${i}`}
              data-tip={`<span class="muted">${dayLabel(offset + i)}</span> · not yet monitored`}
            />
          )
        }
        const pct = (v * 100).toFixed(v >= 0.995 ? 0 : 1)
        const cls = v >= 0.985 ? '' : v >= 0.7 ? ' warn' : ' down'
        const h = Math.max(10, Math.round(v * 100))
        return (
          <span
            class={`b${cls}`}
            style={`height:${h}%;--i:${i}`}
            data-tip={`<span class="muted">${dayLabel(offset + i)}</span> · <b>${pct}%</b> of checks OK`}
          />
        )
      })}
    </div>
  )
}
