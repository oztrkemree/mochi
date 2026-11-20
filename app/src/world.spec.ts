import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { ALIVE_MS } from '../../hooks/live'
import { newsOf, peersOf, viewOf } from './world'

setLang('en')

const NOW = 1_760_000_000_000
const MIN = 60_000

const file = (id: string, more: Record<string, unknown> = {}): string =>
  JSON.stringify({ id, label: id, state: 'idle', line: '', since: 0, at: NOW, v: 2, ...more })

test('the chats are what their files say: junk, a file gone silent and a second copy of a chat are left out', () => {
  const peers = peersOf([
    file('a', { state: 'busy' }),
    'not json',
    '[]',
    file('old', { at: NOW - ALIVE_MS - 1 }),
    file('a', { state: 'asking', at: NOW - 1000 }),
    file('b'),
  ], NOW)
  expect(peers.map(p => [p.id, p.state])).toEqual([['a', 'busy'], ['b', 'idle']])
})

test('one Mochi stands for every chat: asleep with none open, and otherwise as the chat that most needs the person', () => {
  expect(viewOf([], NOW)).toMatchObject({ mood: 'sleeping', link: '', line: 'asleep' })
  expect(viewOf([], NOW).svg.startsWith('<svg')).toBe(true)

  expect(viewOf(peersOf([file('docs')], NOW), NOW)).toMatchObject({ mood: 'idle', line: 'idle' })
  expect(viewOf(peersOf([file('docs'), file('api', { state: 'busy', activity: 'writing' })], NOW), NOW)).toMatchObject({ mood: 'writing', line: 'api is working' })
  // A chat that waits for the person comes before any that works.
  const waiting = viewOf(peersOf([file('api', { state: 'busy', activity: 'writing' }), file('fix-login', { state: 'asking' })], NOW), NOW)
  expect(waiting).toMatchObject({ mood: 'asking', line: 'fix-login is waiting for you' })
  // A turn that ended well a moment ago is something to be proud of.
  expect(viewOf(peersOf([file('docs', { lastTurn: { at: NOW - MIN, reason: 'answer', seconds: 90 } })], NOW), NOW).mood).toBe('proud')
})

test('a press opens the chat that most needs the person when the Claude app can open it, and nothing otherwise', () => {
  const desk = viewOf(peersOf([file('term', { state: 'busy' }), file('desk', { state: 'asking', app: 'local_abc-123' })], NOW), NOW)
  expect(desk.link).toBe('claude://code/continue?session=local_abc-123')
  expect(viewOf(peersOf([file('term', { state: 'asking' })], NOW), NOW).link).toBe('')
})

test('Mochi speaks up when a chat starts to wait, ends a long turn or fails, and says nothing when nothing changed', () => {
  const before = peersOf([file('fix-login', { state: 'busy', since: NOW - 5 * MIN }), file('api', { state: 'busy', since: NOW - 5 * MIN }), file('docs', { state: 'busy', since: NOW - 1000 })], NOW)
  const after = peersOf([file('fix-login', { state: 'asking' }), file('api', { state: 'idle' }), file('docs', { state: 'idle' })], NOW)
  // A turn of a second is not news; one of five minutes is.
  expect(newsOf(before, after, NOW)).toEqual(['‘fix-login’ is waiting for you', '‘api’ finished · 5m'])
  expect(newsOf(after, after, NOW)).toEqual([])
  // A chat seen for the first time has no before: nothing is said of it.
  expect(newsOf([], after, NOW)).toEqual([])
})
