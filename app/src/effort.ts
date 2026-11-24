import { dayKey, shiftDay } from '../../hooks/facts'

/**
 * Where the work went: every chat's days (days/<id>.json, whoever wrote them) added up by project, day by day, for the
 * room's Work tab and Friday's word on the week. A project is a repository: a chat in one of its worktrees counts
 * toward it. The time is the agents' (a day's turns end to end), not the person's: chats run side by side.
 */

export type Sum = { secs: number; commits: number; add: number; del: number; cost: number; night: number; turns: number }
export type Project = { name: string; folders: string[]; chats: number; daily: Sum[] }
/** `days` oldest first, ending today; each project's `daily` follows them. `unmatched` holds chats with no project. */
export type Effort = { days: string[]; projects: Project[]; unmatched: Project; chats: Chat[] }
type Chat = { label: string; days: Record<string, Sum> }

const FIELDS = ['secs', 'commits', 'add', 'del', 'cost', 'night', 'turns'] as const
const zero = (): Sum => ({ secs: 0, commits: 0, add: 0, del: 0, cost: 0, night: 0, turns: 0 })
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)
const base = (path: string): string => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
/** The repository a folder is in: a worktree under .claude/worktrees is its repository's. */
const repoOf = (path: string): string => base(path.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0]!)
/** A worktree Claude Code named by itself ("fervent-boyd-1df155"): its name says nothing of the repository. */
const AUTO = /^[a-z]+-[a-z]+-[0-9a-f]{6}$/

/**
 * The project of a chat: by its folder when its file says it, else by its label (its folder's name, maybe cut short
 * with "…") against the repositories Mochi saw (repos.json); a label seen nowhere stands as its own project. A chat
 * named by its first words, or in a worktree named by Claude Code, has none.
 */
export function projectOf(label: string, byPrompt: boolean, folder: string, roots: readonly string[]): string | null {
  if (folder) return repoOf(folder) || null
  if (byPrompt || !label) return null
  const isCut = label.endsWith('…')
  const hit = roots.find(r => base(r) === label) ?? (isCut ? roots.find(r => base(r).startsWith(label.slice(0, -1))) : undefined)
  if (hit) return repoOf(hit)
  return isCut || AUTO.test(label) ? null : label
}

const add = (into: Sum, rec: Partial<Record<keyof Sum, unknown>>) => {
  for (const f of FIELDS) into[f] += count(rec[f])
}

/** Every chat's days, from the text of their files, added up by project over the `span` days that end `today`. */
export function effortOf(files: readonly string[], roots: readonly string[], today: string, span = 42): Effort {
  const days = Array.from({ length: span }, (_, i) => shiftDay(today, i - span + 1))
  const at = new Map(days.map((d, i) => [d, i]))
  const byName = new Map<string, Project & { seen: Set<string> }>()
  const nobody = { name: '', folders: [], chats: 0, daily: days.map(zero), seen: new Set<string>() }
  const chats: Chat[] = []
  for (const text of files) {
    let v: { label?: unknown; isLabelFromPrompt?: unknown; folder?: unknown; days?: unknown }
    try {
      v = JSON.parse(text) as typeof v
    } catch {
      continue // caught half-written: counted next time
    }
    if (typeof v !== 'object' || v === null || typeof v.days !== 'object' || v.days === null || Array.isArray(v.days)) continue
    const label = typeof v.label === 'string' ? v.label : ''
    const name = projectOf(label, v.isLabelFromPrompt === true, typeof v.folder === 'string' ? v.folder : '', roots)
    const p = name === null ? nobody : byName.get(name) ?? { name, folders: [], chats: 0, daily: days.map(zero), seen: new Set<string>() }
    if (name !== null) byName.set(name, p)
    const mine: Chat = { label, days: {} }
    let isHere = false
    for (const [day, rec] of Object.entries(v.days as Record<string, unknown>)) {
      const i = at.get(day)
      if (i === undefined || typeof rec !== 'object' || rec === null) continue
      add(p.daily[i]!, rec)
      add((mine.days[day] = zero()), rec)
      isHere = true
    }
    if (!isHere) continue
    p.chats++
    if (label && label !== name && !p.seen.has(label)) {
      p.seen.add(label)
      p.folders.push(label)
    }
    chats.push(mine)
  }
  const total = (p: Project) => p.daily.reduce((s, d) => s + d.secs, 0)
  const strip = ({ seen: _, ...p }: Project & { seen: Set<string> }): Project => p
  const projects = [...byName.values()].filter(p => p.chats > 0).sort((a, b) => total(b) - total(a)).map(strip)
  return { days, projects, unmatched: strip(nobody), chats }
}

/** A project's days from the `from`th to the last, added into one. */
export function sumOf(daily: readonly Sum[], from: number): Sum {
  const s = zero()
  for (const d of daily.slice(from)) add(s, d)
  return s
}

/** The busiest day from the `from`th on: its chats in lanes by folder (longest first), the longest chat, and all of them together. */
export function peakOf(e: Effort, from: number): { day: string; total: number; longest: number; lanes: { label: string; chats: number[] }[] } | null {
  const all = [...e.projects, e.unmatched]
  let best = -1
  let total = 0
  for (let i = from; i < e.days.length; i++) {
    const t = all.reduce((s, p) => s + p.daily[i]!.secs, 0)
    if (t > total) [best, total] = [i, t]
  }
  if (best < 0) return null
  const day = e.days[best]!
  const lanes = new Map<string, number[]>()
  for (const c of e.chats) {
    const secs = c.days[day]?.secs ?? 0
    if (secs > 0) lanes.set(c.label, [...(lanes.get(c.label) ?? []), secs])
  }
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
  return {
    day, total,
    longest: Math.max(...[...lanes.values()].flat()),
    lanes: [...lanes].map(([label, chats]) => ({ label, chats: chats.sort((a, b) => b - a) })).sort((a, b) => sum(b.chats) - sum(a.chats)),
  }
}

/** The project with the most time in the last seven days, when it had half an hour or more: something worth saying. */
export function weekTop(e: Effort): { name: string; secs: number } | null {
  const from = Math.max(0, e.days.length - 7)
  const top = e.projects.map(p => ({ name: p.name, secs: sumOf(p.daily, from).secs })).sort((a, b) => b.secs - a.secs)[0]
  return top && top.secs >= 1800 ? top : null
}

/** Friday's word on the week is due from 18:00 local time that Friday, once: the day it is due for, or null. */
export function weekDue(now: number, tz: number, lastSaid: string | null): string | null {
  const local = new Date(now + tz * 60_000)
  if (local.getUTCDay() !== 5 || local.getUTCHours() < 18) return null
  const day = dayKey(now, tz)
  return day === lastSaid ? null : day
}
