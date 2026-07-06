import type { ApiEntry, LifecycleStatus } from './seed'

export type CheckTier = 'endpoint' | 'reachability' | 'docs' | 'listed'

const DEMO_KEY_MARKERS = /\b(DEMO_KEY|trilogy)\b/i
const PLACEHOLDER_KEY = /YOUR_API_KEY|YOUR_KEY|\{[A-Z][A-Z0-9_]*\}/i
const PATH_DEMO_KEY = /\/json\/v1\/[13]\//

/** True when sampleEndpoint embeds a known public demo key (not a signup placeholder). */
export function hasBakedDemoKey(sampleEndpoint: string): boolean {
  if (PLACEHOLDER_KEY.test(sampleEndpoint)) return false
  return DEMO_KEY_MARKERS.test(sampleEndpoint) || PATH_DEMO_KEY.test(sampleEndpoint)
}

function hasKeyInSample(sampleEndpoint: string): boolean {
  return /[?&](api_key|apikey|key|token|access_token)=/i.test(sampleEndpoint) || PLACEHOLDER_KEY.test(sampleEndpoint)
}

/** Infer how shipapis should check this API — honest tier, no fake endpoint scores. */
export function inferCheckTier(spec: {
  auth: ApiEntry['auth']
  sampleEndpoint: string
  status: LifecycleStatus
  checkTier?: CheckTier
  docsUrl?: string
}): CheckTier {
  if (spec.checkTier) return spec.checkTier
  if (spec.status === 'dead') return 'endpoint'
  if (spec.auth === 'none' || spec.auth === 'userAgent') return 'endpoint'
  if (spec.auth === 'apiKey') {
    if (hasBakedDemoKey(spec.sampleEndpoint)) return 'endpoint'
    if (!hasKeyInSample(spec.sampleEndpoint)) return 'endpoint' // e.g. CoinGecko /ping
    return 'reachability'
  }
  if (spec.auth === 'oauth') {
    return spec.docsUrl && !spec.sampleEndpoint ? 'docs' : 'reachability'
  }
  return 'listed'
}

/** Strip common auth query params before a reachability probe. */
export function stripAuthParams(url: string): string {
  try {
    const u = new URL(url)
    for (const k of ['api_key', 'apikey', 'key', 'token', 'app_id', 'app_key', 'access_token']) {
      u.searchParams.delete(k)
    }
    return u.toString()
  } catch {
    return url
  }
}

export function tierLabel(tier: CheckTier, status: LifecycleStatus): string {
  if (status === 'unmonitored') return tier === 'listed' ? 'Listed' : 'On schedule'
  if (status === 'dead') return 'Dead'
  if (tier === 'reachability') {
    if (status === 'healthy' || status === 'new' || status === 'resurrected') return 'Reachable'
    if (status === 'degraded') return 'Unstable'
    if (status === 'dying') return 'Unreachable'
    return 'Reachable'
  }
  if (tier === 'docs') {
    if (status === 'healthy' || status === 'new' || status === 'resurrected') return 'Docs OK'
    if (status === 'degraded' || status === 'dying') return 'Docs down'
    return 'Docs OK'
  }
  if (tier === 'listed') return 'Listed'
  const labels: Record<LifecycleStatus, string> = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    dying: 'Dying',
    dead: 'Dead',
    new: 'New',
    resurrected: 'Resurrected',
    unmonitored: 'Unmonitored',
  }
  return labels[status]
}

export function tierBlurb(tier: CheckTier): string {
  switch (tier) {
    case 'endpoint':
      return 'We probe a documented GET and expect 2xx JSON — full uptime and health score.'
    case 'reachability':
      return 'We probe without your API key. A 401/403 auth wall means the server is up — not a full health pass.'
    case 'docs':
      return 'We check the documentation URL is online — not the API endpoint itself.'
    case 'listed':
      return 'Catalog metadata only — not on our probe schedule yet.'
  }
}

export const isProbeScheduled = (tier: CheckTier) => tier !== 'listed'
