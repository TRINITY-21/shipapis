import type { FC } from 'hono/jsx'

export const RowHead: FC = () => (
  <div class="row row-api row-head" aria-hidden="true">
    <span class="k">API</span>
    <span class="k">Status</span>
    <span class="k">Last 14d</span>
    <span class="k">Uptime 90d</span>
    <span class="k">P50</span>
    <span class="k">Auth</span>
    <span class="k">Checked</span>
  </div>
)
