import type { Activity, Crew, Mood, Peer } from '../types'
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
  // Whole words, as many of the first four as fit; a note Claude Code put in the prompt (<system-reminder>…) is no word of the person's.
  const said = firstPrompt.replace(/<([a-z][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<\/?[a-z][\w-]*\b[^>]*>/gi, ' ')
  let words = ''
  for (const w of said.replace(/\s+/g, ' ').trim().split(' ').slice(0, 4)) {
    const next = words === '' ? w : `${words} ${w}`
    if (cols(next) > 22) break
    words = next
  }
  if (words === '') return clip(said.trim(), 22)
  return words
}

/** What a chat is called on the board and in news: its title in the app, else its short name. */
export const nameOf = (p: Pick<Peer, 'label' | 'title'>): string => p.title || p.label

/** A session of the desktop app, as Claude Code names it in its own files and the app's links take it. */
const APP_SESSION = /^local_[A-Za-z0-9-]{1,64}$/

/**
 * What Claude Code's file of a running session (~/.claude/sessions/<pid>.json)
 * says of it: its id, its name in the app, and its session in the desktop app.
 * The file is Claude Code's own and not a promise: anything else reads as nothing.
 */
export function appSessionOf(value: unknown): { id: string; name: string; app: string } | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as { sessionId?: unknown; name?: unknown; hostSessionId?: unknown; entrypoint?: unknown }
  if (typeof v.sessionId !== 'string' || v.sessionId === '') return null
  const app = v.entrypoint === 'claude-desktop' && typeof v.hostSessionId === 'string' && APP_SESSION.test(v.hostSessionId) ? v.hostSessionId : ''
  return { id: v.sessionId, name: oneLine(v.name, 60), app }
}

/** The desktop app's link that opens one of its sessions, or '' for one it cannot. */
export const appLink = (app: string | undefined): string => (app && APP_SESSION.test(app) ? `claude://code/continue?session=${app}` : '')

/** A chat's subagents in its file: at most this many. */
export const CREW_MAX = 8

const ACTIVITIES: readonly Activity[] = ['thinking', 'talking', 'reading', 'searching', 'writing', 'running', 'testing', 'web', 'agent', 'waiting']
const isActivity = (v: unknown): v is Activity => typeof v === 'string' && (ACTIVITIES as readonly string[]).includes(v)

/** What a face's mood says an agent is doing: a test is "nervous", a command that cannot be undone still "running"; '' for a mood that is no work. */
export function activityOf(mood: Mood): Activity | '' {
  if (mood === 'nervous') return 'testing'
  if (mood === 'scared') return 'running'
  return isActivity(mood) ? mood : ''
}

const oneLine = (v: unknown, max: number): string => (typeof v === 'string' ? clip(v.replace(/\s+/g, ' ').trim(), max) : '')

/** A subagent as a peer file lists it, if it is one. */
function crewOf(value: unknown): Crew | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Partial<Crew>
  if (typeof v.id !== 'string' || v.id === '') return null
  return { id: v.id.slice(0, 80), type: oneLine(v.type, 40), task: oneLine(v.task, 40), activity: isActivity(v.activity) ? v.activity : 'thinking', since: typeof v.since === 'number' ? v.since : 0 }
}

/** A peer file's content, if it is one and still alive. What another chat wrote is checked field by field, and its words cut short. */
export function peerOf(value: unknown, now: number): Peer | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Partial<Peer>
  if (typeof v.id !== 'string' || typeof v.at !== 'number' || now - v.at > ALIVE_MS) return null
  const state = v.state === 'busy' || v.state === 'asking' || v.state === 'error' ? v.state : 'idle'
  const peer: Peer = {
    id: v.id, label: typeof v.label === 'string' && v.label !== '' ? v.label : t().word.chat, state, line: typeof v.line === 'string' ? v.line : '', since: typeof v.since === 'number' ? v.since : 0, at: v.at,
    folder: typeof v.folder === 'string' ? v.folder : '', branch: typeof v.branch === 'string' ? v.branch : '', isWorktree: v.isWorktree === true, stateAt: typeof v.stateAt === 'number' ? v.stateAt : 0,
    title: oneLine(v.title, 60),
  }
  if (v.v !== 2) return peer
  const turn = v.lastTurn
  const limit = v.limit
  return {
    ...peer,
    v: 2,
    activity: isActivity(v.activity) ? v.activity : '',
    waitingFor: v.waitingFor === 'permission' || v.waitingFor === 'question' || v.waitingFor === 'plan' ? v.waitingFor : '',
    lastTurn: typeof turn === 'object' && turn !== null && typeof turn.at === 'number' && typeof turn.seconds === 'number'
      ? { at: turn.at, reason: oneLine(turn.reason, 20), seconds: turn.seconds }
      : null,
    agents: Array.isArray(v.agents) ? v.agents.map(crewOf).filter((c): c is Crew => c !== null).slice(0, CREW_MAX) : [],
    context: typeof v.context === 'number' && v.context >= 0 ? Math.min(100, v.context) : -1,
    cost: typeof v.cost === 'number' && v.cost >= 0 ? v.cost : 0,
    limit: typeof limit === 'object' && limit !== null && typeof limit.kind === 'string' && typeof limit.resetsAt === 'number' ? { kind: oneLine(limit.kind, 20), resetsAt: limit.resetsAt } : null,
    app: typeof v.app === 'string' && APP_SESSION.test(v.app) ? v.app : '',
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
    if (p.state === 'asking' && was.state !== 'asking') out.push({ kind: 'asking', line: t().peer.waiting(nameOf(p)) })
    if (was.state === 'busy' && p.state === 'idle' && was.since > 0 && now - was.since >= 60_000) out.push({ kind: 'done', line: t().peer.done(nameOf(p), duration((now - was.since) / 1000)) })
    if (p.state === 'error' && was.state !== 'error') out.push({ kind: 'failed', line: t().peer.failed(nameOf(p)) })
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
  if (asking.length > 0) return d.asking(asking[0] ? nameOf(asking[0]) : '', asking.length - 1)
  if (error.length > 0) return d.error(error[0] ? nameOf(error[0]) : '')
  if (busy.length === 1) return d.busyOne(busy[0] ? nameOf(busy[0]) : '')
  if (busy.length > 1) return d.busyMany(busy.length)
  return null
}
