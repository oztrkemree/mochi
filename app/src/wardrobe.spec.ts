import { expect, test } from 'vitest'

import { historyOf } from './growth'
import { choiceFrom, choiceText } from '../../hooks/level'
import { chosen, lookNow } from './wardrobe'

const days = (record: Record<string, Record<string, number>>) => JSON.stringify({ id: 'c', label: 'c', days: record })
// Enough work for the first hats: 2 days, 60 turns, 4 commits.
const worked = historyOf([days({ '2026-11-22': { turns: 30, commits: 2 }, '2026-11-23': { turns: 30, commits: 2 } })], '2026-11-23')

test('prefs.json is read slot by slot; a version or an item this does not know is left out', () => {
  expect(choiceFrom(choiceText({ at: 5, pick: { head: 'beanie', neck: null } }))).toEqual({ at: 5, pick: { head: 'beanie', neck: null } })
  expect(choiceFrom('{"v":1,"at":7,"pick":{"head":"bere","eyes":"laser","nope":"beanie"}}')).toEqual({ at: 7, pick: { head: 'beanie' } })
  expect(choiceFrom('{"v":2,"at":7,"pick":{}}')).toBeNull()
  expect(choiceFrom('{ half')).toBeNull()
  expect(choiceFrom(null)).toBeNull()
})

test('Mochi wears what the history opened, by the last choice made in either Mochi, and never what it has not earned', () => {
  const look = lookNow(worked, null, null, 180)!
  expect(look.items).toContain('beanie')
  expect(look).toMatchObject({ pick: {}, tz: 180, birthday: '' })
  // Chosen here or in the mod: prefs.json is the last choice, over the mod's look.
  const mod = { pick: { head: 'beanie' as const }, items: [], tz: 60, birthday: '03-14', firstDay: '2026-01-02' }
  expect(lookNow(worked, mod, null, 180)).toMatchObject({ pick: { head: 'beanie' }, tz: 60, birthday: '03-14' })
  expect(lookNow(worked, mod, { at: 1, pick: { head: null } }, 180)!.pick).toEqual({ head: null })
  expect(lookNow(worked, null, { at: 1, pick: { head: 'crown' } }, 180)!.pick).toEqual({})
  // Before the history is read, the mod's look is all there is; with neither, no look.
  expect(lookNow(null, { ...mod, items: ['beanie'] }, null, 0)!.pick).toEqual({ head: 'beanie' })
  expect(lookNow(null, null, null, 0)).toBeNull()
})

test('a choice can be given back to Mochi, or made nothing', () => {
  expect(chosen({ head: 'beanie' }, 'neck', null)).toEqual({ head: 'beanie', neck: null })
  expect(chosen({ head: 'beanie' }, 'head', undefined)).toEqual({})
})
