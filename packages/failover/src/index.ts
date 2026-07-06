// @shipapis/failover — call the healthiest free API first, fall over automatically.
//
// You give it an ordered set of interchangeable providers (each with its own request logic).
// It reorders them by shipapis.dev's LIVE health data — skipping dead/dying providers to the back —
// then tries them in order, with a per-attempt timeout, until one succeeds.
//
// It is NOT a proxy: your requests go straight to the providers. shipapis is consulted only for
// health ordering, is cached, and — crucially — if it is slow or down the SDK proceeds on your
// original order. A failover library must never become a new point of failure.
//
// Zero dependencies. Runs in browsers, Node ≥18, Deno, Bun and Cloudflare Workers.

/** One interchangeable provider. `run` performs the actual call and returns your normalized value. */
export interface Provider<T> {
  /** shipapis slug — used to look up live health. Use any stable id if the provider isn't listed. */
  slug: string
  /** Perform the call. Honor `signal` for the timeout to work; throw on any failure (incl. bad status). */
  run: (signal: AbortSignal) => Promise<T>
}

export interface FailoverOptions {
  /** Where to read live health. Default: the shipapis feed. Pass `null` to skip health entirely. */
  healthUrl?: string | null
  /** Inject a health map to skip the network fetch (e.g. from your own cache): slug → { ok, status }. */
  health?: HealthMap
  /** Per-attempt timeout in ms (default 6000). Aborts the provider's `signal`. */
  timeoutMs?: number
  /** How long to trust a fetched health map before refetching, ms (default 60_000). */
  healthTtlMs?: number
  /** Override fetch (tests / non-global-fetch runtimes). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch
}

export type HealthMap = Record<string, { ok?: boolean; status?: string }>

export interface Attempt {
  slug: string
  ok: boolean
  ms: number
  error?: string
  /** Health rank the provider was tried at: 'healthy' | 'unknown' | 'down'. */
  tier: Tier
}

export interface FailoverResult<T> {
  value: T
  /** slug of the provider that succeeded. */
  used: string
  attempts: Attempt[]
  /** Was live health actually applied, or did we fall back to your given order? */
  healthApplied: boolean
}

export class AllProvidersFailedError extends Error {
  readonly attempts: Attempt[]
  constructor(attempts: Attempt[]) {
    super(`All ${attempts.length} providers failed: ${attempts.map((a) => `${a.slug} (${a.error ?? 'failed'})`).join(', ')}`)
    this.name = 'AllProvidersFailedError'
    this.attempts = attempts
  }
}

type Tier = 'healthy' | 'unknown' | 'down'
const DEFAULT_HEALTH_URL = 'https://shipapis.dev/data/health.json'
const DOWN_STATUSES = new Set(['dead', 'dying'])

const rankOf = (tier: Tier) => (tier === 'healthy' ? 0 : tier === 'unknown' ? 1 : 2)

function tierFor(slug: string, health: HealthMap | null): Tier {
  const h = health?.[slug]
  if (!h) return 'unknown'
  if (h.ok === false || (h.status && DOWN_STATUSES.has(h.status))) return 'down'
  return 'healthy'
}

/** Run a provider under a timeout. Rejects with an Error whether the call throws or the clock wins. */
async function withTimeout<T>(p: Provider<T>, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
  try {
    return await p.run(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Create a failover caller over a set of interchangeable providers.
 *
 * ```ts
 * const fx = createFailover([
 *   { slug: 'frankfurter',      run: async (s) => (await fetch('https://api.frankfurter.dev/v1/latest?base=USD', { signal: s })).json() },
 *   { slug: 'exchangerate-host', run: async (s) => (await fetch('https://api.exchangerate.host/latest?base=USD', { signal: s })).json() },
 * ])
 * const { value, used } = await fx.run()   // healthiest first, automatic fallback
 * ```
 */
export function createFailover<T>(providers: Provider<T>[], opts: FailoverOptions = {}) {
  if (!providers.length) throw new Error('createFailover: at least one provider is required')
  const {
    healthUrl = DEFAULT_HEALTH_URL,
    timeoutMs = 6000,
    healthTtlMs = 60_000,
    fetchImpl = globalThis.fetch?.bind(globalThis),
  } = opts

  let cache: { at: number; map: HealthMap } | null = null

  async function loadHealth(): Promise<HealthMap | null> {
    if (opts.health) return opts.health
    if (healthUrl === null) return null
    // Serve a fresh-enough cache; never let a slow/failed health fetch block the actual work.
    // We can't read a monotonic clock in every runtime the same way, so Date.now is used only for TTL.
    const now = Date.now()
    if (cache && now - cache.at < healthTtlMs) return cache.map
    if (!fetchImpl) return null
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 2500) // health lookup is best-effort; keep it snappy
      const res = await fetchImpl(healthUrl, { signal: ctrl.signal, headers: { accept: 'application/json' } })
      clearTimeout(timer)
      if (!res.ok) return cache?.map ?? null
      const body = (await res.json()) as { apis?: HealthMap } | HealthMap
      const map = (body && typeof body === 'object' && 'apis' in body ? body.apis : body) as HealthMap
      cache = { at: now, map: map ?? {} }
      return cache.map
    } catch {
      return cache?.map ?? null // offline / slow / blocked → fall back to given order
    }
  }

  async function run(): Promise<FailoverResult<T>> {
    const health = await loadHealth()
    const ordered = providers
      .map((p, i) => ({ p, i, tier: tierFor(p.slug, health) }))
      .sort((a, b) => rankOf(a.tier) - rankOf(b.tier) || a.i - b.i) // stable: health first, else original order

    const attempts: Attempt[] = []
    for (const { p, tier } of ordered) {
      const started = Date.now()
      try {
        const value = await withTimeout(p, timeoutMs)
        attempts.push({ slug: p.slug, ok: true, ms: Date.now() - started, tier })
        return { value, used: p.slug, attempts, healthApplied: health != null }
      } catch (err) {
        attempts.push({ slug: p.slug, ok: false, ms: Date.now() - started, tier, error: err instanceof Error ? err.message : String(err) })
      }
    }
    throw new AllProvidersFailedError(attempts)
  }

  return {
    run,
    /** Force a health refresh on the next run (e.g. after a long idle). */
    invalidateHealth() {
      cache = null
    },
  }
}
