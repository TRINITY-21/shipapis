// Small shared pieces of the console's visual language. Kept here so the pages stay about data
// rather than markup, and so a status chip means the same thing on every screen.

import type { Child, FC } from 'hono/jsx'

export const StatTile: FC<{ label: string; value: string | number; sub?: string; tone?: 'ok' | 'warn' | 'flat' }> = ({
  label,
  value,
  sub,
  tone = 'flat',
}) => (
  <div class={`adm-stat adm-stat-${tone}`}>
    <span class="k adm-stat-label">{label}</span>
    <b class="adm-stat-value num">{value}</b>
    {sub && <span class="adm-stat-sub">{sub}</span>}
  </div>
)

const SUB_TONE: Record<string, string> = {
  pending: 'warn',
  auto_validated: 'info',
  approved: 'ok',
  rejected: 'muted',
  spam: 'bad',
  active: 'ok',
  unsubscribed: 'muted',
  bounced: 'bad',
  healthy: 'ok',
  degraded: 'warn',
  dying: 'warn',
  dead: 'bad',
  unmonitored: 'muted',
  new: 'info',
  resurrected: 'info',
}

export const Chip: FC<{ status: string }> = ({ status }) => (
  <span class={`adm-chip adm-chip-${SUB_TONE[status] ?? 'muted'}`}>{status.replace(/_/g, ' ')}</span>
)

export const Card: FC<{ title?: string; hint?: string; actions?: Child; children?: Child }> = ({
  title,
  hint,
  actions,
  children,
}) => (
  <section class="adm-card">
    {(title || actions) && (
      <div class="adm-card-head">
        <div>
          {title && <h2>{title}</h2>}
          {hint && <p class="adm-card-hint">{hint}</p>}
        </div>
        {actions && <div class="adm-card-actions">{actions}</div>}
      </div>
    )}
    {children}
  </section>
)

export const Empty: FC<{ title: string; body?: string }> = ({ title, body }) => (
  <div class="adm-empty">
    <b>{title}</b>
    {body && <p>{body}</p>}
  </div>
)

/** Filter tabs that keep the current query string honest (one param, no hidden state). */
export const FilterTabs: FC<{ base: string; param: string; active: string; tabs: ReadonlyArray<[string, string, number?]> }> = ({
  base,
  param,
  active,
  tabs,
}) => (
  <nav class="adm-tabs" aria-label="Filter">
    {tabs.map(([value, label, count]) => (
      <a
        class={`adm-tab${value === active ? ' on' : ''}`}
        href={value === 'all' ? base : `${base}?${param}=${encodeURIComponent(value)}`}
        aria-current={value === active ? 'true' : undefined}
      >
        {label}
        {count != null && <span class="adm-tab-n num">{count}</span>}
      </a>
    ))}
  </nav>
)

/** Absolute date + relative age. Operators need both: "when exactly" and "how stale". */
export const When: FC<{ iso: string | null; now?: number }> = ({ iso, now = Date.now() }) => {
  if (!iso) return <span class="adm-muted">—</span>
  const ms = now - Date.parse(iso)
  const mins = Math.round(ms / 60_000)
  const rel =
    mins < 1 ? 'just now'
    : mins < 60 ? `${mins}m ago`
    : mins < 1440 ? `${Math.round(mins / 60)}h ago`
    : `${Math.round(mins / 1440)}d ago`
  return (
    <span class="adm-when" title={iso}>
      <span class="adm-when-date num">{iso.slice(0, 10)}</span>
      <span class="adm-when-rel">{rel}</span>
    </span>
  )
}
