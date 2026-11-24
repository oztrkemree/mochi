import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { type News, isMorePressing, newsOf, queued, stillHolds } from './news'
import { peersOf } from './world'

setLang('en')

const NOW = 1_760_000_000_000
const MIN = 60_000

const file = (id: string, more: Record<string, unknown> = {}): string =>
  JSON.stringify({ id, label: id, state: 'idle', line: '', since: 0, at: NOW, v: 2, ...more })

const news = (id: string, kind: News['kind']): News => ({ id, kind, line: `${id} ${kind}`, link: '' })

test('Mochi speaks up when a chat starts to wait, ends a long turn or fails, each with the chat it is about and the link that opens it', () => {
  const before = peersOf([file('fix-login', { state: 'busy', since: NOW - 5 * MIN, app: 'local_abc-1' }), file('api', { state: 'busy', since: NOW - 5 * MIN }), file('docs', { state: 'busy', since: NOW - 1000 })], NOW)
  const after = peersOf([file('fix-login', { state: 'asking', app: 'local_abc-1' }), file('api', { state: 'idle' }), file('docs', { state: 'idle' })], NOW)
  // A turn of a second is not news; one of five minutes is.
  expect(newsOf(before, after, NOW)).toEqual([
    { id: 'fix-login', kind: 'asking', line: '‘fix-login’ is waiting for you', link: 'claude://code/continue?session=local_abc-1' },
    { id: 'api', kind: 'done', line: '‘api’ finished · 5m', link: '' },
  ])
  expect(newsOf(after, after, NOW)).toEqual([])
  // A chat seen for the first time has no before: nothing is said of it.
  expect(newsOf([], after, NOW)).toEqual([])
})

test('news waits its turn: a chat waiting on the person first, then a failure, then what finished, each kind in the order it came', () => {
  const queue = queued([news('a', 'done'), news('b', 'done')], [news('c', 'failed'), news('d', 'asking'), news('e', 'done')])
  expect(queue.map(n => n.id)).toEqual(['d', 'c', 'a', 'b', 'e'])
  expect(isMorePressing(news('d', 'asking'), news('a', 'done'))).toBe(true)
  expect(isMorePressing(news('a', 'done'), news('b', 'done'))).toBe(false)
})

test('a chat’s newer word takes the place of its older one, so nothing is said twice or out of date', () => {
  const queue = queued([news('a', 'asking'), news('b', 'done')], [news('a', 'done')])
  expect(queue).toEqual([news('b', 'done'), news('a', 'done')])
})

test('a chat that waited and was answered in its own window has nothing left to ask; what finished or failed is still worth saying', () => {
  const peers = peersOf([file('a', { state: 'busy' }), file('b', { state: 'asking' })], NOW)
  expect(stillHolds(news('a', 'asking'), peers)).toBe(false)
  expect(stillHolds(news('b', 'asking'), peers)).toBe(true)
  expect(stillHolds(news('gone', 'asking'), peers)).toBe(false)
  expect(stillHolds(news('a', 'done'), peers)).toBe(true)
  expect(stillHolds(news('gone', 'failed'), peers)).toBe(true)
})
