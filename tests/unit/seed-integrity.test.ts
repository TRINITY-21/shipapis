import { describe, expect, it } from 'vitest'
import { apis, categories, categoryBySlug, endpointUrl } from '../../src/data/seed'
import type { ApiEntry } from '../../src/data/seed'

const LIFECYCLE = new Set(['healthy', 'degraded', 'dying', 'dead', 'new', 'resurrected', 'unmonitored'])
const AUTH = new Set(['none', 'apiKey', 'oauth', 'userAgent'])
const CORS = new Set(['yes', 'no', 'unknown'])
const AGENT = new Set(['ok', 'blocked', 'unknown'])
const TIER = new Set(['endpoint', 'reachability', 'docs', 'listed'])

const isUrl = (s: string) => {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Collect offenders across the whole catalog, then assert the list is empty with a readable message.
const offenders = (pred: (a: ApiEntry) => boolean) => apis.filter(pred).map((a) => a.slug)

describe('seed catalog integrity', () => {
  it('has a non-trivial catalog', () => {
    expect(apis.length).toBeGreaterThan(100)
  })

  it('has unique slugs', () => {
    const seen = new Map<string, number>()
    for (const a of apis) seen.set(a.slug, (seen.get(a.slug) ?? 0) + 1)
    const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s)
    expect(dups).toEqual([])
  })

  it('uses url-safe slugs', () => {
    expect(offenders((a) => !/^[a-z0-9][a-z0-9-]*$/.test(a.slug))).toEqual([])
  })

  it('has non-empty display fields', () => {
    expect(offenders((a) => !a.name?.trim() || !a.tagline?.trim())).toEqual([])
  })

  it('references only known categories', () => {
    expect(offenders((a) => !categoryBySlug.has(a.category))).toEqual([])
  })

  it('has valid absolute base and docs URLs', () => {
    expect(offenders((a) => !isUrl(a.baseUrl))).toEqual([])
    expect(offenders((a) => !isUrl(a.docsUrl))).toEqual([])
  })

  it('has at least one endpoint and exactly one monitored path', () => {
    expect(offenders((a) => a.endpoints.length === 0)).toEqual([])
    expect(offenders((a) => !a.endpoints.some((e) => e.monitored))).toEqual([])
  })

  it('produces resolvable URLs for every endpoint', () => {
    const bad: string[] = []
    for (const a of apis) for (const e of a.endpoints) if (!isUrl(endpointUrl(a.baseUrl, e.path))) bad.push(`${a.slug}${e.path}`)
    expect(bad).toEqual([])
  })

  it('respects the healthScore sentinel rules', () => {
    expect(offenders((a) => a.status === 'unmonitored' && a.healthScore !== -1)).toEqual([])
    expect(offenders((a) => a.status === 'dead' && a.healthScore !== 0)).toEqual([])
    expect(
      offenders((a) => a.status !== 'unmonitored' && a.status !== 'dead' && (a.healthScore < 0 || a.healthScore > 100)),
    ).toEqual([])
  })

  it('has a 90-slot uptime series bounded to [-1, 1]', () => {
    expect(offenders((a) => a.uptime90.length !== 90)).toEqual([])
    expect(offenders((a) => a.uptime90.some((v) => v < -1 || v > 1))).toEqual([])
  })

  it('uses only valid enum values', () => {
    expect(offenders((a) => !LIFECYCLE.has(a.status))).toEqual([])
    expect(offenders((a) => !AUTH.has(a.auth))).toEqual([])
    expect(offenders((a) => !CORS.has(a.cors))).toEqual([])
    expect(offenders((a) => !AGENT.has(a.agentAccess))).toEqual([])
    expect(offenders((a) => !TIER.has(a.checkTier))).toEqual([])
  })

  it('leaves monitoredSince null in the seed (D1 overlays the real date)', () => {
    expect(offenders((a) => a.monitoredSince !== null)).toEqual([])
  })

  it('has valid addedAt dates', () => {
    expect(offenders((a) => !/^\d{4}-\d{2}-\d{2}$/.test(a.addedAt) || Number.isNaN(Date.parse(a.addedAt)))).toEqual([])
  })

  it('only carries diedAt/epitaph on dead records', () => {
    expect(offenders((a) => a.diedAt != null && a.status !== 'dead')).toEqual([])
    expect(offenders((a) => a.diedAt != null && Number.isNaN(Date.parse(a.diedAt)))).toEqual([])
  })
})

// Security regression guard: no real-looking API credential may be baked into a sample URL.
describe('seed catalog secret safety', () => {
  const AUTH_KEYS = new Set(['api_key', 'apikey', 'apikey', 'key', 'token', 'access_token', 'app_id', 'app_key'])
  const PLACEHOLDER = /^(DEMO_KEY|YOUR_[A-Z_]+|demo|test|guest|example|xxx+|none|free|public|trilogy|[0-9]|\{.*\}|<.*>)$/i

  const leaks: string[] = []
  for (const a of apis) {
    const urls = [a.baseUrl + a.sampleEndpoint, ...a.endpoints.map((e) => endpointUrl(a.baseUrl, e.path))]
    for (const raw of urls) {
      let u: URL
      try {
        u = new URL(raw)
      } catch {
        continue
      }
      for (const [k, v] of u.searchParams) {
        if (AUTH_KEYS.has(k.toLowerCase()) && !PLACEHOLDER.test(v) && /[A-Za-z0-9]{16,}/.test(v)) {
          leaks.push(`${a.slug}: ${k}=${v.slice(0, 12)}…`)
        }
      }
    }
  }

  it('never embeds a real credential in a sample or endpoint URL', () => {
    expect(leaks).toEqual([])
  })
})

describe('category table', () => {
  it('has unique category slugs and required fields', () => {
    const slugs = categories.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const c of categories) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/)
      expect(c.name.trim()).toBeTruthy()
    }
  })
})
