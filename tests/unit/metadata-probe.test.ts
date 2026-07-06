import { describe, expect, it } from 'vitest'
import {
  corsFromVerified,
  corsVerifiedFromHeaders,
  isRatePlaceholder,
  rateFromHeaders,
} from '../../src/lib/metadata-probe'

describe('corsVerifiedFromHeaders', () => {
  it('returns 1 when Access-Control-Allow-Origin is present', () => {
    expect(corsVerifiedFromHeaders(new Headers({ 'access-control-allow-origin': '*' }))).toBe(1)
  })
  it('returns 0 when absent', () => {
    expect(corsVerifiedFromHeaders(new Headers({ 'content-type': 'application/json' }))).toBe(0)
  })
})

describe('corsFromVerified', () => {
  it('maps the tri-state column to yes/no/unknown', () => {
    expect(corsFromVerified(1)).toBe('yes')
    expect(corsFromVerified(0)).toBe('no')
    expect(corsFromVerified(null)).toBe('unknown')
    expect(corsFromVerified(undefined)).toBe('unknown')
  })
})

describe('rateFromHeaders', () => {
  it('summarizes a standard ratelimit trio', () => {
    const h = new Headers({
      'x-ratelimit-limit': '100',
      'x-ratelimit-remaining': '42',
      'x-ratelimit-reset': '60',
    })
    expect(rateFromHeaders(h)).toBe('100 req/window · 42 remaining · resets 60')
  })
  it('accepts the un-prefixed RateLimit-* spelling', () => {
    expect(rateFromHeaders(new Headers({ 'ratelimit-limit': '10' }))).toBe('10 req/window')
  })
  it('falls back to Retry-After when no limit header is present', () => {
    expect(rateFromHeaders(new Headers({ 'retry-after': '30' }))).toBe('Retry-After: 30s')
  })
  it('returns null when nothing quota-related is exposed', () => {
    expect(rateFromHeaders(new Headers({ 'content-type': 'application/json' }))).toBeNull()
  })
})

describe('isRatePlaceholder', () => {
  it('treats empty/whitespace/nullish as placeholder', () => {
    expect(isRatePlaceholder('')).toBe(true)
    expect(isRatePlaceholder('   ')).toBe(true)
    expect(isRatePlaceholder(null)).toBe(true)
    expect(isRatePlaceholder(undefined)).toBe(true)
  })
  it('treats known non-committal copy as placeholder', () => {
    for (const s of ['unpublished', 'None published', 'not published', 'unknown', 'generous', 'soft', '—', '-']) {
      expect(isRatePlaceholder(s)).toBe(true)
    }
  })
  it('treats a real quota as concrete', () => {
    expect(isRatePlaceholder('60 req/min')).toBe(false)
    expect(isRatePlaceholder('1000/day')).toBe(false)
  })
})
