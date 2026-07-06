import { describe, expect, it } from 'vitest'
import { scoreRingProps } from '../../src/ui/lib/score-ring'
import { makeApi } from '../helpers/fixtures'

describe('scoreRingProps', () => {
  it('shows the real health score when one exists', () => {
    const api = makeApi({ status: 'healthy', healthScore: 88 })
    const { score, title } = scoreRingProps(api)
    expect(score).toBe(88)
    expect(title).toContain('Health score 88/100')
  })

  it('falls back to reachability uptime% when there is no health score', () => {
    // A reachability-tier API that has history but no computed health score (the D1 overlay
    // can produce healthScore = -1 while status is still healthy).
    const base = makeApi({ status: 'healthy', auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' })
    const api = { ...base, healthScore: -1, checkTier: 'reachability' as const }
    const { score, title } = scoreRingProps(api)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
    expect(title).toContain('Reachability score')
  })

  it('returns the -1 sentinel with a "not scored yet" title for unmonitored records', () => {
    const api = makeApi({ status: 'unmonitored', auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' })
    const { score, title } = scoreRingProps(api)
    expect(score).toBe(-1)
    expect(title).toMatch(/not scored yet/i)
  })

  it('returns -1 when history is still building for a non-reachability tier', () => {
    const base = makeApi({ status: 'new', auth: 'none' }) // endpoint tier
    const api = { ...base, healthScore: -1 }
    const { score } = scoreRingProps(api)
    expect(score).toBe(-1)
  })
})
