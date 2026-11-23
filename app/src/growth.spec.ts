import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { badgesNews, growthOf, historyOf, levelNews } from './growth'

setLang('en')

const days = (id: string, record: Record<string, Record<string, number>>) => JSON.stringify({ id, label: id, days: record })

test('the history is every chat’s days added up, the mod’s and the app’s alike; what is not a days file adds nothing', () => {
  const h = historyOf([
    days('claude-chat', { '2026-11-22': { turns: 4, edits: 10 }, '2026-11-23': { turns: 1 } }),
    days('codex-s1', { '2026-11-23': { turns: 2, commits: 1 } }),
    'half a fi',
    '[]',
    JSON.stringify({ id: 'x' }),
  ], '2026-11-23')
  expect(h.total).toMatchObject({ turns: 7, edits: 10, commits: 1 })
  expect(h.activeDays).toBe(2)
  expect(h.streak).toBe(2)
})

test('the level is counted from the history as the mod counts it: where it stands, how far into the level, how far to the next', () => {
  // 7 turns x 10 + 10 edits x 2 + 1 commit x 25 + 2 active days x 30 = 175 experience. Level 2 starts at 60, level 3 at 240.
  const g = growthOf(historyOf([days('a', { '2026-11-22': { turns: 4, edits: 10 }, '2026-11-23': { turns: 3, commits: 1 } })], '2026-11-23'))
  expect(g).toMatchObject({ level: 2, xp: 175, into: 115, span: 180, toNext: 65, streak: 2, today: 3 })
  expect(growthOf(historyOf([], '2026-11-23'))).toMatchObject({ level: 1, xp: 0, into: 0, span: 60, toNext: 60, streak: 0, today: 0 })
})

test('a new level is celebrated once: said when it rises past what was last kept, kept either way, and never said the first time there is nothing kept', () => {
  const two = historyOf([days('a', { '2026-11-23': { turns: 7, edits: 10, commits: 1 } })], '2026-11-23')
  // Nothing kept yet (the app is new here): what stands is kept, and nothing is said of a level reached long ago.
  const first = levelNews(null, two)
  expect(first.line).toBeNull()
  expect(JSON.parse(first.keep!)).toMatchObject({ level: 2 })
  // Kept at level 1: now level 2 is news, and it is kept so no other Mochi says it again.
  const rose = levelNews(JSON.stringify({ level: 1, items: JSON.parse(first.keep!).items }), two)
  expect(rose.line).toBe('level 2')
  expect(JSON.parse(rose.keep!).level).toBe(2)
  // Kept at level 2 already: nothing to say, nothing to write.
  expect(levelNews(first.keep, two)).toEqual({ line: null, keep: null })
  // A file caught half-written is not taken for an empty one: nothing is said and nothing written over it.
  expect(levelNews('{ half', two)).toEqual({ line: null, keep: null })
})

test('badges the history proves are won once: added to those kept, said when new, and never taken away', () => {
  // A hundred commits in all is a badge of its own.
  const hundred = historyOf([days('a', { '2026-11-23': { turns: 3, commits: 100 } })], '2026-11-23')
  const won = badgesNews('["owl"]', hundred)
  expect(JSON.parse(won.keep!)).toEqual(['owl', 'hundred'])
  expect(won.line).toBe('new badge: hundred commits')
  // Kept already: nothing new.
  expect(badgesNews(won.keep, hundred)).toEqual({ line: null, keep: null, badges: ['owl', 'hundred'] })
  // No file yet: what is proven is kept, and said of nothing (it was earned before the app looked).
  const first = badgesNews(null, hundred)
  expect(first.line).toBeNull()
  expect(JSON.parse(first.keep!)).toEqual(['hundred'])
  // A file that cannot be read is never written over with less.
  expect(badgesNews('{ half', hundred)).toMatchObject({ line: null, keep: null })
})
