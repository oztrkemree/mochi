import type { Peer } from '../types'
import { t } from './i18n'
import { duration } from './react'
import { clip, cols } from './text'

// The other chats: each Mochi writes a small file of where its chat stands,
// and reads the others'. A file not refreshed for a while is a closed chat.

/** A chat older than this is gone. */
export const ALIVE_MS = 45_000

/**
 * A short name for a chat: its folder, or its first words when the folder says
 * nothing (a home folder, a drive, a scratch or temporary one).
 */
export function peerLabel(root: string, firstPrompt: string): string {
  const folder = root.split(/[\\/]/).filter(Boolean).pop() ?? ''
  const isBlank = folder === '' || /^scratch-|^tmp$|^Temp$|^private$/.test(folder) || /^(\/Users|\/home|[A-Za-z]:[\\/]Users)[\\/][^\\/]+[\\/]?$|^[A-Za-z]:[\\/]?$/i.test(root)
  if (!isBlank) return clip(folder, 22)
  // Whole words, as many of the first four as fit.
  let words = ''
  for (const w of firstPrompt.replace(/\s+/g, ' ').trim().split(' ').slice(0, 4)) {
    const next = words === '' ? w : `${words} ${w}`
    if (cols(next) > 22) break
    words = next
  }
  if (words === '') return clip(firstPrompt.trim(), 22)
  return words
}

/** A peer file's content, if it is one and still alive. */
export function peerOf(value: unknown, now: number): Peer | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Partial<Peer>
  if (typeof v.id !== 'string' || typeof v.at !== 'number' || now - v.at > ALIVE_MS) return null
  const state = v.state === 'busy' || v.state === 'asking' || v.state === 'error' ? v.state : 'idle'
  return {
    id: v.id, label: typeof v.label === 'string' && v.label !== '' ? v.label : t().word.chat, state, line: typeof v.line === 'string' ? v.line : '', since: typeof v.since === 'number' ? v.since : 0, at: v.at,
    folder: typeof v.folder === 'string' ? v.folder : '', branch: typeof v.branch === 'string' ? v.branch : '', isWorktree: v.isWorktree === true, stateAt: typeof v.stateAt === 'number' ? v.stateAt : 0,
  }
}

/** A change among the other chats worth saying: one waits on the person, finished a long turn, or failed. */
export type PeerNews = { kind: 'asking' | 'done' | 'failed'; line: string }

/** What changed among the other chats that is worth saying. */
export function peerNews(before: readonly Peer[], after: readonly Peer[], now: number): PeerNews[] {
  const out: PeerNews[] = []
  for (const p of after) {
    const was = before.find(b => b.id === p.id)
    if (was === undefined) continue
    if (p.state === 'asking' && was.state !== 'asking') out.push({ kind: 'asking', line: t().peer.waiting(p.label) })
    if (was.state === 'busy' && p.state === 'idle' && was.since > 0 && now - was.since >= 60_000) out.push({ kind: 'done', line: t().peer.done(p.label, duration((now - was.since) / 1000)) })
    if (p.state === 'error' && was.state !== 'error') out.push({ kind: 'failed', line: t().peer.failed(p.label) })
  }
  return out
}

export const PEER_INK: Record<Peer['state'], string> = { busy: '#7AA2F7', asking: '#F2C14E', idle: '#77706A', error: '#F0645A' }
export const peerState = (state: Peer['state']): string => t().peer.state[state]

/** One line about the other chats for the panel, or null when none needs a look. */
export function peersLine(peers: readonly Peer[]): string | null {
  const asking = peers.filter(p => p.state === 'asking')
  const busy = peers.filter(p => p.state === 'busy')
  const error = peers.filter(p => p.state === 'error')
  const d = t().peer
  if (asking.length > 0) return d.asking(asking[0]?.label ?? '', asking.length - 1)
  if (error.length > 0) return d.error(error[0]?.label ?? '')
  if (busy.length === 1) return d.busyOne(busy[0]?.label ?? '')
  if (busy.length > 1) return d.busyMany(busy.length)
  return null
}
