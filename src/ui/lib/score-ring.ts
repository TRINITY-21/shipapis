import type { CheckTier } from '../../data/check-tier'
import type { ApiEntry } from '../../data/seed'
import { uptimePct } from '../../data/seed'

const HEALTH_TITLE = (n: number) =>
  `Health score ${n}/100 · weighted 60% uptime / 20% latency / 20% shape stability — formula on the Methodology page`

const TIER_TITLE: Record<Exclude<CheckTier, 'endpoint' | 'listed'>, string> = {
  reachability:
    'Reachability score — 90-day server uptime probed without your API key. A 401/403 means the server is up; not full endpoint health.',
  docs: 'Docs liveness score — 90-day documentation URL uptime. Not the API endpoint itself.',
}

/** Score ring display — full health score, or uptime % for reachability/docs tiers. */
export function scoreRingProps(api: ApiEntry): { score: number; title: string } {
  if (api.healthScore >= 0) return { score: api.healthScore, title: HEALTH_TITLE(api.healthScore) }

  if (api.status !== 'unmonitored' && (api.checkTier === 'reachability' || api.checkTier === 'docs')) {
    const raw = uptimePct(api, 90)
    const up = raw === '—' ? -1 : Math.round(Number(raw))
    if (up >= 0) return { score: up, title: TIER_TITLE[api.checkTier] }
  }

  if (api.status === 'unmonitored') {
    return {
      score: -1,
      title: 'Not scored yet — on our probe schedule; uptime appears after the first check lands.',
    }
  }

  return { score: -1, title: 'Not scored yet — monitoring history still building.' }
}
