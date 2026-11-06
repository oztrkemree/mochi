import type { Item, Mood, Outfit, Params, Scene, Shot } from '../types'
import { ART } from './assets'
import { WEAR } from './wear'

// The desktop drawing: one rig whose every pose is a set of numbers. A new
// pose's SVG starts from the numbers that were on screen (mid-transition or
// mid-loop included) and eases into its own, so nothing ever cuts.

export type { Params, Scene, Shot }

export const TRANSITION_MS = 340
const D = `${TRANSITION_MS / 1000}s`
const EASE = 'calcMode="spline" keyTimes="0;1" keySplines="0.35 0 0.15 1"'

// ---------- morphable shapes: closed paths of four cubic segments ----------

type Pt = [number, number]
/** [x0, y0, then four times c1x, c1y, c2x, c2y, x, y], around a center. */
export type Shape = number[]

const K = 0.5523

function ellipse(a: number, top: number, bottom = top, dy = 0): Shape {
  return [
    -a, dy,
    -a, dy - top * K, -a * K, dy - top, 0, dy - top,
    a * K, dy - top, a, dy - top * K, a, dy,
    a, dy + bottom * K, a * K, dy + bottom, 0, dy + bottom,
    -a * K, dy + bottom, -a, dy + bottom * K, -a, dy,
  ]
}

const cubicOfQuad = (s: Pt, c: Pt, e: Pt): number[] =>
  [s[0] + (2 / 3) * (c[0] - s[0]), s[1] + (2 / 3) * (c[1] - s[1]), e[0] + (2 / 3) * (c[0] - e[0]), e[1] + (2 / 3) * (c[1] - e[1]), e[0], e[1]]

/** A quadratic from p0 to p2 split at its middle, as two cubic segments. */
function quadHalves(p0: Pt, q: Pt, p2: Pt): number[] {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const q1 = mid(p0, q)
  const q2 = mid(q, p2)
  const m = mid(q1, q2)
  return [...cubicOfQuad(p0, q1, m), ...cubicOfQuad(m, q2, p2)]
}

/** A crescent from (-w, y0) to (w, y0): its outer edge bows by `h`, `thick` thick at the middle. */
function crescent(w: number, y0: number, h: number, thick: number): Shape {
  const inner = h - Math.sign(h) * thick
  return [-w, y0, ...quadHalves([-w, y0], [0, y0 + 2 * h], [w, y0]), ...quadHalves([w, y0], [0, y0 + 2 * inner], [-w, y0])]
}

const line = (a: Pt, b: Pt): number[] => [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3, a[0] + (2 * (b[0] - a[0])) / 3, a[1] + (2 * (b[1] - a[1])) / 3, b[0], b[1]]

/** A polygon of four points as a shape, in left, top, right, bottom order. */
const quad = (l: Pt, t: Pt, r: Pt, b: Pt): Shape => [...l, ...line(l, t), ...line(t, r), ...line(r, b), ...line(b, l)]

type EyeKind = 'dot' | 'wide' | 'happy' | 'closed' | 'half' | 'squint' | 'wink' | 'none'
type MouthKind = 'smile' | 'grin' | 'open' | 'o' | 'flat' | 'frown' | 'small' | 'pout'

function eyeShape(kind: EyeKind, side: -1 | 1): Shape {
  switch (kind) {
    case 'dot': return ellipse(3.3, 4.3)
    case 'wide': return ellipse(4.3, 5.1)
    case 'happy': return crescent(4.6, 1.6, -4.6, 2.3)
    case 'closed': return crescent(4.6, -0.6, 3.4, 2)
    case 'half': return ellipse(3.4, 1.2, 2.2, 1.2)
    case 'squint': return side < 0
      ? quad([-1, 0], [-4.2, -3.6], [4.2, 0], [-4.2, 3.6])
      : quad([-4.2, 0], [4.2, -3.6], [1, 0], [4.2, 3.6])
    case 'wink': return side < 0 ? ellipse(3.3, 4.3) : crescent(4.6, 1.6, -4.6, 2.3)
    case 'none': return ellipse(0.1, 0.1)
  }
}

function mouthShape(kind: MouthKind): Shape {
  switch (kind) {
    case 'smile': return crescent(5.6, -1.4, 4, 2.4)
    case 'grin': return [-6.8, -1.6, ...line([-6.8, -1.6], [0, -1.6]), ...line([0, -1.6], [6.8, -1.6]), ...quadHalves([6.8, -1.6], [0, 14], [-6.8, -1.6])]
    case 'open': return ellipse(4.2, 3.6, 4.6, 0.5)
    case 'o': return ellipse(2.6, 2.6, 2.8, 0.6)
    case 'flat': return ellipse(4.8, 0.9, 0.9, 0.6)
    case 'frown': return crescent(5.4, 2.4, -3.6, 2.2)
    case 'small': return crescent(3, -0.2, 2, 1.5)
    case 'pout': return crescent(3.4, 1.2, -1.8, 1.5)
  }
}

// ---------- poses ----------

type BodyLoop = { dur: number; keys: { lift?: number; shift?: number; tilt?: number; sx?: number; sy?: number }[]; once?: boolean }
type ArmLoop = { dur: number; values: number[] }
type Held = 'laptop' | 'book' | 'glass' | 'flag'
type Over = 'question' | 'bang' | 'zzz' | 'check' | 'dizzy' | 'thought' | 'hourglass' | 'confetti' | 'terminal' | 'squeeze' | 'hearts'
type Special = 'x' | 'star' | 'spiral'

type Pose = {
  lift?: number
  shift?: number
  tilt?: number
  sx?: number
  sy?: number
  armL: number
  armR: number
  eye: EyeKind
  eyeDx?: number
  eyeDy?: number
  special?: Special
  mouth: MouthKind
  blush?: number
  tint?: [string, number]
  loop?: BodyLoop
  armLoopL?: ArmLoop
  armLoopR?: ArmLoop
  eyeLoop?: 'blink' | 'glance' | 'dart' | 'scan' | 'none'
  mouthLoop?: 'talk' | 'wobble' | 'yawn'
  held?: Held
  over?: Over
  sweat?: boolean
  waves?: boolean
  tapsFoot?: boolean
}

const L = {
  bob: { dur: 1.8, keys: [{ lift: 0 }, { lift: -2.2 }, { lift: 0 }] },
  breathe: { dur: 3.4, keys: [{ sx: 1, sy: 1 }, { sx: 1.012, sy: 1.025 }, { sx: 1, sy: 1 }] },
  bounce: { dur: 0.72, keys: [{ lift: 0 }, { lift: -5 }, { lift: 0 }] },
  jump: { dur: 0.9, keys: [{ lift: 0, sy: 1 }, { lift: 0, sy: 0.93 }, { lift: -10, sy: 1.04 }, { lift: 0, sy: 0.95 }, { lift: 0, sy: 1 }] },
  shake: { dur: 0.32, keys: [{ shift: 0 }, { shift: -2.2 }, { shift: 2.2 }, { shift: -1.4 }, { shift: 0 }] },
  wiggle: { dur: 1.2, keys: [{ tilt: 0 }, { tilt: -4 }, { tilt: 4 }, { tilt: 0 }] },
  sway: { dur: 1.9, keys: [{ tilt: 0 }, { tilt: -2 }, { tilt: 0 }] },
  tap: { dur: 0.5, keys: [{ lift: 0 }, { lift: -1.2 }, { lift: 0 }, { lift: 0 }] },
  startle: { dur: 0.55, once: true, keys: [{ lift: 0, sy: 1 }, { lift: -9, sy: 1.06 }, { lift: 0, sy: 0.94 }, { lift: 0, sy: 1 }] },
  squash: { dur: 0.6, keys: [{ sx: 1, sy: 1 }, { sx: 1.13, sy: 0.88 }, { sx: 1, sy: 1 }] },
  slowBreathe: { dur: 4.6, keys: [{ sx: 1, sy: 1 }, { sx: 1.018, sy: 1.035 }, { sx: 1, sy: 1 }] },
  stretch: { dur: 2.8, keys: [{ sx: 1, sy: 1 }, { sx: 0.95, sy: 1.07 }, { sx: 1, sy: 1 }] },
} satisfies Record<string, BodyLoop>

const RED: [string, number] = ['#E0412E', 0.32]

export const POSES: Record<Mood, Pose> = {
  idle: { armL: 16, armR: -16, eye: 'dot', mouth: 'smile', loop: L.breathe, eyeLoop: 'glance' },
  wave: { armL: 16, armR: -140, armLoopR: { dur: 0.55, values: [0, 38, 0] }, eye: 'happy', mouth: 'grin', loop: L.bounce },
  listening: { tilt: -6, armL: 14, armR: -14, eye: 'dot', eyeDx: -1.2, eyeDy: 2, mouth: 'smile', loop: L.sway, eyeLoop: 'blink' },
  thinking: { tilt: 4, armL: 16, armR: 56, eye: 'dot', eyeDx: 1.6, eyeDy: -2.6, mouth: 'small', loop: L.bob, eyeLoop: 'none', over: 'thought' },
  talking: { armL: 16, armR: -70, armLoopR: { dur: 1.3, values: [0, -24, 6, 0] }, eye: 'dot', mouth: 'small', mouthLoop: 'talk', loop: L.bob, eyeLoop: 'blink' },
  reading: { armL: -50, armR: 50, eye: 'dot', eyeDy: 2.2, mouth: 'small', loop: L.breathe, eyeLoop: 'scan', held: 'book' },
  searching: { tilt: 3, armL: 16, armR: 40, eye: 'wide', mouth: 'o', loop: L.sway, eyeLoop: 'dart', held: 'glass' },
  writing: { armL: -54, armR: 54, armLoopL: { dur: 0.3, values: [0, -9, 0] }, armLoopR: { dur: 0.3, values: [0, 9, 0] }, eye: 'dot', eyeDy: 2.6, mouth: 'small', loop: L.bob, eyeLoop: 'blink', held: 'laptop' },
  running: { armL: -54, armR: 54, armLoopL: { dur: 0.24, values: [0, -9, 0] }, armLoopR: { dur: 0.24, values: [0, 9, 0] }, eye: 'squint', mouth: 'flat', loop: L.bob, held: 'laptop', over: 'terminal' },
  waiting: { armL: 12, armR: -12, eye: 'dot', mouth: 'flat', loop: L.tap, eyeLoop: 'dart', over: 'hourglass', tapsFoot: true },
  web: { armL: 70, armR: -70, armLoopL: { dur: 1.2, values: [0, 10, 0] }, armLoopR: { dur: 1.2, values: [0, 10, 0] }, eye: 'dot', mouth: 'grin', loop: L.wiggle, eyeLoop: 'blink', waves: true },
  agent: { armL: 16, armR: -140, armLoopR: { dur: 0.6, values: [0, 34, 0] }, eye: 'dot', mouth: 'grin', loop: L.bounce, eyeLoop: 'blink' },
  asking: { armL: 16, armR: -140, armLoopR: { dur: 1.4, values: [0, 26, 0] }, eye: 'wide', mouth: 'o', loop: L.sway, eyeLoop: 'blink', over: 'question' },
  success: { armL: 150, armR: -150, eye: 'happy', mouth: 'grin', loop: L.jump, over: 'check' },
  proud: { armL: 16, armR: -152, eye: 'happy', mouth: 'grin', blush: 0.8, loop: L.bounce, held: 'flag' },
  party: { armL: 150, armR: -150, armLoopL: { dur: 0.45, values: [0, -22, 0] }, armLoopR: { dur: 0.45, values: [0, 22, 0] }, eye: 'none', special: 'star', mouth: 'grin', blush: 0.8, loop: L.jump, over: 'confetti' },
  error: { armL: 36, armR: -36, eye: 'none', special: 'x', mouth: 'frown', tint: RED, loop: L.shake, over: 'bang' },
  dizzy: { armL: 24, armR: -24, eye: 'none', special: 'spiral', mouth: 'pout', mouthLoop: 'wobble', tint: RED, loop: L.wiggle, over: 'dizzy' },
  scared: { armL: 150, armR: -150, armLoopL: { dur: 0.2, values: [0, -6, 0] }, armLoopR: { dur: 0.2, values: [0, 6, 0] }, eye: 'wide', mouth: 'open', tint: ['#F5D0C0', 0.4], loop: L.shake, over: 'bang' },
  denied: { lift: 2.5, sy: 0.96, tilt: -3, armL: 6, armR: -6, eye: 'half', eyeDx: -2, mouth: 'pout', tint: ['#9A8F8A', 0.3], loop: L.slowBreathe, eyeLoop: 'none' },
  shocked: { armL: 150, armR: -150, eye: 'wide', mouth: 'o', loop: L.startle, over: 'bang' },
  nervous: { armL: 22, armR: -22, eye: 'dot', mouth: 'flat', mouthLoop: 'wobble', loop: L.sway, eyeLoop: 'dart', sweat: true },
  pleased: { armL: 16, armR: -16, eye: 'happy', mouth: 'smile', blush: 1, loop: L.wiggle },
  tired: { lift: 1.5, sy: 0.97, armL: 6, armR: -6, eye: 'half', mouth: 'o', loop: L.slowBreathe, eyeLoop: 'none', sweat: true },
  sleepy: { lift: 1, armL: 8, armR: -8, eye: 'half', eyeDy: 0.6, mouth: 'small', mouthLoop: 'yawn', loop: L.slowBreathe, eyeLoop: 'none' },
  sleeping: { lift: 1.5, tilt: -3, armL: 6, armR: -6, eye: 'closed', mouth: 'small', tint: ['#5B4FB0', 0.14], loop: L.slowBreathe, eyeLoop: 'none', over: 'zzz' },
  squeezed: { armL: 30, armR: -30, eye: 'squint', mouth: 'pout', mouthLoop: 'wobble', loop: L.squash, over: 'squeeze' },
  stretch: { lift: -1, armL: 162, armR: -162, armLoopL: { dur: 2.8, values: [0, -10, 0] }, armLoopR: { dur: 2.8, values: [0, 10, 0] }, eye: 'closed', mouth: 'small', mouthLoop: 'yawn', loop: L.stretch, eyeLoop: 'none' },
  love: { armL: -40, armR: 40, eye: 'happy', mouth: 'smile', blush: 1, loop: L.sway, over: 'hearts' },
  wink: { tilt: 5, armL: 16, armR: -16, eye: 'wink', mouth: 'smile', blush: 0.5, loop: L.breathe, eyeLoop: 'none' },
}

// ---------- the numbers on screen ----------


const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
const rgb = (c: [number, number, number]) => `#${c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

export function target(mood: Mood): Params {
  const p = POSES[mood]
  const tint = p.tint ?? ['#E0412E', 0]
  return {
    lift: p.lift ?? 0,
    shift: p.shift ?? 0,
    tilt: p.tilt ?? 0,
    sx: p.sx ?? 1,
    sy: p.sy ?? 1,
    armL: p.armL,
    armR: p.armR,
    eyeL: eyeShape(p.eye, -1),
    eyeR: eyeShape(p.eye, 1),
    eyeDx: p.eyeDx ?? 0,
    eyeDy: p.eyeDy ?? 0,
    catchlight: p.eye === 'dot' || p.eye === 'wide' ? 1 : 0,
    x: p.special === 'x' ? 1 : 0,
    star: p.special === 'star' ? 1 : 0,
    spiral: p.special === 'spiral' ? 1 : 0,
    mouth: mouthShape(p.mouth),
    blush: p.blush ?? 0,
    tint: hex(tint[0]),
    tintOp: tint[1],
  }
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixAll = (a: number[], b: number[], t: number) => a.map((v, i) => mix(v, b[i] ?? v, t))

export function lerp(a: Params, b: Params, t: number): Params {
  return {
    lift: mix(a.lift, b.lift, t),
    shift: mix(a.shift, b.shift, t),
    tilt: mix(a.tilt, b.tilt, t),
    sx: mix(a.sx, b.sx, t),
    sy: mix(a.sy, b.sy, t),
    armL: mix(a.armL, b.armL, t),
    armR: mix(a.armR, b.armR, t),
    eyeL: mixAll(a.eyeL, b.eyeL, t),
    eyeR: mixAll(a.eyeR, b.eyeR, t),
    eyeDx: mix(a.eyeDx, b.eyeDx, t),
    eyeDy: mix(a.eyeDy, b.eyeDy, t),
    catchlight: mix(a.catchlight, b.catchlight, t),
    x: mix(a.x, b.x, t),
    star: mix(a.star, b.star, t),
    spiral: mix(a.spiral, b.spiral, t),
    mouth: mixAll(a.mouth, b.mouth, t),
    blush: mix(a.blush, b.blush, t),
    tint: [mix(a.tint[0], b.tint[0], t), mix(a.tint[1], b.tint[1], t), mix(a.tint[2], b.tint[2], t)],
    tintOp: mix(a.tintOp, b.tintOp, t),
  }
}

/** The easing the SVG's keySplines draw, solved for x so the plugin can say where a transition stands. */
function ease(x: number): number {
  const [x1, y1, x2, y2] = [0.35, 0, 0.15, 1]
  const bez = (t: number, a: number, b: number) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (bez(mid, x1, x2) < x) lo = mid
    else hi = mid
  }
  return bez((lo + hi) / 2, y1, y2)
}

/** Where a looping list of keyframes stands `seconds` into it. */
function sample(values: number[], dur: number, seconds: number, once = false): number {
  if (values.length === 0) return 0
  const span = values.length - 1
  const phase = once ? Math.min(1, seconds / dur) : (seconds % dur) / dur
  const at = phase * span
  const i = Math.min(span - 1, Math.floor(at))
  return mix(values[i] ?? 0, values[i + 1] ?? 0, at - i)
}

/** What a pose drawn `ms` ago shows now: its transition, then its loops on top. */
export function paramsAt(from: Params | null, mood: Mood, ms: number): Params {
  const to = target(mood)
  if (from !== null && ms < TRANSITION_MS) return lerp(from, to, ease(ms / TRANSITION_MS))
  const p = POSES[mood]
  const s = Math.max(0, (ms - TRANSITION_MS) / 1000)
  const out = { ...to }
  if (p.loop) {
    const keys = p.loop.keys
    const at = (k: 'lift' | 'shift' | 'tilt' | 'sx' | 'sy', base: number) =>
      keys.some(x => x[k] !== undefined) ? sample(keys.map(x => x[k] ?? (k === 'sx' || k === 'sy' ? 1 : 0)), p.loop!.dur, s, p.loop!.once) : base
    out.lift += at('lift', 0)
    out.shift += at('shift', 0)
    out.tilt += at('tilt', 0)
    out.sx *= at('sx', 1)
    out.sy *= at('sy', 1)
  }
  if (p.armLoopL) out.armL += sample(p.armLoopL.values, p.armLoopL.dur, s)
  if (p.armLoopR) out.armR += sample(p.armLoopR.values, p.armLoopR.dur, s)
  return out
}

// ---------- drawing ----------

const n = (v: number) => String(Math.round(v * 100) / 100)
const pathOf = (s: Shape, cx: number, cy: number) => {
  const pt = (i: number) => `${n((s[i] ?? 0) + cx)} ${n((s[i + 1] ?? 0) + cy)}`
  let d = `M${pt(0)}`
  for (let k = 0; k < 4; k++) {
    const o = 2 + k * 6
    d += `C${pt(o)} ${pt(o + 2)} ${pt(o + 4)}`
  }
  return `${d}Z`
}

const tween = (attr: string, from: string, to: string) =>
  from === to ? '' : `<animate attributeName="${attr}" values="${from};${to}" dur="${D}" fill="freeze" ${EASE}/>`
const tweenT = (type: string, from: string, to: string) =>
  from === to ? '' : `<animateTransform attributeName="transform" type="${type}" values="${from};${to}" dur="${D}" fill="freeze" ${EASE}/>`
const loopT = (type: string, values: string[], dur: number, extra = '', begin = D) =>
  `<animateTransform attributeName="transform" type="${type}" values="${values.join(';')}" dur="${dur}s" begin="${begin}" repeatCount="indefinite"${extra}/>`

const img = (a: { uri: string; w: number; h: number }, x: number, y: number, w: number, attrs = '') =>
  `<image href="${a.uri}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n((w * a.h) / a.w)}"${attrs}/>`

/**
 * A group that fades (and pops) in when `isNew`, out when `isGone`, or just
 * stays. Each element's own attributes hold its final state and every
 * animation starts at zero: a drawing resumed long after (its timeline moved
 * back) shows that final state, which Chrome does not freeze for an animation
 * that ended before the drawing began.
 */
function presence(body: string, isNew: boolean, isGone: boolean, cx: number, cy: number): string {
  if (isGone) {
    return `<g opacity="0"><animate attributeName="opacity" values="1;0" dur="0.22s" fill="freeze"/>${body}</g>`
  }
  if (!isNew) return body
  return `<g><animate attributeName="opacity" values="0;0;1" keyTimes="0;0.2;1" dur="0.4s" fill="freeze"/>` +
    `<g transform="translate(${n(cx)} ${n(cy)})"><g><animateTransform attributeName="transform" type="scale" values="0.55;0.55;1.08;1" keyTimes="0;0.19;0.75;1" dur="0.42s" fill="freeze"/>` +
    `<g transform="translate(${n(-cx)} ${n(-cy)})">${body}</g></g></g></g>`
}

const SHOULDER_L: Pt = [23.5, 55]
const SHOULDER_R: Pt = [76.5, 55]
const BODY = { x: 21, y: 31, w: 58 }
const BODY_H = (BODY.w * ART.body.h) / ART.body.w

function arm(side: 'L' | 'R', from: number, to: number, loop: ArmLoop | undefined): string {
  const [px, py] = side === 'L' ? SHOULDER_L : SHOULDER_R
  const at = (deg: number) => `${n(deg)} ${px} ${py}`
  const swing = loop ? loopT('rotate', loop.values.map(v => `${n(v)} ${px} ${py}`), loop.dur) : ''
  return `<g transform="rotate(${at(to)})">${tweenT('rotate', at(from), at(to))}<g>${swing}<rect x="${px - 3.2}" y="${py - 2.3}" width="6.4" height="14" rx="3.2" fill="#D27352"/>${img(ART.arm, px - 3.5, py - 2.5, 7)}</g></g>`
}

function heldSvg(kind: Held): string {
  switch (kind) {
    case 'laptop': return img(ART.laptop, 32, 62, 36)
    case 'book': return img(ART.book, 35.5, 61, 29)
    case 'glass': return `<g>${loopT('translate', ['0 0', '-3 -2', '1 -3', '0 0'], 1.6)}${img(ART.glass, 67, 55, 17)}</g>`
    case 'flag': return `<g transform="rotate(0 84 40)">${loopT('rotate', ['0 84 40', '-6 84 40', '0 84 40'], 0.9)}${img(ART.flag, 81.5, 22, 15)}</g>`
  }
}

/** A heart two units wide around (0, 0). */
const HEART = 'M0 0.9C-0.3 0.66 -1 0.2 -1 -0.3C-1 -0.72 -0.66 -0.98 -0.32 -0.98C-0.12 -0.98 0 -0.84 0 -0.68C0 -0.84 0.12 -0.98 0.32 -0.98C0.66 -0.98 1 -0.72 1 -0.3C1 0.2 0.3 0.66 0 0.9Z'

const HELD_AT: Record<Held, Pt> = { laptop: [50, 72], book: [50, 70], glass: [75, 63], flag: [88, 30] }
const OVER_AT: Record<Over, Pt> = {
  question: [79, 13], bang: [80, 13], zzz: [76, 16], check: [79, 14], dizzy: [50, 26], thought: [74, 18],
  hourglass: [80, 13], confetti: [50, 20], terminal: [79, 12], squeeze: [50, 56], hearts: [50, 20],
}

function overSvg(kind: Over): string {
  const floatUp = (dur: number, delay: number) =>
    `<animateTransform attributeName="transform" type="translate" values="0 5;0 -7" dur="${dur}s" begin="${n(delay)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.7;1" dur="${dur}s" begin="${n(delay)}s" repeatCount="indefinite"/>`
  switch (kind) {
    case 'question': return `<g>${loopT('rotate', ['0 79 14', '-10 79 14', '8 79 14', '0 79 14'], 1.3)}${img(ART.question, 75, 5, 9)}</g>`
    case 'bang': return `<g>${loopT('translate', ['0 0', '0 -2', '0 0'], 0.4)}${img(ART.bang, 77.5, 5, 5)}</g>`
    case 'check': return img(ART.check, 72, 8, 15)
    case 'zzz': return [[64, 24, 5, 0], [70, 15, 6.5, 0.8], [77, 5, 8, 1.6]]
      .map(([x, y, w, delay]) => `<g opacity="0">${floatUp(2.4, delay ?? 0)}${img(ART.zed, x ?? 0, y ?? 0, w ?? 6)}</g>`).join('')
    case 'dizzy': return `<g>${loopT('rotate', ['0 50 24', '360 50 24'], 1.6)}${img(ART.sparkle, 30, 18, 7)}${img(ART.sparkle, 64, 22, 6)}${img(ART.sparkle, 47, 10, 5)}</g>`
    case 'thought': return [[66, 22, 1.6, 0], [71, 15, 2.4, 0.25], [78, 7, 3.4, 0.5]]
      .map(([x, y, r, delay]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#C9B8AE" stroke-width="0.8" opacity="0.35"><animate attributeName="opacity" values="0.35;1;0.35" dur="1.5s" begin="${delay}s" repeatCount="indefinite"/></circle>`).join('')
    case 'hourglass': return `<g>${loopT('rotate', ['0 80.5 13', '0 80.5 13', '180 80.5 13', '180 80.5 13', '360 80.5 13'], 3.2, ' keyTimes="0;0.4;0.5;0.9;1"')}${img(ART.hourglass, 76, 6.5, 9)}</g>`
    case 'confetti': return (['#FFD23F', '#5B8DEF', '#2EA043', '#E0245E', '#9B6BFF', '#FF9F40'] as const)
      .map((fill, i) => {
        const x = 12 + i * 15
        return `<rect x="${x}" y="2" width="3.2" height="3.2" rx="0.8" fill="${fill}" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;${i % 2 ? 4 : -4} 46" dur="${n(1.3 + (i % 3) * 0.25)}s" begin="${n(0.1 * i)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.75;1" dur="${n(1.3 + (i % 3) * 0.25)}s" begin="${n(0.1 * i)}s" repeatCount="indefinite"/></rect>`
      }).join('') + img(ART.sparkle, 78, 4, 8)
    case 'terminal': return `<g><rect x="69" y="5" width="21" height="13" rx="3" fill="#1C1D21"/><rect x="69" y="5" width="21" height="13" rx="3" fill="none" stroke="#3A3D45" stroke-width="0.8"/><text x="72" y="13.6" font-size="6.4" font-family="ui-monospace, Menlo, monospace" fill="#7CFC9A">&gt;_</text><rect x="81.5" y="9" width="2.6" height="5" fill="#7CFC9A"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="0.9s" repeatCount="indefinite"/></rect></g>`
    case 'squeeze': return ['M6 56 L15 56 M11 52 L15 56 L11 60', 'M94 56 L85 56 M89 52 L85 56 L89 60']
      .map(d => `<path d="${d}" stroke="#9A8F8A" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">${loopT('translate', ['0 0', d.startsWith('M6') ? '2 0' : '-2 0', '0 0'], 0.6)}</path>`).join('')
    case 'hearts': return [[30, 27, 3.4, 0], [70, 23, 4.2, 0.9], [60, 12, 3, 1.8]]
      .map(([x, y, s, delay]) => `<g opacity="0">${floatUp(2.7, delay ?? 0)}<path transform="translate(${x} ${y}) scale(${s})" d="${HEART}" fill="#FF7A95" stroke="#E0245E" stroke-width="${n(0.5 / (s ?? 1))}"/></g>`).join('')
  }
}

function eyeLoops(kind: Pose['eyeLoop']): [string, string] {
  const blink = loopT('scale', ['1 1', '1 1', '1 0.08', '1 1'], 4.2, ' keyTimes="0;0.93;0.965;1"')
  switch (kind ?? 'blink') {
    case 'none': return ['', '']
    case 'blink': return ['', blink]
    case 'glance': return [loopT('translate', ['0 0', '0 0', '-2.2 0', '-2.2 0', '0 0', '0 0', '2.2 0', '2.2 0', '0 0'], 9, ' keyTimes="0;0.3;0.34;0.46;0.5;0.72;0.76;0.88;1"'), blink]
    case 'dart': return [loopT('translate', ['0 0', '-2.4 0', '-2.4 0', '2.4 0', '2.4 0', '0 0'], 2.4, ' keyTimes="0;0.08;0.42;0.5;0.92;1"'), blink]
    case 'scan': return [loopT('translate', ['0 0', '2.2 0', '-2.2 0.8', '2.2 0.8', '-2.2 0', '0 0'], 3.6, ' keyTimes="0;0.25;0.3;0.7;0.75;1"'), '']
  }
}

function mouthLoop(kind: Pose['mouthLoop'], base: MouthKind): string {
  if (kind === undefined) return ''
  const cx = 50
  const cy = 64
  const shapes: Record<NonNullable<Pose['mouthLoop']>, [MouthKind[], number]> = {
    talk: [['small', 'open', 'o', 'small', 'open', 'small'], 0.9],
    wobble: [['pout', 'flat', 'pout'], 0.7],
    yawn: [['small', 'small', 'open', 'open', 'small'], 4],
  }
  const [middle, dur] = shapes[kind]
  const list = [base, ...middle.slice(1, -1), base]
  return `<animate attributeName="d" values="${list.map(k => pathOf(mouthShape(k), cx, cy)).join(';')}" dur="${dur}s" begin="${D}" repeatCount="indefinite"/>`
}

function bodyLoops(loop: BodyLoop | undefined): { move: string; turn: string; squash: string } {
  if (loop === undefined) return { move: '', turn: '', squash: '' }
  const has = (k: 'lift' | 'shift' | 'tilt' | 'sx' | 'sy') => loop.keys.some(x => x[k] !== undefined)
  const repeat = loop.once ? '' : ' repeatCount="indefinite"'
  const anim = (type: string, values: string[]) =>
    `<animateTransform attributeName="transform" type="${type}" values="${values.join(';')}" dur="${loop.dur}s" begin="${D}"${repeat}/>`
  return {
    move: has('lift') || has('shift') ? anim('translate', loop.keys.map(k => `${n(k.shift ?? 0)} ${n(k.lift ?? 0)}`)) : '',
    turn: has('tilt') ? anim('rotate', loop.keys.map(k => `${n(k.tilt ?? 0)} 50 88`)) : '',
    squash: has('sx') || has('sy') ? anim('scale', loop.keys.map(k => `${n(k.sx ?? 1)} ${n(k.sy ?? 1)}`)) : '',
  }
}

/** Where each thing to wear sits: its center, width and tilt, in the drawing's 100×100. `stretch` scales its height (1 = as drawn), `skew` leans it sideways in degrees. */
export const WEAR_AT: Record<Item, { x: number; y: number; w: number; r?: number; s?: number; stretch?: number; skew?: number; flip?: true; ground?: true }> = {
  hardhat: { x: 50, y: 29.3, w: 50, r: -1, stretch: 0.84 },
  crown: { x: 50, y: 22, w: 45 },
  gradcap: { x: 40, y: 28.6, w: 52, r: -9 },
  partyhat: { x: 35.7, y: 22.9, w: 32, r: -17 },
  witchhat: { x: 38, y: 23, w: 48, r: -14 },
  santahat: { x: 39, y: 26.3, w: 42, r: -16 },
  nightcap: { x: 28.6, y: 25.7, w: 43.3, r: -15, flip: true },
  cowboy: { x: 39, y: 25.7, w: 50, r: -14 },
  pirate: { x: 42, y: 26.7, w: 50, r: -9 },
  chefhat: { x: 38, y: 22.1, w: 34, r: -15 },
  viking: { x: 50, y: 22, w: 50 },
  wizard: { x: 38, y: 22.1, w: 42, r: -20 },
  fez: { x: 39, y: 27.1, w: 32.9, r: -15 },
  propeller: { x: 40, y: 25.1, w: 38, r: -16 },
  beanie: { x: 40, y: 22.4, w: 40, r: -18 },
  sunglasses: { x: 50, y: 52, w: 48 },
  glasses: { x: 50, y: 52, w: 40 },
  mustache: { x: 50, y: 62.1, w: 35.3 },
  monocle: { x: 62.1, y: 55.7, w: 17.5 },
  bowtie: { x: 50, y: 73.5, w: 30.4 },
  medal: { x: 50, y: 78.6, w: 16.9 },
  scarf: { x: 50.2, y: 75.7, w: 20 },
  necktie: { x: 50, y: 78, w: 12 },
  evileye: { x: 50, y: 73, w: 48.8, stretch: 0.6 },
  mug: { x: 84, y: 69.5, w: 22 },
  tea: { x: 83.5, y: 69.5, w: 21 },
  simit: { x: 83, y: 69, w: 22 },
  pencil: { x: 78.3, y: 68.5, w: 6.5, r: 18 },
  wrench: { x: 85.3, y: 56.4, w: 13, r: 33 },
  balloon: { x: 80.6, y: 42.5, w: 24 },
  pumpkin: { x: 14, y: 76.4, w: 23.7, ground: true },
  duck: { x: 12.5, y: 78.1, w: 21, flip: true, ground: true },
  cactus: { x: 11, y: 76.1, w: 17, ground: true },
  cat: { x: 13.5, y: 74.4, w: 24, ground: true },
  gift: { x: 12, y: 77.6, w: 20, ground: true },
  sakura: { x: 39, y: 31, w: 18, s: 1.3 },
  pin: { x: 34.6, y: 70.8, w: 9, s: 1.6 },
  rosette: { x: 50, y: 76, w: 12, s: 1.5 },
  candy: { x: 83, y: 69, w: 14, s: 1.8 },
  lantern: { x: 80.5, y: 73, w: 9, s: 1.9 },
  envelope: { x: 83, y: 70, w: 9, s: 1.8 },
  diya: { x: 13, y: 84, w: 17, s: 1.4, ground: true },
  songpyeon: { x: 12, y: 85, w: 16, s: 1.4, ground: true },
  cake: { x: 12, y: 82, w: 15, s: 1.4, ground: true },
  mushroom: { x: 13.2, y: 75.7, w: 23.4, ground: true },
  frog: { x: 12.9, y: 75.4, w: 22.9, ground: true },
  robot: { x: 88.1, y: 79.9, w: 19.5, ground: true },
  ramen: { x: 13.5, y: 76.8, w: 24.0, ground: true },
  snail: { x: 12.9, y: 84.8, w: 24, ground: true },
  campfire: { x: 14, y: 83.4, w: 22.5, ground: true },
  bonsai: { x: 13.9, y: 83.4, w: 22, ground: true },
  penguin: { x: 12, y: 81.4, w: 22.7, ground: true },
  lavalamp: { x: 10.0, y: 74.0, w: 11.1, ground: true },
  taco: { x: 81.5, y: 84.1, w: 23, ground: true },
  tent: { x: 83.1, y: 83.8, w: 24, ground: true },
  hedgehog: { x: 13.1, y: 80.6, w: 24, flip: true, ground: true },
  wateringcan: { x: 14.6, y: 82.7, w: 24, ground: true },
  macaron: { x: 12.5, y: 81, w: 16.2, ground: true },
  arcade: { x: 13, y: 81, w: 20.3, ground: true },
  snowman: { x: 17, y: 81.7, w: 29.8, r: -6, ground: true },
  rocket: { x: 14.3, y: 82.2, w: 20.6, ground: true },
  watermelon: { x: 15.1, y: 84, w: 23, ground: true },
  chest: { x: 14, y: 85.1, w: 23.5, ground: true },
  axolotl: { x: 15.1, y: 82.4, w: 24, ground: true },
  horse: { x: 13, y: 75.5, w: 21.1, ground: true },
  sprout: { x: 12, y: 77, w: 17.1, ground: true },
  bunny: { x: 12, y: 76, w: 15.8, ground: true },
  bandana: { x: 52.9, y: 37.1, w: 58.7, r: -4, stretch: 0.82 },
  sailorhat: { x: 41, y: 26.9, w: 44, r: -10 },
  strawhat: { x: 40, y: 25.3, w: 56, r: -12 },
  daisyhat: { x: 41, y: 28.2, w: 46, r: -12 },
  leaf: { x: 46, y: 27.1, w: 32.9, r: -12 },
  catears: { x: 50, y: 33.7, w: 63.6 },
  bunnyears: { x: 50, y: 25.7, w: 62.4, stretch: 0.76 },
  flowercrown: { x: 50, y: 36, w: 51.3 },
  beret: { x: 37.9, y: 26.8, w: 46, r: -21 },
  tophat: { x: 40, y: 26.3, w: 38, r: -12 },
  jester: { x: 34.3, y: 25.7, w: 53.8, r: -22 },
  nursecap: { x: 41, y: 28.5, w: 40, r: -8 },
  sombrero: { x: 41, y: 26.4, w: 60, r: -10 },
  antlers: { x: 50, y: 27.5, w: 67.9 },
  farmer: { x: 46.5, y: 24.5, w: 50, r: -10 },
  sunflowercrown: { x: 50, y: 37, w: 58.7 },
  bee: { x: 50, y: 30.6, w: 68.5 },
  halo: { x: 44, y: 20, w: 34, r: -8 },
  unicorn: { x: 50, y: 27, w: 56.2 },
  shortcake: { x: 42, y: 23.0, w: 42, r: -8 },
  rainbow: { x: 50, y: 19.3, w: 46 },
  dragon: { x: 50, y: 26.6, w: 56.2 },
  astronaut: { x: 50, y: 43.6, w: 59.3, r: -1, stretch: 1.05 },
  bowler: { x: 50.0, y: 33.3, w: 62.8 },
  flatcap: { x: 49.9, y: 31.3, w: 57.0 },
  explorer: { x: 49.9, y: 35.3, w: 73.8 },
  baseballcap: { x: 50.0, y: 37.6, w: 58.4 },
  heartglasses: { x: 50, y: 52.4, w: 53.8, stretch: 1.05 },
  eyepatch: { x: 49.1, y: 50.6, w: 51.0 },
  beard: { x: 49.9, y: 67.9, w: 58.1, stretch: 0.73 },
  goggles: { x: 50.0, y: 52.4, w: 60.8 },
  starglasses: { x: 49.9, y: 50.7, w: 55 },
  cinema3d: { x: 49.9, y: 50.3, w: 57.0 },
  nerdglasses: { x: 50, y: 50.7, w: 58.1 },
  visor: { x: 50.0, y: 49.9, w: 58.4 },
  clownnose: { x: 50, y: 56.4, w: 13.8 },
  catwhiskers: { x: 50, y: 58.5, w: 44.5 },
  plaster: { x: 65.4, y: 58, w: 17 },
  freckles: { x: 50.0, y: 59.5, w: 36.0 },
  bushybrows: { x: 50.0, y: 42.8, w: 44.0 },
  eyelashes: { x: 50.1, y: 47.7, w: 37.4 },
  fangs: { x: 50.5, y: 67.1, w: 16.3, stretch: 1.95 },
  teardrop: { x: 39.7, y: 60.1, w: 6.6 },
  spikedcollar: { x: 49.9, y: 71.4, w: 59.3, stretch: 0.73 },
  pearls: { x: 50.1, y: 67.1, w: 56.2, stretch: 0.52 },
  bellcollar: { x: 50, y: 74.8, w: 58.1, stretch: 0.79 },
  neckerchief: { x: 49.9, y: 74.4, w: 30.4 },
  lei: { x: 49.9, y: 68.8, w: 56.8, stretch: 0.61 },
  goldchain: { x: 50.1, y: 72.9, w: 50.7, stretch: 0.58 },
  overalls: { x: 50, y: 72.9, w: 45.8, stretch: 0.81 },
  sailorcollar: { x: 50, y: 73, w: 58 },
  whistle: { x: 54, y: 76.5, w: 11 },
  lanyard: { x: 50, y: 78, w: 12 },
  camera: { x: 50, y: 77.5, w: 18 },
  stethoscope: { x: 50, y: 74, w: 47 },
  binoculars: { x: 50, y: 76.5, w: 16 },
  headphones: { x: 50, y: 69, w: 48 },
  bib: { x: 50, y: 76, w: 28 },
  ruff: { x: 50, y: 70, w: 58 },
  bolotie: { x: 50, y: 75, w: 8 },
  boa: { x: 50, y: 70, w: 64 },
  locket: { x: 50, y: 76.5, w: 9, s: 1.2 },
  aviators: { x: 50, y: 52, w: 48 },
  pixelshades: { x: 50, y: 51, w: 44 },
  cateye: { x: 50, y: 51.5, w: 48 },
  masquerade: { x: 50, y: 50, w: 47 },
  divemask: { x: 50, y: 50, w: 44 },
  facemask: { x: 50, y: 64, w: 28 },
  vrheadset: { x: 50, y: 51, w: 50 },
  lollipop: { x: 60, y: 60, w: 20 },
  bubblegum: { x: 50, y: 66, w: 12 },
  wheat: { x: 37, y: 60, w: 18, s: 1.25 },
  rose: { x: 46, y: 64, w: 28, s: 1.2 },
  goldstars: { x: 50, y: 58, w: 44 },
  pencilstache: { x: 50, y: 60.6, w: 26 },
  chevron: { x: 50, y: 60.4, w: 30 },
  handlebar: { x: 50, y: 59.2, w: 40 },
  walrus: { x: 50, y: 61.6, w: 36 },
  horseshoe: { x: 50, y: 65.4, w: 26 },
  goatee: { x: 50, y: 71, w: 12 },
  soulpatch: { x: 50, y: 69, w: 5 },
  chinstrap: { x: 50, y: 66, w: 54 },
  wizardbeard: { x: 50, y: 74, w: 48 },
  braidbeard: { x: 50, y: 74, w: 46 },
  flag: { x: 88.1, y: 54.2, w: 20.6, r: 15 },
  whisk: { x: 83.8, y: 53.1, w: 12, r: 24, stretch: 0.99 },
  pinwheel: { x: 81.3, y: 50.5, w: 21.2 },
  compass: { x: 83.5, y: 59.9, w: 13.5, r: 45 },
  key: { x: 84, y: 67.9, w: 11.4, r: -29 },
  icecream: { x: 80.3, y: 57, w: 10.9 },
  cupcake: { x: 82.4, y: 61.3, w: 14.5 },
  sunflower: { x: 81.2, y: 51.2, w: 26.1 },
  clover: { x: 85.1, y: 56.6, w: 18.5, r: 35 },
  toadstool: { x: 83, y: 57.9, w: 16, r: 28 },
  cactuspot: { x: 82.8, y: 58, w: 12.8 },
  wand: { x: 83.1, y: 56.7, w: 12.3, r: 20 },
  potion: { x: 84, y: 63.6, w: 16.1, r: 15 },
  paddle: { x: 83, y: 56.2, w: 14.8, r: 19 },
  joystick: { x: 81.7, y: 59, w: 12.4 },
  bubblewand: { x: 82.1, y: 57.1, w: 13, r: 17 },
  rollingpin: { x: 85.1, y: 55.4, w: 7.1, r: 33 },
  harmonica: { x: 80.3, y: 63.8, w: 17.1, r: -20, stretch: 1.23 },
  tambourine: { x: 85, y: 59.9, w: 23, r: 45, stretch: 0.79 },
}

const NO_OUTFIT: Outfit = { head: null, eyes: null, face: null, lip: null, chin: null, neck: null, held: null, ground: null }

/** `count` circles of radius `r` around (x, y), `d` from it: a blossom's petals, a rosette's pleats. */
const around = (x: number, y: number, d: number, r: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i * 2 * Math.PI) / count
    return `<circle cx="${n(x + Math.sin(a) * d)}" cy="${n(y - Math.cos(a) * d)}" r="${n(r)}"/>`
  }).join('')

/** `count` points spread evenly along the curve from (x1, y1) to (x2, y2) bending toward (cx, cy), each with the curve's slope there in degrees: a ruff's pleats, a boa's tufts. */
const along = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, count: number): [number, number, number][] =>
  Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    const at = (a: number, c: number, b: number) => (1 - t) ** 2 * a + 2 * (1 - t) * t * c + t ** 2 * b
    const slope = Math.atan2((1 - t) * (cy - y1) + t * (y2 - cy), (1 - t) * (cx - x1) + t * (x2 - cx))
    return [at(x1, cx, x2), at(y1, cy, y2), (slope * 180) / Math.PI]
  })

/** A five-pointed star at (x, y), `r` to its points, turned `turn` degrees: a sticker's. */
/** A left half drawn again, mirrored about the middle (x 50). */
const both = (half: string) => `${half}<g transform="translate(100 0) scale(-1 1)">${half}</g>`
const starAt = (x: number, y: number, r: number, turn: number) =>
  `M${Array.from({ length: 10 }, (_, i) => {
    const a = ((i * 36 + turn) * Math.PI) / 180
    const d = i % 2 ? r * 0.45 : r
    return `${n(x + Math.sin(a) * d)} ${n(y - Math.cos(a) * d)}`
  }).join('L')}Z`

/** A small flame standing at (x, y), `s` times its size, flickering in its glow. */
const flame = (x: number, y: number, s: number) =>
  `<circle cx="${n(x)}" cy="${n(y - 2 * s)}" r="${n(3.4 * s)}" fill="#FFE7CF" opacity="0.45"><animate attributeName="opacity" values="0.45;0.25;0.45" dur="1.3s" repeatCount="indefinite"/></circle>` +
  `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})"><g><animateTransform attributeName="transform" type="scale" values="1 1;0.88 1.1;1.04 0.94;1 1" dur="0.9s" repeatCount="indefinite"/>` +
  '<path d="M0 -4.6C1.6 -2.6 2 -1 1.5 0C1.1 0.8 0.6 1 0 1C-0.6 1 -1.1 0.8 -1.5 0C-2 -1 -1.6 -2.6 0 -4.6Z" fill="#FF9F40"/>' +
  '<path d="M0 -2.6C0.8 -1.5 1 -0.6 0.7 0C0.5 0.4 0.3 0.5 0 0.5C-0.3 0.5 -0.5 0.4 -0.7 0C-1 -0.6 -0.8 -1.5 0 -2.6Z" fill="#FFF3D6"/></g></g>'

/** A songpyeon: half a moon of rice cake, its flat side down at (x, y). */
const halfMoon = (x: number, y: number, fill: string) =>
  `<g transform="translate(${n(x)} ${n(y)})"><path d="M-3.4 0Q-3.8 -4 0 -4.2Q3.8 -4 3.4 0Q0 0.8 -3.4 0Z" fill="${fill}" stroke="#C9B8AE" stroke-width="0.35"/>` +
  '<path d="M-2.4 -1.6Q0 -3.2 2.4 -1.6" stroke="#2B1B17" stroke-opacity="0.12" stroke-width="0.4" fill="none"/><ellipse cx="-1.2" cy="-2.8" rx="1" ry="0.45" fill="#fff" opacity="0.6"/></g>'

/**
 * Glasses and a monocle drawn as lines rather than pictures: a thin painted
 * rim vanishes on the clay at band size, and a drawn lens is wide enough for
 * the eyes to look around inside it. The days' own things (a sakura sprig, a
 * lantern, a cake) are drawn the same way.
 */
export const VECTOR_WEAR: Partial<Record<Item, { svg: string; box: [number, number, number, number]; onSkin?: true }>> = {
  glasses: {
    box: [23, 42, 54, 20],
    onSkin: true,
    svg: '<g fill="none" stroke="#2B1B17" stroke-width="1.8" stroke-linecap="round">' +
      '<circle cx="40" cy="52" r="7.8" fill="#FFF6EC" fill-opacity="0.16"/><circle cx="60" cy="52" r="7.8" fill="#FFF6EC" fill-opacity="0.16"/>' +
      '<path d="M47.6 50.6Q50 48.8 52.4 50.6"/><path d="M32.3 50.4L25.2 48.6"/><path d="M67.7 50.4L74.8 48.6"/></g>' +
      '<path d="M35.4 48.6A5.6 5.6 0 0 1 39.6 45.9M55.4 48.6A5.6 5.6 0 0 1 59.6 45.9" stroke="#fff" stroke-opacity="0.6" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
  },
  scarf: {
    box: [18, 60, 64, 30],
    svg: '<defs><pattern id="scarfP" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><rect width="7" height="7" fill="#F3ECE4"/><rect width="3.6" height="7" fill="#D8433B"/></pattern>' +
      '<linearGradient id="scarfS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#3A120E" stop-opacity="0.32"/></linearGradient>' +
      '<linearGradient id="scarfT" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A120E" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#3A120E" stop-opacity="0.22"/></linearGradient></defs>' +
      '<path d="M61.5 71L69.5 70.5L71.4 84.6Q67.2 86 63 85Z" fill="url(#scarfP)"/><path d="M61.5 71L69.5 70.5L71.4 84.6Q67.2 86 63 85Z" fill="url(#scarfT)" stroke="#8E2A22" stroke-opacity="0.35" stroke-width="0.5"/>' +
      '<path d="M63.6 85.2V87.4M65.6 85.5V87.8M67.6 85.5V87.8M69.6 85.2V87.4" stroke="#D8433B" stroke-width="0.9" stroke-linecap="round"/>' +
      '<path d="M21.6 63.4Q50 72 78.4 63.4L78.9 72.2Q50 80.6 21.1 72.2Z" fill="url(#scarfP)"/>' +
      '<path d="M21.6 63.4Q50 72 78.4 63.4L78.9 72.2Q50 80.6 21.1 72.2Z" fill="url(#scarfS)" stroke="#8E2A22" stroke-opacity="0.35" stroke-width="0.5"/>' +
      '<rect x="60.2" y="67.4" width="10" height="8.6" rx="3.4" fill="url(#scarfP)"/><rect x="60.2" y="67.4" width="10" height="8.6" rx="3.4" fill="url(#scarfS)" stroke="#8E2A22" stroke-opacity="0.4" stroke-width="0.5"/>',
  },
  evileye: {
    box: [36, 61, 28, 20],
    svg: '<path d="M26.8 57.4Q50 86 73.2 57.4" stroke="#2B1B17" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.9"/>' +
      '<circle cx="50" cy="71.6" r="1.1" fill="none" stroke="#C9A24A" stroke-width="0.6"/>' +
      '<circle cx="50" cy="76.4" r="4.7" fill="#1E4CC2" stroke="#12348C" stroke-width="0.5"/><circle cx="50" cy="76.4" r="3.2" fill="#F7F7F4"/>' +
      '<circle cx="50" cy="76.4" r="2.05" fill="#5FA8F2"/><circle cx="50" cy="76.4" r="0.95" fill="#121212"/>' +
      '<ellipse cx="48.2" cy="74.2" rx="1.5" ry="0.8" fill="#fff" opacity="0.7" transform="rotate(-30 48.2 74.2)"/>',
  },
  monocle: {
    box: [49, 42.5, 22, 19],
    onSkin: true,
    svg: '<path d="M66.4 57.6C69.6 61.5 70.8 65.5 69.4 70.5" stroke="#B8862A" stroke-width="1.2" fill="none" stroke-dasharray="1.3 0.9" stroke-linecap="round"/>' +
      '<circle cx="60" cy="52" r="7.6" fill="#FFF6EC" fill-opacity="0.16" stroke="#5A3A10" stroke-width="2.6"/>' +
      '<circle cx="60" cy="52" r="7.6" fill="none" stroke="#E9B949" stroke-width="1.1"/>' +
      '<path d="M55.4 48.6A5.6 5.6 0 0 1 59.6 45.9" stroke="#fff" stroke-opacity="0.6" stroke-width="1.1" fill="none" stroke-linecap="round"/>',
  },
  sakura: {
    box: [27, 21, 24, 17],
    svg: '<path d="M30.2 38Q38 32.4 48.4 30.2M40.6 33.4Q41.8 29 40.2 25.6M35.4 34.6Q35 32.4 36.2 30.8" stroke="#7A4A2E" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      `<g fill="#FAD0DC" stroke="#E68AA6" stroke-width="0.3">${around(36.2, 30.6, 1.2, 1.1, 5)}${around(33, 35.8, 1.9, 1.75, 5)}${around(39.6, 32.3, 2.2, 2, 5)}${around(46.2, 30.6, 1.6, 1.5, 5)}</g>` +
      '<g fill="#E0607F"><circle cx="36.2" cy="30.6" r="0.6"/><circle cx="33" cy="35.8" r="0.9"/><circle cx="39.6" cy="32.3" r="1"/><circle cx="46.2" cy="30.6" r="0.8"/></g>' +
      '<ellipse cx="40.2" cy="25.2" rx="1.1" ry="1.5" fill="#F59AB5" transform="rotate(-14 40.2 25.2)"/>' +
      // Now and then a petal drifts down past the cheek.
      '<ellipse cx="36" cy="37" rx="1" ry="0.6" fill="#FAD0DC" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;-6 9;-9 18" dur="6s" repeatCount="indefinite"/>' +
      '<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.5;0.6;0.9;1" dur="6s" repeatCount="indefinite"/></ellipse>',
  },
  pin: {
    box: [29, 65, 11.5, 11.5],
    onSkin: true,
    svg: '<circle cx="35" cy="71.4" r="4.4" fill="#2B1B17" opacity="0.18"/><circle cx="34.6" cy="70.8" r="4.2" fill="#2B2D5C" stroke="#E9B949" stroke-width="0.9"/>' +
      '<path d="M33 69.2L31.4 70.8L33 72.4M36.2 69.2L37.8 70.8L36.2 72.4M35.2 68.6L34 73" stroke="#FFB38A" stroke-width="0.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M31.8 68.6Q32.6 67.4 34 67.2" stroke="#fff" stroke-opacity="0.45" stroke-width="0.7" fill="none" stroke-linecap="round"/>',
  },
  rosette: {
    box: [41, 66.5, 18, 20],
    onSkin: true,
    svg: '<path d="M47.8 76.4L45.4 84.6L47.2 83.6L48.4 85.4L50.6 77Z" fill="#B8322B"/><path d="M52.2 76.4L54.6 84.6L52.8 83.6L51.6 85.4L49.4 77Z" fill="#B8322B"/>' +
      `<g fill="#D8433B" stroke="#B8322B" stroke-width="0.3">${around(50, 75.5, 4.6, 1.7, 12)}</g>` +
      '<circle cx="50" cy="75.5" r="4.6" fill="#D8433B"/><circle cx="50" cy="75.5" r="3.3" fill="#F3ECE4"/><circle cx="50" cy="75.5" r="2.3" fill="#E9B949" stroke="#B8862A" stroke-width="0.4"/>' +
      '<path d="M48.7 74.4Q49.2 73.6 50.2 73.5" stroke="#fff" stroke-opacity="0.7" stroke-width="0.6" fill="none" stroke-linecap="round"/>',
  },
  candy: {
    box: [74, 62, 18, 14],
    svg: '<g transform="rotate(-24 83 69)"><g fill="#F2B84B" stroke="#B8862A" stroke-width="0.4" stroke-linejoin="round"><path d="M79.8 69L76.2 66.2L77 69L76.2 71.8Z"/><path d="M86.2 69L89.8 66.2L89 69L89.8 71.8Z"/></g>' +
      '<ellipse cx="83" cy="69" rx="3.8" ry="3" fill="#E8685F" stroke="#B8322B" stroke-width="0.4"/>' +
      '<path d="M81.4 66.4Q82.6 69 81.4 71.6M84.2 66.2Q85.4 69 84.2 71.8" stroke="#FFF6EC" stroke-width="0.8" fill="none"/>' +
      '<ellipse cx="82" cy="67.4" rx="1.4" ry="0.6" fill="#fff" opacity="0.5"/></g>',
  },
  lantern: {
    box: [73.5, 63.5, 14, 17],
    svg: '<circle cx="80.5" cy="74.4" r="5.4" fill="#FFE7CF" opacity="0.4"><animate attributeName="opacity" values="0.4;0.22;0.4" dur="1.6s" repeatCount="indefinite"/></circle>' +
      '<circle cx="80.5" cy="66.4" r="1.2" fill="none" stroke="#B8862A" stroke-width="0.7"/><path d="M80.5 67.6V69.2" stroke="#B8862A" stroke-width="0.7"/>' +
      '<path d="M77.6 71.2Q80.5 67.8 83.4 71.2Z" fill="#E9B949" stroke="#B8862A" stroke-width="0.5"/>' +
      '<rect x="78" y="71.2" width="5" height="6.8" rx="1.2" fill="#FFD27A" stroke="#B8862A" stroke-width="0.6"/>' +
      '<path d="M79.7 71.4V77.8M81.3 71.4V77.8" stroke="#B8862A" stroke-width="0.45"/><ellipse cx="80.5" cy="74.6" rx="1" ry="1.6" fill="#FFF3D6"/>' +
      '<rect x="77.4" y="77.8" width="6.2" height="1.4" rx="0.6" fill="#E9B949" stroke="#B8862A" stroke-width="0.4"/>',
  },
  envelope: {
    box: [75.5, 62.5, 15, 15],
    svg: '<g transform="rotate(14 83 70)"><rect x="79.2" y="64.8" width="7.6" height="10.4" rx="1" fill="#D8433B" stroke="#8E2A22" stroke-width="0.45"/>' +
      '<path d="M79.4 66.2L83 68.8L86.6 66.2" stroke="#E9B949" stroke-width="0.6" fill="none" stroke-linejoin="round"/>' +
      '<circle cx="83" cy="71" r="1.7" fill="#E9B949"/><path d="M83 70.1L83.9 71L83 71.9L82.1 71Z" fill="#D8433B"/>' +
      '<path d="M80.2 73.8H85.8" stroke="#E9B949" stroke-width="0.4" opacity="0.7"/></g>',
  },
  diya: {
    box: [3, 73, 21, 17],
    svg: '<ellipse cx="12.5" cy="88.6" rx="7" ry="1.7" fill="#2B1B17" opacity="0.13"/>' +
      '<path d="M17.6 83.6Q20.4 83 21.6 81.2Q20.8 84.4 18 85.4Z" fill="#B65A3C"/><path d="M5 83.6Q5.8 88.4 12 88.4Q18.2 88.4 19 83.6Z" fill="#C9694A"/>' +
      '<ellipse cx="12" cy="83.7" rx="7" ry="1.2" fill="#7A2E16"/><path d="M5 83.6Q12 85.6 19 83.6" stroke="#E08A6A" stroke-width="0.7" fill="none"/>' +
      `<g fill="#F2B84B"><circle cx="8.4" cy="86.2" r="0.55"/><circle cx="12" cy="87" r="0.55"/><circle cx="15.6" cy="86.2" r="0.55"/></g>${flame(21.3, 81, 1.15)}`,
  },
  songpyeon: {
    box: [3, 77, 18.5, 13],
    svg: '<ellipse cx="12" cy="88.6" rx="7.4" ry="1.6" fill="#2B1B17" opacity="0.13"/><ellipse cx="12" cy="87" rx="7.6" ry="2" fill="#E9DCCB" stroke="#C9B8AE" stroke-width="0.4"/>' +
      '<path d="M5.6 86.4L9.2 84.6M6.6 87.2L10.6 85.6M15 84.8L18.4 86.4M14 85.6L17.6 87.4" stroke="#3F8A3A" stroke-width="0.55" stroke-linecap="round"/>' +
      halfMoon(8.8, 86, '#F7F1E8') + halfMoon(15.2, 86.2, '#F5B8C4') + halfMoon(12, 83.2, '#A9D18E'),
  },
  cake: {
    box: [3.5, 70, 17, 20],
    svg: '<ellipse cx="12" cy="88.6" rx="7" ry="1.7" fill="#2B1B17" opacity="0.13"/><ellipse cx="12" cy="87.6" rx="7.6" ry="1.5" fill="#E9DCCB" stroke="#C9B8AE" stroke-width="0.4"/>' +
      '<rect x="6" y="80.6" width="12" height="7" rx="1.4" fill="#F3ECE4" stroke="#C9B8AE" stroke-width="0.4"/><rect x="6.2" y="84.6" width="11.6" height="1.2" fill="#F5B8C4"/>' +
      '<path d="M6 82.2Q6 80.6 7.6 80.6H16.4Q18 80.6 18 82.2Q17 83.8 16 82.4Q15 84 14 82.4Q13 84.2 12 82.4Q11 84 10 82.4Q9 84.2 8 82.4Q7 83.8 6 82.2Z" fill="#F5B8C4"/>' +
      '<g stroke-width="0.6" stroke-linecap="round"><path d="M8.4 81.4L9.2 81.1" stroke="#5B8DEF"/><path d="M11 81.2L11.6 81.6" stroke="#FFD23F"/><path d="M14.6 81.4L15.4 81.2" stroke="#2EA043"/><path d="M16 82L16.4 82.6" stroke="#5B8DEF"/></g>' +
      `<rect x="11.3" y="76.2" width="1.4" height="4.6" rx="0.4" fill="#7AA2F7"/><path d="M11.3 77.4L12.7 76.8M11.3 79L12.7 78.4" stroke="#fff" stroke-width="0.4"/>${flame(12, 76, 0.7)}`,
  },
  // More for the neck, in the same clay: lit from the top left, a darker edge of their own colour.
  sailorcollar: {
    box: [18, 60, 64, 27],
    svg: '<defs><linearGradient id="sailorcollarS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#0B1430" stop-opacity="0.35"/></linearGradient></defs>' +
      '<path d="M42.4 68.6Q50 70.8 57.6 68.6L50 81.6Z" fill="#FBF8F3"/><path d="M44.4 71.6Q50 73.4 55.6 71.6" stroke="#233A6E" stroke-width="1" fill="none"/><path d="M45.8 74.4Q50 75.8 54.2 74.4" stroke="#233A6E" stroke-width="0.8" fill="none"/>' +
      '<g stroke="#152447" stroke-width="0.45" stroke-linejoin="round"><path d="M21.6 62.8Q32 67.6 42.4 68.6L50 81.6Q36 79.6 21.2 72.4Z" fill="#233A6E"/><path d="M78.4 62.8Q68 67.6 57.6 68.6L50 81.6Q64 79.6 78.8 72.4Z" fill="#233A6E"/></g>' +
      '<path d="M21.6 62.8Q32 67.6 42.4 68.6L50 81.6Q36 79.6 21.2 72.4ZM78.4 62.8Q68 67.6 57.6 68.6L50 81.6Q64 79.6 78.8 72.4Z" fill="url(#sailorcollarS)"/>' +
      '<g stroke="#FBF8F3" stroke-width="0.7" fill="none" stroke-linecap="round"><path d="M21.4 70.6Q35.6 77.4 47.4 79.2M21.6 68.8Q35 75.4 46 77.2"/><path d="M78.6 70.6Q64.4 77.4 52.6 79.2M78.4 68.8Q65 75.4 54 77.2"/></g>' +
      '<g fill="#D8433B" stroke="#8E2A22" stroke-width="0.4" stroke-linejoin="round"><path d="M49.4 80.2L47.4 85.2L48.8 84.6L49.6 85.8L50.6 80.4Z"/><path d="M50.6 80.2L52.6 85.2L51.2 84.6L50.4 85.8L49.4 80.4Z"/>' +
      '<path d="M50 79.8L46 77.8Q45 79.8 46 81.8Z"/><path d="M50 79.8L54 77.8Q55 79.8 54 81.8Z"/><rect x="48.8" y="78.6" width="2.4" height="2.4" rx="0.8"/></g>' +
      '<path d="M46.4 78.6Q46 79.4 46.3 80.2" stroke="#fff" stroke-opacity="0.5" stroke-width="0.5" fill="none" stroke-linecap="round"/>',
  },
  whistle: {
    box: [41, 67, 23, 16],
    onSkin: true,
    svg: '<defs><linearGradient id="whistleM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F8FA"/><stop offset="1" stop-color="#8E98A3"/></linearGradient></defs>' +
      '<path d="M28.4 60.4Q50 84 71.6 60.4" stroke="#D8433B" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
      '<path d="M28.4 60.4Q50 84 71.6 60.4" stroke="#FFF6EC" stroke-width="0.5" stroke-dasharray="1.4 1.4" fill="none" opacity="0.8"/>' +
      '<circle cx="50" cy="73" r="1.1" fill="none" stroke="#9AA4AE" stroke-width="0.6"/>' +
      '<g transform="translate(53 76.8) rotate(-12) scale(1.25)"><circle cx="-2.3" cy="-2.3" r="0.9" fill="none" stroke="#9AA4AE" stroke-width="0.6"/>' +
      '<path d="M0 -3.2H6.3Q7 -3.2 7 -2.5V-1.5Q7 -0.8 6.3 -0.8H3.1A3.2 3.2 0 1 1 0 -3.2Z" fill="url(#whistleM)" stroke="#5E6670" stroke-width="0.45" stroke-linejoin="round"/>' +
      '<path d="M0.9 -3.2H2.7V-2.1H0.9Z" fill="#3A3F47"/><ellipse cx="-1.1" cy="-1.3" rx="1.3" ry="0.7" fill="#fff" opacity="0.75" transform="rotate(-30 -1.1 -1.3)"/>' +
      '<path d="M3.6 -2.6H6.2" stroke="#fff" stroke-opacity="0.7" stroke-width="0.4" stroke-linecap="round"/></g>',
  },
  lanyard: {
    box: [37, 66, 26, 19],
    svg: '<defs><linearGradient id="lanyardM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F8FA"/><stop offset="1" stop-color="#8E98A3"/></linearGradient></defs>' +
      '<g fill="none"><path d="M30.4 60.6Q38 69.4 48.8 73.4M69.6 60.6Q62 69.4 51.2 73.4" stroke="#3B6FD8" stroke-width="2.2"/><path d="M30.4 60.6Q38 69.4 48.8 73.4M69.6 60.6Q62 69.4 51.2 73.4" stroke="#9DBBFA" stroke-width="0.5"/></g>' +
      '<g transform="rotate(5 50 79)"><rect x="44.4" y="74.8" width="11.2" height="8.6" rx="1.3" fill="#FBF8F3" stroke="#B9AA9E" stroke-width="0.45"/>' +
      '<path d="M44.4 77.2V76.1Q44.4 74.8 45.7 74.8H54.3Q55.6 74.8 55.6 76.1V77.2Z" fill="#3B6FD8"/>' +
      '<rect x="45.7" y="78.2" width="3.6" height="4" rx="0.6" fill="#F5D6C4"/><circle cx="47.5" cy="79.6" r="0.9" fill="#D97757"/><path d="M46.1 82.2Q47.5 80.6 48.9 82.2Z" fill="#D97757"/>' +
      '<path d="M50.6 79H54.2M50.6 80.6H53.4M50.6 82.2H54" stroke="#C9BDB2" stroke-width="0.7" stroke-linecap="round"/></g>' +
      '<rect x="48.6" y="72.4" width="2.8" height="2.8" rx="0.6" fill="url(#lanyardM)" stroke="#5E6670" stroke-width="0.4"/>',
  },
  camera: {
    box: [38, 68, 24, 17],
    svg: '<defs><linearGradient id="cameraM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F8FA"/><stop offset="1" stop-color="#8E98A3"/></linearGradient>' +
      '<linearGradient id="cameraS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#1A0E0A" stop-opacity="0.3"/></linearGradient>' +
      '<radialGradient id="cameraL" cx="0.35" cy="0.35" r="0.7"><stop offset="0" stop-color="#5A7FC8"/><stop offset="1" stop-color="#0E1A33"/></radialGradient></defs>' +
      '<path d="M27.4 61Q32.4 71 41.8 74.6M72.6 61Q67.6 71 58.2 74.6" stroke="#4A3328" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M27.4 61Q32.4 71 41.8 74.6M72.6 61Q67.6 71 58.2 74.6" stroke="#A8784F" stroke-width="0.35" stroke-dasharray="0.8 0.8" fill="none"/>' +
      '<path d="M46.4 73.6L47.4 71.4H52.6L53.6 73.6Z" fill="url(#cameraM)" stroke="#5E6670" stroke-width="0.4" stroke-linejoin="round"/><rect x="54.6" y="72.2" width="2" height="1.4" rx="0.4" fill="#D8433B"/>' +
      '<rect x="41.4" y="73.4" width="17.2" height="10" rx="2" fill="#5A3D30"/>' +
      '<path d="M41.4 76.4V75.4Q41.4 73.4 43.4 73.4H56.6Q58.6 73.4 58.6 75.4V76.4Z" fill="url(#cameraM)"/>' +
      '<rect x="41.4" y="73.4" width="17.2" height="10" rx="2" fill="url(#cameraS)" stroke="#2B1B17" stroke-opacity="0.6" stroke-width="0.5"/>' +
      '<rect x="43" y="74.2" width="2.6" height="1.4" rx="0.3" fill="#FFF6EC" stroke="#9AA4AE" stroke-width="0.3"/>' +
      '<circle cx="50" cy="78.8" r="4.2" fill="url(#cameraM)" stroke="#5E6670" stroke-width="0.45"/><circle cx="50" cy="78.8" r="3" fill="#2B2E34"/><circle cx="50" cy="78.8" r="1.9" fill="url(#cameraL)"/>' +
      '<ellipse cx="49.1" cy="77.9" rx="0.9" ry="0.5" fill="#fff" opacity="0.8" transform="rotate(-30 49.1 77.9)"/><circle cx="51" cy="79.8" r="0.3" fill="#fff" opacity="0.5"/>',
  },
  stethoscope: {
    box: [34, 64, 30, 21],
    onSkin: true,
    svg: '<defs><linearGradient id="stethoscopeM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F8FA"/><stop offset="1" stop-color="#8E98A3"/></linearGradient></defs>' +
      '<g fill="none" stroke-linecap="round"><path d="M26.6 61Q29.6 70.8 38.6 74.2M73.4 61Q71 72.6 60.4 76.6" stroke="#2F343C" stroke-width="1.8"/>' +
      '<path d="M26.3 60.6Q29.3 70.4 38.3 73.8M73.1 60.6Q70.7 72.2 60.1 76.2" stroke="#fff" stroke-opacity="0.22" stroke-width="0.5"/>' +
      '<path d="M38.6 74.2Q42.2 75.2 42.6 79.6M38.6 74.2Q37.6 77.8 39.4 80.6M60.4 76.6L59.6 77.8" stroke="#A7B0BA" stroke-width="0.9"/></g>' +
      '<circle cx="38.6" cy="74.2" r="0.9" fill="#A7B0BA"/><g fill="#2F343C"><circle cx="42.6" cy="80" r="0.95"/><circle cx="39.6" cy="81" r="0.95"/></g>' +
      '<circle cx="58.6" cy="80" r="3.3" fill="url(#stethoscopeM)" stroke="#5E6670" stroke-width="0.45"/><circle cx="58.6" cy="80" r="2.2" fill="#E9EDF1" stroke="#9AA4AE" stroke-width="0.35"/>' +
      '<ellipse cx="57.4" cy="78.8" rx="1.1" ry="0.55" fill="#fff" opacity="0.8" transform="rotate(-30 57.4 78.8)"/>',
  },
  binoculars: {
    box: [38, 67, 24, 18],
    svg: '<defs><linearGradient id="binocularsB" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7E9C5C"/><stop offset="1" stop-color="#3E5530"/></linearGradient>' +
      '<linearGradient id="binocularsL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CC3F5"/><stop offset="1" stop-color="#2D4F86"/></linearGradient></defs>' +
      '<path d="M28.2 61Q35 69.6 43.6 71.6M71.8 61Q65 69.6 56.4 71.6" stroke="#6B5A3A" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
      '<g fill="#2B2E34"><rect x="43" y="70.6" width="4.4" height="2.6" rx="0.8"/><rect x="52.6" y="70.6" width="4.4" height="2.6" rx="0.8"/><rect x="47.6" y="73.6" width="4.8" height="3.2" rx="0.8"/></g>' +
      '<g fill="url(#binocularsB)" stroke="#2B1B17" stroke-opacity="0.6" stroke-width="0.45"><rect x="42" y="72.6" width="6.4" height="10" rx="2.2"/><rect x="51.6" y="72.6" width="6.4" height="10" rx="2.2"/></g>' +
      '<g fill="#2B2E34" opacity="0.85"><rect x="42" y="75.6" width="6.4" height="1.6"/><rect x="51.6" y="75.6" width="6.4" height="1.6"/></g>' +
      '<rect x="48.6" y="72" width="2.8" height="2" rx="0.6" fill="#8E98A3"/><path d="M49.3 72.2V73.8M50 72.2V73.8M50.7 72.2V73.8" stroke="#5E6670" stroke-width="0.3"/>' +
      '<g fill="url(#binocularsL)" stroke="#2B2E34" stroke-width="0.5"><ellipse cx="45.2" cy="82.2" rx="2.7" ry="1.1"/><ellipse cx="54.8" cy="82.2" rx="2.7" ry="1.1"/></g>' +
      '<g fill="#fff" opacity="0.3"><rect x="43" y="77.6" width="1" height="3.8" rx="0.5"/><rect x="52.6" y="77.6" width="1" height="3.8" rx="0.5"/></g>',
  },
  headphones: {
    box: [25, 59, 50, 16],
    svg: '<defs><linearGradient id="headphonesC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FE3D3"/><stop offset="1" stop-color="#2E9C8A"/></linearGradient></defs>' +
      '<path d="M30.6 64.4Q50 80 69.4 64.4" stroke="#2E3440" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M33 66.6Q50 78.4 67 66.6" stroke="#fff" stroke-opacity="0.2" stroke-width="0.6" fill="none" stroke-linecap="round"/>' +
      [['30.4', '18', ''], ['69.6', '-18', ' scale(-1 1)']].map(([x, r, flip]) => `<g transform="translate(${x} 66.6) rotate(${r})${flip}">` +
        '<ellipse rx="3.8" ry="5.4" fill="#2E3440"/><ellipse cx="-0.9" rx="3.3" ry="4.9" fill="url(#headphonesC)" stroke="#1D6E62" stroke-width="0.45"/>' +
        '<ellipse cx="-0.9" rx="1.9" ry="3" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="0.5"/><circle cx="-0.9" cy="1.6" r="0.45" fill="#FFE7A3"/>' +
        '<ellipse cx="-2.2" cy="-2.6" rx="1" ry="0.6" fill="#fff" opacity="0.6" transform="rotate(-40 -2.2 -2.6)"/></g>').join(''),
  },
  bib: {
    box: [33, 64, 34, 23],
    svg: '<defs><linearGradient id="bibS" x1="0" y1="0" x2="0" y2="1"><stop offset="0.4" stop-color="#2B1B17" stop-opacity="0"/><stop offset="1" stop-color="#2B1B17" stop-opacity="0.12"/></linearGradient></defs>' +
      '<path d="M37 68.8Q30 67.4 22.6 63.4M63 68.8Q70 67.4 77.4 63.4" stroke="#E8685F" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M36.6 68.4Q50 72.6 63.4 68.4Q65.6 77.4 59.4 81.4Q50 85.6 40.6 81.4Q34.4 77.4 36.6 68.4Z" fill="#FBF8F3" stroke="#E8685F" stroke-width="1"/>' +
      '<path d="M36.6 68.4Q50 72.6 63.4 68.4Q65.6 77.4 59.4 81.4Q50 85.6 40.6 81.4Q34.4 77.4 36.6 68.4Z" fill="url(#bibS)"/>' +
      '<path d="M36.6 68.4Q50 72.6 63.4 68.4Q65.6 77.4 59.4 81.4Q50 85.6 40.6 81.4Q34.4 77.4 36.6 68.4Z" transform="translate(50 76.6) scale(0.84) translate(-50 -76.6)" fill="none" stroke="#F5B8C4" stroke-width="0.7" stroke-dasharray="0.1 1.4" stroke-linecap="round"/>' +
      '<path d="M48.4 76.8Q49.4 73.8 51.8 73M51.8 77.2Q51.4 74.8 51.8 73" stroke="#3F8A3A" stroke-width="0.6" fill="none" stroke-linecap="round"/><ellipse cx="53.2" cy="72.9" rx="1.4" ry="0.7" fill="#5FA052" transform="rotate(-20 53.2 72.9)"/>' +
      '<g fill="#D8433B" stroke="#8E2A22" stroke-width="0.35"><circle cx="48.2" cy="77.8" r="1.7"/><circle cx="51.9" cy="78.2" r="1.7"/></g>' +
      '<g fill="#fff" opacity="0.7"><circle cx="47.6" cy="77.2" r="0.5"/><circle cx="51.3" cy="77.6" r="0.5"/></g>',
  },
  ruff: {
    box: [18, 60, 64, 20],
    svg: '<path d="M21.6 63.4Q50 73.6 78.4 63.4L78.8 70.8Q50 82 21.2 70.8Z" fill="#E4DBD0"/>' +
      // The pleats from both ends inward, so the middle ones lie on top.
      along(22.4, 66.8, 50, 76.6, 77.6, 66.8, 15).map((p, i) => ({ p, far: Math.abs(i - 7) })).sort((a, b) => b.far - a.far)
        .map(({ p: [x, y, a] }) => `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(a)})"><ellipse rx="2.5" ry="4.5" fill="#FBF8F3" stroke="#C9BDB2" stroke-width="0.4"/>` +
          '<path d="M-0.5 -3.2Q0.9 0 -0.5 3.2" stroke="#DCD2C7" stroke-width="0.5" fill="none"/><ellipse cx="-1" cy="-2.4" rx="0.7" ry="1" fill="#fff"/></g>').join(''),
  },
  bolotie: {
    box: [37, 65, 26, 21],
    onSkin: true,
    svg: '<defs><linearGradient id="bolotieM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F8FA"/><stop offset="1" stop-color="#8E98A3"/></linearGradient>' +
      '<radialGradient id="bolotieT" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#8CE6DC"/><stop offset="1" stop-color="#1E8C84"/></radialGradient></defs>' +
      '<g fill="none" stroke-linecap="round"><path d="M29.8 60.4Q39 68.8 48.4 72M70.2 60.4Q61 68.8 51.6 72M48.8 75.4Q48.2 79 47.5 82.2M51.2 75.4Q51.8 79 52.5 82.2" stroke="#5A3A26" stroke-width="1.1"/>' +
      '<path d="M29.8 60.4Q39 68.8 48.4 72M70.2 60.4Q61 68.8 51.6 72M48.8 75.4Q48.2 79 47.5 82.2M51.2 75.4Q51.8 79 52.5 82.2" stroke="#A8784F" stroke-width="0.5" stroke-dasharray="0.8 0.8"/></g>' +
      '<g fill="url(#bolotieM)" stroke="#5E6670" stroke-width="0.3"><path d="M46.7 81.8H48.3L47.9 84.6Q47.5 85 47.1 84.6Z"/><path d="M51.7 81.8H53.3L52.9 84.6Q52.5 85 52.1 84.6Z"/></g>' +
      '<ellipse cx="50" cy="73.6" rx="3.7" ry="4.3" fill="url(#bolotieM)" stroke="#5E6670" stroke-width="0.45"/><ellipse cx="50" cy="73.6" rx="3.15" ry="3.75" fill="none" stroke="#8E98A3" stroke-width="0.35" stroke-dasharray="0.5 0.5"/>' +
      '<ellipse cx="50" cy="73.6" rx="2.4" ry="3" fill="url(#bolotieT)"/><path d="M48.6 72.4Q49.6 73.4 49 74.6M51 72Q50.6 73.6 51.6 75" stroke="#2B1B17" stroke-opacity="0.3" stroke-width="0.3" fill="none"/>' +
      '<ellipse cx="49.1" cy="72.2" rx="0.8" ry="0.5" fill="#fff" opacity="0.7" transform="rotate(-35 49.1 72.2)"/>',
  },
  boa: {
    box: [16, 57, 68, 30],
    // A ring of tufts round the neck, and its end hanging down on the right.
    svg: [...along(22.4, 63.4, 50, 79.4, 77.6, 63.4, 17), ...along(70.4, 69.6, 73.6, 76, 71.6, 83.4, 5)].map(([x, y], i) => {
      const r = i >= 17 ? 3.2 - (i - 17) * 0.2 : i % 2 ? 3.4 : 3.9
      const fill = ['#F58BB7', '#F9A8CB', '#E86FA3'][i % 3]
      return `<path d="M${n(x + r * 0.5)} ${n(y - r * 0.8)}l0.9 -1M${n(x - r * 0.8)} ${n(y - r * 0.4)}l-1 -0.5" stroke="${fill}" stroke-width="0.5" stroke-linecap="round"/>` +
        `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}" stroke="#C24F84" stroke-opacity="0.45" stroke-width="0.3"/>` +
        `<circle cx="${n(x - r * 0.3)}" cy="${n(y - r * 0.35)}" r="${n(r * 0.35)}" fill="#fff" opacity="0.35"/>`
    }).join(''),
  },
  locket: {
    box: [41, 67, 18, 15],
    onSkin: true,
    svg: '<defs><linearGradient id="locketG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE38E"/><stop offset="1" stop-color="#C08A2A"/></linearGradient></defs>' +
      '<path d="M29.6 60.2Q50 82.6 70.4 60.2" stroke="#C9A24A" stroke-width="0.75" stroke-dasharray="1 0.55" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50" cy="72.6" r="0.9" fill="none" stroke="#B8862A" stroke-width="0.6"/>' +
      '<path d="M50 80.6C46.6 78.2 45.4 76.4 45.6 74.6C45.8 72.8 47.8 72.2 50 73.8C52.2 72.2 54.2 72.8 54.4 74.6C54.6 76.4 53.4 78.2 50 80.6Z" fill="url(#locketG)" stroke="#8A5E14" stroke-width="0.45"/>' +
      '<path d="M50 80.6C46.6 78.2 45.4 76.4 45.6 74.6C45.8 72.8 47.8 72.2 50 73.8C52.2 72.2 54.2 72.8 54.4 74.6C54.6 76.4 53.4 78.2 50 80.6Z" transform="translate(50 76.4) scale(0.6) translate(-50 -76.4)" fill="none" stroke="#A8761E" stroke-width="0.7"/>' +
      '<ellipse cx="47.6" cy="74.6" rx="1.2" ry="0.6" fill="#fff" opacity="0.75" transform="rotate(-35 47.6 74.6)"/>',
  },
  // More for the face. Eyes sit at (40, 52) and (60, 52), the mouth at (50, 64).
  aviators: {
    box: [22, 43, 56, 18],
    svg: '<defs><linearGradient id="aviatorsL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F3B33"/><stop offset="1" stop-color="#6E5A44"/></linearGradient></defs>' +
      '<g fill="url(#aviatorsL)" fill-opacity="0.9" stroke="#C9A24A" stroke-width="0.9" stroke-linejoin="round"><path d="M31.4 47.6Q40 46 46.6 47.8Q47.6 52.6 44.6 56.4Q41 59.4 36.4 58.4Q31.4 57 30.8 52Q30.6 49 31.4 47.6Z"/>' +
      '<path d="M68.6 47.6Q60 46 53.4 47.8Q52.4 52.6 55.4 56.4Q59 59.4 63.6 58.4Q68.6 57 69.2 52Q69.4 49 68.6 47.6Z"/></g>' +
      '<g fill="none" stroke="#C9A24A" stroke-width="0.8" stroke-linecap="round"><path d="M46.6 48.4Q50 47.2 53.4 48.4M44.6 47.2Q50 45.8 55.4 47.2M31 49L24 47.6M69 49L76 47.6"/></g>' +
      '<path d="M33.4 49.6L37.8 48.6M56.4 49.6L60.8 48.6" stroke="#fff" stroke-opacity="0.4" stroke-width="1" stroke-linecap="round"/>',
  },
  pixelshades: {
    box: [25, 44, 50, 14],
    // Blocks on a grid, as pixel art draws them.
    svg: '<g fill="#141414" shape-rendering="crispEdges"><rect x="27.8" y="47.6" width="44.4" height="1.8"/>' +
      [[30.8, 49.4, 16.8], [32.6, 51.2, 15], [34.4, 53, 11.4], [36.2, 54.8, 7.8]].map(([x = 0, y = 0, w = 0]) =>
        `<rect x="${x}" y="${y}" width="${w}" height="1.8"/><rect x="${n(100 - x - w)}" y="${y}" width="${w}" height="1.8"/>`).join('') +
      '</g><g fill="#fff" shape-rendering="crispEdges"><rect x="34.4" y="49.4" width="1.8" height="1.8"/><rect x="36.2" y="51.2" width="1.8" height="1.8"/>' +
      '<rect x="56" y="49.4" width="1.8" height="1.8"/><rect x="57.8" y="51.2" width="1.8" height="1.8"/></g>',
  },
  cateye: {
    box: [24, 43, 52, 17],
    onSkin: true,
    svg: '<g fill="#FFF6EC" fill-opacity="0.16" stroke="#D6336C" stroke-width="1.6" stroke-linejoin="round"><path d="M32 49.2Q38 46.4 46.2 48Q47.4 53 44 56.2Q39.6 58.6 35.4 56.4Q32.4 54.4 32 49.2Z"/>' +
      '<path d="M68 49.2Q62 46.4 53.8 48Q52.6 53 56 56.2Q60.4 58.6 64.6 56.4Q67.6 54.4 68 49.2Z"/></g>' +
      '<g fill="#D6336C"><path d="M32.6 48.4L27.6 45.4Q29.4 49 32 50.6Z"/><path d="M67.4 48.4L72.4 45.4Q70.6 49 68 50.6Z"/></g>' +
      '<g fill="none" stroke="#D6336C" stroke-width="1.2" stroke-linecap="round"><path d="M46.4 49.6Q50 48.2 53.6 49.6M31.6 50.4L25 49.2M68.4 50.4L75 49.2"/></g>' +
      '<g fill="#fff"><circle cx="29.6" cy="46.8" r="0.5"/><circle cx="70.4" cy="46.8" r="0.5"/></g>' +
      '<path d="M35.4 49.8A5.6 5.6 0 0 1 39.6 48M55.4 49.8A5.6 5.6 0 0 1 59.6 48" stroke="#fff" stroke-opacity="0.6" stroke-width="1" fill="none" stroke-linecap="round"/>',
  },
  masquerade: {
    box: [22, 31, 56, 30],
    svg: '<defs><linearGradient id="masqueradeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E4DB8"/><stop offset="1" stop-color="#4A1F6B"/></linearGradient></defs>' +
      '<path d="M30.6 46.6Q23.4 40.4 25.2 31.4Q31 37.8 30.6 46.6Z" fill="#4FB3A9" stroke="#2E7C74" stroke-width="0.4"/><path d="M30.6 46.6Q27 39.4 25.2 31.4" stroke="#2E7C74" stroke-width="0.4" fill="none"/>' +
      '<path d="M32.4 46Q29.6 39.6 32.6 33.4Q35.4 39.6 32.4 46Z" fill="#F58BB7" stroke="#C24F84" stroke-width="0.4"/>' +
      '<path d="M50 49.6Q44 44.4 34 45.2Q27.4 46 26.6 50.4Q27 56 33.6 58.4Q41 60 46 56.4Q48.4 54.4 50 54.8Q51.6 54.4 54 56.4Q59 60 66.4 58.4Q73 56 73.4 50.4Q72.6 46 66 45.2Q56 44.4 50 49.6Z' +
      'M34 52Q40 45.4 46 52Q40 58.4 34 52ZM54 52Q60 45.4 66 52Q60 58.4 54 52Z" fill="url(#masqueradeG)" fill-rule="evenodd" stroke="#E9B949" stroke-width="0.7" stroke-linejoin="round"/>' +
      '<path d="M48 47.8Q50 46.2 52 47.8M29.4 54.4Q31 56.4 33.4 56.6M70.6 54.4Q69 56.4 66.6 56.6" stroke="#E9B949" stroke-width="0.5" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50" cy="51.8" r="1" fill="#E9B949" stroke="#B8862A" stroke-width="0.3"/><circle cx="31.6" cy="46.8" r="1.1" fill="#E9B949" stroke="#B8862A" stroke-width="0.3"/>' +
      '<path d="M57 46.2Q62 45.4 66.4 46.6" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8" fill="none" stroke-linecap="round"/>',
  },
  divemask: {
    box: [21, 33, 58, 34],
    svg: '<path d="M29 50.6H23.4M71 50.6H76.6" stroke="#2B2E34" stroke-width="2"/>' +
      '<path d="M56 64.6Q66 66 70.4 60.6Q72.6 57.4 73.2 52L74.6 36.6" stroke="#FF8A3D" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M56 64.6Q66 66 70.4 60.6Q72.6 57.4 73.2 52L74.6 36.6" stroke="#fff" stroke-opacity="0.35" stroke-width="0.5" fill="none" stroke-linecap="round" transform="translate(-0.5 -0.3)"/>' +
      '<rect x="72.8" y="34" width="3.8" height="3.2" rx="1" fill="#2B2E34"/><rect x="53.4" y="62.8" width="4" height="3.4" rx="1.3" fill="#2B2E34"/>' +
      '<path d="M36 44H64Q71 44 71 51V53Q71 60 64 60H55Q53 60 52 58.4Q51 56.6 50 56.6Q49 56.6 48 58.4Q47 60 45 60H36Q29 60 29 53V51Q29 44 36 44Z" fill="#F2C230" stroke="#B8860B" stroke-width="0.5"/>' +
      '<rect x="31.4" y="46" width="37.2" height="9.6" rx="4.4" fill="#9FD8F0" fill-opacity="0.28" stroke="#2B2E34" stroke-width="1.2"/>' +
      '<path d="M34.6 53.4L39.4 47.4M37.4 53.4L41 48.8" stroke="#fff" stroke-opacity="0.55" stroke-width="0.8" stroke-linecap="round"/>' +
      '<path d="M33 45.4Q50 44.4 67 45.4" stroke="#fff" stroke-opacity="0.4" stroke-width="0.6" fill="none" stroke-linecap="round"/>',
  },
  facemask: {
    box: [23, 51, 54, 23],
    svg: '<defs><linearGradient id="facemaskS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="1" stop-color="#1F4E63" stop-opacity="0.18"/></linearGradient></defs>' +
      '<path d="M36.4 59.6Q29 58 25.4 53.6M36.4 67.4Q29 66.4 25.6 58.4" stroke="#EDF6FA" stroke-width="0.8" fill="none" stroke-linecap="round"/>' +
      '<path d="M63.6 59.6Q71 58 74.6 53.6M63.6 67.4Q71 66.4 74.4 58.4" stroke="#EDF6FA" stroke-width="0.8" fill="none" stroke-linecap="round"/>' +
      '<path d="M36.4 58.6Q50 55.6 63.6 58.6Q64.4 64 63.6 68.4Q50 72.4 36.4 68.4Q35.6 64 36.4 58.6Z" fill="#A8D8EA" stroke="#5E9DB8" stroke-width="0.5"/>' +
      '<path d="M36.4 58.6Q50 55.6 63.6 58.6Q64.4 64 63.6 68.4Q50 72.4 36.4 68.4Q35.6 64 36.4 58.6Z" fill="url(#facemaskS)"/>' +
      '<path d="M36.6 61.4Q50 58.6 63.4 61.4M36.6 64.2Q50 61.6 63.4 64.2M36.6 67Q50 64.8 63.4 67" stroke="#7FB5CC" stroke-width="0.55" fill="none"/>' +
      '<path d="M44 58.2Q50 56.8 56 58.2" stroke="#fff" stroke-opacity="0.75" stroke-width="0.7" fill="none" stroke-linecap="round"/>',
  },
  vrheadset: {
    box: [20, 40, 60, 21],
    svg: '<defs><linearGradient id="vrheadsetG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F4EF"/><stop offset="1" stop-color="#C4BCB2"/></linearGradient></defs>' +
      '<g fill="#4A4F57"><rect x="21.6" y="48" width="7" height="3.2" rx="1"/><rect x="71.4" y="48" width="7" height="3.2" rx="1"/></g>' +
      '<path d="M34 43H66Q72 43 72 49V53Q72 59 66 59H56Q53.6 59 52.6 57.2Q51.4 55.4 50 55.4Q48.6 55.4 47.4 57.2Q46.4 59 44 59H34Q28 59 28 53V49Q28 43 34 43Z" fill="url(#vrheadsetG)" stroke="#8A8178" stroke-width="0.5"/>' +
      '<rect x="30.6" y="45.4" width="38.8" height="8.4" rx="3.6" fill="#22252B"/><path d="M33 47.6Q42 46 50 46.6" stroke="#fff" stroke-opacity="0.3" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
      '<circle cx="66.4" cy="47.6" r="0.6" fill="#7AD8FF"><animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/></circle>' +
      '<path d="M30.2 44.8Q32 43.6 35 43.6" stroke="#fff" stroke-opacity="0.8" stroke-width="0.6" fill="none" stroke-linecap="round"/>',
  },
  lollipop: {
    box: [50, 52, 22, 15],
    svg: '<path d="M53.6 64.2L62.6 59.8" stroke="#F3ECE4" stroke-width="1.1" stroke-linecap="round"/><path d="M53.6 64.2L62.6 59.8" stroke="#C9B8AE" stroke-width="0.3" stroke-linecap="round" transform="translate(0 0.4)"/>' +
      '<circle cx="66" cy="58.4" r="4.4" fill="#FF6FA0" stroke="#C2406E" stroke-width="0.4"/>' +
      '<path d="M66 58.4a0.8 0.8 0 0 1 1.6 0a1.6 1.6 0 0 1 -3.2 0a2.4 2.4 0 0 1 4.8 0a3.2 3.2 0 0 1 -6.4 0" stroke="#FFF6EC" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="64.4" cy="56.4" rx="1.2" ry="0.6" fill="#fff" opacity="0.6" transform="rotate(-35 64.4 56.4)"/>',
  },
  bubblegum: {
    box: [41, 58, 18, 15],
    // The bubble grows, holds a moment and goes back.
    svg: '<circle cx="50" cy="65.6" r="5.6" fill="#FF8FC0" fill-opacity="0.92" stroke="#D9558F" stroke-width="0.4"><animate attributeName="r" values="3.2;5.8;5.8;3.2" keyTimes="0;0.6;0.85;1" dur="4s" repeatCount="indefinite"/></circle>' +
      '<ellipse cx="48" cy="63.6" rx="1.4" ry="0.8" fill="#fff" opacity="0.7" transform="rotate(-35 48 63.6)"><animate attributeName="opacity" values="0.2;0.7;0.7;0.2" keyTimes="0;0.6;0.85;1" dur="4s" repeatCount="indefinite"/></ellipse>',
  },
  wheat: {
    box: [25, 51, 25, 17],
    svg: '<g transform="translate(46 64.6) rotate(208.3)"><path d="M0 0H18.2" stroke="#C9973A" stroke-width="0.8" stroke-linecap="round"/>' +
      '<path d="M12.6 -0.9l1.4 -2M14.4 -0.9l1.4 -2M16.2 -0.9l1.4 -2M18 -0.9l1.4 -2M12.6 0.9l1.4 2M14.4 0.9l1.4 2M16.2 0.9l1.4 2M18 0.9l1.4 2M19.6 0h2" stroke="#D9B460" stroke-width="0.3" stroke-linecap="round"/>' +
      `<g fill="#E2B04A" stroke="#A8761E" stroke-width="0.25">${[12.6, 14.4, 16.2, 18].map(x => `<ellipse cx="${x}" cy="-0.8" rx="1.1" ry="0.55" transform="rotate(-25 ${x} -0.8)"/><ellipse cx="${x}" cy="0.8" rx="1.1" ry="0.55" transform="rotate(25 ${x} 0.8)"/>`).join('')}` +
      '<ellipse cx="19.4" cy="0" rx="1.1" ry="0.5"/></g></g>',
  },
  rose: {
    box: [29, 57, 33, 13],
    svg: '<path d="M58.4 64.6Q50 65.4 41.4 63.8" stroke="#3F8A3A" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
      '<path d="M53.2 65L53.8 66.2M47.4 64.8L46.8 66" stroke="#3F8A3A" stroke-width="0.5" stroke-linecap="round"/>' +
      '<path d="M50.6 65.1Q52.4 67.8 55.6 67.4Q53.8 64.8 50.6 65.1Z" fill="#5FA052" stroke="#3F8A3A" stroke-width="0.3"/>' +
      '<path d="M41.8 64.4Q40.6 66.8 38 67.2Q39.4 64.8 41.8 64.4Z" fill="#5FA052" stroke="#3F8A3A" stroke-width="0.3"/>' +
      '<circle cx="37.6" cy="62.6" r="3.4" fill="#D8233B" stroke="#9E1028" stroke-width="0.4"/>' +
      '<path d="M37.6 62.4a0.7 0.7 0 0 1 1.4 0a1.4 1.4 0 0 1 -2.8 0a2.2 2.2 0 0 1 4.4 0" stroke="#9E1028" stroke-width="0.5" fill="none" stroke-linecap="round"/>' +
      '<path d="M34.4 63.6Q35 66.4 38 66.2Q40.6 66 41 63.4" stroke="#9E1028" stroke-width="0.4" fill="none"/>' +
      '<ellipse cx="36.2" cy="60.8" rx="1" ry="0.5" fill="#fff" opacity="0.45" transform="rotate(-30 36.2 60.8)"/>',
  },
  goldstars: {
    box: [24, 50, 52, 15],
    onSkin: true,
    svg: '<defs><linearGradient id="goldstarsG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE58A"/><stop offset="1" stop-color="#E0A526"/></linearGradient></defs>' +
      [[31, 59.4, 3.6, -12], [69, 59.6, 3.6, 10], [73.6, 54.4, 1.9, 20]].map(([x = 0, y = 0, r = 0, turn = 0]) =>
        `<path d="${starAt(x, y, r, turn)}" fill="#FFF6EC" stroke="#FFF6EC" stroke-width="1.4" stroke-linejoin="round"/><path d="${starAt(x, y, r, turn)}" fill="url(#goldstarsG)" stroke="#B8862A" stroke-width="0.4" stroke-linejoin="round"/>`).join('') +
      '<g fill="#fff" opacity="0.7"><ellipse cx="30" cy="58" rx="0.9" ry="0.5" transform="rotate(-30 30 58)"/><ellipse cx="68" cy="58.2" rx="0.9" ry="0.5" transform="rotate(-30 68 58.2)"/></g>',
  },
  // Mustaches and beards, worn together: the mouth is at (50, 64), the jaw follows the body's round corners (radius 19 about (41, 61.5) and (59, 61.5)).
  pencilstache: {
    box: [34, 55, 32, 11],
    onSkin: true,
    svg: '<defs><linearGradient id="pencilstacheH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      both('<path d="M49.2 60Q43 58.8 36.6 60.6Q36.2 61.3 37 61.3Q43 60.3 49.2 61.1Z" fill="url(#pencilstacheH)" stroke="#2B1B17" stroke-width="0.3"/>'),
  },
  chevron: {
    box: [33, 54, 34, 12],
    onSkin: true,
    svg: '<defs><linearGradient id="chevronH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      both('<path d="M50 57.6Q42 57.2 37 59.2Q34.8 60.2 35 62.6Q35.2 63.6 36.6 63.1Q43 61.8 50 62.4Z" fill="url(#chevronH)" stroke="#2B1B17" stroke-width="0.4" stroke-linejoin="round"/>' +
        '<path d="M40 59.6L39.4 61.6M43 59L42.6 61.2M46 58.7L45.8 60.9" stroke="#2B1B17" stroke-opacity="0.35" stroke-width="0.4" stroke-linecap="round"/>') +
      '<path d="M38.4 59.4Q42 58.4 46 58.4" stroke="#fff" stroke-opacity="0.35" stroke-width="0.7" fill="none" stroke-linecap="round"/>',
  },
  handlebar: {
    box: [28, 51, 44, 14],
    onSkin: true,
    // Thick at the middle, thinning out to ends that curl up.
    svg: '<defs><linearGradient id="handlebarH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      both('<path d="M50 58.8Q44 57.6 38.6 59.2Q34.4 60.4 32.6 58.8Q31.2 57.2 32.8 55.6Q30.8 55.6 30.2 57.4Q30 61 34 62Q40 63 45.6 61.4Q48.6 60.8 50 61.4Z" fill="url(#handlebarH)" stroke="#2B1B17" stroke-width="0.4" stroke-linejoin="round"/>') +
      '<path d="M39.4 59.8Q43 58.6 46.6 58.8" stroke="#fff" stroke-opacity="0.35" stroke-width="0.7" fill="none" stroke-linecap="round"/>',
  },
  walrus: {
    box: [31, 54, 38, 15],
    onSkin: true,
    // Bushy and hanging over the mouth, its edge in strands.
    svg: '<defs><linearGradient id="walrusH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      both('<path d="M50 56.6Q42 55.8 36.6 58.4Q32.8 60.6 33 64.8Q33.2 66.4 34.6 65.8L36.2 64.4L37.8 66.4L39.6 64.8L41.4 66.8L43.2 65L45 67L46.8 65.2L48.6 67L50 65.6Z" fill="url(#walrusH)" stroke="#2B1B17" stroke-width="0.4" stroke-linejoin="round"/>' +
        '<path d="M38 60.4Q37.4 62.4 37.8 64.6M41.6 59.2Q41 61.6 41.4 64.6M45.4 58.4Q45 61.4 45.2 64.8" stroke="#2B1B17" stroke-opacity="0.3" stroke-width="0.45" fill="none" stroke-linecap="round"/>') +
      '<path d="M37.6 59.2Q42 57.4 47 57.4" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8" fill="none" stroke-linecap="round"/>',
  },
  horseshoe: {
    box: [35, 55, 30, 20],
    onSkin: true,
    // Over the lip, and down past both corners of the mouth.
    svg: '<defs><linearGradient id="horseshoeH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      both('<path d="M50 58.6Q43 57.8 39.6 59.6Q37.6 61 37.8 64L38 71.4Q38.2 73 39.4 73Q40.6 73 40.8 71.4L41 64.4Q41.4 62.2 44 61.6Q47.4 61 50 61.4Z" fill="url(#horseshoeH)" stroke="#2B1B17" stroke-width="0.4" stroke-linejoin="round"/>') +
      '<path d="M38.8 63.4L38.9 70.6M40.6 60Q44 59 47 59" stroke="#fff" stroke-opacity="0.3" stroke-width="0.6" fill="none" stroke-linecap="round"/>',
  },
  goatee: {
    box: [42, 64, 16, 14],
    onSkin: true,
    svg: '<defs><linearGradient id="goateeH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      '<path d="M44.6 66.8Q50 68.4 55.4 66.8Q56 70.6 53 73Q50.8 74.8 50 76.2Q49.2 74.8 47 73Q44 70.6 44.6 66.8Z" fill="url(#goateeH)" stroke="#2B1B17" stroke-width="0.4" stroke-linejoin="round"/>' +
      '<path d="M47.4 69.6Q48.4 72 50 74M50 69.4L50 72.6M52.6 69.6Q51.8 72 50.6 73.6" stroke="#2B1B17" stroke-opacity="0.3" stroke-width="0.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M46 68.2Q47.6 68.8 49.4 68.9" stroke="#fff" stroke-opacity="0.35" stroke-width="0.6" fill="none" stroke-linecap="round"/>',
  },
  soulpatch: {
    box: [45, 65, 10, 8],
    onSkin: true,
    svg: '<defs><linearGradient id="soulpatchH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      '<path d="M48 67.4Q50 66.8 52 67.4Q51.8 70 50 71.4Q48.2 70 48 67.4Z" fill="url(#soulpatchH)" stroke="#2B1B17" stroke-width="0.35" stroke-linejoin="round"/>',
  },
  chinstrap: {
    box: [21, 46, 58, 34],
    onSkin: true,
    // A thin band along the jaw, ear to ear.
    svg: '<defs><linearGradient id="chinstrapH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4A32"/><stop offset="1" stop-color="#3B2117"/></linearGradient></defs>' +
      '<path d="M24.6 48.6L24.6 61A16.4 16.4 0 0 0 41 77.4L59 77.4A16.4 16.4 0 0 0 75.4 61L75.4 48.6" fill="none" stroke="#2B1B17" stroke-width="3.6" stroke-linecap="round"/>' +
      '<path d="M24.6 48.6L24.6 61A16.4 16.4 0 0 0 41 77.4L59 77.4A16.4 16.4 0 0 0 75.4 61L75.4 48.6" fill="none" stroke="url(#chinstrapH)" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M24.2 50L24.2 60" stroke="#fff" stroke-opacity="0.3" stroke-width="0.7" stroke-linecap="round"/>',
  },
  wizardbeard: {
    box: [22, 52, 56, 42],
    // Long and white, from the cheeks to a point below Mochi; the mouth stays clear.
    svg: '<defs><linearGradient id="wizardbeardW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFDF8"/><stop offset="1" stop-color="#D6CEC4"/></linearGradient></defs>' +
      '<path d="M27.4 55.6Q29.6 66 40 67.8Q45 68.8 50 68.6Q55 68.8 60 67.8Q70.4 66 72.6 55.6Q76.4 66 72.4 76.4Q66.4 86.4 50 92.4Q33.6 86.4 27.6 76.4Q23.6 66 27.4 55.6Z" fill="url(#wizardbeardW)" stroke="#A89E93" stroke-width="0.5" stroke-linejoin="round"/>' +
      '<g fill="none" stroke="#B5AB9F" stroke-width="0.5" stroke-linecap="round"><path d="M33 70Q34 78 41 85M39.6 71.4Q40.4 80 46 88M50 71.6L50 89M60.4 71.4Q59.6 80 54 88M67 70Q66 78 59 85"/></g>' +
      '<path d="M29.4 62Q30 70 34.4 75.6" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/>',
  },
  braidbeard: {
    box: [25, 54, 50, 38],
    // A fair beard under the mouth, and two braids with golden beads.
    svg: '<defs><linearGradient id="braidbeardY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4D684"/><stop offset="1" stop-color="#C4913A"/></linearGradient></defs>' +
      '<path d="M28 57.6Q31 67 41 68.4Q50 69.6 59 68.4Q69 67 72 57.6Q74.2 70 66 76Q58 80.6 50 80.6Q42 80.6 34 76Q25.8 70 28 57.6Z" fill="url(#braidbeardY)" stroke="#8F6A22" stroke-width="0.5" stroke-linejoin="round"/>' +
      [44.6, 55.4].map(x => [79.4, 82.2, 85].map(y => `<ellipse cx="${x}" cy="${y}" rx="2.1" ry="1.7" fill="url(#braidbeardY)" stroke="#8F6A22" stroke-width="0.45"/>`).join('') +
        `<rect x="${n(x - 1.8)}" y="86.4" width="3.6" height="2" rx="0.8" fill="#E9B949" stroke="#9C6F1E" stroke-width="0.4"/><path d="M${n(x - 1)} 88.6L${n(x - 1.4)} 90.4M${x} 88.6L${x} 90.8M${n(x + 1)} 88.6L${n(x + 1.4)} 90.4" stroke="#C4913A" stroke-width="0.6" stroke-linecap="round"/>`).join('') +
      '<g fill="none" stroke="#A67B2C" stroke-opacity="0.5" stroke-width="0.45" stroke-linecap="round"><path d="M34 70Q37 74 41 76M66 70Q63 74 59 76M50 71L50 77"/></g>' +
      '<path d="M30 62Q31 67 34.6 70.6" stroke="#fff" stroke-opacity="0.6" stroke-width="0.9" fill="none" stroke-linecap="round"/>',
  },
}

function wearSvg(item: Item): string {
  const vector = VECTOR_WEAR[item]
  const at = WEAR_AT[item]
  // Lines are drawn at a fixed size; `s` grows them around their foot (on the ground) or center.
  if (vector) return at.s ? `<g transform="translate(${at.x} ${at.ground ? 88 : at.y}) scale(${at.s}) translate(${-at.x} ${at.ground ? -88 : -at.y})">${vector.svg}</g>` : `<g>${vector.svg}</g>`
  const a = WEAR[item]
  if (a === undefined) return ''
  const h = (at.w * a.h) / a.w
  const drawn = img(a, at.x - at.w / 2, at.y - h / 2, at.w)
  // Stretch and skew work about the picture's center, before it is mirrored or tilted.
  const flat = at.stretch || at.skew
    ? `<g transform="translate(${n(at.x)} ${n(at.y)}) skewX(${at.skew ?? 0}) scale(1 ${at.stretch ?? 1}) translate(${n(-at.x)} ${n(-at.y)})">${drawn}</g>`
    : drawn
  const pic = at.flip ? `<g transform="translate(${n(at.x * 2)} 0) scale(-1 1)">${flat}</g>` : flat
  // Things on the ground cast the same soft shadow as Mochi.
  const shadow = at.ground ? `<ellipse cx="${n(at.x)}" cy="88.6" rx="${n(at.w * 0.42)}" ry="1.7" fill="#2B1B17" opacity="0.13"/>` : ''
  const steam = item === 'mug'
    ? [0, 1].map(i => `<path d="M${n(at.x - 2 + i * 3.4)} ${n(at.y - h / 2 - 1)}q-1.6 -2.2 0 -4.4t0 -4.4" stroke="#C9B8AE" stroke-width="1" fill="none" stroke-linecap="round" opacity="0"><animateTransform attributeName="transform" type="translate" values="0 1;0 -3" dur="2.2s" begin="${n(i * 1.1)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.7;0" dur="2.2s" begin="${n(i * 1.1)}s" repeatCount="indefinite"/></path>`).join('')
    : ''
  return shadow + (at.r ? `<g transform="rotate(${at.r} ${at.x} ${at.y})">${pic}</g>` : pic + steam)
}

/** One slot of the outfit: what is on now, the old thing fading out and the new one popping in. */
function wearSlot(slot: keyof Outfit, now: Outfit, was: Outfit): string {
  const a = now[slot]
  const b = was[slot]
  if (a === b) return a ? wearSvg(a) : ''
  const out = b ? presence(wearSvg(b), false, true, WEAR_AT[b].x, WEAR_AT[b].y) : ''
  const into = a ? presence(wearSvg(a), true, false, WEAR_AT[a].x, WEAR_AT[a].y) : ''
  return out + into
}

/** Little helpers around the mascot, one per running subagent (up to three). */
function helpers(was: number, now: number): string {
  const spots: Pt[] = [[2, 73], [84, 73], [1, 44]]
  return spots.map(([x, y], i) => {
    const body = `<g>${loopT('translate', ['0 0', '0 -3.5', '0 0'], 0.7, '', `${n(0.34 + i * 0.18)}s`)}${img(ART.helper, x, y, 14)}</g>`
    const isThere = i < now
    const wasThere = i < was
    if (!isThere && !wasThere) return ''
    return presence(body, isThere && !wasThere, wasThere && !isThere, x + 7, y + 6)
  }).join('')
}

/**
 * Moves every animation's start back by `seconds`, as if the drawing had been
 * on screen that long: the desktop rebuilds its band on each redraw, and a
 * drawing shifted by the time since its shot began resumes mid-loop instead of
 * starting over. A begin before zero is SMIL's own "already running".
 */
export function shiftTimeline(svg: string, seconds: number): string {
  if (seconds <= 0) return svg
  return svg.replace(/<(animate|animateTransform|set)\b([^>]*?)(\/?)>/g, (_, tag: string, attrs: string, close: string) => {
    const begin = /\sbegin="(-?[\d.]+)s"/.exec(attrs)
    const at = n((begin ? Number(begin[1]) : 0) - seconds)
    const rest = begin ? attrs.replace(begin[0], '') : attrs
    return `<${tag}${rest} begin="${at}s"${close}>`
  })
}

const ROOT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">'

/** The SVG for a shot, `elapsedMs` after it began: from what was on screen into `mood`, then its loops. */
export function svgFor(shot: Pick<Shot, 'mood' | 'scene' | 'from'>, elapsedMs = 0): string {
  return shiftTimeline(markup(shot), elapsedMs / 1000)
}

/** The mascot's markup without its root, to nest inside a larger drawing. */
export function mascotInner(shot: Pick<Shot, 'mood' | 'scene' | 'from'>, elapsedMs = 0): string {
  const full = svgFor(shot, elapsedMs)
  const open = full.indexOf('<defs>')
  return full.slice(open, full.lastIndexOf('</svg>'))
}

function markup(shot: Pick<Shot, 'mood' | 'scene' | 'from'>): string {
  const { mood, scene } = shot
  const pose = POSES[mood]
  const to = target(mood)
  const from = shot.from?.params ?? to
  const was = shot.from ? POSES[shot.from.mood] : pose
  const wasScene = shot.from?.scene ?? scene
  const loops = bodyLoops(pose.loop)
  const [eyeMove, eyeBlink] = eyeLoops(pose.eyeLoop)

  const level = (c: number) => Math.max(0, Math.min(100, c)) / 100
  const liquidY = (c: number) => BODY.y + BODY_H - BODY_H * level(c)
  const liquidFill = (c: number) => (c >= 80 ? '#B3261E' : '#7A2E16')
  const liquidOp = (c: number) => (c <= 0 ? 0 : c >= 80 ? 0.3 : 0.16)

  const eyes = [[-1, 40, from.eyeL, to.eyeL], [1, 60, from.eyeR, to.eyeR]] as const
  const eyesSvg = eyes.map(([side, cx, a, b]) =>
    `<path d="${pathOf(b, cx, 52)}" fill="#2B1B17">${tween('d', pathOf(a, cx, 52), pathOf(b, cx, 52))}</path>` +
    `<circle cx="${cx + 1.3}" cy="50.2" r="1.15" fill="#fff" opacity="${n(to.catchlight * 0.9)}">${tween('opacity', n(from.catchlight * 0.9), n(to.catchlight * 0.9))}</circle>` +
    `<g opacity="${n(to.x)}">${tween('opacity', n(from.x), n(to.x))}<path d="M${cx - 3.6} ${48.4}L${cx + 3.6} ${55.6}M${cx + 3.6} ${48.4}L${cx - 3.6} ${55.6}" stroke="#2B1B17" stroke-width="2.4" stroke-linecap="round"/></g>` +
    `<g opacity="${n(to.star)}">${tween('opacity', n(from.star), n(to.star))}${img(ART.sparkle, cx - 5, 47, 10)}</g>` +
    `<g opacity="${n(to.spiral)}">${tween('opacity', n(from.spiral), n(to.spiral))}<g>${loopT('rotate', [`0 ${cx} 52`, `${side * 360} ${cx} 52`], 1.1)}<path d="M${cx} 52m-0.9 0a0.9 0.9 0 1 1 1.8 0a2.3 2.3 0 1 1 -4.6 0a3.8 3.8 0 1 1 7.6 0" stroke="#2B1B17" stroke-width="1.6" fill="none" stroke-linecap="round"/></g></g>`,
  ).join('')

  const held = (['laptop', 'book', 'glass', 'flag'] as const).map(k => {
    const isNow = pose.held === k
    const wasThen = was.held === k
    if (!isNow && !wasThen) return ''
    const [cx, cy] = HELD_AT[k]
    return presence(heldSvg(k), isNow && !wasThen, wasThen && !isNow, cx, cy)
  }).join('')

  const over = (Object.keys(OVER_AT) as Over[]).map(k => {
    const isNow = pose.over === k
    const wasThen = was.over === k
    if (!isNow && !wasThen) return ''
    const [cx, cy] = OVER_AT[k]
    return presence(overSvg(k), isNow && !wasThen, wasThen && !isNow, cx, cy)
  }).join('')

  const sweat = pose.sweat || was.sweat
    ? presence(`<g opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;0 9" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.7;1" dur="1.5s" repeatCount="indefinite"/>${img(ART.drop, 24, 30, 5)}</g>`, !!pose.sweat && !was.sweat, !!was.sweat && !pose.sweat, 26.5, 33)
    : ''
  const strain = scene.context >= 85 || wasScene.context >= 85
    ? presence(`<g opacity="0"><animateTransform attributeName="transform" type="translate" values="0 0;0 8" dur="1.8s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.7;1" dur="1.8s" repeatCount="indefinite"/>${img(ART.drop, 71, 33, 4.5)}</g>`, scene.context >= 85 && wasScene.context < 85, wasScene.context >= 85 && scene.context < 85, 73, 36)
    : ''
  const waves = pose.waves || was.waves
    ? presence(`<path d="M-10 93 Q0 88 10 93 T30 93 T50 93 T70 93 T90 93 T110 93" stroke="#5B8DEF" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.8">${loopT('translate', ['0 0', '-20 0'], 1)}</path>`, !!pose.waves && !was.waves, !!was.waves && !pose.waves, 50, 92)
    : ''

  const tap = pose.tapsFoot ? loopT('rotate', ['0 55 84', '-14 55 84', '0 55 84', '0 55 84'], 0.5) : ''
  // What stands beside Mochi makes way for the first helper, who stands there too.
  // An id this version does not know (an older one's, kept in $.state) is left off.
  const fit = (o: Outfit | undefined, agents: number): Outfit => {
    const v = { ...NO_OUTFIT, ...o }
    for (const slot of Object.keys(NO_OUTFIT) as (keyof Outfit)[]) if (!Object.hasOwn(WEAR_AT, v[slot] ?? '')) v[slot] = null
    return agents >= 1 && v.ground ? { ...v, ground: null } : v
  }
  const outfit = fit(scene.outfit, scene.agents)
  const wasOutfit = fit(wasScene.outfit, wasScene.agents)

  return [
    // The desktop draws an interactive Svg in its own frame: without a color
    // scheme of its own that frame paints an opaque white box on a dark app,
    // and fixed pixel sizes overflow it. Transparent, and filling whatever box it gets.
    ROOT,
    '<style>:root{color-scheme:light dark;background:transparent;overflow:hidden}html,body{margin:0;height:100%;background:transparent;overflow:hidden}svg{display:block}</style>',
    '<defs>',
    `<mask id="bm" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100" style="mask-type:alpha">${img(ART.body, BODY.x, BODY.y, BODY.w)}</mask>`,
    `<linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${liquidFill(scene.context)}" stop-opacity="0"/><stop offset="0.35" stop-color="${liquidFill(scene.context)}" stop-opacity="0.8"/><stop offset="1" stop-color="${liquidFill(scene.context)}"/></linearGradient>`,
    '<radialGradient id="glow"><stop offset="0" stop-color="#FFE7CF" stop-opacity="0.95"/><stop offset="1" stop-color="#FFE7CF" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="blush"><stop offset="0" stop-color="#FF7A95" stop-opacity="0.8"/><stop offset="1" stop-color="#FF7A95" stop-opacity="0"/></radialGradient>',
    '</defs>',
    helpers(wasScene.agents, scene.agents),
    '<ellipse cx="50" cy="88.5" rx="21" ry="3" fill="#2B1B17" opacity="0.13"/>',
    wearSlot('ground', outfit, wasOutfit),
    waves,
    `<g transform="translate(${n(to.shift)} ${n(to.lift)})">${tweenT('translate', `${n(from.shift)} ${n(from.lift)}`, `${n(to.shift)} ${n(to.lift)}`)}`,
    `<g>${loops.move}`,
    `<g transform="rotate(${n(to.tilt)} 50 88)">${tweenT('rotate', `${n(from.tilt)} 50 88`, `${n(to.tilt)} 50 88`)}`,
    `<g>${loops.turn}`,
    '<rect x="33.5" y="79.6" width="14" height="6.4" rx="3.2" fill="#C9694A"/>',
    img(ART.foot, 33, 79, 15),
    `<g>${tap}<rect x="52.5" y="79.6" width="14" height="6.4" rx="3.2" fill="#C9694A"/>${img(ART.foot, 52, 79, 15)}</g>`,
    '<g transform="translate(50 82)">',
    `<g transform="scale(${n(to.sx)} ${n(to.sy)})">${tweenT('scale', `${n(from.sx)} ${n(from.sy)}`, `${n(to.sx)} ${n(to.sy)}`)}`,
    `<g>${loops.squash}`,
    '<g transform="translate(-50 -82)">',
    // A hat has no room for the antenna: it comes off while something is on the head.
    outfit.head ? '' : '<path d="M50 34 Q49 27 50 21" stroke="#B65A3C" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    outfit.head ? '' : '<circle cx="50" cy="17.5" r="8" fill="url(#glow)"><animate attributeName="opacity" values="0.45;1;0.45" dur="2.2s" repeatCount="indefinite"/></circle>',
    outfit.head ? '' : '<circle cx="50" cy="17.5" r="4" fill="#FFB38A"/>',
    outfit.head ? '' : img(ART.bulb, 45.6, 13.1, 8.8),
    '<rect x="22" y="32" width="56" height="48.5" rx="19" fill="#D97757"/>',
    img(ART.body, BODY.x, BODY.y, BODY.w),
    `<rect x="18" y="${n(liquidY(scene.context))}" width="64" height="${n(BODY_H * level(scene.context) + 2)}" fill="url(#liq)" opacity="${n(liquidOp(scene.context))}" mask="url(#bm)">` +
      tween('y', n(liquidY(wasScene.context)), n(liquidY(scene.context))) +
      tween('height', n(BODY_H * level(wasScene.context) + 2), n(BODY_H * level(scene.context) + 2)) +
      tween('opacity', n(liquidOp(wasScene.context)), n(liquidOp(scene.context))) +
      '</rect>',
    `<rect x="18" y="28" width="64" height="56" fill="${rgb(to.tint)}" opacity="${n(to.tintOp)}" mask="url(#bm)">${tween('fill', rgb(from.tint), rgb(to.tint))}${tween('opacity', n(from.tintOp), n(to.tintOp))}</rect>`,
    `<g opacity="${n(to.blush)}">${tween('opacity', n(from.blush), n(to.blush))}<ellipse cx="31" cy="60" rx="5.5" ry="3.2" fill="url(#blush)"/><ellipse cx="69" cy="60" rx="5.5" ry="3.2" fill="url(#blush)"/></g>`,
    `<g transform="translate(${n(to.eyeDx)} ${n(to.eyeDy)})">${tweenT('translate', `${n(from.eyeDx)} ${n(from.eyeDy)}`, `${n(to.eyeDx)} ${n(to.eyeDy)}`)}`,
    `<g>${eyeMove}<g transform="translate(0 52)"><g>${eyeBlink}<g transform="translate(0 -52)">${eyesSvg}</g></g></g></g></g>`,
    `<path d="${pathOf(to.mouth, 50, 64)}" fill="#2B1B17">${tween('d', pathOf(from.mouth, 50, 64), pathOf(to.mouth, 50, 64))}${mouthLoop(pose.mouthLoop, pose.mouth)}</path>`,
    // The face from the skin out: a beard, a mustache over it, the rest, then glasses on top.
    wearSlot('chin', outfit, wasOutfit),
    wearSlot('lip', outfit, wasOutfit),
    wearSlot('face', outfit, wasOutfit),
    wearSlot('eyes', outfit, wasOutfit),
    wearSlot('neck', outfit, wasOutfit),
    wearSlot('head', outfit, wasOutfit),
    arm('L', from.armL, to.armL, pose.armLoopL),
    arm('R', from.armR, to.armR, pose.armLoopR),
    // A held thing is drawn over the hand, as if gripped by it.
    wearSlot('held', outfit, wasOutfit),
    held,
    sweat,
    strain,
    '</g></g></g></g>',
    over,
    '</g></g></g></g>',
    '</svg>',
  ].join('')
}
