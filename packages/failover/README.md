# @shipapis/failover

Call the healthiest free API first, and fall over automatically when one fails — using the **live health data** from [shipapis.dev](https://shipapis.dev).

Most "free API" outages aren't your fault: the provider went down, got rate-limited, or a WAF started blocking server-side calls. If two providers do the same job (FX rates, geocoding, IP lookup, weather…), you shouldn't hard-code one and hope. This picks the one that's actually up right now.

- **Not a proxy.** Your requests go straight to the providers. shipapis is consulted only for health ordering.
- **Never a new point of failure.** Health is cached and best-effort; if shipapis is slow or down, the SDK proceeds on your given order.
- **Zero dependencies.** Browsers, Node ≥18, Deno, Bun, Cloudflare Workers.

## Install

```bash
npm i @shipapis/failover
```

## Use

```ts
import { createFailover } from '@shipapis/failover'

// Interchangeable providers — each does the same job, its own way.
const fx = createFailover([
  {
    slug: 'frankfurter', // the shipapis slug — used to look up live health
    run: async (signal) => {
      const r = await fetch('https://api.frankfurter.dev/v1/latest?base=USD', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    },
  },
  {
    slug: 'exchangerate-host',
    run: async (signal) => {
      const r = await fetch('https://api.exchangerate.host/latest?base=USD', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    },
  },
])

const { value, used, attempts } = await fx.run()
// value  → the winning provider's response
// used   → 'frankfurter' (or whichever was healthiest + succeeded)
// attempts → per-provider log with timing + health tier
```

`run()` reorders your providers by live health (healthy first, `dead`/`dying` sent to the back), then calls them in order with a per-attempt timeout until one succeeds. If they all fail it throws `AllProvidersFailedError` with the full `attempts` log.

## API

### `createFailover<T>(providers, options?)`

**`providers`** — `{ slug, run }[]`. `run(signal)` performs the call and returns your value; **throw** on any failure (including a bad HTTP status), and pass `signal` to your `fetch` so the timeout works.

**`options`**

| option | default | meaning |
|---|---|---|
| `healthUrl` | shipapis feed | Where to read health. `null` disables it (pure given-order failover). |
| `health` | — | Inject a health map (`slug → { ok, status }`) to skip the network fetch. |
| `timeoutMs` | `6000` | Per-attempt timeout. |
| `healthTtlMs` | `60000` | How long a fetched health map is trusted before refetch. |
| `fetchImpl` | `globalThis.fetch` | Override for tests / non-standard runtimes. |

Returns `{ run(), invalidateHealth() }`.

### `run(): Promise<FailoverResult<T>>`

```ts
{
  value: T
  used: string            // slug that succeeded
  attempts: Attempt[]     // { slug, ok, ms, tier, error? }
  healthApplied: boolean  // false if the health lookup was skipped/unavailable
}
```

## How health ordering works

The SDK reads [`/data/health.json`](https://shipapis.dev/data/health.json) — a tiny `slug → { status, ok }` snapshot backed by real probes. Providers are bucketed **healthy → unknown → down** (down = `ok:false` or status `dead`/`dying`), stable within each bucket. Unknown providers (not in the feed) keep your given order. A down provider is still tried, but only as a last resort.

## License

MIT · part of [shipapis](https://shipapis.dev) — the free-API directory that health-checks everything it lists.
