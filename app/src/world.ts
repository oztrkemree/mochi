import type { Peer } from '../../types'
import { appLink, peerOf } from '../../hooks/live'
import { type Spot, crowdOf, floorOf, spotAt } from '../../hooks/party'
import { svgFor } from '../../hooks/rig'

/** What the window shows: one drawing, its size in its own units, and where each chat's Mochi stands in it. */
export type View = { svg: string; width: number; height: number; spots: Spot[]; peers: readonly Peer[] }

/** The side of the square a Mochi alone sleeps in. */
export const LONE = 96

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

/** The floor with every chat on it, or one Mochi asleep when no chat is open. */
export function viewOf(peers: readonly Peer[], now: number): View {
  if (peers.length === 0) return { svg: svgFor({ mood: 'sleeping', scene: { context: -1, agents: 0 }, from: null }), width: LONE, height: LONE, spots: [], peers }
  return { ...floorOf(crowdOf(peers, now), now), peers }
}

/** The link that opens the chat whose Mochi stands at `fx` (0 to 1 across the drawing); '' where none does or it cannot be opened. */
export function linkAt(view: View, fx: number): string {
  const id = spotAt(view, fx)
  return appLink(view.peers.find(p => p.id === id)?.app)
}
