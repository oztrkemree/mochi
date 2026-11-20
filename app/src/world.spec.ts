import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { ALIVE_MS } from '../../hooks/live'
import { LONE, linkAt, peersOf, viewOf } from './world'

setLang('en')

const NOW = 1_760_000_000_000

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

test('with no chat open one Mochi sleeps alone; with chats the floor shows each by name', () => {
  const alone = viewOf([], NOW)
  expect([alone.width, alone.height]).toEqual([LONE, LONE])
  expect(alone.svg.startsWith('<svg')).toBe(true)
  expect(alone.spots).toEqual([])

  const floor = viewOf(peersOf([file('fix-login', { state: 'asking' }), file('docs', { state: 'busy' })], NOW), NOW)
  expect(floor.svg).toContain('fix-login')
  expect(floor.svg).toContain('docs')
  expect(floor.width).toBeGreaterThan(LONE)
  expect(floor.spots.map(s => s.key)).toEqual(['fix-login', 'docs'])
})

test('a press on a Mochi gives the link that opens its chat in the Claude app, and nothing for a chat that runs elsewhere', () => {
  const view = viewOf(peersOf([file('desk', { state: 'asking', app: 'local_abc-123' }), file('term', { state: 'busy' })], NOW), NOW)
  const mid = (key: string) => {
    const spot = view.spots.find(s => s.key === key)!
    return (spot.x0 + spot.x1) / 2 / view.width
  }
  expect(linkAt(view, mid('desk'))).toBe('claude://code/continue?session=local_abc-123')
  expect(linkAt(view, mid('term'))).toBe('')
  expect(linkAt(viewOf([], NOW), 0.5)).toBe('')
})
