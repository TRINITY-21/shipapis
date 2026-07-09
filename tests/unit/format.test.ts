import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkedAgo,
  chipTone,
  dayLabel,
  daysSinceAdded,
  esc,
  fmtAdded,
  hlJson,
  jsonLdStr,
  lastCheckShort,
  sweepLabel,
} from '../../src/ui/lib/format'
import { makeApi } from '../helpers/fixtures'

describe('esc', () => {
  it('escapes the three HTML-significant characters', () => {
    expect(esc('<a & b>')).toBe('&lt;a &amp; b&gt;')
  })
  it('escapes ampersand before angle brackets (no double-escape)', () => {
    expect(esc('&<')).toBe('&amp;&lt;')
  })
  it('leaves safe text untouched', () => {
    expect(esc('hello world 123')).toBe('hello world 123')
  })
})

describe('jsonLdStr', () => {
  it('escapes < so a </script> payload cannot break out', () => {
    const out = jsonLdStr({ x: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script')
  })
  it('produces valid JSON once unescaped', () => {
    const out = jsonLdStr({ a: 1, b: 'two' })
    expect(JSON.parse(out.replace(/\\u003c/g, '<'))).toEqual({ a: 1, b: 'two' })
  })
})

describe('sweepLabel', () => {
  it('renders an em dash for null', () => {
    expect(sweepLabel(null)).toBe('—')
  })
  it('renders JUST NOW under a minute', () => {
    expect(sweepLabel(0)).toBe('JUST NOW')
    expect(sweepLabel(0.4)).toBe('JUST NOW')
  })
  it('renders minutes otherwise', () => {
    expect(sweepLabel(5)).toBe('5 MIN AGO')
  })
})

describe('lastCheckShort', () => {
  it('collapses sub-minute to Now', () => {
    expect(lastCheckShort(0)).toBe('Now')
    expect(lastCheckShort(0.9)).toBe('Now')
  })
  it('renders minutes under an hour', () => {
    expect(lastCheckShort(30)).toBe('30m')
    expect(lastCheckShort(59)).toBe('59m')
  })
  it('rounds to hours under a day', () => {
    expect(lastCheckShort(90)).toBe('2h') // round(1.5) = 2
    expect(lastCheckShort(1439)).toBe('24h')
  })
  it('rounds to days at a day or more', () => {
    expect(lastCheckShort(1440)).toBe('1d')
    expect(lastCheckShort(2880)).toBe('2d')
  })
})

describe('checkedAgo', () => {
  it('reads "just now" under a minute', () => {
    expect(checkedAgo(0)).toBe('just now')
    expect(checkedAgo(0.5)).toBe('just now')
  })
  it('keeps minutes under an hour', () => {
    expect(checkedAgo(5)).toBe('5 min ago')
    expect(checkedAgo(59)).toBe('59 min ago')
  })
  it('collapses to hours under a day', () => {
    expect(checkedAgo(60)).toBe('1h ago')
    expect(checkedAgo(90)).toBe('2h ago')
  })
  it('collapses to days beyond 24h — never "2650 min ago"', () => {
    expect(checkedAgo(2650)).toBe('2d ago')
    expect(checkedAgo(1440)).toBe('1d ago')
    expect(checkedAgo(2650)).not.toContain('min')
  })
})

describe('hlJson', () => {
  it('wraps keys, strings, numbers and booleans in typed spans', () => {
    const html = hlJson({ name: 'x', count: 3, ok: true, nil: null })
    expect(html).toContain('class="j-key"')
    expect(html).toContain('class="j-str"')
    expect(html).toContain('class="j-num"')
    expect(html).toContain('class="j-bool"')
  })
  it('escapes HTML in values so it cannot inject markup', () => {
    const html = hlJson({ x: '<b>' })
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('dayLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 6, 4))
  })
  afterEach(() => vi.useRealTimers())

  it('maps index 89 to today (UTC)', () => {
    expect(dayLabel(89)).toBe('Jul 4')
  })
  it('counts backwards from today', () => {
    expect(dayLabel(88)).toBe('Jul 3')
    expect(dayLabel(79)).toBe('Jun 24')
  })
  it('advances with the real calendar rather than a frozen anchor', () => {
    vi.setSystemTime(Date.UTC(2026, 6, 9))
    expect(dayLabel(89)).toBe('Jul 9')
    expect(dayLabel(88)).toBe('Jul 8')
  })
})

describe('fmtAdded', () => {
  it('formats an ISO date uppercased in UTC', () => {
    expect(fmtAdded('2026-01-01')).toBe('JAN 1')
    expect(fmtAdded('2026-12-25')).toBe('DEC 25')
  })
})

describe('daysSinceAdded', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 6, 4))
  })
  afterEach(() => vi.useRealTimers())

  it('measures whole days against today (UTC)', () => {
    expect(daysSinceAdded(makeApi({ addedAt: '2026-07-01' }))).toBe(3)
    expect(daysSinceAdded(makeApi({ addedAt: '2026-07-04' }))).toBe(0)
  })
})

describe('chipTone', () => {
  it('marks affirmative values good', () => {
    expect(chipTone('yes')).toBe('yes')
    expect(chipTone('true')).toBe('yes')
    expect(chipTone(true)).toBe('yes')
  })
  it('marks unknown/unclear as meh', () => {
    expect(chipTone('unknown')).toBe('meh')
    expect(chipTone('unclear')).toBe('meh')
  })
  it('marks everything else no', () => {
    expect(chipTone('no')).toBe('no')
    expect(chipTone(false)).toBe('no')
  })
  it('honors a custom good-set', () => {
    expect(chipTone('open', ['open'])).toBe('yes')
    expect(chipTone('yes', ['open'])).toBe('no')
  })
})
