import type { Hono } from 'hono'
import { catBySlug } from '../data/catalog'
import { uptimePct, type LifecycleStatus } from '../data/seed'
import type { Env } from '../workers/env'

const STATUS_COLOR: Record<LifecycleStatus, string> = {
  healthy: '#047857',
  new: '#1d4ed8',
  resurrected: '#7e22ce',
  degraded: '#b45309',
  dying: '#c2410c',
  dead: '#b91c1c',
  unmonitored: '#575e69',
}

const badgeLabel = (status: LifecycleStatus, health: number, uptime: string) => {
  if (status === 'unmonitored') return 'catalogued'
  if (status === 'dead') return 'dead'
  if (health >= 0) return `${health} health`
  return `${uptime}% up`
}

export function registerBadge(app: Hono<{ Bindings: Env }>) {
  app.get('/badge/:slug', (c) => {
    const raw = c.req.param('slug')
    if (!raw.endsWith('.svg')) return c.text('not found', 404)
    const slug = raw.slice(0, -4)
    const api = catBySlug().get(slug)
    if (!api) return c.text('not found', 404)
    const label = badgeLabel(api.status, api.healthScore, uptimePct(api))
    const color = STATUS_COLOR[api.status]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="20" role="img" aria-label="shipapis ${label}">
  <title>shipapis: ${label}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="132" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="62" height="20" fill="#555"/>
    <rect x="62" width="70" height="20" fill="${color}"/>
    <rect width="132" height="20" fill="url(#s)"/>
    <g fill="#fff" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="11">
      <text x="31" y="14" fill="#010101" fill-opacity=".3">shipapis</text>
      <text x="31" y="13">shipapis</text>
      <text x="97" y="14" fill="#010101" fill-opacity=".3">${label}</text>
      <text x="97" y="13">${label}</text>
    </g>
  </g>
</svg>`
    return c.body(svg, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' })
  })
}
