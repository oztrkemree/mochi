import type { Info, Limit, Mood, Panel, Recent } from '../types'
import { ciMark } from './ci'
import { clockAt, local, timeGone } from './facts'
import { DEFS, STYLE, ring, usageInk } from './gauge'
import { isShell } from './guard'
import { t } from './i18n'
import { clip, cols, rtlStyle } from './text'
import type { Arc } from './gauge'
import { mascotInner, shiftTimeline } from './rig'

// The desktop band as one drawing: the mascot on a lit stage, three lines of
// what is happening, and three ring gauges (context, the 5-hour session, the
// week). One SVG keeps everything aligned whatever the band's own layout
// does, and an <img> of it keeps the painted parts an interactive frame would strip.

export const PANEL_H = 88
/** The height the lines and gauges are laid out in, centred in the band's. */
const ROW_H = 76
/** The mascot's box in the band, in pixels: larger than the band, its empty margins outside. */
const MASCOT = Math.round(PANEL_H * 1.14)
/** The mascot's box from the band's left edge, room for what stands beside it. */
const MASCOT_X = 4
/** The widest the three lines get; past it they sit centred between the mascot and the gauges. */
const LINES_W = 440

/** Which family a tool belongs to, for the strip's icon and colour. */
export function toolKind(tool: string): Recent['kind'] {
  if (tool === 'Read' || tool === 'NotebookRead' || tool === 'Skill') return 'read'
  if (tool === 'Grep' || tool === 'Glob' || tool === 'LS' || tool === 'ToolSearch') return 'search'
  if (/^(Edit|MultiEdit|Write|NotebookEdit|TodoWrite|TaskCreate|TaskUpdate|Artifact)$/.test(tool)) return 'edit'
  if (isShell(tool) || tool === 'BashOutput' || tool === 'Monitor') return 'bash'
  if (tool === 'WebFetch' || tool === 'WebSearch' || /Browser|chrome/i.test(tool)) return 'web'
  if (tool === 'Agent' || tool === 'Task') return 'agent'
  if (tool === 'AskUserQuestion' || tool === 'ExitPlanMode') return 'ask'
  return 'other'
}

export const KIND_INK: Record<Recent['kind'], string> = {
  read: '#7AA2F7', search: '#7DCFFF', edit: '#B794F6', bash: '#F07CB8', web: '#73DACA', agent: '#9ECE6A', ask: '#F2C14E', other: '#9A9994',
}

/** A 10×10 icon for a tool family, drawn around (0, 0). */
export function glyph(kind: Recent['kind'], ink: string): string {
  const s = `stroke="${ink}" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"`
  switch (kind) {
    case 'read': return `<path d="M-3.5 -3H3.5M-3.5 0H3.5M-3.5 3H1" ${s}/>`
    case 'search': return `<circle cx="-0.8" cy="-0.8" r="2.6" ${s}/><path d="M1.2 1.2L3.6 3.6" ${s}/>`
    case 'edit': return `<path d="M-3.4 3.4L-2.8 1.2L1.8 -3.4L3.4 -1.8L-1.2 2.8Z" ${s}/>`
    case 'bash': return `<path d="M-3.6 -2.6L-1 0L-3.6 2.6M0.4 3H3.6" ${s}/>`
    case 'web': return `<circle r="3.6" ${s}/><path d="M-3.6 0H3.6M0 -3.6C-1.8 -1.2 -1.8 1.2 0 3.6M0 -3.6C1.8 -1.2 1.8 1.2 0 3.6" ${s}/>`
    case 'agent': return `<circle cx="-1.8" cy="0" r="1.6" fill="${ink}"/><circle cx="2" cy="0" r="1.6" fill="${ink}"/>`
    case 'ask': return `<path d="M-1.8 -2C-1.8 -4 1.8 -4 1.8 -2C1.8 -0.6 0 -0.6 0 1" ${s}/><circle cx="0" cy="3.2" r="0.8" fill="${ink}"/>`
    case 'other': return `<circle r="1.8" fill="${ink}"/>`
  }
}

/** The mood's colour for the title, as hex: an <img> cannot read the app's theme. */
export const MOOD_INK: Record<Mood, string> = {
  idle: '#E08A6A', wave: '#E08A6A', listening: '#E08A6A', thinking: '#A9B4F5', talking: '#E08A6A',
  reading: '#7AA2F7', searching: '#7AA2F7', writing: '#B794F6', running: '#F07CB8', waiting: '#F07CB8',
  web: '#7AA2F7', agent: '#B794F6', asking: '#A9B4F5', success: '#5CC97A', proud: '#5CC97A', party: '#F2C14E',
  error: '#F0707A', dizzy: '#F0707A', scared: '#F2C14E', denied: '#97968F', shocked: '#F2C14E',
  nervous: '#F2C14E', pleased: '#E08A6A', tired: '#97968F', sleepy: '#97968F', sleeping: '#97968F', squeezed: '#5FB3A8',
  stretch: '#5FB3A8', love: '#F07CB8', wink: '#E08A6A',
}

/** /context's palette, matched by the category's name. */
export function sliceInk(name: string): string {
  const k = name.toLowerCase()
  if (k.includes('system prompt')) return '#7AA2F7'
  if (k.includes('mcp')) return '#BB9AF7'
  if (k.includes('tool')) return '#7DCFFF'
  if (k.includes('agent')) return '#9ECE6A'
  if (k.includes('memory')) return '#E0AF68'
  if (k.includes('skill')) return '#F7768E'
  if (k.includes('command') || k.includes('slash')) return '#73DACA'
  if (k.includes('message')) return '#D97757'
  return '#8C8A88'
}

const n = (v: number) => String(Math.round(v * 100) / 100)
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** 273000 → "273k", 1000000 → "1M". */
export function tokens(v: number): string {
  if (v >= 1_000_000) return `${n(Math.round(v / 100_000) / 10)}M`
  if (v >= 1000) return `${Math.round(v / 1000)}k`
  return String(Math.round(v))
}

/** Time until a reset, in the language's units: "2h 14m", "3d 4h", "12m". */
export function until(ms: number): string {
  const u = t().unit
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return u(m, 'm')
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 === 0 ? u(h, 'h') : `${u(h, 'h')} ${u(m % 60, 'm')}`
  const d = Math.floor(h / 24)
  return h % 24 === 0 ? u(d, 'd') : `${u(d, 'd')} ${u(h % 24, 'h')}`
}

/** A usage window's short name: session, week. */
export const limitName = (kind: string): string => t().limit.short[kind] ?? kind

export function limitInk(p: number): [string, string] {
  if (p >= 80) return ['#E5534B', '#F2837C']
  if (p >= 50) return ['#E5A93B', '#F4CB72']
  return ['#3FAE60', '#7FD69A']
}


export type PanelInput = { panel: Panel; now: number; width: number }

/** An Info with every list and figure present, whatever an older version stored. */
function whole(info: Partial<Info> | undefined): Info {
  const c: Partial<Info['context']> = info?.context ?? {}
  return {
    label: info?.label ?? '',
    detail: info?.detail ?? '',
    context: { percent: c.percent ?? -1, tokens: c.tokens ?? 0, window: c.window ?? 0, slices: c.slices ?? [] },
    limits: info?.limits ?? [],
    cost: info?.cost ?? 0,
    agents: info?.agents ?? 0,
    tools: info?.tools ?? 0,
    isBusy: info?.isBusy ?? false,
    recent: info?.recent ?? [],
    last: info?.last ?? '',
    compactPct: info?.compactPct ?? 0,
    warn: info?.warn ?? 0,
    git: info?.git ?? null,
    forecast: info?.forecast ?? {},
    ...(info?.turnsLeft !== undefined ? { turnsLeft: info.turnsLeft } : {}),
    tz: info?.tz ?? 0,
    peers: info?.peers ?? [],
    ci: info?.ci ?? null,
    pr: info?.pr ?? null,
  }
}

type Gauge = { key: string; label: string; sub: string; subInk?: string; arcs: Arc[]; was: Arc[]; center: string; mark?: number; pace?: number; halo?: string }

const contextArcs = (info: Info): Arc[] => {
  const { window, slices, percent } = info.context
  if (window > 0 && slices.length > 0) return slices.map(s => ({ key: s.name, value: (s.tokens / window) * 100, color: sliceInk(s.name) }))
  return percent > 0 ? [{ key: 'used', value: percent, color: sliceInk('messages') }] : []
}

function gauges(info: Info, was: Info, now: number): Gauge[] {
  const ctx = info.context
  const warnInk = info.warn >= 2 ? '#F0645A' : '#F2B84B'
  const out: Gauge[] = [{
    key: 'context',
    label: t().panel.context,
    // About how many turns are left reads better than tokens; the tokens stay in the detail pane.
    sub: info.turnsLeft !== undefined ? t().panel.turnsLeft(info.turnsLeft) : ctx.window > 0 ? `${tokens(ctx.tokens)}/${tokens(ctx.window)}` : '—',
    arcs: contextArcs(info),
    was: contextArcs(was),
    center: ctx.percent >= 0 ? `${Math.round(ctx.percent)}%` : '—',
    ...(info.compactPct > 0 ? { mark: info.compactPct } : {}),
    ...(info.warn >= 1 ? { halo: warnInk } : {}),
  }]
  const byKind = (list: Limit[], kind: string) => list.find(l => l.kind === kind)
  for (const kind of ['five_hour', 'seven_day']) {
    const l = byKind(info.limits, kind)
    const before = byKind(was.limits, kind) ?? l
    // At this pace the window runs out before its reset: say when, instead of the reset.
    const full = info.forecast?.[kind]
    const gone = l ? timeGone(l, now) : null
    out.push({
      key: kind,
      label: limitName(kind),
      sub: full !== undefined ? t().panel.fullAt(clockAt(full, now, info.tz ?? 0)) : l && l.resetsAt > now ? `↻ ${until(l.resetsAt - now)}` : '—',
      ...(full !== undefined ? { subInk: full - now < 30 * 60_000 ? '#F0645A' : '#F2B84B' } : {}),
      arcs: l ? [{ key: 'u', value: Math.min(100, l.percent), color: usageInk(l.percent) }] : [],
      was: before ? [{ key: 'u', value: Math.min(100, before.percent), color: usageInk(before.percent) }] : [],
      center: l ? `${Math.round(l.percent)}%` : '—',
      ...(gone !== null ? { pace: gone } : {}),
      ...(l && l.percent >= 80 ? { halo: '#F0645A' } : {}),
    })
  }
  return out
}

/** The last tool calls as a row of small squares: new ones arrive, a running one breathes, a failed one is red. */
function timeline(recent: Recent[], seen: Set<number>, x: number, cy: number, room: number): { svg: string; width: number } {
  // Each call a tile of its family's colour with the family's icon on it,
  // so the trail reads as what was done; the running one breathes.
  const step = 16
  const fits = Math.floor(room / step)
  const list = fits > 0 ? recent.slice(-fits) : []
  const svg = list.map((r, i) => {
    const px = x + i * step
    const fill = r.state === 'fail' ? '#F0645A' : KIND_INK[r.kind]
    const breathe = r.state === 'run' ? '<animate attributeName="opacity" values="1;0.35;1" dur="1s" repeatCount="indefinite"/>' : ''
    const sq = `<g>${breathe}<rect x="${px}" y="${cy - 6.5}" width="13" height="13" rx="3.6" fill="${fill}" fill-opacity="${r.state === 'run' ? 0.32 : 0.18}"/>` +
      `<g transform="translate(${n(px + 6.5)} ${n(cy)}) scale(0.95)">${glyph(r.kind, fill)}</g></g>`
    if (seen.has(r.id)) return sq
    return `<g><animate attributeName="opacity" values="0;1" dur="0.35s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="6 0;0 0" dur="0.35s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.35 0 0.15 1"/>${sq}</g>`
  }).join('')
  return { svg, width: list.length * step - 3 }
}

/** The speech bubble's fill and edge, in either theme. */
const BUBBLE = '<style>.bub{fill:#fff;fill-opacity:.06;stroke:#fff;stroke-opacity:.1;stroke-width:1}' +
  '@media (prefers-color-scheme:light){.bub{fill:#000;fill-opacity:.035;stroke:#000;stroke-opacity:.09}}</style>'

const BRANCH = (x: number, y: number) =>
  `<g transform="translate(${n(x)} ${n(y)})" stroke="#A1A09B" stroke-width="1.3" fill="none" stroke-linecap="round"><circle cx="2" cy="-7" r="1.6"/><circle cx="2" cy="1" r="1.6"/><circle cx="8" cy="-5" r="1.6"/><path d="M2 -5.4V-0.6M8 -3.4C8 -1 2 -2 2 -0.6"/></g>`

/**
 * The sky behind the mascot at the machine's local hour, `w` wide and `h`
 * tall: a moon, stars and two fireflies at night, the first stars at dusk,
 * drifting clouds by day. Within the stage: a cloud fades in and
 * out at its edges, so nothing drifts under the lines.
 */
export function sky(hour: number, w: number, h: number): string {
  const isNight = hour >= 21 || hour < 5
  const isLow = (hour >= 5 && hour < 8) || (hour >= 17 && hour < 21)
  const star = (x: number, y: number, r: number, dur: number, begin: number) =>
    `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="#FFF6D8"><animate attributeName="opacity" values="0.15;0.9;0.15" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`
  const stars = (count: number) => [[8, 12, 0.9, 2.6, 0], [20, 6, 0.7, 3.4, 1.1], [w - 30, 8, 0.8, 2.9, 0.6], [6, 34, 0.7, 3.8, 1.9], [w - 8, 36, 0.9, 3.1, 0.3], [26, 22, 0.6, 4.2, 2.4]]
    .slice(0, count).map(([x, y, r, d, b]) => star(x!, y!, r!, d!, b!)).join('')
  const firefly = (path: string, dur: number, begin: number) =>
    `<g><animateMotion path="${path}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" rotate="0"/>` +
    `<circle r="4" fill="#E9F57A" opacity="0.25" filter="url(#haze)"/><circle r="1.3" fill="#F2FA9C"><animate attributeName="opacity" values="1;0.2;1" dur="1.7s" begin="${begin}s" repeatCount="indefinite"/></circle></g>`
  const cloud = (y: number, s: number, dur: number, begin: number) =>
    `<g opacity="0" fill="#FFFFFF"><animateTransform attributeName="transform" type="translate" values="-6 ${y};${w - 24} ${y}" dur="${dur}s" begin="-${begin}s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="0;0.16;0.16;0" keyTimes="0;0.15;0.85;1" dur="${dur}s" begin="-${begin}s" repeatCount="indefinite"/>` +
    `<g transform="scale(${s})"><circle cx="0" cy="0" r="5"/><circle cx="6" cy="-2.5" r="6.5"/><circle cx="13" cy="0" r="5"/><rect x="0" y="0" width="13" height="5" rx="2.5"/></g></g>`
  let scene: string
  if (isNight) {
    scene = stars(6) +
      `<g transform="translate(${n(w - 16)} 15)"><circle r="11" fill="#FFF3C4" opacity="0.12" filter="url(#haze)"/><circle r="6.5" fill="#F6EBC8" mask="url(#moonbite)"/></g>` +
      firefly(`M8 ${h - 22} q10 -12 20 -2 t16 6 t-14 10 t-22 -14`, 9, 0) +
      firefly(`M${w - 10} ${h - 30} q-10 8 -18 -4 t-6 -14 t14 4 t10 14`, 11, 3)
  } else if (isLow) {
    scene = hour >= 17 ? stars(2) : ''
  } else {
    scene = cloud(10, 0.8, 38, 6) + cloud(26, 0.6, 52, 30)
  }
  return '<defs><mask id="moonbite" maskUnits="userSpaceOnUse" x="-10" y="-10" width="20" height="20"><rect x="-10" y="-10" width="20" height="20" fill="#fff"/><circle cx="3.2" cy="-2.4" r="5.6" fill="#000"/></mask></defs>' +
    scene
}

/**
 * A celebration across the whole band, `elapsed` seconds after it began:
 * fireworks bursting behind the lines between `x0` and `x1`, and confetti
 * falling over everything, all gone after about four seconds. `seed` (the
 * moment it began) picks the same show on every redraw.
 */
export function fireworks(seed: number, elapsed: number, x0: number, x1: number, w: number, h: number): { behind: string; front: string } {
  if (elapsed < 0 || elapsed > 4.5) return { behind: '', front: '' }
  let r = Math.floor(seed) % 2147483647 || 1
  const rand = () => (r = (r * 48271) % 2147483647) / 2147483647
  const INKS = ['#FF6B6B', '#FFD36B', '#7AA2F7', '#73DACA', '#B794F6', '#F07CB8', '#FF9E63']
  const at = (t: number) => n(t - elapsed)
  const bursts = Array.from({ length: 5 }, (_, i) => {
    const cx = x0 + (x1 - x0) * ((i + 0.2 + rand() * 0.6) / 5)
    const cy = 12 + rand() * 26
    const ink = INKS[Math.floor(rand() * INKS.length)]!
    const t0 = i * 0.38 + rand() * 0.2
    const rise = `<circle cx="${n(cx)}" cy="${n(h + 4)}" r="1.4" fill="${ink}" opacity="0"><animate attributeName="cy" values="${n(h + 4)};${n(cy)}" begin="${at(t0)}s" dur="0.45s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.6 0.4 1"/>` +
      `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" begin="${at(t0)}s" dur="0.45s" fill="freeze"/></circle>`
    const sparks = Array.from({ length: 18 }, (_, k) => {
      const a = (k / 18) * Math.PI * 2 + rand() * 0.2
      const d = 19 + rand() * 10
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d
      return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(1.1 + rand() * 0.7)}" fill="${k % 3 === 0 ? '#FFFFFF' : ink}" opacity="0">` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;${n(dx)} ${n(dy)};${n(dx * 1.1)} ${n(dy * 1.1 + 6)}" keyTimes="0;0.45;1" begin="${at(t0 + 0.45)}s" dur="1.3s" fill="freeze" calcMode="spline" keySplines="0.1 0.8 0.3 1;0.4 0 0.8 0.6"/>` +
        `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.55;1" begin="${at(t0 + 0.45)}s" dur="1.3s" fill="freeze"/></circle>`
    }).join('')
    const flash = `<circle cx="${n(cx)}" cy="${n(cy)}" r="14" fill="${ink}" opacity="0" filter="url(#haze)"><animate attributeName="opacity" values="0;0.45;0" begin="${at(t0 + 0.45)}s" dur="0.6s" fill="freeze"/></circle>`
    return rise + flash + sparks
  }).join('')
  const confetti = Array.from({ length: 30 }, () => {
    const x = rand() * w
    const t0 = rand() * 1.4
    const dur = 1.8 + rand() * 1.4
    const ink = INKS[Math.floor(rand() * INKS.length)]!
    const spin = rand() < 0.5 ? 360 : -360
    return `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.8;1" begin="${at(t0)}s" dur="${n(dur)}s" fill="freeze"/>` +
      `<animateTransform attributeName="transform" type="translate" values="${n(x)} -6;${n(x + (rand() - 0.5) * 30)} ${n(h + 6)}" begin="${at(t0)}s" dur="${n(dur)}s" fill="freeze"/>` +
      `<rect x="-2" y="-1" width="4" height="2.2" rx="0.6" fill="${ink}"><animateTransform attributeName="transform" type="rotate" values="0;${spin}" dur="0.9s" repeatCount="indefinite"/></rect></g>`
  }).join('')
  return { behind: bursts, front: confetti }
}

/** The panel's drawing, and where its gauges sit (in the drawing's pixels) so a click region can lie over them. */
export function panelSvg({ panel, now, width }: PanelInput): { svg: string; card: { x: number; w: number }; width: number } {
  const { shot, infoFrom } = panel
  const info = whole(panel.info)
  const was = infoFrom ? whole(infoFrom) : info
  const W = Math.max(420, Math.round(width))
  const H = PANEL_H
  const ink = MOOD_INK[shot.mood]
  const since = Math.max(0, now - panel.infoAt) / 1000

  // ---- three ring gauges on the right ----
  // Narrow columns against the right edge, so the lines in the middle keep the room.
  const colW = 56
  const list = gauges(info, was, now)
  const gX = W - colW * list.length
  const sepX = gX - 10
  const rings = list.map((g, i) => {
    const cx = gX + colW * i + colW / 2
    return ring({ id: g.key, cx, cy: 29, r: 14.5, width: 4.2, arcs: g.arcs, was: g.was, center: esc(g.center), centerSize: 10.5,
      ...(g.mark !== undefined ? { mark: g.mark } : {}), ...(g.pace !== undefined ? { pace: g.pace } : {}), ...(g.halo ? { halo: g.halo, markColor: g.halo } : {}) }) +
      `<text class="t ${g.halo ? '' : 'dim'}" x="${n(cx)}" y="58.5" font-size="10" font-weight="${g.halo ? 650 : 500}" text-anchor="middle"${g.halo ? ` fill="${g.halo}"` : ''}>${esc(g.label)}</text>` +
      `<text class="t${g.subInk ? '' : ' faint'}" x="${n(cx)}" y="69.5" font-size="9.5" text-anchor="middle" font-variant-numeric="tabular-nums"${g.subInk ? ` fill="${g.subInk}" font-weight="600"` : ''}>${esc(g.sub)}</text>`
  }).join('')

  // ---- the mascot on its stage ----
  // The mascot's box is larger than the band: its drawing reaches from about
  // 9 units down (a hat) to 93 (what stands beside it), so that span fills
  // the height; across, it reaches 88, where the lines may start.
  const mY = -MASCOT * 0.07
  const gx = n(MASCOT_X + MASCOT * 0.5), gy = n(mY + MASCOT * 0.55), gr = n(MASCOT * 0.35)
  const glow = info.isBusy
    ? `<circle cx="${gx}" cy="${gy}" r="${gr}" fill="${ink}" opacity="0.3" filter="url(#haze)"><animate attributeName="opacity" values="0.18;0.38;0.18" dur="2.4s" repeatCount="indefinite"/></circle>`
    : `<circle cx="${gx}" cy="${gy}" r="${gr}" fill="${ink}" opacity="0.2" filter="url(#haze)"/>`
  const mascot = `<svg x="${MASCOT_X}" y="${n(mY)}" width="${MASCOT}" height="${MASCOT}" viewBox="0 0 100 100" overflow="visible">${mascotInner(shot, Math.max(0, now - shot.at))}</svg>`

  // ---- three lines of what is happening ----
  const stageEnd = Math.round(MASCOT_X + MASCOT * 0.88 + 6)
  const clock = local(now, info.tz)
  const show = shot.mood === 'party' ? fireworks(shot.at, (now - shot.at) / 1000, stageEnd + 10, sepX - 10, W, H) : { behind: '', front: '' }
  const free = Math.max(0, sepX - stageEnd - 12)
  const room = Math.min(free, LINES_W)
  const x0 = stageEnd + Math.round((free - room) / 2)
  const end = x0 + room
  const [verb = '', ...rest] = info.detail.split(' · ')
  const subject = rest.join(' · ')
  // What Mochi says, in a speech bubble whose tail points back at it; the
  // bubble pops when the line changes. The two lines under it start at its edge.
  const bx = x0 + 7
  const titleRoom = Math.max(6, Math.floor((room - 7 - 34) / 8.3))
  const verbShown = clip(verb, titleRoom)
  const subjectShown = subject ? clip(subject, Math.max(4, titleRoom - cols(verbShown) - 3)) : ''
  const bw = Math.min(room - 7, 34 + (cols(verbShown) + (subjectShown ? cols(subjectShown) + 3 : 0)) * 7.7)
  const [y0, y1, r] = [4, 34, 12]
  const bubblePath = `M${n(bx + r)} ${y0}H${n(bx + bw - r)}Q${n(bx + bw)} ${y0} ${n(bx + bw)} ${y0 + r}V${y1 - r}Q${n(bx + bw)} ${y1} ${n(bx + bw - r)} ${y1}` +
    `H${n(bx + r)}Q${bx} ${y1} ${bx} ${y1 - r}V${y1 - r + 1}L${n(bx - 7)} ${y1 - 3}L${bx} ${y0 + r + 1}V${y0 + r}Q${bx} ${y0} ${n(bx + r)} ${y0}Z`
  const pops = was.detail !== info.detail
    ? `<animateTransform attributeName="transform" type="translate" values="-3 1;0 0" dur="0.3s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.3 0 0.2 1.4"/><animate attributeName="opacity" values="0;1" dur="0.25s" fill="freeze"/>`
    : ''
  const dot = info.isBusy
    ? `<circle cx="${bx + 13}" cy="19" r="3.5" fill="${ink}"><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite"/></circle>`
    : `<circle cx="${bx + 13}" cy="19" r="3.5" fill="${ink}" opacity="0.6"/>`
  // A new line is typed out a letter at a time behind a caret, which
  // blinks twice when it is done and goes.
  const tx = bx + 22
  const letters = cols(verbShown) + (subjectShown ? cols(subjectShown) + 3 : 0)
  const typeS = Math.min(0.9, Math.max(0.25, letters * 0.03))
  const steps = Array.from({ length: letters + 1 }, (_, k) => k)
  const stepTimes = steps.map(k => n(k / (letters + 1))).join(';')
  const typing = pops !== '' && letters > 0
  const typed = typing
    ? `<clipPath id="typed"><rect x="${tx - 1}" y="6" height="24" width="${n(letters * 8.3 + 4)}"><animate attributeName="width" values="${steps.map(k => n(k * 8.3 + 1)).join(';')}" keyTimes="${stepTimes}" calcMode="discrete" dur="${typeS}s" fill="freeze"/></rect></clipPath>`
    : ''
  const blinkS = typeS + 1
  const p = typeS / blinkS
  const caret = typing
    ? `<rect x="${tx}" y="12" width="1.6" height="15" rx="0.8" fill="${ink}" opacity="0">` +
      `<animate attributeName="x" values="${steps.map(k => n(tx + k * 8.3)).join(';')}" keyTimes="${stepTimes}" calcMode="discrete" dur="${typeS}s" fill="freeze"/>` +
      `<animate attributeName="opacity" values="1;1;0;1;0;0" keyTimes="0;${n(p)};${n(p + (1 - p) * 0.25)};${n(p + (1 - p) * 0.5)};${n(p + (1 - p) * 0.75)};1" calcMode="discrete" dur="${n(blinkS)}s" fill="freeze"/></rect>`
    : ''
  const title = `<g>${pops}<path class="bub" d="${bubblePath}"/>${dot}${typed}` +
    `<text class="t" x="${tx}" y="24.2" font-size="15" font-weight="650"${typing ? ' clip-path="url(#typed)"' : ''}><tspan fill="${ink}">${esc(verbShown)}</tspan>` +
    (subjectShown ? `<tspan class="faint" font-weight="400"> · </tspan><tspan class="fg">${esc(subjectShown)}</tspan>` : '') + `</text>${caret}</g>`

  const seen = new Set(was.recent.map(r => r.id))
  const line = timeline(info.recent, seen, bx, 49, Math.min(12 * 16, Math.max(0, room - 160)))
  const summary = info.isBusy
    ? [t().st.tools(info.tools), ...(info.agents > 0 ? [t().st.agents(info.agents)] : [])].join(' · ')
    : info.last !== '' ? t().panel.lastTurn(info.last) : info.label
  const sumX = bx + line.width + (line.width > 0 ? 8 : 0)
  const second = line.svg + `<text class="t dim" x="${sumX}" y="53.2" font-size="12">${esc(clip(summary, Math.max(4, Math.floor((end - sumX) / 6.6))))}</text>`

  const git = info.git
  const metaParts = [
    ...(git ? [git.branch, git.changed > 0 ? t().panel.changes(git.changed) : t().panel.clean, ...(git.ahead > 0 ? [`↑${git.ahead}`] : []), ...(git.behind > 0 ? [`↓${git.behind}`] : [])] : []),
    ...(info.cost > 0 ? [`$${info.cost.toFixed(2)}`] : []),
  ]
  const metaX = git ? bx + 14 : bx
  const room3 = end - metaX
  // A push's CI while its runs go, else the branch's pull request, at the right end of the line.
  const ci = ciMark(info.ci, info.pr, end, 73, room3 - 40)
  const third = (git ? BRANCH(bx, 73) : '') +
    `<text class="t faint" x="${metaX}" y="73" font-size="11">${esc(clip(metaParts.join('  ·  '), Math.max(4, Math.floor((room3 - (ci.width > 0 ? ci.width + 14 : 0)) / 6.3))))}</text>` + ci.svg

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">` +
    STYLE + BUBBLE + rtlStyle() + DEFS + sky(clock.hour, stageEnd, H) + show.behind + glow + mascot +
    `<g transform="translate(0 ${n((H - ROW_H) / 2)})">` +
    // The bubble's pop and typing run from when the line changed, so a redraw
    // mid-way picks them up where they were; the rest loops on the clock.
    shiftTimeline(title, since) +
    shiftTimeline(second + third, (now / 1000) % 600) +
    `<path class="rule" d="M${n(sepX)} 14V62"/>` +
    shiftTimeline(rings, since) +
    '</g>' + show.front + '</svg>'
  return { svg, card: { x: sepX, w: W - sepX }, width: W }
}
