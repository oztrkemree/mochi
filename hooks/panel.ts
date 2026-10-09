import type { Info, Limit, Mood, Panel, Recent } from '../types'
import { clockAt } from './facts'
import { DEFS, STYLE, ring, usageInk } from './gauge'
import { t } from './i18n'
import { PEER_INK, peersLine } from './live'
import { clip, cols } from './text'
import type { Arc } from './gauge'
import { mascotInner, shiftTimeline } from './rig'

// The desktop band as one drawing: the mascot on a lit stage, three lines of
// what is happening, and three ring gauges (context, the 5-hour session, the
// week). One SVG keeps everything aligned whatever the band's own layout
// does, and an <img> of it keeps the painted parts an interactive frame would strip.

export const PANEL_H = 76

/** Which family a tool belongs to, for the strip's icon and colour. */
export function toolKind(tool: string): Recent['kind'] {
  if (tool === 'Read' || tool === 'NotebookRead' || tool === 'Skill') return 'read'
  if (tool === 'Grep' || tool === 'Glob' || tool === 'LS' || tool === 'ToolSearch') return 'search'
  if (/^(Edit|MultiEdit|Write|NotebookEdit|TodoWrite|TaskCreate|TaskUpdate|Artifact)$/.test(tool)) return 'edit'
  if (tool === 'Bash' || tool === 'BashOutput' || tool === 'Monitor') return 'bash'
  if (tool === 'WebFetch' || tool === 'WebSearch' || /Browser|chrome/i.test(tool)) return 'web'
  if (tool === 'Agent' || tool === 'Task') return 'agent'
  if (tool === 'AskUserQuestion' || tool === 'ExitPlanMode') return 'ask'
  return 'other'
}

export const KIND_INK: Record<Recent['kind'], string> = {
  read: '#7AA2F7', search: '#7DCFFF', edit: '#B794F6', bash: '#F07CB8', web: '#73DACA', agent: '#9ECE6A', ask: '#F2C14E', other: '#9D958F',
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
  error: '#F0707A', dizzy: '#F0707A', scared: '#F2C14E', denied: '#9A918B', shocked: '#F2C14E',
  nervous: '#F2C14E', pleased: '#E08A6A', tired: '#9A918B', sleepy: '#9A918B', sleeping: '#9A918B', squeezed: '#5FB3A8',
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
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

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
    tz: info?.tz ?? 0,
    peers: info?.peers ?? [],
  }
}

type Gauge = { key: string; label: string; sub: string; subInk?: string; arcs: Arc[]; was: Arc[]; center: string; mark?: number; halo?: string }

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
    sub: ctx.window > 0 ? `${tokens(ctx.tokens)}/${tokens(ctx.window)}` : '—',
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
    out.push({
      key: kind,
      label: limitName(kind),
      sub: full !== undefined ? t().panel.fullAt(clockAt(full, now, info.tz ?? 0)) : l && l.resetsAt > now ? `↻ ${until(l.resetsAt - now)}` : '—',
      ...(full !== undefined ? { subInk: full - now < 30 * 60_000 ? '#F0645A' : '#F2B84B' } : {}),
      arcs: l ? [{ key: 'u', value: Math.min(100, l.percent), color: usageInk(l.percent) }] : [],
      was: before ? [{ key: 'u', value: Math.min(100, before.percent), color: usageInk(before.percent) }] : [],
      center: l ? `${Math.round(l.percent)}%` : '—',
      ...(l && l.percent >= 80 ? { halo: '#F0645A' } : {}),
    })
  }
  return out
}

/** The last tool calls as a row of small squares: new ones arrive, a running one breathes, a failed one is red. */
function timeline(recent: Recent[], seen: Set<number>, x: number, cy: number, room: number): { svg: string; width: number } {
  const step = 12
  const list = recent.slice(-Math.max(0, Math.floor(room / step)))
  const svg = list.map((r, i) => {
    const px = x + i * step
    const fill = r.state === 'fail' ? '#F0645A' : KIND_INK[r.kind]
    const breathe = r.state === 'run' ? '<animate attributeName="opacity" values="1;0.35;1" dur="1s" repeatCount="indefinite"/>' : ''
    const sq = `<rect x="${px}" y="${cy - 4.5}" width="9" height="9" rx="2.6" fill="${fill}" fill-opacity="${r.state === 'run' ? 1 : 0.8}">${breathe}</rect>`
    if (seen.has(r.id)) return sq
    return `<g><animate attributeName="opacity" values="0;1" dur="0.35s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="6 0;0 0" dur="0.35s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.35 0 0.15 1"/>${sq}</g>`
  }).join('')
  return { svg, width: list.length * step }
}

const BRANCH = (x: number, y: number) =>
  `<g transform="translate(${n(x)} ${n(y)})" stroke="#A59D96" stroke-width="1.3" fill="none" stroke-linecap="round"><circle cx="2" cy="-7" r="1.6"/><circle cx="2" cy="1" r="1.6"/><circle cx="8" cy="-5" r="1.6"/><path d="M2 -5.4V-0.6M8 -3.4C8 -1 2 -2 2 -0.6"/></g>`

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
  const colW = 84
  const list = gauges(info, was, now)
  const gX = W - colW * list.length
  const sepX = gX - 8
  const rings = list.map((g, i) => {
    const cx = gX + colW * i + colW / 2
    return ring({ id: g.key, cx, cy: 28.5, r: 16.5, width: 4.6, arcs: g.arcs, was: g.was, center: esc(g.center), centerSize: 11.5,
      ...(g.mark !== undefined ? { mark: g.mark } : {}), ...(g.halo ? { halo: g.halo, markColor: g.halo } : {}) }) +
      `<text class="t ${g.halo ? '' : 'dim'}" x="${n(cx)}" y="61" font-size="10.5" font-weight="${g.halo ? 650 : 500}" text-anchor="middle"${g.halo ? ` fill="${g.halo}"` : ''}>${esc(g.label)}</text>` +
      `<text class="t${g.subInk ? '' : ' faint'}" x="${n(cx)}" y="72.5" font-size="10" text-anchor="middle" font-variant-numeric="tabular-nums"${g.subInk ? ` fill="${g.subInk}" font-weight="600"` : ''}>${esc(g.sub)}</text>`
  }).join('')

  // ---- the mascot on its stage ----
  const glow = info.isBusy
    ? `<circle cx="38" cy="42" r="27" fill="${ink}" opacity="0.3" filter="url(#haze)"><animate attributeName="opacity" values="0.18;0.38;0.18" dur="2.4s" repeatCount="indefinite"/></circle>`
    : `<circle cx="38" cy="42" r="27" fill="${ink}" opacity="0.2" filter="url(#haze)"/>`
  const mascot = `<svg x="0" y="0" width="${H}" height="${H}" viewBox="0 0 100 100" overflow="visible">${mascotInner(shot, Math.max(0, now - shot.at))}</svg>`

  // ---- three lines of what is happening ----
  const x0 = 86
  const room = sepX - x0 - 12
  const [verb = '', ...rest] = info.detail.split(' · ')
  const subject = rest.join(' · ')
  const titleRoom = Math.max(6, Math.floor((room - 14) / 8.1))
  const verbShown = clip(verb, titleRoom)
  const subjectShown = subject ? clip(subject, Math.max(4, titleRoom - cols(verbShown) - 3)) : ''
  const dot = info.isBusy
    ? `<circle cx="${x0 + 3.5}" cy="21.5" r="3.5" fill="${ink}"><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite"/></circle>`
    : `<circle cx="${x0 + 3.5}" cy="21.5" r="3.5" fill="${ink}" opacity="0.6"/>`
  const title = `<text class="t" x="${x0 + 13}" y="26.5" font-size="15" font-weight="650"><tspan fill="${ink}">${esc(verbShown)}</tspan>` +
    (subjectShown ? `<tspan class="faint" font-weight="400"> · </tspan><tspan class="fg">${esc(subjectShown)}</tspan>` : '') + '</text>'

  const seen = new Set(was.recent.map(r => r.id))
  const line = timeline(info.recent, seen, x0, 43, Math.min(14 * 12, Math.max(0, room - 150)))
  const summary = info.isBusy
    ? [t().st.tools(info.tools), ...(info.agents > 0 ? [t().st.agents(info.agents)] : [])].join(' · ')
    : info.last !== '' ? t().panel.lastTurn(info.last) : info.label
  const sumX = x0 + line.width + (line.width > 0 ? 6 : 0)
  const second = line.svg + `<text class="t dim" x="${sumX}" y="47" font-size="11.5">${esc(clip(summary, Math.max(4, Math.floor((sepX - sumX - 12) / 6.6))))}</text>`

  const git = info.git
  const metaParts = [
    ...(git ? [git.branch, git.changed > 0 ? t().panel.changes(git.changed) : t().panel.clean, ...(git.ahead > 0 ? [`↑${git.ahead}`] : []), ...(git.behind > 0 ? [`↓${git.behind}`] : [])] : []),
    ...(info.cost > 0 ? [`$${info.cost.toFixed(2)}`] : []),
  ]
  const metaX = git ? x0 + 14 : x0
  // The other chats, right-aligned on the same line, when one needs a look.
  const others = peersLine(info.peers ?? [])
  const lead = (info.peers ?? []).find(p => p.state === 'asking') ?? (info.peers ?? []).find(p => p.state === 'error') ?? (info.peers ?? []).find(p => p.state === 'busy')
  const room3 = sepX - metaX - 12
  const peerText = others ? clip(others, Math.max(4, Math.floor((room3 * 0.55 - 12) / 6))) : ''
  const peerW = others ? cols(peerText) * 6 + 12 : 0
  const peerSvg = others && lead
    ? `<circle cx="${n(sepX - 12 - peerW + 3.5)}" cy="63.2" r="3" fill="${PEER_INK[lead.state]}">${lead.state === 'asking' ? '<animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>' : ''}</circle>` +
      `<text class="t" x="${n(sepX - 12 - peerW + 11)}" y="67" font-size="11" fill="${lead.state === 'busy' ? '#A59D96' : PEER_INK[lead.state]}">${esc(peerText)}</text>`
    : ''
  const third = (git ? BRANCH(x0, 67) : '') +
    `<text class="t faint" x="${metaX}" y="67" font-size="11">${esc(clip(metaParts.join('  ·  '), Math.max(4, Math.floor((room3 - (peerW > 0 ? peerW + 14 : 0)) / 6.3))))}</text>` + peerSvg

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">` +
    STYLE + DEFS + glow + mascot +
    shiftTimeline(dot + title + second + third, (now / 1000) % 600) +
    `<path class="rule" d="M${n(sepX)} 14V62"/>` +
    shiftTimeline(rings, since) +
    '</svg>'
  return { svg, card: { x: sepX, w: W - sepX }, width: W }
}
