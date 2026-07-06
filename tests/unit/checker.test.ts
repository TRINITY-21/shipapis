import { describe, expect, it } from 'vitest'
import {
  buildDaySeries,
  dayOf,
  hashSig,
  shapeSignature,
  stripAuthParams,
  summarizeDiff,
} from '../../src/workers/checker'

describe('shapeSignature', () => {
  it('captures a flat path→type map, sampling arrays by their first element', () => {
    const sig = shapeSignature({ a: 1, b: 'x', c: true, d: null, e: [1, 2], f: { g: 2 } })
    expect(sig).toMatchObject({
      a: 'number',
      b: 'string',
      c: 'boolean',
      d: 'null',
      e: 'array',
      'e[]': 'number',
      f: 'object',
      'f.g': 'number',
    })
  })

  it('descends into arrays of objects', () => {
    const sig = shapeSignature({ list: [{ x: 1 }] })
    expect(sig['list']).toBe('array')
    expect(sig['list[]']).toBe('object')
    expect(sig['list[].x']).toBe('number')
  })

  it('is key-order independent', () => {
    expect(shapeSignature({ a: 1, b: 2 })).toEqual(shapeSignature({ b: 2, a: 1 }))
  })
})

describe('hashSig', () => {
  it('is stable and value-insensitive (same structure ⇒ same hash)', () => {
    const a = hashSig(shapeSignature({ temp: 20, city: 'NYC' }))
    const b = hashSig(shapeSignature({ temp: -5, city: 'LA' }))
    expect(a).toBe(b)
  })

  it('changes when a field is retyped', () => {
    const num = hashSig(shapeSignature({ id: 1 }))
    const str = hashSig(shapeSignature({ id: '1' }))
    expect(num).not.toBe(str)
  })

  it('changes when a field is added or removed', () => {
    const one = hashSig(shapeSignature({ a: 1 }))
    const two = hashSig(shapeSignature({ a: 1, b: 2 }))
    expect(one).not.toBe(two)
  })
})

describe('summarizeDiff', () => {
  it('reports an added field', () => {
    expect(summarizeDiff({}, { x: 'number' })).toBe('+x:number')
  })

  it('reports a retyped field with an arrow', () => {
    const out = summarizeDiff({ x: 'number' }, { x: 'string' })
    expect(out.startsWith('~x:')).toBe(true)
    expect(out).toContain('number')
    expect(out).toContain('string')
  })

  it('reports a removed field', () => {
    const out = summarizeDiff({ x: 'number' }, {})
    expect(out).toContain('x')
    expect(out).not.toContain('+')
    expect(out).not.toContain('~')
  })

  it('returns a fallback string when signatures are identical', () => {
    expect(summarizeDiff({ x: 'number' }, { x: 'number' })).toBe('shape changed')
  })

  it('truncates long diffs with an overflow marker', () => {
    const oldSig = {}
    const newSig = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`f${i}`, 'number']))
    const out = summarizeDiff(oldSig, newSig)
    expect(out).toMatch(/…\(\+4 more\)$/)
  })
})

describe('dayOf', () => {
  it('extracts the calendar day from an ISO timestamp', () => {
    expect(dayOf('2026-07-04T13:45:00.000Z')).toBe('2026-07-04')
  })
})

describe('buildDaySeries', () => {
  const today = new Date().toISOString().slice(0, 10)

  it('materializes a 90-slot uptime axis with -1 for missing days', () => {
    const series = JSON.parse(
      buildDaySeries([
        { day: today, up: 1, ms: 100, p95: 150, n: 1 },
        { day: today, up: 0, ms: 200, p95: 250, n: 1 },
      ]),
    )
    expect(series.u).toHaveLength(90)
    expect(series.u[89]).toBe(0.5) // today = mean(1, 0)
    expect(series.u[0]).toBe(-1) // 89 days ago = no data
    expect(series.l).toEqual([150]) // mean latency for the single day
    expect(series.p50).toBe(150)
    expect(series.p95).toBe(200) // p95 is averaged within a day (mean(150, 250)), then max across days
  })

  it('handles an empty input', () => {
    const series = JSON.parse(buildDaySeries([]))
    expect(series.u.every((v: number) => v === -1)).toBe(true)
    expect(series.l).toEqual([])
    expect(series.p50).toBe(0)
    expect(series.p95).toBe(0)
  })
})

describe('stripAuthParams (checker copy)', () => {
  it('strips auth query keys and keeps the rest', () => {
    const out = stripAuthParams('https://api.x.com/d?key=SECRET&lat=1')
    expect(out).not.toContain('SECRET')
    expect(out).toContain('lat=1')
  })
  it('returns the input verbatim for a non-URL', () => {
    expect(stripAuthParams('::not a url::')).toBe('::not a url::')
  })
})
