import type { Act, Mood, Outfit, Params, Peer, Scene } from '../../types'
import { type Look, dressAs } from '../../hooks/level'
import { appLink, nameOf, peerOf, peersLine } from '../../hooks/live'
import { STATUS_INK, type Status, crowdOf, membersOf, moodOf, statusLine } from '../../hooks/party'
import { layersFor, mascotInner, paramsAt } from '../../hooks/rig'
import { isDuo } from './acts'
import { t } from '../../hooks/i18n'

/**
 * What the window shows: one Mochi that stands for every chat. It wears the
 * face of the chat that most needs the person; what else there is to know it
 * says, when it happens, and is not on screen the rest of the time.
 */
export type View = {
  /** The drawing as it comes to the screen: eased in from what was there. */
  svg: string
  /** The same pose with nothing to ease in from: what Mochi goes back to when it moves again, and what it holds still in (see `stillOf`). */
  rest: string
  /** The same pose held, in layers that keep moving by themselves at next to no cost: what Mochi shows between moves (see `layersFor`). */
  alive: string
  /** A mood, or a moment Mochi plays (a pat, a chat's turn done, Claude Code and Codex at work together). */
  mood: Mood | Act
  /** What Mochi wears, by the look the mod writes; undefined before there is one. */
  outfit: Outfit | undefined
  /** Opens the chat Mochi stands for, in the Claude app; '' when no chat is open or it runs where a link cannot reach. */
  link: string
  /** How things stand in one line, for a press: who needs a look, or else what Mochi is doing. */
  line: string
  peers: readonly Peer[]
  /** What is drawn besides the mood, when this drawing took the screen, and what it was eased in from: the next change starts from where this one stands. */
  scene: Scene
  at: number
  from: Params | null
}

/** What changes Mochi beyond the chats: the drawing on screen now, a mood held for a moment, a limit nearly gone. */
export type Now = { was?: View | null; held?: Mood | Act | null; isTired?: boolean; skin?: string }

/** The chats alive now that another Mochi writes, from the text of their files; the first file of a chat wins. */
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

const isMood = (m: Mood | Act): m is Mood => Object.hasOwn(t().mood, m)

/** The moods that are Mochi with nothing to do: a limit nearly gone shows on these, and never over a chat that works or waits. */
const AT_EASE: readonly Mood[] = ['idle', 'sleeping', 'sleepy', 'proud']

/**
 * Mochi as it stands now: asleep with no chat open, else as the most pressing
 * one (waiting, failed, working, done, at rest). A change of mood is eased in
 * from the drawing on screen; with no change that drawing is kept as it is.
 */
export function viewOf(peers: readonly Peer[], now: number, look: Look | null = null, { was = null, held = null, isTired = false, skin }: Now = {}): View {
  const lead = membersOf(crowdOf(peers, now))[0]
  const calm = lead ? moodOf(lead, now) : 'sleeping'
  // Claude Code and Codex both at work, with the lead chat working: a ball in the air for each.
  const working: Mood | Act = lead?.status === 'busy' && isDuo(peers) ? 'juggle' : calm
  // A moment is held over anything but a chat that waits on the person or failed: that is Mochi's face then.
  const isPressing = calm === 'asking' || calm === 'error' || calm === 'denied'
  const mood = (isPressing ? null : held) ?? (isTired && AT_EASE.includes(calm) ? 'tired' : working)
  const outfit = look ? dressAs(look, mood, now) : undefined
  const scene: Scene = { context: -1, agents: Math.min(3, lead?.peer.agents?.length ?? 0), outfit, ...(skin ? { skin } : {}) }
  // A moment is never said: the line is what the chats make Mochi.
  const said = { link: appLink(lead?.peer.app), line: peersLine(peers) ?? t().mood[isMood(mood) ? mood : calm], peers }
  if (was && was.mood === mood && JSON.stringify(was.scene) === JSON.stringify(scene)) return { ...was, ...said }
  const from = was ? { params: paramsAt(was.from, was.mood, now - was.at), mood: was.mood, scene: was.scene } : null
  const rest = drawn(mascotInner({ mood, scene, from: null }))
  const alive = layersFor({ mood, scene }, ROOM, SHADOW)
  return { svg: from ? drawn(mascotInner({ mood, scene, from })) : rest, rest, alive, mood, outfit, scene, at: now, from: from?.params ?? null, ...said }
}

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
export type Row = { id: string; name: string; status: Status; line: string; ink: string; link: string; where: Where; agents: { type: string; task: string }[]; plan: string }

/** Where a chat runs: the Claude app (a press opens it), Codex, or a terminal or editor, which a press cannot reach. */
export type Where = 'app' | 'codex' | 'terminal'

const whereOf = (p: Peer): Where => (appLink(p.app) ? 'app' : p.id.startsWith('codex-') ? 'codex' : 'terminal')

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
    // How far its plan is: "2/4 · Writing the tests".
    plan: m.peer.plan ? `${m.peer.plan.done}/${m.peer.plan.total}${m.peer.plan.now ? ` · ${m.peer.plan.now}` : ''}` : '',
  }))
}

/** The count at Mochi's feet: how many chats are in the list, in the ink of the most pressing; null with none. */
export function badgeOf(rows: readonly Row[]): { count: number; ink: string; isAsking: boolean } | null {
  const lead = rows[0]
  return lead ? { count: rows.length, ink: lead.ink, isAsking: lead.status === 'asking' } : null
}

/** How far Mochi's eyes turn, in the units of its drawing: all the way for a pointer this many points off or more. */
const GAZE_REACH = 1.7
const GAZE_FULL_AT = 160

/** Where Mochi's eyes turn for a pointer, both in the window's points: toward it, further the further off it is, up to their reach, and less up and down than across. */
export function gazeOf(face: { x: number; y: number }, pointer: { x: number; y: number }): { dx: number; dy: number } {
  const x = pointer.x - face.x
  const y = pointer.y - face.y
  const far = Math.hypot(x, y)
  if (far < 1) return { dx: 0, dy: 0 }
  const reach = Math.min(1, far / GAZE_FULL_AT) * GAZE_REACH
  const round = (v: number) => Math.round(v * 100) / 100 + 0
  return { dx: round((x / far) * reach), dy: round((y / far) * reach * 0.8) }
}

/**
 * A drawing with its motion taken out: every part where it rests. The drawing's
 * own motion redraws all of Mochi sixty times a second for as long as it runs,
 * and a drawing told to pause goes on being redrawn; one with no motion in it
 * costs nothing. Mochi holds still in this between the moments it moves.
 */
export const stillOf = (svg: string): string => svg.replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g, '')
