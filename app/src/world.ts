import type { Mood, Peer } from '../../types'
import { appLink, peerNews, peerOf, peersLine } from '../../hooks/live'
import { crowdOf, membersOf, moodOf } from '../../hooks/party'
import { svgFor } from '../../hooks/rig'
import { t } from '../../hooks/i18n'

/**
 * What the window shows: one Mochi that stands for every chat. It wears the
 * face of the chat that most needs the person; what else there is to know it
 * says, when it happens, and is not on screen the rest of the time.
 */
export type View = {
  svg: string
  mood: Mood
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
export function viewOf(peers: readonly Peer[], now: number): View {
  const lead = membersOf(crowdOf(peers, now))[0]
  const mood = lead ? moodOf(lead, now) : 'sleeping'
  return {
    svg: svgFor({ mood, scene: { context: -1, agents: Math.min(3, lead?.peer.agents?.length ?? 0) }, from: null }),
    mood,
    link: appLink(lead?.peer.app),
    line: peersLine(peers) ?? t().mood[mood],
    peers,
  }
}

/** What Mochi has to say about the change from one read to the next: a chat waits, ended a long turn, or failed. */
export const newsOf = (before: readonly Peer[], after: readonly Peer[], now: number): string[] => peerNews(before, after, now).map(n => n.line)
