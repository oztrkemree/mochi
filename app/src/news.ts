import type { Peer } from '../../types'
import { type PeerNews, appLink, peerNews } from '../../hooks/live'

/**
 * What Mochi has to say, one thing at a time. News of several chats at once
 * waits its turn, the most pressing first, so the bubble never grows into a list.
 */

/** Something to say about one chat, and the link that opens that chat ('' when a press cannot). */
export type News = { id: string; kind: PeerNews['kind'] | 'limit' | 'back' | 'level' | 'nudge'; line: string; link: string }

/** What is said first: a chat waiting on the person, then one that failed, a limit running out, a chat that finished, a new level or badge, a limit that is back, changes left uncommitted. */
const RANK: Record<News['kind'], number> = { asking: 0, failed: 1, limit: 2, done: 3, level: 4, back: 5, nudge: 6 }

/** What changed among the chats that is worth saying, chat by chat: one waits, ended a long turn, or failed. */
export function newsOf(before: readonly Peer[], after: readonly Peer[], now: number): News[] {
  return after.flatMap(p => {
    const was = before.find(b => b.id === p.id)
    return was === undefined ? [] : peerNews([was], [p], now).map(n => ({ ...n, id: p.id, link: appLink(p.app) }))
  })
}

/** Whether `a` is said before `b`. */
export const isMorePressing = (a: News, b: News): boolean => RANK[a.kind] < RANK[b.kind]

/** What waits to be said after more news came: a chat's newer word takes the place of its older, the most pressing goes first, the rest in the order they came. */
export function queued(queue: readonly News[], fresh: readonly News[]): News[] {
  const kept = queue.filter(q => !fresh.some(f => f.id === q.id))
  return [...kept, ...fresh].map((news, at) => ({ news, at })).sort((a, b) => RANK[a.news.kind] - RANK[b.news.kind] || a.at - b.at).map(x => x.news)
}

/** Whether news still holds: a chat that waited and was answered in its own window, or is gone, has nothing left to ask. */
export const stillHolds = (news: News, peers: readonly Peer[]): boolean => news.kind !== 'asking' || peers.some(p => p.id === news.id && p.state === 'asking')

/** News without what only looks like it: a chat taken as stopped because it went silent rests now, which is no turn that finished. */
export const withoutStalled = (news: readonly News[], stalled: ReadonlySet<string>): News[] => news.filter(n => !(n.kind === 'done' && stalled.has(n.id)))
