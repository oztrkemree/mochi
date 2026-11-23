import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { usageCard, usageLine, usageNews, usageOf, usageRings } from './limits'
import { peersOf } from './world'

setLang('en')

const NOW = 1_760_000_000_000
const HOUR = 3_600_000

const file = (id: string, at: number, windows: unknown[]): string => JSON.stringify({ id, label: id, state: 'idle', line: '', since: 0, at, v: 2, windows })
const win = (kind: string, p: number, inHours: number) => ({ kind, p, resetsAt: NOW + inHours * HOUR })

test('the limits are the newest window any chat knows, and within it the most used, the session before the week', () => {
  // A chat at rest keeps writing what it last heard: who wrote last says nothing of who knows best.
  const peers = peersOf([
    file('working', NOW - 20_000, [win('seven_day', 41, 50), win('five_hour', 12, 3)]),
    file('resting', NOW - 1000, [win('seven_day', 40, 50), win('five_hour', 10, 3)]),
  ], NOW)
  expect(usageOf(peers, NOW)).toEqual([win('five_hour', 12, 3), win('seven_day', 41, 50)])
  expect(usageOf(peersOf([file('none', NOW, [])], NOW), NOW)).toEqual([])
  // After a reset the chat that heard of the new window knows best, however little is used of it.
  const after = peersOf([file('resting', NOW - 1000, [win('five_hour', 93, 0.2)]), file('working', NOW - 9000, [win('five_hour', 2, 5)])], NOW)
  expect(usageOf(after, NOW)).toEqual([win('five_hour', 2, 5)])
  // Two chats that disagree never make news by turns.
  const one = usageOf(peersOf([file('a', NOW, [win('five_hour', 82, 3)])], NOW), NOW)
  const two = usageOf(peersOf([file('a', NOW - 5000, [win('five_hour', 82, 3)]), file('b', NOW, [win('five_hour', 40, 3)])], NOW), NOW)
  expect(usageNews(one, two, NOW)).toEqual([])
})

test('a window whose reset has passed is empty again, whatever an older word of it says', () => {
  const peers = peersOf([file('a', NOW - 1000, [win('five_hour', 97, -1), win('seven_day', 60, 50)])], NOW)
  expect(usageOf(peers, NOW).map(u => [u.kind, u.p])).toEqual([['five_hour', 0], ['seven_day', 60]])
})

test('Mochi says so when a limit passes four fifths and again when it is nearly gone, once each, with when it comes back', () => {
  const at = (p: number) => [win('five_hour', p, 2), win('seven_day', 30, 50)]
  expect(usageNews(at(70), at(79), NOW)).toEqual([])
  expect(usageNews(at(79), at(82), NOW)).toEqual([{ id: 'limit-five_hour', kind: 'limit', line: 'session limit 82% · resets in 2h', link: '' }])
  expect(usageNews(at(82), at(90), NOW)).toEqual([])
  expect(usageNews(at(90), at(96), NOW).map(n => n.line)).toEqual(['session limit 96% · resets in 2h'])
  // A jump over both marks is said once.
  expect(usageNews(at(10), at(99), NOW)).toHaveLength(1)
  // The first reading has no before: nothing is said of where it already stood.
  expect(usageNews([], at(99), NOW)).toEqual([])
})

test('a limit that was nearly gone and is back is good news; one that was never near is not news', () => {
  expect(usageNews([win('five_hour', 93, 0.1)], [win('five_hour', 2, 5)], NOW)).toEqual([{ id: 'limit-five_hour', kind: 'back', line: 'session limit reset · you can carry on', link: '' }])
  expect(usageNews([win('five_hour', 40, 0.1)], [win('five_hour', 2, 5)], NOW)).toEqual([])
})

test('each limit in a line for a press, and both as rings in the mod’s own drawing', () => {
  expect(usageLine(win('seven_day', 91, 50), NOW)).toBe('week 91% · resets in 2d')
  expect(usageLine({ kind: 'five_hour', p: 12, resetsAt: 0 }, NOW)).toBe('session 12%')
  const svg = usageRings([win('five_hour', 62, 2), win('seven_day', 91, 50)], NOW)
  expect(svg.startsWith('<svg')).toBe(true)
  // The week is past four fifths: its ring is drawn in the red the band uses there, the session's in amber.
  expect(svg).toContain('#F0645A')
  expect(svg).toContain('#F2B84B')
  expect(usageRings([], NOW)).toBe('')
})

test('in the list each limit is a ring with its number in it, its name, and when it comes back', () => {
  const card = usageCard(win('five_hour', 62, 2), NOW)
  expect(card.name).toBe('session limit')
  expect(card.back).toBe('resets in 2h')
  expect(card.ring).toContain('>62<')
  expect(usageCard({ kind: 'seven_day', p: 5, resetsAt: 0 }, NOW)).toMatchObject({ name: 'weekly limit', back: '' })
})
