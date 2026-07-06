// Runnable proof: node demo.ts
// Two scenarios against real endpoints — (1) automatic failover, (2) live-health reordering.
import { createFailover } from './src/index.ts'

type Rates = { base?: string; rates?: Record<string, number>; amount?: number }

const providers = [
  {
    slug: 'broken-provider',
    run: async (signal: AbortSignal): Promise<Rates> => {
      const r = await fetch('https://this-host-does-not-exist.invalid/latest', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    },
  },
  {
    slug: 'frankfurter',
    run: async (signal: AbortSignal): Promise<Rates> => {
      const r = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP', { signal })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    },
  },
]

console.log('\n① Failover (no health feed — try in given order, fall over on failure):')
const fx1 = createFailover<Rates>(providers, { healthUrl: null, timeoutMs: 5000 })
const r1 = await fx1.run()
console.log('   used:', r1.used, '| EUR:', r1.value.rates?.EUR)
console.log('   attempts:', r1.attempts.map((a) => `${a.slug}=${a.ok ? 'ok' : a.error}`).join('  →  '))

console.log('\n② Live-health reordering (inject health: broken is "dead" → sent to the back):')
const fx2 = createFailover<Rates>(providers, {
  health: { 'broken-provider': { ok: false, status: 'dead' }, frankfurter: { ok: true, status: 'healthy' } },
  timeoutMs: 5000,
})
const r2 = await fx2.run()
console.log('   used:', r2.used, '| healthApplied:', r2.healthApplied)
console.log('   attempts (order):', r2.attempts.map((a) => `${a.slug}[${a.tier}]`).join('  →  '))
console.log('   → healthy provider tried FIRST, the dead one never called.\n')
