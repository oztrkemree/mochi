import { expect, test } from 'vitest'

import type { Act, Mood } from '../../types'
import { ACTS, POSES, layersFor, mascotInner } from '../../hooks/rig'
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
  // The blink is the drawing's own (eyeLoops in the rig: shut to 0.08 at 0.965 of 4.2 s), so a hand-off between them never flickers the eyes.
  expect(idle).toMatch(/<div class="blink"[^>]*data-frames="\[\[1\],\[1\],\[0\.08\],\[1\]\]" data-times="\[0,0\.93,0\.965,1\]" data-dur="4\.2"/)
  // A moment's once-only loop is played whole by the app, not held looping here.
  expect(plays(layersFor({ mood: 'spin', scene }, ROOM), 'squash')).toBe(false)
})

test('talking, the mouth chatters about its middle and never drops far under a mustache, in the drawing and in layers', () => {
  // A mustache ends at 63.4 over the mouth's middle, and the shut mouth spans 63.8 to 65.8: talking may open it a unit lower, no more.
  const lowest = 66.8
  const shapes = mascotInner({ mood: 'talking', scene, from: null }).match(/attributeName="d" values="([^"]+)"/)![1]!.split(';')
  for (const d of shapes) expect(Math.max(...d.match(/-?[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 1)), d).toBeLessThanOrEqual(lowest)
  const m = layersFor({ mood: 'talking', scene }, ROOM).match(/<div class="mouth" style="transform-origin:[\d.]+% ([\d.]+)%[^"]*" data-tpl="scale\(\{0\}, \{1\}\)" data-frames="([^"]+)"/)!
  const originY = (Number(m[1]) / 100) * (100 + ROOM.top + ROOM.bottom) - ROOM.top
  const stretch = Math.max(...(JSON.parse(m[2]!) as number[][]).map(f => f[1]!))
  expect(originY + (65.8 - originY) * stretch).toBeLessThanOrEqual(lowest)
})

test('talking and surfing the web, the arms move below the shoulder, never held up in the air', () => {
  const reach = (side: 'L' | 'R', mood: 'talking' | 'web') => {
    const p = POSES[mood]
    const loop = side === 'L' ? p.armLoopL : p.armLoopR
    return Math.max(...(loop?.values ?? [0]).map(v => Math.abs((side === 'L' ? p.armL : p.armR) + v)))
  }
  expect(reach('R', 'talking')).toBeLessThanOrEqual(56)
  expect([reach('L', 'web'), reach('R', 'web')].every(v => v <= 46)).toBe(true)
})
