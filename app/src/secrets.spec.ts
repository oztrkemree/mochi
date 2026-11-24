import { expect, test } from 'vitest'

import type { DayRec, History } from '../../types'
import { secretsNow, secretsWon } from './secrets'

const rec = (over: Partial<DayRec> = {}): DayRec => ({ turns: 0, tools: 0, edits: 0, errors: 0, commits: 0, cost: 0, secs: 0, night: 0, add: 0, del: 0, early: 0, langs: 0, ...over })

const hist = (days: Record<string, Partial<DayRec>>): History => ({
  days: Object.fromEntries(Object.entries(days).map(([k, v]) => [k, rec(v)])),
  total: rec(),
  activeDays: 0,
  streak: 0,
  bestStreak: 0,
}) as History

// 2026-11-16 is a Monday, 2026-11-21 a Saturday, 2026-11-22 a Sunday.
const WEEK = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']

test('weekender is proven by an active Saturday followed by an active Sunday, not by a Saturday alone', () => {
  expect(secretsNow(hist({ '2026-11-21': { turns: 2 }, '2026-11-22': { turns: 1 } }))).toContain('weekender')
  expect(secretsNow(hist({ '2026-11-21': { turns: 2 } }))).not.toContain('weekender')
})

test('fullWeek needs seven active days in a row from a Monday to the Sunday after it', () => {
  const active = Object.fromEntries(WEEK.map(k => [k, { turns: 1 }]))
  expect(secretsNow(hist(active))).toContain('fullWeek')
  expect(secretsNow(hist({ ...active, '2026-11-18': { turns: 0 } }))).not.toContain('fullWeek')
  expect(secretsNow(hist(Object.fromEntries(WEEK.slice(0, 6).map(k => [k, { turns: 1 }]))))).not.toContain('fullWeek')
})

test('eraser is proven by a day that deletes at least 100 lines and more than it adds', () => {
  expect(secretsNow(hist({ '2026-11-10': { add: 20, del: 150 } }))).toContain('eraser')
  expect(secretsNow(hist({ '2026-11-10': { add: 10, del: 90 } }))).not.toContain('eraser')
  expect(secretsNow(hist({ '2026-11-10': { add: 200, del: 150 } }))).not.toContain('eraser')
})

test('oneLiner is proven by a day with exactly one turn and at least one commit', () => {
  expect(secretsNow(hist({ '2026-11-10': { turns: 1, commits: 1 } }))).toContain('oneLiner')
  expect(secretsNow(hist({ '2026-11-10': { turns: 1, commits: 0 } }))).not.toContain('oneLiner')
  expect(secretsNow(hist({ '2026-11-10': { turns: 2, commits: 1 } }))).not.toContain('oneLiner')
})

test('nightAndDawn is proven by a day with both night and early work', () => {
  expect(secretsNow(hist({ '2026-11-10': { night: 1, early: 1 } }))).toContain('nightAndDawn')
  expect(secretsNow(hist({ '2026-11-10': { night: 1, early: 0 } }))).not.toContain('nightAndDawn')
})

test('evenSteven is proven by a day whose additions equal its deletions, at least 50 of each', () => {
  expect(secretsNow(hist({ '2026-11-10': { add: 50, del: 50 } }))).toContain('evenSteven')
  expect(secretsNow(hist({ '2026-11-10': { add: 49, del: 49 } }))).not.toContain('evenSteven')
  expect(secretsNow(hist({ '2026-11-10': { add: 60, del: 50 } }))).not.toContain('evenSteven')
})

test('a day record missing a field reads that field as zero, so a day with only deletions still proves eraser', () => {
  const partial = { days: { '2026-11-10': { del: 150 } as unknown as DayRec }, total: rec(), activeDays: 0, streak: 0, bestStreak: 0 } as History
  expect(secretsNow(partial)).toContain('eraser')
})

test('secrets proven now come back in the order they are listed, and an empty history proves none', () => {
  expect(secretsNow(hist({ '2026-11-10': { turns: 1, commits: 1, add: 0, del: 150 } }))).toEqual(['eraser', 'oneLiner'])
  expect(secretsNow(hist({}))).toEqual([])
})

test('a secret won once is still won when the history no longer proves it, and a new one is stored with the rest', () => {
  expect(secretsWon(null, ['eraser'])).toEqual({ won: ['eraser'], fresh: ['eraser'], keep: '["eraser"]' })
  expect(secretsWon('["weekender"]', [])).toEqual({ won: ['weekender'], fresh: [], keep: null })
  expect(secretsWon('["eraser"]', ['eraser', 'oneLiner'])).toEqual({ won: ['eraser', 'oneLiner'], fresh: ['oneLiner'], keep: '["eraser","oneLiner"]' })
})

test('stored text that is not a list of known secrets is treated as none kept, and a repeat is not counted twice', () => {
  expect(secretsWon('nope', [])).toEqual({ won: [], fresh: [], keep: null })
  expect(secretsWon('{"a":1}', ['eraser'])).toEqual({ won: ['eraser'], fresh: ['eraser'], keep: '["eraser"]' })
  expect(secretsWon('["bogus","eraser","eraser"]', [])).toEqual({ won: ['eraser'], fresh: [], keep: null })
})
