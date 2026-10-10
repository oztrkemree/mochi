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

/** Where each thing to wear sits: its center, width and tilt, in the drawing's 100×100. */
export const WEAR_AT: Record<Item, { x: number; y: number; w: number; r?: number; flip?: true; ground?: true }> = {
  hardhat: { x: 50, y: 32.5, w: 36 },
  crown: { x: 50, y: 29.5, w: 26 },
  gradcap: { x: 50, y: 31.5, w: 40 },
  headphones: { x: 50, y: 49.5, w: 66 },
  partyhat: { x: 36, y: 27, w: 16, r: -20 },
  witchhat: { x: 37, y: 24, w: 38, r: -14 },
  santahat: { x: 38, y: 29.5, w: 33, r: -16 },
  nightcap: { x: 38, y: 29.5, w: 33, r: -16 },
  cowboy: { x: 37.5, y: 29.5, w: 37, r: -14 },
  pirate: { x: 41.5, y: 30, w: 41, r: -9 },
  chefhat: { x: 37, y: 25, w: 25, r: -15 },
  viking: { x: 50, y: 31.5, w: 48 },
  wizard: { x: 37, y: 23, w: 34, r: -20 },
  fez: { x: 38, y: 31, w: 19, r: -18 },
  propeller: { x: 39, y: 30, w: 28, r: -16 },
  beanie: { x: 39, y: 30.5, w: 31, r: -18 },
  sunglasses: { x: 50, y: 52, w: 42 },
  glasses: { x: 50, y: 52, w: 40 },
  mustache: { x: 50, y: 59.8, w: 16 },
  monocle: { x: 61.3, y: 55.6, w: 13 },
  bowtie: { x: 50, y: 73.5, w: 15 },
  medal: { x: 50, y: 75, w: 10 },
  scarf: { x: 50, y: 77.5, w: 22 },
  necktie: { x: 50, y: 76, w: 10 },
  evileye: { x: 50, y: 68, w: 30 },
  mug: { x: 82.5, y: 69.5, w: 13 },
  tea: { x: 82, y: 69.5, w: 12 },
  simit: { x: 82.5, y: 69, w: 14 },
  pencil: { x: 81.5, y: 65, w: 5.4, r: 18 },
  wrench: { x: 81.5, y: 65, w: 7.6, r: -12 },
  balloon: { x: 81.5, y: 53, w: 15 },
  pumpkin: { x: 12, y: 80.9, w: 15, ground: true },
  duck: { x: 12, y: 80.7, w: 16, flip: true, ground: true },
  cactus: { x: 12, y: 79.2, w: 13, ground: true },
  cat: { x: 12.5, y: 77.6, w: 19, ground: true },
  gift: { x: 12, y: 80.5, w: 15, ground: true },
  sakura: { x: 39, y: 31, w: 18 },
  pin: { x: 34.6, y: 70.8, w: 9 },
  rosette: { x: 50, y: 76, w: 12 },
  candy: { x: 83, y: 69, w: 14 },
  lantern: { x: 80.5, y: 73, w: 9 },
  envelope: { x: 83, y: 70, w: 9 },
  diya: { x: 13, y: 84, w: 17, ground: true },
  sprouts: { x: 12, y: 81, w: 14, ground: true },
  songpyeon: { x: 12, y: 85, w: 16, ground: true },
  cake: { x: 12, y: 82, w: 15, ground: true },
}

const NO_OUTFIT: Outfit = { head: null, face: null, neck: null, held: null, ground: null }

/** `count` circles of radius `r` around (x, y), `d` from it: a blossom's petals, a rosette's pleats. */
const around = (x: number, y: number, d: number, r: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i * 2 * Math.PI) / count
    return `<circle cx="${n(x + Math.sin(a) * d)}" cy="${n(y - Math.cos(a) * d)}" r="${n(r)}"/>`
  }).join('')

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
  sprouts: {
    box: [3, 70.5, 18, 19.5],
    svg: '<ellipse cx="12" cy="88.6" rx="7" ry="1.7" fill="#2B1B17" opacity="0.13"/>' +
      '<path d="M7 84.4Q6.2 80 4.8 77.4M8.2 84.4Q7.6 79 6.6 75M9.4 84.4Q9 78 8.4 73.4M10.6 84.4Q10.6 77.6 10.4 72.4M12 84.4Q12.2 77.4 12.8 72.6M13.2 84.4Q13.8 78.4 15 74.2M14.6 84.4Q15.4 79.6 17 76.2M16 84.4Q17 81 18.8 78.6" stroke="#5FAF4E" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      '<path d="M7.6 84.4Q7.2 81 5.8 79.2M9 84.4Q8.6 80.4 7.6 77.6M11.2 84.4Q11.2 79.6 11.6 76M13.8 84.4Q14.2 80.6 15.4 78.2M15.4 84.4Q16 82 17.4 80.4" stroke="#3F8A3A" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
      '<rect x="7" y="80.4" width="10" height="1.6" fill="#D8433B"/><path d="M12 81.2L9.8 80L10 82.4ZM12 81.2L14.2 80L14 82.4Z" fill="#D8433B" stroke="#8E2A22" stroke-width="0.3" stroke-linejoin="round"/>' +
      '<path d="M5.4 84Q6.2 88.2 12 88.2Q17.8 88.2 18.6 84Z" fill="#F3ECE4" stroke="#C9B8AE" stroke-width="0.5"/><path d="M6 85.6Q12 87.4 18 85.6" stroke="#1E4CC2" stroke-width="0.7" fill="none"/>',
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
}

function wearSvg(item: Item): string {
  const vector = VECTOR_WEAR[item]
  if (vector) return `<g>${vector.svg}</g>`
  const at = WEAR_AT[item]
  const a = WEAR[item]
  if (a === undefined) return ''
  const h = (at.w * a.h) / a.w
  const flat = img(a, at.x - at.w / 2, at.y - h / 2, at.w)
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
    '<path d="M50 34 Q49 27 50 21" stroke="#B65A3C" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    '<circle cx="50" cy="17.5" r="8" fill="url(#glow)"><animate attributeName="opacity" values="0.45;1;0.45" dur="2.2s" repeatCount="indefinite"/></circle>',
    '<circle cx="50" cy="17.5" r="4" fill="#FFB38A"/>',
    img(ART.bulb, 45.6, 13.1, 8.8),
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
    wearSlot('face', outfit, wasOutfit),
    wearSlot('neck', outfit, wasOutfit),
    wearSlot('head', outfit, wasOutfit),
    // A held thing goes under the hand, so the hand grips it.
    wearSlot('held', outfit, wasOutfit),
    arm('L', from.armL, to.armL, pose.armLoopL),
    arm('R', from.armR, to.armR, pose.armLoopR),
    held,
    sweat,
    strain,
    '</g></g></g></g>',
    over,
    '</g></g></g></g>',
    '</svg>',
  ].join('')
}
