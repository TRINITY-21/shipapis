import { describe, expect, it } from 'vitest'
import {
  hasBakedDemoKey,
  inferCheckTier,
  isProbeScheduled,
  stripAuthParams,
  tierBlurb,
  tierLabel,
  type CheckTier,
} from '../../src/data/check-tier'

describe('hasBakedDemoKey', () => {
  it('detects a public DEMO_KEY', () => {
    expect(hasBakedDemoKey('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY')).toBe(true)
  })
  it('detects the TheMealDB /1/ demo path', () => {
    expect(hasBakedDemoKey('https://www.themealdb.com/api/json/v1/1/random.php')).toBe(true)
  })
  it('detects the "trilogy" marker', () => {
    expect(hasBakedDemoKey('https://api.example.com/trilogy/data')).toBe(true)
  })
  it('returns false for a signup placeholder even if other markers appear', () => {
    expect(hasBakedDemoKey('https://api.example.com/data?api_key=YOUR_API_KEY')).toBe(false)
    expect(hasBakedDemoKey('https://api.example.com/{API_KEY}/json/v1/1/x')).toBe(false)
  })
  it('returns false for a plain keyless endpoint', () => {
    expect(hasBakedDemoKey('https://api.example.com/v1/ping')).toBe(false)
  })
})

describe('inferCheckTier', () => {
  const base = { auth: 'none', sampleEndpoint: '/ping', status: 'healthy', docsUrl: 'https://d' } as const

  it('respects an explicit checkTier override', () => {
    expect(inferCheckTier({ ...base, checkTier: 'docs' })).toBe('docs')
  })
  it('probes the endpoint for keyless APIs', () => {
    expect(inferCheckTier({ ...base, auth: 'none' })).toBe('endpoint')
    expect(inferCheckTier({ ...base, auth: 'userAgent' })).toBe('endpoint')
  })
  it('probes the endpoint for a dead API regardless of auth', () => {
    expect(inferCheckTier({ ...base, auth: 'apiKey', status: 'dead' })).toBe('endpoint')
  })
  it('probes the endpoint for apiKey when a baked demo key is present', () => {
    expect(
      inferCheckTier({ ...base, auth: 'apiKey', sampleEndpoint: '/apod?api_key=DEMO_KEY' }),
    ).toBe('endpoint')
  })
  it('probes the endpoint for apiKey when the sample carries no key (e.g. /ping)', () => {
    expect(inferCheckTier({ ...base, auth: 'apiKey', sampleEndpoint: '/ping' })).toBe('endpoint')
  })
  it('drops apiKey with a required signup key to reachability', () => {
    expect(
      inferCheckTier({ ...base, auth: 'apiKey', sampleEndpoint: '/data?api_key=YOUR_API_KEY' }),
    ).toBe('reachability')
  })
  it('uses docs tier for oauth documented without a sample endpoint', () => {
    expect(inferCheckTier({ auth: 'oauth', sampleEndpoint: '', status: 'healthy', docsUrl: 'https://d' })).toBe('docs')
  })
  it('uses reachability for oauth with a sample endpoint', () => {
    expect(inferCheckTier({ auth: 'oauth', sampleEndpoint: '/me', status: 'healthy', docsUrl: 'https://d' })).toBe('reachability')
  })
  it('falls back to listed for an unrecognized auth scheme', () => {
    expect(inferCheckTier({ auth: 'saml' as never, sampleEndpoint: '/x', status: 'healthy' })).toBe('listed')
  })
})

describe('stripAuthParams', () => {
  it('removes every known auth query key', () => {
    const out = stripAuthParams('https://api.x.com/d?api_key=A&token=B&app_id=C&keep=1')
    expect(out).not.toMatch(/api_key|token|app_id/)
    expect(out).toContain('keep=1')
  })
  it('leaves an auth-free URL unchanged', () => {
    expect(stripAuthParams('https://api.x.com/d?lat=1&lon=2')).toBe('https://api.x.com/d?lat=1&lon=2')
  })
  it('returns the input verbatim when it is not a valid URL', () => {
    expect(stripAuthParams('not a url ?key=secret')).toBe('not a url ?key=secret')
  })
})

describe('tierLabel', () => {
  it('labels unmonitored records by schedule state', () => {
    expect(tierLabel('listed', 'unmonitored')).toBe('Listed')
    expect(tierLabel('endpoint', 'unmonitored')).toBe('On schedule')
  })
  it('labels reachability by lifecycle', () => {
    expect(tierLabel('reachability', 'healthy')).toBe('Reachable')
    expect(tierLabel('reachability', 'degraded')).toBe('Unstable')
    expect(tierLabel('reachability', 'dying')).toBe('Unreachable')
  })
  it('labels docs tier', () => {
    expect(tierLabel('docs', 'healthy')).toBe('Docs OK')
    expect(tierLabel('docs', 'dying')).toBe('Docs down')
  })
  it('labels endpoint tier straight from lifecycle', () => {
    expect(tierLabel('endpoint', 'healthy')).toBe('Healthy')
    expect(tierLabel('endpoint', 'degraded')).toBe('Degraded')
    expect(tierLabel('endpoint', 'dead')).toBe('Dead')
  })
})

describe('tierBlurb', () => {
  it('returns a distinct sentence per tier', () => {
    const tiers: CheckTier[] = ['endpoint', 'reachability', 'docs', 'listed']
    const blurbs = tiers.map(tierBlurb)
    expect(new Set(blurbs).size).toBe(4)
    for (const b of blurbs) expect(b.length).toBeGreaterThan(10)
  })
})

describe('isProbeScheduled', () => {
  it('is false only for listed-only records', () => {
    expect(isProbeScheduled('listed')).toBe(false)
    expect(isProbeScheduled('endpoint')).toBe(true)
    expect(isProbeScheduled('reachability')).toBe(true)
    expect(isProbeScheduled('docs')).toBe(true)
  })
})
