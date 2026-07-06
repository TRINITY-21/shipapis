import type { FC } from 'hono/jsx'

export const ScoreRing: FC<{ score: number; lg?: boolean; title?: string }> = ({ score, lg, title }) => {
  const size = lg ? 64 : 40
  const r = lg ? 28 : 16.5
  const sw = lg ? 4 : 3
  const c = 2 * Math.PI * r
  const scored = score >= 0
  const fill = score >= 80 ? 'fill-ok' : score >= 50 ? 'fill-warn' : 'fill-bad'
  const defaultTitle = scored
    ? `Health score ${score}/100 · weighted 60% uptime / 20% latency / 20% shape stability — formula on the Methodology page`
    : 'Not scored yet — imported and probed once, but no monitoring history. A score appears after the checker runs.'
  return (
    <span class={`score${lg ? ' lg' : ''}`} title={title ?? defaultTitle}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle class="track" cx={size / 2} cy={size / 2} r={r} fill="none" stroke-width={sw} />
        {scored && (
          <circle
            class={fill}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke-width={sw}
            stroke-linecap="round"
            stroke-dasharray={`${(c * score) / 100} ${c}`}
          />
        )}
      </svg>
      <b>{scored ? score : '—'}</b>
    </span>
  )
}
