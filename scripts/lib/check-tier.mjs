// Mirror of src/data/check-tier.ts for plain-node import scripts.

const DEMO_KEY_MARKERS = /\b(DEMO_KEY|trilogy)\b/i
const PLACEHOLDER_KEY = /YOUR_API_KEY|YOUR_KEY|\{[A-Z][A-Z0-9_]*\}/i
const PATH_DEMO_KEY = /\/json\/v1\/[13]\//

export function hasBakedDemoKey(sampleEndpoint) {
  if (PLACEHOLDER_KEY.test(sampleEndpoint)) return false
  return DEMO_KEY_MARKERS.test(sampleEndpoint) || PATH_DEMO_KEY.test(sampleEndpoint)
}

function hasKeyInSample(sampleEndpoint) {
  return /[?&](api_key|apikey|key|token|access_token)=/i.test(sampleEndpoint) || PLACEHOLDER_KEY.test(sampleEndpoint)
}

export function inferCheckTier({ auth, sampleEndpoint, status, checkTier, docsUrl }) {
  if (checkTier) return checkTier
  if (status === 'dead') return 'endpoint'
  if (auth === 'none' || auth === 'userAgent') return 'endpoint'
  if (auth === 'apiKey') {
    if (hasBakedDemoKey(sampleEndpoint)) return 'endpoint'
    if (!hasKeyInSample(sampleEndpoint)) return 'endpoint'
    return 'reachability'
  }
  if (auth === 'oauth') {
    return docsUrl && !sampleEndpoint ? 'docs' : 'reachability'
  }
  return 'listed'
}
