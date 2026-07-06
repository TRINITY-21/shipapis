import type { FC } from 'hono/jsx'

export const BarsLegend: FC = () => (
  <div class="bars-legend">
    <span><i class="i-ok" />operational</span>
    <span><i class="i-warn" />partial</span>
    <span><i class="i-down" />down</span>
    <span><i class="i-nodata" />no data</span>
  </div>
)
