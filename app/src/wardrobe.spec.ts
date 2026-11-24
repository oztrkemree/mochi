import { expect, test } from 'vitest'

import { historyOf } from './growth'
import { choiceFrom, choiceText, skinNow } from '../../hooks/level'
import { svgFor } from '../../hooks/rig'
import { SKINS, skinFilter, skinOf, skinsAt } from '../../hooks/skins'
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

test('thirty-six colours open by level; the one chosen is worn while the level opens it, and prefs.json carries it', () => {
  expect(SKINS).toHaveLength(36)
  expect(new Set(SKINS.map(k => k.id)).size).toBe(36)
  expect(skinsAt(1).map(k => k.id)).toEqual(['clay'])
  expect(skinsAt(10).length).toBe(8)
  // Each is a run of five colours, shade to glint.
  for (const k of SKINS) if (k.map) expect(k.map).toHaveLength(5)
  // What a skin lays over the clay blends into it only if each layer is cut to the body by itself: a group holding them all would keep the blend to itself.
  expect(skinOf('rainbow')!.over).toMatch(/^<g mask="url\(#bm\)" style="mix-blend-mode:multiply">/)
  expect(svgFor({ mood: 'idle', scene: { context: -1, agents: 0, skin: 'rainbow' }, from: null })).not.toContain('<g mask="url(#bm)"><g mask')
  // Mochi's own clay needs no filter; any other colour has one of its own name, so several Mochis on a page keep theirs.
  expect(skinFilter(skinOf('clay'))).toBe('')
  expect(skinFilter(skinOf('mint'))).toContain('id="skin-map-mint"')
  // Level 3 (worked: 2 days, 60 turns, 4 commits) opens peach but not mint.
  expect(skinNow('peach', worked)).toBe('peach')
  expect(skinNow('mint', worked)).toBeUndefined()
  expect(skinNow('nonsense', worked)).toBeUndefined()
  expect(skinNow(undefined, worked)).toBeUndefined()
  expect(choiceFrom(choiceText({ at: 2, pick: { head: 'beanie' }, skin: 'peach' }))).toEqual({ at: 2, pick: { head: 'beanie' }, skin: 'peach' })
  expect(choiceFrom('{"v":1,"at":2,"pick":{},"skin":"<script>"}')).toEqual({ at: 2, pick: {} })
})
