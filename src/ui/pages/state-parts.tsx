import type { FC } from 'hono/jsx'

import type { Child, FC } from 'hono/jsx'

export const StatBar: FC<{ label: string; n: number; total: number; color: string; href?: string }> = ({
  label,
  n,
  total,
  color,
  href,
}) => {
  const pct = total ? Math.round((n / total) * 100) : 0
  const bar = (
    <>
      <span class="statbar-label">{label}</span>
      <span class="statbar-track" aria-hidden="true">
        <span class="statbar-fill" style={`width:${n ? Math.max(pct, 2) : 0}%;background:${color}`} />
      </span>
      <span class="statbar-val">
        <b class="num">{n}</b>
        <span class="dim">{pct}%</span>
      </span>
    </>
  )
  return href ? (
    <a class="statbar statbar-link" href={href}>
      {bar}
    </a>
  ) : (
    <div class="statbar">{bar}</div>
  )
}

export const StateBlock: FC<{ title: string; children?: Child }> = ({ title, children }) => (
  <section class="state-block">
    <h2>{title}</h2>
    <div class="state-rows">{children}</div>
  </section>
)
