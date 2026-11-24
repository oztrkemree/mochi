import { expect, test } from 'vitest'

import { bestOf, roundOf, scoreOf } from './game'

test('the same seed gives the same round of hops, and another seed gives a different round', () => {
  expect(roundOf(7)).toEqual(roundOf(7))
  expect(roundOf(7)).not.toEqual(roundOf(8))
})

test('a round has twelve hops, strictly increasing, each inside its own slot of 2.5 seconds, none after the round ends', () => {
  const hops = roundOf(7)
  expect(hops).toHaveLength(12)
  hops.forEach((t, i) => {
    expect(t).toBeGreaterThanOrEqual(i * 2500 + 500)
    expect(t).toBeLessThan(i * 2500 + 1700)
    if (i > 0) expect(t).toBeGreaterThan(hops[i - 1])
  })
  expect(hops[11]).toBeLessThan(30000)
})

test('a press within 800 ms after a hop catches it, a press before the hop catches nothing, and a late press catches nothing', () => {
  expect(scoreOf([1000, 4000], [1500, 3900, 4801])).toBe(1)
  expect(scoreOf([1000], [1800])).toBe(1)
  expect(scoreOf([1000], [999])).toBe(0)
})

test('one press catches only one hop, and one hop counts once however many presses come for it', () => {
  expect(scoreOf([1000, 1100], [1200])).toBe(1)
  expect(scoreOf([1000], [1100, 1200, 1300])).toBe(1)
  expect(scoreOf([1000, 1100], [1050, 1200])).toBe(2)
  expect(scoreOf([], [1000])).toBe(0)
})

test('a new best is kept when it beats the stored one, and a stored text that is not a whole number counts as zero', () => {
  expect(bestOf(null, 3)).toEqual({ best: 3, isNew: true })
  expect(bestOf(null, 0)).toEqual({ best: 0, isNew: false })
  expect(bestOf('7', 5)).toEqual({ best: 7, isNew: false })
  expect(bestOf('7', 8)).toEqual({ best: 8, isNew: true })
  expect(bestOf('x', 4)).toEqual({ best: 4, isNew: true })
  expect(bestOf('-3', 0)).toEqual({ best: 0, isNew: false })
})
