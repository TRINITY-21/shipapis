import type { FC } from 'hono/jsx'

export const Sparkline: FC<{ points: number[]; width?: number }> = ({ points, width = 600 }) => {
  if (!points.length) return null
  const h = 56
  const pad = 3
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(1, max - min)
  const step = (width - pad * 2) / (points.length - 1)
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2)
  const coords = points.map((v, i) => `${(pad + i * step).toFixed(1)},${y(v).toFixed(1)}`)
  const lastX = pad + (points.length - 1) * step
  return (
    <div class="spark-wrap" data-points={points.join(',')}>
      <svg class="spark" viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Response time over the last ${points.length} checks, between ${min} and ${max} milliseconds`}>
        <line class="gridline" x1="0" y1={h / 2} x2={width} y2={h / 2} />
        <polygon class="fill" points={`${pad},${h} ${coords.join(' ')} ${lastX},${h}`} />
        <polyline class="line" points={coords.join(' ')} />
        <circle class="dot" cx={lastX} cy={y(points[points.length - 1])} r="3" />
      </svg>
      <span class="sr-only">Fastest {min} ms, slowest {max} ms, most recent {points[points.length - 1]} ms.</span>
    </div>
  )
}
