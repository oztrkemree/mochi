import { expect, test } from 'vitest'

import type { Act, Mood } from '../../types'
import { ACTS, POSES, layersFor, mascotInner, paramsAt, poseOf, target } from '../../hooks/rig'
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

/** How far up and down a mouth path of cubic segments ("M x y C x1 y1 x2 y2 x y ... Z") reaches, its curves sampled. */
function reach(d: string): [number, number] {
  const n = d.match(/-?[\d.]+/g)!.map(Number)
  const ys: number[] = []
  for (let i = 2; i + 5 < n.length; i += 6) {
    const [y0, y1, y2, y3] = [n[i - 1]!, n[i + 1]!, n[i + 3]!, n[i + 5]!]
    for (let t = 0; t <= 1; t += 0.02) ys.push((1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y3)
  }
  return [Math.min(...ys), Math.max(...ys)]
}

test('no mouth ever drops far down the face: under a mustache it stays a small mouth, in the drawing and in layers alike', () => {
  // A mustache ends at 63.4 over the mouth's middle; the widest grin may reach 68, two units under the shut mouth, no lower.
  const lowest = 68.05
  const H = 100 + ROOM.top + ROOM.bottom
  for (const mood of [...Object.keys(POSES), ...Object.keys(ACTS)] as (Mood | Act)[]) {
    const drawing = mascotInner({ mood, scene, from: null })
    const loop = drawing.match(/attributeName="d" values="([^"]+)"/)?.[1]?.split(';') ?? []
    for (const d of loop) expect(reach(d)[1], `${mood} drawn`).toBeLessThanOrEqual(lowest)
    const html = layersFor({ mood, scene }, ROOM)
    const m = html.match(/<div class="mouth" style="transform-origin:[\d.]+% ([\d.]+)%[^"]*"( data-tpl="scale\(\{0\}, \{1\}\)" data-frames="([^"]+)"[^>]*)?>.*?<path d="([^"]+)"/)!
    const originY = (Number(m[1]) / 100) * H - ROOM.top
    const [top, bottom] = reach(m[4]!)
    expect(bottom, `${mood} shut`).toBeLessThanOrEqual(lowest)
    for (const [, sy] of m[3] ? (JSON.parse(m[3]) as number[][]) : []) expect(originY + (bottom - originY) * sy!, `${mood} layer`).toBeLessThanOrEqual(lowest)
    // The layer opens the mouth as far as the drawing's own shapes do, within a unit, so a hand-off between them never jumps.
    if (m[3] && loop.length) {
      const drawnTop = Math.min(...loop.map(d => reach(d)[0]))
      const layerTop = Math.min(...(JSON.parse(m[3]) as number[][]).map(([, sy]) => originY + (top - originY) * sy!))
      expect(Math.abs(layerTop - drawnTop), `${mood} opens alike`).toBeLessThanOrEqual(1)
    }
  }
})

test('talking and surfing the web, the arms move below the shoulder, never held up in the air', () => {
  const reach = (side: 'L' | 'R', mood: 'talking' | 'web' | 'juggle') => {
    const p = poseOf(mood)
    const loop = side === 'L' ? p.armLoopL : p.armLoopR
    return Math.max(...(loop?.values ?? [0]).map(v => Math.abs((side === 'L' ? p.armL : p.armR) + v)))
  }
  expect(reach('R', 'talking')).toBeLessThanOrEqual(56)
  expect([reach('L', 'web'), reach('R', 'web')].every(v => v <= 46)).toBe(true)
  // Juggling, while Claude Code and Codex both work, the hands toss low by the body, never flung out level.
  expect([reach('L', 'juggle'), reach('R', 'juggle')].every(v => v <= 52)).toBe(true)
})

test('Mochi moves as if it had weight: loops ease, a bounce squashes as it lands, the antenna and a free arm follow the body', () => {
  const wave = layersFor({ mood: 'wave', scene }, ROOM)
  const attr = (html: string, layer: string, name: string) => html.match(new RegExp(`<div class="${layer}"[^>]*data-${name}="([^"]+)"`))?.[1]
  // A bounce rises fast and slows to the top, then falls faster to the ground, in layers and in the drawing alike.
  expect(attr(wave, 'move', 'ease')).toBe('[[0.2,0.6,0.45,1],[0.55,0,0.8,0.4]]')
  expect(mascotInner({ mood: 'wave', scene, from: null })).toContain('keySplines="0.2 0.6 0.45 1;0.55 0 0.8 0.4"')
  // It squashes on the ground and stretches in the air.
  expect(attr(wave, 'squash', 'frames')).toBe('[[1.06,0.93],[0.98,1.03],[1.06,0.93]]')
  // The antenna wobbles: wide on a bouncing body, small at rest; a hat takes it off.
  expect(attr(wave, 'antenna', 'frames')).toBe('[[-8],[8],[-8]]')
  expect(attr(layersFor({ mood: 'idle', scene }, ROOM), 'antenna', 'frames')).toBe('[[-3],[3],[-3]]')
  expect(layersFor({ mood: 'idle', scene: { ...scene, outfit: { head: 'fez', eyes: null, face: null, lip: null, chin: null, neck: null, held: null, ground: null } } }, ROOM)).not.toContain('class="antenna"')
  // The free arm flaps out as the body lands; the waving arm keeps its own wave, and a hand holding the flag keeps still.
  expect(attr(wave, 'armL', 'frames')).toBe('[[23],[16],[23]]')
  expect(attr(wave, 'armR', 'frames')).toBe('[[-140],[-102],[-140]]')
  expect(attr(layersFor({ mood: 'proud', scene }, ROOM), 'armR', 'frames')).toBeUndefined()
  // A big turn of an arm swings past where it goes and settles back.
  expect(mascotInner({ mood: 'wave', scene, from: { params: target('idle'), mood: 'idle', scene } })).toMatch(/values="-16 76\.5 55;-152 76\.5 55;-140 76\.5 55"/)
})

test('what the layers take over is what the drawing shows: the antenna in step, an arm turning where the drawing has it', () => {
  // The drawing's antenna starts with every other loop, after the move in, and wobbles as the layers do, a moment's included.
  for (const mood of ['wave', 'shocked'] as const) {
    const drawn = mascotInner({ mood, scene, from: null }).match(/<animateTransform attributeName="transform" type="rotate" values="(-?[\d.]+) 50 34;[^"]*" dur="([\d.]+)s" begin="([^"]+)"/)!
    const layer = layersFor({ mood, scene }, ROOM).match(/<div class="antenna"[^>]*data-frames="\[\[(-?[\d.]+)\][^"]*" data-times="[^"]*" data-dur="([\d.]+)"/)!
    expect([drawn[1], drawn[2], drawn[3]], mood).toEqual([layer[1], layer[2], '0.34s'])
  }
  // 100 ms into idle turning to wave, the drawing's right arm is at -110.8 (from -16 past -152 to -140, keySplines 0.3 0 0.2 1 over
  // the first 70%): a pose that comes then starts from there, not from a straight ease of -16 to -140.
  expect(paramsAt(target('idle'), 'wave', 100).armR).toBeCloseTo(-110.8, 0)
})
