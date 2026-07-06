// Test fixtures — build valid ApiEntry records through the real seed `build()` so tests
// exercise the same construction path production uses (check-tier inference, health series,
// endpoint resolution). Override only the fields a given test cares about.
import { build, type ApiEntry, type ApiSpec } from '../../src/data/seed'

const BASE_SPEC: ApiSpec = {
  slug: 'test-api',
  name: 'Test API',
  emoji: '🧪',
  tagline: 'A test API for fixtures',
  description: 'Longer description used by the test fixture factory.',
  category: 'developer',
  docsUrl: 'https://example.com/docs',
  baseUrl: 'https://api.example.com',
  sampleEndpoint: '/v1/ping',
  auth: 'none',
  https: true,
  cors: 'yes',
  commercialUse: 'yes',
  dataLicense: 'MIT',
  freeTier: '1000 req/day',
  rateLimit: '60 req/min',
  requiresCard: false,
  status: 'healthy',
  lastCheckedMin: 3,
  addedAt: '2026-01-01',
  sample: { ok: true },
  shapeChanges: [],
  baseLatency: 90,
}

/** Build a valid ApiEntry, overriding any spec fields. */
export function makeApi(overrides: Partial<ApiSpec> = {}): ApiEntry {
  return build({ ...BASE_SPEC, ...overrides })
}

/** Build several APIs from partial specs; slug auto-fills if omitted. */
export function makeApis(specs: Partial<ApiSpec>[]): ApiEntry[] {
  return specs.map((s, i) => makeApi({ slug: s.slug ?? `test-api-${i}`, ...s }))
}
