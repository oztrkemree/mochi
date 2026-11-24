import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { ALIVE_MS } from '../../hooks/live'
import { lookFrom } from '../../hooks/level'
import { badgeOf, gazeOf, jobsOf, peersOf, rowsOf, stillOf, viewOf } from './world'

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

test('Mochi wears what the band’s Mochi wears, by the look the mod writes; with no look yet it wears what the season gives', () => {
  const look = lookFrom({ v: 1, pick: { head: 'tophat', eyes: 'monocle' }, items: ['tophat', 'monocle'], tz: 180, birthday: '', firstDay: '' })!
  const dressed = viewOf(peersOf([file('docs', { state: 'busy', activity: 'writing' })], NOW), NOW, look)
  expect(dressed.outfit).toMatchObject({ head: 'tophat', eyes: 'monocle' })
  expect(dressed.svg).not.toBe(viewOf(peersOf([file('docs', { state: 'busy', activity: 'writing' })], NOW), NOW).svg)
  // Asleep with no chat open, still in the person's own hat.
  expect(viewOf([], NOW, look).outfit?.head).toBe('tophat')
  expect(viewOf([], NOW).outfit).toBeUndefined()
})

test('the list of agents: the most pressing first, each with its status in words, its ink, its link and its subagents', () => {
  const rows = rowsOf(peersOf([
    file('docs', { title: 'Write the docs' }),
    file('api', { state: 'busy', activity: 'testing', since: NOW - 3 * MIN, agents: [{ id: 'a1', type: 'Explore', task: 'find the client', activity: 'reading', since: NOW }] }),
    file('fix-login', { state: 'asking', waitingFor: 'permission', app: 'local_abc-1', stateAt: NOW - 2 * MIN }),
  ], NOW), NOW)
  expect(rows.map(r => [r.name, r.status, r.line, r.link])).toEqual([
    ['fix-login', 'asking', 'awaiting approval', 'claude://code/continue?session=local_abc-1'],
    ['api', 'busy', 'test', ''],
    ['Write the docs', 'idle', 'idle', ''],
  ])
  expect(rows[0].ink).toBe('#F2C14E')
  expect(rows[1].agents).toEqual([{ type: 'Explore', task: 'find the client' }])
  expect(rowsOf([], NOW)).toEqual([])
})

test('a chat at rest longer than the setting leaves the list; one that works, waits or failed stays however old', () => {
  const peers = peersOf([
    file('fresh', { stateAt: NOW - 10 * MIN }),
    file('old', { stateAt: NOW - 45 * MIN }),
    file('old-turn', { stateAt: 0, lastTurn: { at: NOW - 50 * MIN, reason: 'answer', seconds: 9 } }),
    file('waiting', { state: 'asking', stateAt: NOW - 3 * 60 * MIN }),
    file('working', { state: 'busy', since: NOW - 2 * 60 * MIN, stateAt: NOW - 2 * 60 * MIN }),
  ], NOW)
  expect(rowsOf(peers, NOW, 30 * MIN).map(r => r.id)).toEqual(['waiting', 'working', 'fresh'])
  // 0 keeps every one.
  expect(rowsOf(peers, NOW, 0)).toHaveLength(5)
})

test('each row says where its chat runs, so one that cannot be opened from here is not mistaken for a broken press', () => {
  const rows = rowsOf([...peersOf([file('desk', { app: 'local_abc-1' }), file('term')], NOW), { ...peersOf([file('codex-s1', { label: 'shop' })], NOW)[0] }], NOW)
  expect(Object.fromEntries(rows.map(r => [r.name, r.where]))).toEqual({ desk: 'app', term: 'terminal', shop: 'codex' })
})

test('Mochi is drawn with room around it, so what it holds or has beside it is never cut off', () => {
  const svg = viewOf([], NOW).svg
  expect(svg).toMatch(/viewBox="-\d+ -\d+ \d+ \d+"/)
  expect(svg).toContain('overflow="visible"')
  // A soft shadow under its feet, drawn before Mochi so Mochi stands on it.
  expect(svg.indexOf('class="shadow"')).toBeGreaterThan(-1)
  expect(svg.indexOf('class="shadow"')).toBeLessThan(svg.indexOf('overflow="visible"'))
})

test('the count at Mochi’s feet: how many chats, in the ink of the most pressing, glowing while one waits, and nothing with no chat', () => {
  const rows = rowsOf(peersOf([file('rest'), file('work', { state: 'busy' }), file('wait', { state: 'asking' })], NOW), NOW)
  expect(badgeOf(rows)).toEqual({ count: 3, ink: '#F2C14E', isAsking: true })
  expect(badgeOf(rowsOf(peersOf([file('work', { state: 'busy' })], NOW), NOW))).toEqual({ count: 1, ink: '#7AA2F7', isAsking: false })
  expect(badgeOf([])).toBeNull()
})

test('a bubble over Mochi for each chat at work: how it stands, its plan and subagents in full, none at rest, none when off', () => {
  const rows = rowsOf(peersOf([
    file('rest'),
    file('shop', { state: 'busy', activity: 'writing', plan: { total: 4, done: 2, now: 'Writing the tests' }, agents: [{ id: 'x', type: 'Explore', task: 'Find the bubble', since: 0 }] }),
    file('wait', { state: 'asking', waitingFor: 'permission' }),
  ], NOW), NOW)
  expect(jobsOf(rows, 'brief')).toEqual({
    jobs: [
      { id: 'wait', name: 'wait', line: 'awaiting approval', ink: '#F2C14E', link: '', more: [] },
      { id: 'shop', name: 'shop', line: 'editing', ink: '#7AA2F7', link: '', more: [] },
    ],
    left: 0,
  })
  expect(jobsOf(rows, 'full').jobs[1]!.more).toEqual(['2/4 · Writing the tests', 'Explore · Find the bubble'])
  expect(jobsOf(rows, 'off')).toEqual({ jobs: [], left: 0 })
  const many = rowsOf(peersOf(['a', 'b', 'c', 'd', 'e', 'f'].map(id => file(id, { state: 'busy' })), NOW), NOW)
  expect(jobsOf(many, 'brief').jobs).toHaveLength(4)
  expect(jobsOf(many, 'brief').left).toBe(2)
})

test('a change of mood is eased into from what was on screen; with no change the drawing stays the very one it was, so its motion never starts over', () => {
  const writing = peersOf([file('api', { state: 'busy', activity: 'writing' })], NOW)
  const first = viewOf(writing, NOW)
  // A second later nothing changed: the same drawing, not one like it.
  expect(viewOf(writing, NOW + 1000, null, { was: first }).svg).toBe(first.svg)
  // The chat starts to wait: Mochi turns to it from where it stood, which is not the drawing a cold start gives.
  const asking = peersOf([file('api', { state: 'asking' })], NOW)
  const turned = viewOf(asking, NOW + 2000, null, { was: first })
  expect(turned.mood).toBe('asking')
  expect(turned.svg).not.toBe(viewOf(asking, NOW + 2000).svg)
  expect(turned.at).toBe(NOW + 2000)
  // The words follow the chats even when the drawing stays.
  expect(viewOf(peersOf([file('api', { state: 'busy', activity: 'writing' }), file('docs', { state: 'busy', activity: 'writing', at: NOW - 5 })], NOW), NOW + 1000, null, { was: first }).line).toBe('2 chats working')
})

test('a mood held for a moment (a pat, a limit that is back) comes before what the chats say, and goes when it is let go', () => {
  const writing = peersOf([file('api', { state: 'busy', activity: 'writing' })], NOW)
  expect(viewOf(writing, NOW, null, { held: 'love' }).mood).toBe('love')
  expect(viewOf(writing, NOW, null, { held: null }).mood).toBe('writing')
})

test('with a limit nearly gone Mochi is tired while nothing else is going on, and gets on with it when a chat works or waits', () => {
  expect(viewOf([], NOW, null, { isTired: true }).mood).toBe('tired')
  expect(viewOf(peersOf([file('docs')], NOW), NOW, null, { isTired: true }).mood).toBe('tired')
  expect(viewOf(peersOf([file('api', { state: 'busy', activity: 'writing' })], NOW), NOW, null, { isTired: true }).mood).toBe('writing')
  expect(viewOf(peersOf([file('api', { state: 'asking' })], NOW), NOW, null, { isTired: true }).mood).toBe('asking')
})

test('Mochi’s eyes turn toward the pointer: a little for one close by, no further than their reach for one far off, and not at all for one on its face', () => {
  const face = { x: 200, y: 300 }
  expect(gazeOf(face, { x: 200, y: 300 })).toEqual({ dx: 0, dy: 0 })
  // Far to the right: all the way right, and no further however far.
  expect(gazeOf(face, { x: 1200, y: 300 })).toEqual({ dx: 1.7, dy: 0 })
  expect(gazeOf(face, { x: 5000, y: 300 })).toEqual({ dx: 1.7, dy: 0 })
  // Up and to the left, close by: part of the way, less up than across, as eyes move.
  const near = gazeOf(face, { x: 160, y: 270 })
  expect(near.dx).toBeLessThan(0)
  expect(near.dy).toBeLessThan(0)
  expect(Math.hypot(near.dx, near.dy)).toBeLessThan(1)
  expect(gazeOf(face, { x: 200, y: -700 })).toEqual({ dx: 0, dy: -1.36 })
})

test('at rest Mochi is a drawing with no motion in it at all: the same pose, and nothing left that redraws it', () => {
  const view = viewOf(peersOf([file('api', { state: 'busy', activity: 'writing' })], NOW), NOW)
  expect(view.rest).toMatch(/<animate/)
  const still = stillOf(view.rest)
  expect(still).not.toMatch(/<(animate|animateTransform|animateMotion|set)\b/)
  expect(still.startsWith('<svg')).toBe(true)
  // Still Mochi: its eyes and its shadow are there, only the motion is gone.
  expect(still).toContain('translate(0 -52)')
  expect(still).toContain('class="shadow"')
  expect(still.length).toBeLessThan(view.rest.length)
  // What Mochi holds while it works is there at rest too: the pose it rests in is drawn with nothing to ease in from.
  const turned = viewOf(peersOf([file('api', { state: 'asking' })], NOW), NOW + 2000, null, { was: view })
  expect(turned.rest).toBe(viewOf(peersOf([file('api', { state: 'asking' })], NOW), NOW + 2000).svg)
})

test('a chat’s row says how far its plan is: steps done of all, and the one under way', () => {
  const p = { id: 'a', label: 'shop', state: 'busy' as const, line: '', since: 1, at: 1, v: 2 as const, activity: 'writing' as const, app: '' }
  expect(rowsOf([{ ...p, plan: { total: 4, done: 2, now: 'Writing the tests' } }], 1)[0]!.plan).toBe('2/4 · Writing the tests')
  expect(rowsOf([{ ...p, plan: { total: 4, done: 4, now: '' } }], 1)[0]!.plan).toBe('4/4')
  expect(rowsOf([p], 1)[0]!.plan).toBe('')
})
