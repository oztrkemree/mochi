import type { Activity, Mood, Outfit, Peer } from '../types'
import { age } from './facts'
import { STYLE } from './gauge'
import { t } from './i18n'
import { ALIVE_MS, nameOf } from './live'
import { mascotInner } from './rig'
import { clip, cols, rtlStyle } from './text'

// The party: every chat on the machine as a small Mochi on one shared floor, its
// subagents beside it, in three places: the doorstep (those that need the person),
// the workshop (those at work, or just done) and the nap corner (the rest).
// Only what a chat's own file says is shown; a file gone quiet is "unknown",
// never "idle", since a chat that stopped writing may still wait on the person.

/** Where a chat stands, most pressing first. */
export type Status = 'asking' | 'error' | 'limit' | 'busy' | 'done' | 'idle' | 'quiet'

/** Where on the floor a chat stands: by the door when it needs the person, at the bench at work, in the corner at rest. */
export type Zone = 'door' | 'shop' | 'nap'

/** A turn that ended well this recently, the person not back since, still shows as done. */
export const DONE_FOR_MS = 10 * 60_000
/** At most this many Mochis move at once; the rest stand still. Those waiting on the person always move. */
export const MOVING_MAX = 6

const RANK: Record<Status, number> = { asking: 0, error: 1, limit: 2, busy: 3, done: 4, idle: 5, quiet: 6 }

/** Where a chat stands, from its file alone; `now - at` past ALIVE_MS is quiet whatever it last said. */
export function statusOf(p: Peer, now: number): Status {
  if (now - p.at > ALIVE_MS) return 'quiet'
  if (p.state === 'asking') return 'asking'
  if (p.state === 'error') return 'error'
  if (p.state === 'busy') return 'busy'
  // An idle chat held by a used-up window says so: the person cannot go on there until it resets.
  if (p.limit && p.limit.resetsAt > now) return 'limit'
  if (p.lastTurn && p.lastTurn.reason === 'answer' && now - p.lastTurn.at < DONE_FOR_MS) return 'done'
  return 'idle'
}

export const zoneOf = (s: Status): Zone => (s === 'asking' || s === 'error' || s === 'limit' ? 'door' : s === 'busy' || s === 'done' ? 'shop' : 'nap')

/** Most pressing first: the longest wait, then failures, used-up windows, work, fresh results, rest and silence. */
function before(a: Member, b: Member): number {
  if (a.status !== b.status) return RANK[a.status] - RANK[b.status]
  const at = (m: Member) => (m.status === 'done' ? -(m.peer.lastTurn?.at ?? 0) : m.peer.stateAt || m.peer.at)
  return at(a) - at(b) || nameOf(a.peer).localeCompare(nameOf(b.peer))
}

export type Member = { peer: Peer; status: Status; isSelf: boolean; isMoving: boolean }

/** The party: each place's chats, most pressing first; `isShown` false for this chat alone with no subagents. */
export type Party = { isShown: boolean; door: Member[]; shop: Member[]; nap: Member[]; waiting: number }

/** The party seen from this chat: `self` is its own file as it would write it, `peers` the others' as read. */
export function partyOf(self: Peer, peers: readonly Peer[], now: number): Party {
  const all = [{ peer: self, isSelf: true }, ...peers.filter(p => p.id !== self.id).map(peer => ({ peer, isSelf: false }))]
    .map(({ peer, isSelf }) => ({ peer, isSelf, status: isSelf ? statusOf({ ...peer, at: now }, now) : statusOf(peer, now), isMoving: false }))
    .sort(before)
  const isShown = all.length > 1 || (self.agents?.length ?? 0) > 0
  // The moving ones go by the same order: the waiting first, so they always move. Those at rest stand still.
  let moving = 0
  for (const m of all) {
    if (zoneOf(m.status) === 'nap' || m.status === 'done' || (moving >= MOVING_MAX && m.status !== 'asking')) continue
    m.isMoving = true
    moving += 1
  }
  return {
    isShown,
    door: all.filter(m => zoneOf(m.status) === 'door'),
    shop: all.filter(m => zoneOf(m.status) === 'shop'),
    nap: all.filter(m => zoneOf(m.status) === 'nap'),
    waiting: all.filter(m => m.status === 'asking').length,
  }
}

/** Every member, in the order the floor shows them. */
export const membersOf = (party: Party): Member[] => [...party.door, ...party.shop, ...party.nap]

// ---------- the drawing ----------

/** The ink of each status, as the board's dots. */
export const STATUS_INK: Record<Status, string> = { asking: '#F2C14E', error: '#F0645A', limit: '#C08BE8', busy: '#7AA2F7', done: '#4CC38A', idle: '#77706A', quiet: '#77706A' }

/** An idle chat dozes off after this long, as Mochi itself does. */
const SLEEPS_AFTER_MS = 8 * 60_000

const ACTIVITY_MOOD: Record<Activity, Mood> = {
  thinking: 'thinking', talking: 'talking', reading: 'reading', searching: 'searching', writing: 'writing',
  running: 'running', testing: 'nervous', web: 'web', agent: 'agent', waiting: 'waiting',
}

/** The mood a chat's Mochi shows: its status, and while busy what its main loop does. */
export function moodOf(m: Pick<Member, 'peer' | 'status'>, now: number): Mood {
  switch (m.status) {
    case 'asking': return 'asking'
    case 'error': return 'error'
    case 'limit': return 'tired'
    case 'busy': return m.peer.activity ? ACTIVITY_MOOD[m.peer.activity] : 'thinking'
    case 'done': return 'proud'
    case 'quiet': return 'idle'
    case 'idle': return (m.peer.stateAt ?? 0) > 0 && now - (m.peer.stateAt ?? 0) >= SLEEPS_AFTER_MS ? 'sleeping' : 'idle'
  }
}

/** What a status is called; working says what it does, waiting what for. */
export function statusLine(m: Pick<Member, 'peer' | 'status'>): string {
  const d = t()
  const p = m.peer
  if (m.status === 'busy' && p.activity) return activityName(p.activity)
  if (m.status === 'asking' && p.waitingFor) return p.waitingFor === 'permission' ? d.st.awaitingApproval : p.waitingFor === 'question' ? d.st.waitingAnswer : d.st.waitingPlan
  return statusName(m.status)
}

export const statusName = (s: Status): string => {
  const d = t()
  switch (s) {
    case 'asking': case 'busy': case 'idle': case 'error': return d.peer.state[s]
    case 'limit': return d.party.limit
    case 'done': return d.st.done
    case 'quiet': return d.party.quiet
  }
}

export const activityName = (a: Activity): string => {
  const d = t()
  switch (a) {
    case 'thinking': return d.st.thinking
    case 'talking': return d.st.talking
    case 'reading': return d.st.reading
    case 'searching': return d.st.searching
    case 'writing': return d.st.editing
    case 'running': return d.st.running
    case 'testing': return d.st.test
    case 'web': return d.party.web
    case 'agent': return d.st.agent
    case 'waiting': return d.st.running
  }
}

const n = (v: number) => String(Math.round(v * 100) / 100)
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** A Mochi that stands still: its loops taken out, what eases it into its pose kept. */
export const stillOf = (svg: string): string => svg.replace(/<(animate|animateTransform)\b[^>]*repeatCount="indefinite"[^>]*\/>/g, '')

/**
 * Every picture in the drawing defined once and used where it was: the rig
 * embeds each part as a data URI, and one Mochi would carry the same
 * body twice and each foot and arm twice.
 */
export function shareArt(body: string): { defs: string; body: string } {
  const ids = new Map<string, string>()
  const used = body.replace(/<image href="(data:[^"]+)"([^>]*?)\/>/g, (_, uri: string, rest: string) => {
    let id = ids.get(uri)
    if (id === undefined) {
      id = `art${ids.size}`
      ids.set(uri, id)
    }
    return `<use href="#${id}"${rest}/>`
  })
  const defs = [...ids].map(([uri, id]) => `<symbol id="${id}" viewBox="0 0 1 1" preserveAspectRatio="none"><image href="${uri}" width="1" height="1" preserveAspectRatio="none"/></symbol>`).join('')
  return { defs, body: used }
}


// ---------- the floor ----------

/** How many of each place's chats get a Mochi; the rest are a "+N". */
export const SHOWN: Record<Zone, number> = { door: 4, shop: 6, nap: 7 }
/** A Mochi's size in each place, and the room each takes (a name under it, but in the nap corner). */
const SIZE: Record<Zone, number> = { door: 86, shop: 68, nap: 42 }
const SLOT: Record<Zone, number> = { door: 140, shop: 128, nap: 30 }
const PAD = 16
const MORE_W = 46
const TOP = 30
/** A name's lines under its Mochi (a chat's name is how it is found: as much of it as there is room for), and about how wide a character of it is at 11px. */
const NAME_LINES = 3
const CHAR_W = 5.7

/** A place on the floor a press can land on, from `x0` to `x1` of the floor's width; `key` the chat's id, '' for none. */
export type Spot = { key: string; x0: number; x1: number }

/** The floor drawn: the SVG, its size in its own units, and where each Mochi stands for a press. */
export type Floor = { svg: string; width: number; height: number; spots: Spot[] }

/** A name broken into whole words over at most `lines` lines of `max` columns; what does not fit ends in "…". */
export function nameLines(name: string, max: number, lines = NAME_LINES): string[] {
  const out: string[] = []
  let line = ''
  const words = name.replace(/\s+/g, ' ').trim().split(' ')
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? ''
    const next = line === '' ? w : `${line} ${w}`
    if (cols(next) <= max) {
      line = next
      continue
    }
    if (out.length === lines - 1) return [...out, clip(next, max).endsWith('…') ? clip(next, max) : `${clip(next, max - 1)}…`]
    if (line !== '') out.push(line)
    line = w
    // A word longer than a line is cut there.
    if (cols(line) > max) {
      if (out.length === lines - 1) return [...out, clip(line, max)]
      out.push(clip(line, max))
      line = ''
    }
  }
  if (line !== '') out.push(line)
  return out.slice(0, lines)
}

/** The press at `fx` (0 to 1 across the floor as drawn) lands on this chat, or none. */
export function spotAt(floor: Pick<Floor, 'width' | 'spots'>, fx: number): string {
  const x = fx * floor.width
  return floor.spots.find(s => x >= s.x0 && x < s.x1)?.key ?? ''
}

/** What a Mochi wears in a mood: the person's own outfit, as the band's Mochi wears it; nothing when none is given. */
export type Dress = (mood: Mood) => Outfit | undefined

/** One Mochi on the floor, its feet at `base`: the rig in its mood and the person's outfit, still unless it moves; a mark on the floor says its state at a glance. */
function standing(m: Member, cx: number, base: number, size: number, now: number, isPicked: boolean, dress: Dress): string {
  const mood = moodOf(m, now)
  let mascot = mascotInner({ mood, scene: { context: -1, agents: Math.min(3, m.peer.agents?.length ?? 0), outfit: dress(mood) }, from: null })
  if (!m.isMoving) mascot = stillOf(mascot)
  const ink = STATUS_INK[m.status]
  const glow = m.status === 'asking'
    ? `<ellipse cx="${n(cx)}" cy="${n(base - 1)}" rx="${n(size * 0.42)}" ry="${n(size * 0.08)}" fill="${ink}" opacity="0.3"><animate attributeName="opacity" values="0.15;0.42;0.15" dur="1.4s" repeatCount="indefinite"/></ellipse>`
    : m.status === 'error' || m.status === 'limit' || m.status === 'busy'
      ? `<ellipse cx="${n(cx)}" cy="${n(base - 1)}" rx="${n(size * 0.36)}" ry="${n(size * 0.065)}" fill="${ink}" opacity="${m.status === 'busy' ? 0.18 : 0.26}"/>`
      : ''
  const ring = isPicked ? `<ellipse cx="${n(cx)}" cy="${n(base - 1)}" rx="${n(size * 0.48)}" ry="${n(size * 0.1)}" fill="none" stroke="#E08A6A" stroke-width="2"/>` : ''
  const extra = (m.peer.agents?.length ?? 0) > 3 ? `<text class="t faint" x="${n(cx + size * 0.55)}" y="${n(base - size * 0.08)}" font-size="10" text-anchor="end">+${(m.peer.agents?.length ?? 0) - 3}</text>` : ''
  const unknown = m.status === 'quiet' ? `<text class="t dim" x="${n(cx + size * 0.2)}" y="${n(base - size * 0.62)}" font-size="${n(size * 0.26)}" font-weight="700">?</text>` : ''
  const body = `<svg x="${n(cx - size / 2)}" y="${n(base - size * 0.9)}" width="${size}" height="${size}" viewBox="0 0 100 100" overflow="visible">${mascot}</svg>`
  return glow + ring + (m.status === 'quiet' ? `<g opacity="0.35">${body}</g>` : body) + extra + unknown
}

/** A "+N" for those a place has no room for. */
const moreSvg = (cx: number, cy: number, k: number) =>
  `<circle cx="${n(cx)}" cy="${n(cy)}" r="15" class="trackf"/><text class="t fg" x="${n(cx)}" y="${n(cy + 4)}" font-size="12" font-weight="650" text-anchor="middle">+${k}</text>`

/**
 * The floor: the doorstep, the workshop and the nap corner side by side, each
 * as wide as what stands in it, a place with nobody left out. Bigger at the
 * door, smaller at rest; a name under each but in the corner, where a count is.
 */
export function floorOf(party: Party, now: number, picked = '', dress: Dress = () => undefined): Floor {
  const d = t().party
  const zones = (['door', 'shop', 'nap'] as const).filter(z => party[z].length > 0)
  const tallest = Math.max(...zones.map(z => SIZE[z]), SIZE.nap)
  const floorY = TOP + Math.round(tallest * 0.92)
  const hasNames = zones.some(z => z !== 'nap')
  const height = floorY + (hasNames ? 14 + NAME_LINES * 13 : 26)
  let x = 0
  let art = ''
  let marks = ''
  const spots: Spot[] = []
  for (const z of zones) {
    const all = party[z]
    const shown = all.slice(0, SHOWN[z])
    const more = all.length - shown.length
    const w = z === 'nap'
      ? Math.max(170, PAD * 2 + shown.length * SLOT.nap + 40 + (more > 0 ? MORE_W : 0))
      : PAD * 2 + shown.length * SLOT[z] + (more > 0 ? MORE_W : 0)
    const title = z === 'door' ? d.door : z === 'shop' ? d.shop : d.nap
    marks += `<text class="t faint" x="${n(x + PAD)}" y="19" font-size="10" font-weight="650" letter-spacing="1.1">${esc(title.toLocaleUpperCase())}</text>`
    // The place itself: a warm mat by the door, a bench, a cushion.
    if (z === 'door') marks += `<rect x="${n(x + 10)}" y="${n(floorY - 6)}" width="${n(w - 20)}" height="12" rx="6" fill="${STATUS_INK.asking}" opacity="0.09"/>`
    if (z === 'shop') marks += `<rect x="${n(x + 10)}" y="${n(floorY - SIZE.shop * 0.5)}" width="${n(w - 20)}" height="6" rx="3" fill="#5A4636"/>` +
      `<rect x="${n(x + 18)}" y="${n(floorY - SIZE.shop * 0.5 + 6)}" width="4" height="${n(SIZE.shop * 0.5 - 6)}" fill="#4A3A2E"/><rect x="${n(x + w - 22)}" y="${n(floorY - SIZE.shop * 0.5 + 6)}" width="4" height="${n(SIZE.shop * 0.5 - 6)}" fill="#4A3A2E"/>`
    if (z === 'nap') marks += `<ellipse cx="${n(x + w / 2)}" cy="${n(floorY + 3)}" rx="${n(w / 2 - 18)}" ry="13" fill="#3B3230"/>`
    if (z === 'nap') {
      const span = shown.length * SLOT.nap
      const left = x + w / 2 - span / 2 - (more > 0 ? MORE_W / 2 : 0)
      shown.forEach((m, i) => {
        const cx = left + SLOT.nap * (i + 0.5)
        art += standing(m, cx, floorY + 4 + (i % 2) * 4, SIZE.nap, now, m.peer.id === picked, dress)
        spots.push({ key: m.peer.id, x0: cx - SLOT.nap / 2, x1: cx + SLOT.nap / 2 })
      })
      if (more > 0) marks += moreSvg(left + span + MORE_W / 2, floorY - 12, more)
      marks += `<text class="t faint" x="${n(x + w / 2)}" y="${n(floorY + 30)}" font-size="10.5" text-anchor="middle">${esc(`${all.length} ${statusName('idle')}`)}</text>`
    } else {
      const max = Math.floor((SLOT[z] - 8) / CHAR_W)
      shown.forEach((m, i) => {
        const cx = x + PAD + SLOT[z] * (i + 0.5)
        art += standing(m, cx, floorY, SIZE[z], now, m.peer.id === picked, dress)
        const name = `${m.isSelf ? '• ' : ''}${nameOf(m.peer)}`
        marks += nameLines(name, max).map((line, k) =>
          `<text class="t ${z === 'door' ? 'fg' : 'dim'}" x="${n(cx)}" y="${n(floorY + 18 + k * 13)}" font-size="11" font-weight="${z === 'door' ? 650 : 550}" text-anchor="middle">${esc(line)}</text>`).join('')
        spots.push({ key: m.peer.id, x0: cx - SLOT[z] / 2, x1: cx + SLOT[z] / 2 })
      })
      if (more > 0) marks += moreSvg(x + PAD + shown.length * SLOT[z] + MORE_W / 2, floorY - SIZE[z] * 0.45, more)
    }
    x += w
  }
  const width = Math.max(1, Math.round(x))
  const ground = `<rect x="0" y="0" width="${width}" height="${height}" rx="14" class="trackf"/>` +
    `<path d="M10 ${floorY} H${width - 10}" stroke="#fff" stroke-opacity="0.08" stroke-width="1.5"/>`
  const { defs, body } = shareArt(art)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMinYMin meet">${STYLE}${rtlStyle()}<defs>${defs}</defs>${ground}${marks}${body}</svg>`
  return { svg, width, height, spots }
}

/** The picked chat in lines: where it works, where it stands and since when, what it does, its subagents, its context and cost. */
export function memberLines(m: Member, now: number): string[] {
  const d = t()
  const p = m.peer
  const since = m.status === 'busy' && p.since > 0 ? p.since : p.stateAt ?? 0
  const where = [p.folder || (p.title ? p.label : ''), p.branch ? (p.isWorktree ? d.chats.worktree(p.branch) : p.branch) : ''].filter(s => s !== '').join(' · ')
  // What it does or waits for in its own words ("editing · rig.ts"), which say more than its status alone.
  const doing = (m.status === 'busy' || m.status === 'asking') && p.line !== '' ? p.line : statusLine(m)
  const lines = [
    where,
    [doing, since > 0 ? age(now - since) : ''].filter(s => s !== '').join(' · '),
    m.status === 'limit' && p.limit ? d.party.resetsIn(age(p.limit.resetsAt - now)) : '',
    p.lastTurn && m.status !== 'busy' ? d.party.lastTurn(age(now - p.lastTurn.at)) : '',
    [p.context !== undefined && p.context >= 0 ? `${d.party.context} ${p.context}%` : '', p.v === 2 ? `${d.party.cost} $${(p.cost ?? 0).toFixed(2)}` : ''].filter(s => s !== '').join(' · '),
  ]
  const agents = p.agents ?? []
  if (agents.length > 0) {
    lines.push(d.st.agents(agents.length))
    for (const a of agents) lines.push(`  ${[a.type, a.task, activityName(a.activity), a.since > 0 ? age(now - a.since) : ''].filter(s => s !== '').join(' · ')}`)
    lines.push(d.party.agentTokens)
  }
  if (p.v !== 2) lines.push(d.party.older)
  return lines.filter(s => s !== '').map(s => (cols(s) > 120 ? clip(s, 120) : s))
}
