import type { Env, Limit, Peer } from '../types'
import type { Card } from './detail'
import { age } from './facts'
import { t } from './i18n'
import { PEER_INK, peerState } from './live'
import { clip, cols } from './text'

// Several chats and the usage windows they share: the board of every chat on
// the machine, a nearly used-up window that resets, a wait on the person that
// goes on. What reads files or tells the person lives in register.tsx.

/** A window used this far or more is worth a word when it resets. */
export const NEARLY_FULL = 90
/** A chat that has waited on the person this long gets one more notification. */
export const WAIT_LONG_MS = 5 * 60_000
/** The windows whose reset is told: the 5-hour session and the week. */
const TOLD = ['five_hour', 'seven_day']

/** The nearly used-up windows whose reset fell after the last look and by now; none on the first look. */
export function resetsPassed(limits: readonly Limit[], before: number, now: number): Limit[] {
  if (before <= 0) return []
  return limits.filter(l => TOLD.includes(l.kind) && l.percent >= NEARLY_FULL && l.resetsAt > before && l.resetsAt <= now)
}

/**
 * Who holds one reset in its marker file: this chat, another, or nobody yet
 * (no file, an older reset's, or one caught mid-write).
 */
export function claimOf(text: string | null, at: number, id: string): 'mine' | 'theirs' | 'free' {
  try {
    const v = JSON.parse(text ?? '') as { at?: unknown; id?: unknown }
    if (v.at !== at || typeof v.id !== 'string') return 'free'
    return v.id === id ? 'mine' : 'theirs'
  } catch {
    return 'free'
  }
}

/** Whether a chat has waited on the person long enough for its one more notification; `told` is the wait already told of. */
export function isWaitLong(p: Pick<Peer, 'state' | 'stateAt'>, told: number, now: number): boolean {
  const at = p.stateAt ?? 0
  return p.state === 'asking' && at > 0 && at !== told && now - at >= WAIT_LONG_MS
}

/** Whether `git rev-parse --git-dir --git-common-dir` printed a linked worktree's: its own folder under the shared one's `worktrees/`. */
export function isLinkedWorktree(out: string): boolean {
  const [dir = '', common = ''] = out.trim().split(/\r?\n/).map(s => s.trim().replaceAll('\\', '/'))
  return common !== '' && dir.startsWith(`${common}/worktrees/`)
}

const RANK: Record<Peer['state'], number> = { asking: 0, error: 1, busy: 2, idle: 3 }

/** Every chat for the board: this one first, then those waiting on the person (the longest wait first), failed, working, idle. */
export function boardOf(me: Peer | undefined, peers: readonly Peer[]): Peer[] {
  const others = peers.filter(p => p.id !== me?.id).sort((a, b) =>
    RANK[a.state] - RANK[b.state] || (a.state === 'asking' ? (a.stateAt ?? 0) - (b.stateAt ?? 0) : 0) || a.label.localeCompare(b.label))
  return me ? [me, ...others] : others
}

/** Since when a chat stands where it does: a working one since its turn began. */
const sinceOf = (p: Peer): number => (p.state === 'busy' && p.since > 0 ? p.since : p.stateAt ?? 0)

const branchOf = (p: Peer): string => (p.branch ? (p.isWorktree ? t().chats.worktree(p.branch) : p.branch) : '')

/** One chat in words: name, branch, state, what it does or waits for (an idle one does nothing), for how long. */
function parts(p: Peer, isMe: boolean, now: number): string[] {
  const from = sinceOf(p)
  return [
    isMe ? `${p.label} (${t().chats.here})` : p.label,
    branchOf(p),
    peerState(p.state),
    p.state === 'idle' ? '' : p.line,
    from > 0 ? age(now - from) : '',
  ].filter(s => s !== '')
}

/** The board as text: a heading, then a line per chat. */
export function boardLines(me: Peer | undefined, peers: readonly Peer[], now: number): string[] {
  const all = boardOf(me, peers)
  return [t().chats.heading(all.length), ...all.map((p, i) => `  ${p.state === 'idle' ? '○' : '●'} ${parts(p, i === 0 && me !== undefined, now).join(' · ')}`)]
}

const n = (v: number) => String(Math.round(v * 100) / 100)
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** The details pane's card of every chat, when there are others: a row each, as on the board. */
export function chatsCard(env: Env, now: number): Card | null {
  const peers = env.peers ?? []
  if (peers.length === 0) return null
  const all = boardOf(env.me, peers)
  const asking = all.filter(p => p.state === 'asking').length
  const d = t().chats
  return {
    title: d.title, right: `${t().detail.open(all.length)}${asking > 0 ? ` · ${d.waiting(asking)}` : ''}`, content: 16 + (all.length - 1) * 22,
    body: (x, y, w) => all.map((p, i) => {
      const cy = y + 8 + i * 22
      const ink = PEER_INK[p.state]
      const isIdle = p.state === 'idle'
      const pulse = p.state === 'asking' || p.state === 'busy'
        ? `<animate attributeName="opacity" values="1;0.35;1" dur="${p.state === 'asking' ? 1.2 : 2}s" repeatCount="indefinite"/>`
        : ''
      // Name, branch (on a wide card), then the state and what it does, and for how long at the right.
      const nameW = Math.min(160, w * 0.24)
      const branchW = w >= 480 ? Math.min(140, w * 0.18) : 0
      const chars = Math.floor(nameW / 7)
      // This chat is marked where the name has room for it; a narrow card only keeps it first.
      const name = i === 0 && env.me !== undefined && chars - cols(d.here) - 1 >= 4
        ? `${esc(clip(p.label, chars - cols(d.here) - 1))}<tspan class="faint" font-weight="400" dx="6">${esc(d.here)}</tspan>`
        : esc(clip(p.label, chars))
      const room = Math.floor((w - 16 - nameW - branchW - 44) / 6.3)
      const state = clip(peerState(p.state), room)
      const rest = room - cols(state) - 3
      const from = sinceOf(p)
      const span = from > 0 ? age(now - from) : ''
      return `<circle cx="${x + 4}" cy="${cy}" r="4" fill="${ink}">${pulse}</circle>` +
        `<text class="t fg" x="${x + 16}" y="${cy + 4}" font-size="12" font-weight="600">${name}</text>` +
        (branchW > 0 && branchOf(p) ? `<text class="t faint" x="${n(x + 16 + nameW)}" y="${cy + 4}" font-size="11">${esc(clip(branchOf(p), Math.floor((branchW - 8) / 6.4)))}</text>` : '') +
        `<text class="t" x="${n(x + 16 + nameW + branchW)}" y="${cy + 4}" font-size="11.5"><tspan ${isIdle ? 'class="faint"' : `fill="${ink}"`}>${esc(state)}</tspan>` +
        (!isIdle && p.line !== '' && rest > 6 ? `<tspan class="faint" font-size="11"> · ${esc(clip(p.line, rest))}</tspan>` : '') + '</text>' +
        (span ? `<text class="t${p.state === 'asking' ? '' : ' faint'}" x="${n(x + w)}" y="${cy + 4}" font-size="10.5" text-anchor="end"${p.state === 'asking' ? ` fill="${ink}"` : ''}>${esc(span)}</text>` : '')
    }).join(''),
  }
}
