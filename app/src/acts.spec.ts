import { expect, test } from 'vitest'

import type { Act } from '../../types'
import { setLang } from '../../hooks/i18n'
import { ACTS, isAct, paramsAt, svgFor } from '../../hooks/rig'
import { ACT_MS, actOf, fidgetOf, isDuo, louder, patOf, pokesOf } from './acts'
import { lookFrom } from '../../hooks/level'
import { peersOf, stillOf, viewOf } from './world'

setLang('en')

const NOW = 1_760_000_000_000
const file = (id: string, more: Record<string, unknown> = {}): string =>
  JSON.stringify({ id, label: id, state: 'idle', line: '', since: 0, at: NOW, v: 2, ...more })
const chats = (...files: string[]) => peersOf(files, NOW)
const scene = { context: -1, agents: 0 }

test('what a chat just did becomes a moment: a turn done, a long one, one cut off, a step of the plan, the whole plan, a helper, a start, a new chat', () => {
  const busy = chats(file('a', { state: 'busy' }))
  const ended = (reason: string, seconds: number) => chats(file('a', { lastTurn: { at: NOW, reason, seconds } }))
  expect(actOf(busy, ended('answer', 40))).toBe('cheer')
  expect(actOf(busy, ended('answer', 600))).toBe('phew')
  expect(actOf(busy, ended('aborted', 40))).toBe('oops')
  expect(actOf(chats(file('a')), busy)).toBe('ready')
  // An answer given to a chat that waited is no new start.
  expect(actOf(chats(file('a', { state: 'asking' })), busy)).toBeNull()
  // A chat taken as stopped because it went silent finished nothing.
  expect(actOf(busy, ended('aborted', 40), new Set(['a']))).toBeNull()
  const plan = (done: number) => chats(file('a', { state: 'busy', plan: { total: 4, done, now: 'x' } }))
  expect(actOf(plan(1), plan(2))).toBe('fistpump')
  expect(actOf(plan(3), plan(4))).toBe('party')
  // A plan written anew (more steps) is no step done.
  expect(actOf(plan(3), chats(file('a', { state: 'busy', plan: { total: 6, done: 4, now: 'x' } })))).toBeNull()
  expect(actOf(busy, chats(file('a', { state: 'busy', agents: [{ id: 's1', type: 'Explore', task: 'look', activity: 'reading', since: NOW }] })))).toBe('wave')
  expect(actOf(chats(file('old')), chats(file('old'), file('new')))).toBe('perk')
  // The first chat of the day, with none open before; one that comes in already at work is a start.
  expect(actOf([], chats(file('a')))).toBe('perk')
  expect(actOf([], chats(file('a', { state: 'busy' })))).toBe('ready')
  // Of two moments, the one that matters more.
  expect([louder('cheer', 'party'), louder(null, 'wave'), louder('oops', 'cheer')]).toEqual(['party', 'wave', 'oops'])
  expect(actOf(busy, busy)).toBeNull()
  // Of several at once, what went wrong first, then what is most worth a cheer.
  expect(actOf(chats(file('a', { state: 'busy' }), file('b', { state: 'busy' })), chats(file('a', { lastTurn: { at: NOW, reason: 'answer', seconds: 9 } }), file('b', { lastTurn: { at: NOW, reason: 'interrupted', seconds: 9 } })))).toBe('oops')
})

test('Claude Code and Codex at work together: Mochi juggles a ball for each, and says what the chats do, not the moment', () => {
  const both = chats(file('claude-1', { state: 'busy', activity: 'writing' }), file('codex-1', { state: 'busy', activity: 'running' }))
  expect(isDuo(both)).toBe(true)
  expect(isDuo(chats(file('claude-1', { state: 'busy' }), file('claude-2', { state: 'busy' })))).toBe(false)
  const view = viewOf(both, NOW)
  expect(view.mood).toBe('juggle')
  expect(view.line).not.toContain('juggle')
  // A chat that waits on the person comes first all the same.
  expect(viewOf([...both, ...chats(file('ask', { state: 'asking' }))], NOW).mood).toBe('asking')
  // Held still, the balls rest in the hands: none is drawn at the drawing's corner.
  expect(stillOf(view.svg)).toContain('<g transform="translate(19 62)"><circle r="4.2"')
  expect(stillOf(view.svg)).toContain('<g transform="translate(81 62)"><circle r="4.2"')
  // Nothing in the juggling hand but the ball, even with a balloon picked to hold.
  const look = lookFrom({ v: 1, pick: { held: 'balloon' }, items: ['balloon'], tz: 0, birthday: '', firstDay: '' })
  expect(viewOf(both, NOW, look).outfit?.held).toBeNull()
  expect(viewOf(chats(file('a')), NOW, look).outfit?.held).toBe('balloon')
})

test('a moment never hides a chat that waits on the person or failed', () => {
  expect(viewOf(chats(file('a', { state: 'asking' })), NOW, null, { held: 'dance' }).mood).toBe('asking')
  expect(viewOf(chats(file('a', { state: 'error' })), NOW, null, { held: 'whee' }).mood).toBe('error')
  expect(viewOf(chats(file('a')), NOW, null, { held: 'dance' }).mood).toBe('dance')
})

test('by itself now and then: never while a chat works or waits, a dream while asleep, and every moment Mochi has can come up', () => {
  expect(fidgetOf('writing', 0, 0)).toBeNull()
  expect(fidgetOf('asking', 0, 0)).toBeNull()
  expect(fidgetOf('idle', 0.9, 0)).toBeNull()
  expect(fidgetOf('sleeping', 0.1, 0)).toBe('dream')
  expect(fidgetOf('sleeping', 0.9, 0)).toBeNull()
  const seen = new Set(Array.from({ length: 50 }, (_, i) => fidgetOf('idle', 0, i / 50)))
  expect([...seen].sort()).toEqual(['curious', 'dance', 'hop', 'hum', 'sneeze', 'spin', 'stretch'])
  expect([patOf(0), patOf(0.7), patOf(0.95)]).toEqual(['love', 'shy', 'spin'])
  expect(pokesOf([NOW - 2000, NOW - 500, NOW - 100], NOW)).toBeNull()
  expect(pokesOf([NOW - 900, NOW - 500, NOW - 100], NOW)).toBe('giggle')
  expect(pokesOf([1100, 900, 700, 500, 300, 100].map(d => NOW - d), NOW)).toBe('dizzy')
})

test('every moment is drawn whole, eased in from the last and out to the next, and held long enough to be seen', () => {
  for (const act of Object.keys(ACTS) as Act[]) {
    expect(isAct(act)).toBe(true)
    const from = { params: paramsAt(null, 'idle', 5000), mood: 'idle' as const, scene }
    const svg = svgFor({ mood: act, scene, from })
    expect(svg, act).not.toMatch(/NaN|undefined/)
    expect(svg).not.toBe(svgFor({ mood: 'idle', scene, from: null }))
    // And back again from it.
    expect(svgFor({ mood: 'idle', scene, from: { params: paramsAt(from.params, act, 800), mood: act, scene } })).not.toMatch(/NaN|undefined/)
    expect(ACT_MS[act], act).toBeGreaterThanOrEqual(1000)
  }
  expect(isAct('idle')).toBe(false)
})
