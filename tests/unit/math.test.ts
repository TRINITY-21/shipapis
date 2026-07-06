import { describe, expect, it } from 'vitest'
import { median } from '../../src/ui/lib/math'

describe('median', () => {
  it('returns 0 for an empty array', () => {
    expect(median([])).toBe(0)
  })

  it('returns the middle element for odd-length input', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([5])).toBe(5)
  })

  it('averages the two middle elements for even-length input', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([10, 20])).toBe(15)
  })

  it('sorts numerically, not lexicographically', () => {
    // A lexical sort would put 100 before 9 and pick the wrong middle.
    expect(median([100, 9, 1])).toBe(9)
  })

  it('does not mutate the input array', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })
})
