import type { Mood, Outfit, Peer } from '../../types'
import { type Look, dressAs } from '../../hooks/level'
import { type PeerNews, appLink, nameOf, peerNews, peerOf, peersLine } from '../../hooks/live'
import { STATUS_INK, type Status, crowdOf, membersOf, moodOf, statusLine } from '../../hooks/party'
import { mascotInner } from '../../hooks/rig'
import { t } from '../../hooks/i18n'

/**
 * What the window shows: one Mochi that stands for every chat. It wears the
 * face of the chat that most needs the person; what else there is to know it
 * says, when it happens, and is not on screen the rest of the time.
 */
export type View = {
  svg: string
  mood: Mood
  /** What Mochi wears, by the look the mod writes; undefined before there is one. */
  outfit: Outfit | undefined
  /** Opens the chat Mochi stands for, in the Claude app; '' when no chat is open or it runs where a link cannot reach. */
  link: string
  /** How things stand in one line, for a press: who needs a look, or else what Mochi is doing. */
  line: string
  peers: readonly Peer[]
}

/** The chats alive now, from the text of their files as the mod wrote them; the first file of a chat wins. */
export function peersOf(texts: readonly string[], now: number): Peer[] {
  const peers = new Map<string, Peer>()
  for (const text of texts) {
    let value: unknown
    try {
      value = JSON.parse(text)
    } catch {
      continue
    }
    const peer = peerOf(value, now)
    if (peer && !peers.has(peer.id)) peers.set(peer.id, peer)
  }
  return [...peers.values()]
}

/** Mochi as it stands now: asleep with no chat open, else as the most pressing one (waiting, failed, working, done, at rest). */
export function viewOf(peers: readonly Peer[], now: number, look: Look | null = null): View {
  const lead = membersOf(crowdOf(peers, now))[0]
  const mood = lead ? moodOf(lead, now) : 'sleeping'
  const outfit = look ? dressAs(look, mood, now) : undefined
  return {
    svg: drawn(mascotInner({ mood, scene: { context: -1, agents: Math.min(3, lead?.peer.agents?.length ?? 0), outfit }, from: null })),
    mood,
    outfit,
    link: appLink(lead?.peer.app),
    line: peersLine(peers) ?? t().mood[mood],
    peers,
  }
}

/** What Mochi has to say about the change from one read to the next: a chat waits, ended a long turn, or failed. */
export const newsOf = (before: readonly Peer[], after: readonly Peer[], now: number): PeerNews[] => peerNews(before, after, now)

/**
 * Mochi's drawing with room around its own square: what it holds, wears on
 * the ground beside it or has floating over it reaches past that square, and
 * the band gives it that room too.
 */
export const ROOM = { left: 26, top: 14, right: 22, bottom: 6 }
/** A soft shadow on the ground under Mochi's feet (at 90 in its square), there to stand on, not to be looked at. */
const SHADOW = '<defs><filter id="mochi-shadow" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="1.8"/></filter></defs>' +
  '<ellipse class="shadow" cx="50" cy="90.5" rx="25" ry="3.4" fill="#000" opacity="0.2" filter="url(#mochi-shadow)"/>'
const drawn = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${ROOM.left} -${ROOM.top} ${100 + ROOM.left + ROOM.right} ${100 + ROOM.top + ROOM.bottom}" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">${SHADOW}<svg x="0" y="0" width="100" height="100" viewBox="0 0 100 100" overflow="visible">${inner}</svg></svg>`

/** One agent in the list: the chat, how it stands in words and ink, the link that opens it, and its subagents. */
export type Row = { id: string; name: string; status: Status; line: string; ink: string; link: string; where: Where; agents: { type: string; task: string }[] }

/** Where a chat runs: the Claude app (a press opens it), Codex, or a terminal or editor, which a press cannot reach. */
export type Where = 'app' | 'codex' | 'terminal'

const whereOf = (p: Peer): Where => (appLink(p.app) ? 'app' : p.id.startsWith('codex:') ? 'codex' : 'terminal')

/** Since when a chat has been at rest: when it came to rest, else when its last turn ended; 0 when it does not say. */
const restingSince = (p: Peer): number => p.stateAt || p.lastTurn?.at || 0

/** Every agent, the most pressing first, as the list beside Mochi shows them. */
export function rowsOf(peers: readonly Peer[], now: number, hideIdleAfterMs = 0): Row[] {
  const isStale = (m: { peer: Peer; status: Status }) =>
    hideIdleAfterMs > 0 && (m.status === 'idle' || m.status === 'quiet') && restingSince(m.peer) > 0 && now - restingSince(m.peer) >= hideIdleAfterMs
  return membersOf(crowdOf(peers, now)).filter(m => !isStale(m)).map(m => ({
    id: m.peer.id,
    name: nameOf(m.peer),
    status: m.status,
    line: statusLine(m),
    ink: STATUS_INK[m.status],
    link: appLink(m.peer.app),
    where: whereOf(m.peer),
    agents: (m.peer.agents ?? []).map(a => ({ type: a.type, task: a.task })),
  }))
}
