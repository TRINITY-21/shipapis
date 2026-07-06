import { uptimePct, type ApiEntry } from '../../data/seed'

export const CMP_META: ReadonlyArray<readonly [string, (x: ApiEntry) => string, 'good-high' | 'good-low' | null]> = [
  ['Uptime · 90d', (x) => `${uptimePct(x)}%`, 'good-high'],
  ['Uptime · 30d', (x) => `${uptimePct(x, 30)}%`, 'good-high'],
  ['P50 · ms', (x) => (x.p50 > 0 ? String(x.p50) : '—'), 'good-low'],
  ['P95 · ms', (x) => (x.p95 > 0 ? String(x.p95) : '—'), 'good-low'],
  ['Auth', (x) => x.auth, null],
  ['CORS', (x) => x.cors, null],
  ['HTTPS', (x) => (x.https ? 'yes' : 'no'), null],
  ['Card required', (x) => (x.requiresCard ? 'yes' : 'no'), null],
  ['Commercial use', (x) => x.commercialUse, null],
  ['Data license', (x) => x.dataLicense, null],
  ['Free tier', (x) => x.freeTier, null],
  ['Rate limit', (x) => x.rateLimit, null],
  ['In directory since', (x) => x.addedAt, null],
]
