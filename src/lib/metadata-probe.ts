// Shared metadata extraction from live HTTP responses (checker + backfill scripts).

export const PROBE_ORIGIN = 'https://shipapis.dev'

/** Placeholder rate-limit copy from import — not provider-verified. */
export const RATE_PLACEHOLDER =
  /^(unpublished|none published|not published|unknown|generous|soft|—|-|\s*)$/i

/** cors_verified column: 1 = ACAO seen, 0 = absent, null = not probed yet */
export function corsVerifiedFromHeaders(headers: Headers): 0 | 1 {
  const acao = headers.get('access-control-allow-origin')
  if (!acao) return 0
  return 1
}

export function corsFromVerified(v: number | null | undefined): 'yes' | 'no' | 'unknown' {
  if (v === 1) return 'yes'
  if (v === 0) return 'no'
  return 'unknown'
}

/** Human-readable rate limit when response headers expose quotas. */
export function rateFromHeaders(headers: Headers): string | null {
  const limit =
    headers.get('x-ratelimit-limit') ??
    headers.get('ratelimit-limit') ??
    headers.get('x-rate-limit-limit')
  const remaining =
    headers.get('x-ratelimit-remaining') ??
    headers.get('ratelimit-remaining') ??
    headers.get('x-rate-limit-remaining')
  const reset = headers.get('x-ratelimit-reset') ?? headers.get('ratelimit-reset')
  const retryAfter = headers.get('retry-after')

  if (limit) {
    const bits = [`${limit} req/window`]
    if (remaining != null) bits.push(`${remaining} remaining`)
    if (reset) bits.push(`resets ${reset}`)
    return bits.join(' · ')
  }
  if (retryAfter) return `Retry-After: ${retryAfter}s`
  return null
}

export function isRatePlaceholder(s: string | null | undefined): boolean {
  if (!s?.trim()) return true
  return RATE_PLACEHOLDER.test(s.trim())
}
