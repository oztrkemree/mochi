import { expect, test } from 'vitest'

import { hopsOn, playsOn, quipOf, temperFrom, tipsOn } from './temper'

const quips = { done: ['a', 'b'], failed: ['c'], level: [] } as const

test('a stored temper is read back as it was saved, and anything else falls back to calm, Mochi as it always was', () => {
  expect(temperFrom('playful')).toBe('playful')
  expect(temperFrom('serious')).toBe('serious')
  expect(temperFrom('calm')).toBe('calm')
  expect(temperFrom('loud')).toBe('calm')
  expect(temperFrom(undefined)).toBe('calm')
  expect(temperFrom(3)).toBe('calm')
})

test('calm and playful let Mochi hop, tip and play, while serious keeps it still and quiet', () => {
  expect([hopsOn('calm'), tipsOn('calm'), playsOn('calm')]).toEqual([true, true, true])
  expect([hopsOn('playful'), tipsOn('playful'), playsOn('playful')]).toEqual([true, true, true])
  expect([hopsOn('serious'), tipsOn('serious'), playsOn('serious')]).toEqual([false, false, false])
})

test('playful Mochi adds a quip to news of a done chat one time in three, cycling through the list', () => {
  expect(quipOf('playful', 'done', 0, quips)).toBe('a')
  expect(quipOf('playful', 'done', 3, quips)).toBe('b')
  expect(quipOf('playful', 'done', 6, quips)).toBe('a')
  expect(quipOf('playful', 'done', 1, quips)).toBeNull()
})

test('no quip for an empty list, a kind that is not a quip kind, calm or serious Mochi, or a roll that is not a whole number of zero or more', () => {
  expect(quipOf('playful', 'level', 0, quips)).toBeNull()
  expect(quipOf('playful', 'asking', 0, quips)).toBeNull()
  expect(quipOf('calm', 'done', 0, quips)).toBeNull()
  expect(quipOf('serious', 'done', 0, quips)).toBeNull()
  expect(quipOf('playful', 'failed', -3, quips)).toBeNull()
  expect(quipOf('playful', 'failed', 1.5, quips)).toBeNull()
})
