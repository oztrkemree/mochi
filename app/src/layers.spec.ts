import { expect, test } from 'vitest'

import type { Act, Mood } from '../../types'
import { ACTS, POSES, layersFor } from '../../hooks/rig'
import { ROOM } from './world'

const scene = { context: -1, agents: 0 }

test('every pose held a while is drawn in layers that keep moving by themselves, by the compositor, never by SMIL redrawing Mochi', () => {
  for (const mood of [...Object.keys(POSES), ...Object.keys(ACTS)] as (Mood | Act)[]) {
    const html = layersFor({ mood, scene }, ROOM)
    expect(html, mood).not.toMatch(/NaN|undefined/)
    // The eyes the app turns toward the pointer are there.
    expect(html, mood).toContain('<g transform="translate(0 -52)">')
    // The body, what it wears and the feet are drawn once: any SMIL is in a small layer of its own (a note, a cursor), never in the body's.
    const body = html.split('<div class="squash"')[1]!.split('<div class="look"')[0]!
    expect(body, mood).not.toMatch(/<animate/)
  }
  // At rest it breathes and its eyes glance about and blink; at work its arms type; talking, its mouth moves.
  const idle = layersFor({ mood: 'idle', scene }, ROOM)
  const plays = (html: string, layer: string) => new RegExp(`<div class="${layer}"[^>]*data-tpl=`).test(html)
  expect(['squash', 'look', 'blink'].map(l => plays(idle, l))).toEqual([true, true, true])
  expect(plays(layersFor({ mood: 'writing', scene }, ROOM), 'armR')).toBe(true)
  expect(plays(layersFor({ mood: 'talking', scene }, ROOM), 'mouth')).toBe(true)
  // A moment's once-only loop is played whole by the app, not held looping here.
  expect(plays(layersFor({ mood: 'spin', scene }, ROOM), 'squash')).toBe(false)
})
