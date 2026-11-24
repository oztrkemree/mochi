import { expect, test } from 'vitest'

import { DEFAULTS, SIZES, settingsFrom, talksAbout } from './settings'

test('settings read from what was kept fill in what is missing and drop what is not a setting', () => {
  expect(settingsFrom(null)).toEqual(DEFAULTS)
  expect(settingsFrom('not json')).toEqual(DEFAULTS)
  const kept = settingsFrom(JSON.stringify({ size: 'large', talk: { done: false }, talkSeconds: 15, onTop: false, lang: 'tr', extra: 1 }))
  expect(kept).toEqual({ ...DEFAULTS, size: 'large', talk: { asking: true, done: false, failed: true, limit: true }, talkSeconds: 15, onTop: false, lang: 'tr' })
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
  const quiet = { ...DEFAULTS, talk: { asking: true, done: false, failed: true, limit: false } }
  expect(talksAbout(quiet, 'asking')).toBe(true)
  expect(talksAbout(quiet, 'done')).toBe(false)
  expect(talksAbout(DEFAULTS, 'done')).toBe(true)
  // A limit that is back is news of the limits: one switch for both.
  expect(talksAbout(quiet, 'limit')).toBe(false)
  expect(talksAbout(quiet, 'back')).toBe(false)
  expect(talksAbout(DEFAULTS, 'back')).toBe(true)
  // Changes left uncommitted are said at a turn's end: with the turns that finish.
  expect(talksAbout(quiet, 'nudge')).toBe(false)
  expect(talksAbout(DEFAULTS, 'nudge')).toBe(true)
})

test('how long Mochi waits before it leaves the screen: 30 seconds unless set, one of the offered times, 0 to stay', () => {
  expect(settingsFrom(null).leaveSeconds).toBe(30)
  expect(settingsFrom(JSON.stringify({ leaveSeconds: 0 })).leaveSeconds).toBe(0)
  expect(settingsFrom(JSON.stringify({ leaveSeconds: 300 })).leaveSeconds).toBe(300)
  expect(settingsFrom(JSON.stringify({ leaveSeconds: 7 })).leaveSeconds).toBe(30)
})

test('how much the bubbles over Mochi say of each chat: brief unless set, off or full when chosen, brief for anything else', () => {
  expect(settingsFrom(null).jobs).toBe('brief')
  expect(settingsFrom(JSON.stringify({ jobs: 'off' })).jobs).toBe('off')
  expect(settingsFrom(JSON.stringify({ jobs: 'full' })).jobs).toBe('full')
  expect(settingsFrom(JSON.stringify({ jobs: 'loud' })).jobs).toBe('brief')
})
