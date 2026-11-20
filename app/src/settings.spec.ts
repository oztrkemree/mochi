import { expect, test } from 'vitest'

import { DEFAULTS, SIZES, settingsFrom, talksAbout } from './settings'

test('settings read from what was kept fill in what is missing and drop what is not a setting', () => {
  expect(settingsFrom(null)).toEqual(DEFAULTS)
  expect(settingsFrom('not json')).toEqual(DEFAULTS)
  const kept = settingsFrom(JSON.stringify({ size: 'large', talk: { done: false }, talkSeconds: 15, onTop: false, lang: 'tr', extra: 1 }))
  expect(kept).toEqual({ ...DEFAULTS, size: 'large', talk: { asking: true, done: false, failed: true }, talkSeconds: 15, onTop: false, lang: 'tr' })
  expect(settingsFrom(JSON.stringify({ idleMinutes: 60 })).idleMinutes).toBe(60)
  expect(settingsFrom(JSON.stringify({ idleMinutes: 0 })).idleMinutes).toBe(0)
  expect(DEFAULTS.idleMinutes).toBe(30)
  // Values that are not among the choices fall back to the default, one by one.
  expect(settingsFrom(JSON.stringify({ size: 'giant', talkSeconds: 7, lang: 'xx', onTop: 'yes', showAgents: 0, idleMinutes: 45 }))).toEqual(DEFAULTS)
})

test('each size is a side in points, the default the one Mochi had', () => {
  expect(SIZES[DEFAULTS.size]).toBe(128)
  expect(Object.values(SIZES)).toEqual([96, 128, 160, 200])
})

test('Mochi speaks of a kind of news only while that kind is on', () => {
  const quiet = { ...DEFAULTS, talk: { asking: true, done: false, failed: true } }
  expect(talksAbout(quiet, 'asking')).toBe(true)
  expect(talksAbout(quiet, 'done')).toBe(false)
  expect(talksAbout(DEFAULTS, 'done')).toBe(true)
})
