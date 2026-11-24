import { expect, test } from 'vitest'

import { type Saved, MAX_OUTFITS, outfitsFrom, removed, saved, wearable } from './outfits'

test('a look kept under a name survives a round trip through stored text', () => {
  const list = saved(saved([], 'Winter', { head: 'beanie', neck: 'scarf' }), 'Party', { head: 'partyhat', eyes: null })
  expect(outfitsFrom(JSON.stringify(list))).toEqual([
    { name: 'Party', pick: { head: 'partyhat', eyes: null } },
    { name: 'Winter', pick: { head: 'beanie', neck: 'scarf' } },
  ])
})

test('a ninth look pushes out the oldest, and only eight are read back from storage', () => {
  let list: Saved[] = []
  for (let i = 1; i <= 9; i++) list = saved(list, `look ${i}`, {})
  expect(MAX_OUTFITS).toBe(8)
  expect(list.map(s => s.name)).toEqual(['look 9', 'look 8', 'look 7', 'look 6', 'look 5', 'look 4', 'look 3', 'look 2'])
  const nine = Array.from({ length: 9 }, (_, i) => ({ name: `look ${i + 1}`, pick: {} }))
  expect(outfitsFrom(JSON.stringify(nine))).toHaveLength(8)
})

test('a look saved under a name already kept replaces it and moves to the front; a removed name is gone', () => {
  const list = saved(saved(saved([], 'a', { head: 'crown' }), 'b', {}), 'a', { head: 'medal' })
  expect(list).toEqual([{ name: 'a', pick: { head: 'medal' } }, { name: 'b', pick: {} }])
  expect(removed(list, 'a')).toEqual([{ name: 'b', pick: {} }])
})

test('a name is trimmed and cut to twenty-four characters, and a blank name keeps the list as it was', () => {
  expect(saved([], '  Party  ', {})).toEqual([{ name: 'Party', pick: {} }])
  expect(saved([], 'x'.repeat(30), {})).toEqual([{ name: 'x'.repeat(24), pick: {} }])
  const list = saved([], 'a', {})
  expect(saved(list, '   ', { head: 'crown' })).toEqual(list)
})

test('stored looks with a bad name, a bad pick or a non-object entry are left out; unknown slots and odd values are dropped from the rest', () => {
  const text = JSON.stringify([
    { name: 'ok', pick: { head: 'beanie', nope: 'crown', eyes: 3, lip: null } },
    { name: '   ', pick: {} },
    { name: 'x'.repeat(25), pick: {} },
    { name: 7, pick: {} },
    { name: 'no pick', pick: 'crown' },
    null,
  ])
  expect(outfitsFrom(text)).toEqual([{ name: 'ok', pick: { head: 'beanie', lip: null } }])
  expect(outfitsFrom('{"name":"x"}')).toEqual([])
  expect(outfitsFrom('[ half')).toEqual([])
  expect(outfitsFrom(null)).toEqual([])
})

test('a kept look wears only the items still owned, keeps a slot chosen as nothing, and leaves a slot without a choice to Mochi', () => {
  expect(wearable({ head: 'beanie', eyes: null, neck: 'scarf' }, ['beanie'])).toEqual({ head: 'beanie', eyes: null })
  expect(wearable({}, [])).toEqual({})
})
