import { expect, test } from 'vitest'

import { type Entry, isDaysFile, planOf } from './sync'

const NOW = 1_760_000_000_000

const file = (name: string, mtime = NOW, size = 10): Entry => ({ name, mtime, size })

test('a days file that only this computer has is pushed to the shared folder, and one only the shared folder has is pulled', () => {
  expect(planOf([file('a.json')], [])).toEqual({ pull: [], push: ['a.json'] })
  expect(planOf([], [file('b.json')])).toEqual({ pull: ['b.json'], push: [] })
})

test('a file the shared folder has newer by more than two seconds is pulled; by exactly two seconds or less, nothing moves', () => {
  expect(planOf([file('a.json', NOW)], [file('a.json', NOW + 2001)])).toEqual({ pull: ['a.json'], push: [] })
  expect(planOf([file('a.json', NOW + 2001)], [file('a.json', NOW)])).toEqual({ pull: [], push: ['a.json'] })
  expect(planOf([file('a.json', NOW)], [file('a.json', NOW + 2000)])).toEqual({ pull: [], push: [] })
})

test('names that leave the folder, nest, or are not a days file never appear in a plan', () => {
  const bad = ['../x.json', 'a/b.json', 'x.txt', '.json']
  expect(bad.map(isDaysFile)).toEqual([false, false, false, false])
  expect(planOf(bad.map(n => file(n)), bad.map(n => file(n, NOW + 9000)))).toEqual({ pull: [], push: [] })
})

test('a days file of size 0 is never copied, neither over a file nor as a new one', () => {
  expect(planOf([file('a.json', NOW, 0)], [])).toEqual({ pull: [], push: [] })
  expect(planOf([], [file('a.json', NOW, 0)])).toEqual({ pull: [], push: [] })
  expect(planOf([file('a.json', NOW)], [file('a.json', NOW + 9000, 0)])).toEqual({ pull: [], push: ['a.json'] })
})

test('a size-0 file counts as absent: a good file on the other side is copied over it', () => {
  expect(planOf([file('a.json', 1000, 10)], [file('a.json', 9000, 0)])).toEqual({ pull: [], push: ['a.json'] })
  expect(planOf([file('b.json', 9000, 0)], [file('b.json', 1000, 10)])).toEqual({ pull: ['b.json'], push: [] })
  expect(planOf([file('c.json', 1000, 0)], [])).toEqual({ pull: [], push: [] })
})

test('a file with a broken time is ignored, and the plan lists its names sorted', () => {
  expect(planOf([file('a.json', Number.NaN)], [file('a.json', NOW + 9000)])).toEqual({ pull: ['a.json'], push: [] })
  expect(planOf([file('c.json'), file('a.json'), file('b.json')], [])).toEqual({ pull: [], push: ['a.json', 'b.json', 'c.json'] })
})

test('a name is a days file when it is letters, digits, dash or underscore and ends in .json, up to 140 characters', () => {
  expect(isDaysFile('kayit-1_a.json')).toBe(true)
  expect(isDaysFile('a'.repeat(140) + '.json')).toBe(true)
  expect(isDaysFile('a'.repeat(141) + '.json')).toBe(false)
})
