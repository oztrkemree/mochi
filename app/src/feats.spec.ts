import { expect, test } from 'vitest'

import { BADGES } from '../../hooks/badges'
import { historyOf } from './growth'
import { CATS, MILESTONES, TIERS, countsOf, featsOf, tally } from './feats'

const days = (record: Record<string, Record<string, number>>) => JSON.stringify({ id: 'c', label: 'c', days: record })

test('sixty milestones: ten easy, twenty medium, twenty hard, ten impossible, each named once', () => {
  const by = (tier: string) => MILESTONES.filter(x => x.tier === tier).length
  expect([by('easy'), by('medium'), by('hard'), by('impossible')]).toEqual([10, 20, 20, 10])
  expect(new Set(MILESTONES.map(x => x.id)).size).toBe(60)
  // None shares a name with a badge, which the room lists beside them.
  expect(MILESTONES.filter(x => (BADGES as string[]).includes(x.id))).toEqual([])
})

test('the counts come from the history every Mochi reads, and each achievement says how far along it is', () => {
  const h = historyOf([days({
    '2026-11-22': { turns: 30, edits: 12, commits: 3, secs: 5400, night: 1, add: 400, del: 90, langs: 0b101 },
    '2026-11-23': { turns: 60, edits: 3, commits: 11, secs: 1800, early: 2, langs: 0b010 },
  })], '2026-11-23')
  const counts = countsOf(h, ['green'])
  expect(counts).toMatchObject({ turns: 90, dayTurns: 60, edits: 15, commits: 14, dayCommits: 11, hours: 2, night: 1, early: 2, added: 400, removed: 90, langs: 3, days: 2, streak: 2, badges: 1 })
  const feats = featsOf(h, ['green'])
  expect(feats).toHaveLength(BADGES.length + 60)
  const find = (id: string) => feats.find(f => f.id === id)!
  expect(find('hello')).toMatchObject({ done: true, now: 1, target: 1, cat: 'talk', tier: 'easy' })
  expect(find('talker')).toMatchObject({ done: false, now: 90, target: 250, cat: 'talk', tier: 'medium' })
  expect(find('bigDay')).toMatchObject({ done: true, now: 50 })
  expect(find('trilingual')).toMatchObject({ done: true })
  expect(find('green')).toMatchObject({ done: true, badge: 'green', cat: 'code', tier: 'easy' })
  expect(find('push')).toMatchObject({ done: false, badge: 'push' })
  // Every achievement has a theme and a tier the room knows.
  expect(feats.every(f => (CATS as readonly string[]).includes(f.cat) && (TIERS as readonly string[]).includes(f.tier))).toBe(true)
  expect(tally(feats.filter(f => f.tier === 'easy'))).toEqual({ done: expect.any(Number), all: 12 })
})
