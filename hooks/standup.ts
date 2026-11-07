import type { DayRec } from '../types'
import { shiftDay } from './facts'
import { lang, t } from './i18n'
import { duration } from './react'

// The Work group: /mochi standup (the last day worked and today, as a note
// to paste where the team keeps its stand-up), /mochi week (the last seven
// days) and /mochi desk (work not yet safe on a remote). The commits and the
// repositories come from every repository Mochi has seen in any chat lately,
// the turns, time and lines from its own history.

/** One commit, from `git log`: the repository's folder name, when, and its first line. */
export type Commit = { repo: string; at: number; subject: string }

/** At most this many commits a repository shows each day; the rest are a count. */
const SHOWN = 5
/** How far back the last day worked is looked for. */
export const LOOK_BACK_DAYS = 7

/** The day before `today` with any work in it, within a week; yesterday when there is none. */
export function lastWorked(today: string, days: Record<string, DayRec>, commitDays: Set<string>): string {
  for (let i = 1; i <= LOOK_BACK_DAYS; i++) {
    const key = shiftDay(today, -i)
    if (commitDays.has(key) || (days[key]?.turns ?? 0) > 0) return key
  }
  return shiftDay(today, -1)
}

/** Yesterday as "yesterday"; an earlier day by its weekday's name in the language in use. */
function dayName(key: string, today: string): string {
  if (key === shiftDay(today, -1)) return t().standup.yesterday
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  try {
    const name = new Intl.DateTimeFormat(lang(), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
    return name.charAt(0).toLocaleUpperCase(lang()) + name.slice(1)
  } catch {
    return key
  }
}

/** One day's part: its commits by repository, most first, then the turns, time and lines of that day. */
function dayPart(title: string, commits: Commit[], rec: DayRec | undefined): string[] {
  const s = t().standup
  const byRepo = new Map<string, Commit[]>()
  for (const c of [...commits].sort((a, b) => b.at - a.at)) byRepo.set(c.repo, [...(byRepo.get(c.repo) ?? []), c])
  const repos = [...byRepo.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const lines = [title]
  if (repos.length === 0) lines.push(`• ${s.noCommits}`)
  for (const [repo, list] of repos) {
    lines.push(`• ${repo}: ${s.commits(list.length)}`)
    for (const c of list.slice(0, SHOWN)) lines.push(`  – ${c.subject}`)
    if (list.length > SHOWN) lines.push(`  – ${s.more(list.length - SHOWN)}`)
  }
  if (rec && rec.turns > 0) lines.push(`  ${s.stats(rec.turns, duration(rec.secs), rec.add, rec.del)}`)
  return lines
}

/** The stand-up note: the last day worked, then today, each with its commits and its numbers. */
export function standupText(today: string, days: Record<string, DayRec>, commits: (Commit & { day: string })[]): string {
  const before = lastWorked(today, days, new Set(commits.map(c => c.day)))
  return [
    ...dayPart(dayName(before, today), commits.filter(c => c.day === before), days[before]),
    '',
    ...dayPart(t().standup.today, commits.filter(c => c.day === today), days[today]),
  ].join('\n')
}

// ---------- the week ----------

/** A day as "3 Nov" in the language in use, or as written when the language has no calendar names. */
function shortDate(key: string): string {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(lang(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
  } catch {
    return key
  }
}

/** The last seven days with today: commits by repository, most first, and the week's turns, time, lines and days worked. */
export function weekText(today: string, days: Record<string, DayRec>, commits: (Commit & { day: string })[]): string {
  const s = t().standup
  const keys = Array.from({ length: 7 }, (_, i) => shiftDay(today, i - 6))
  const inWeek = commits.filter(c => keys.includes(c.day))
  const recs = keys.map(k => days[k]).filter((r): r is DayRec => r !== undefined)
  const sum = (pick: (r: DayRec) => number) => recs.reduce((total, r) => total + pick(r), 0)
  const worked = keys.filter(k => (days[k]?.turns ?? 0) > 0 || inWeek.some(c => c.day === k)).length
  const lines = dayPart(s.week(shortDate(keys[0]!), shortDate(today)), inWeek, undefined)
  lines.push('', s.weekTotals(inWeek.length, worked, sum(r => r.turns), duration(sum(r => r.secs)), sum(r => r.add), sum(r => r.del)))
  return lines.join('\n')
}

// ---------- what is left on the desk ----------

/** A repository as git sees it now: changes not committed on the branch checked out, and each branch's commits no remote has. */
export type Desk = { repo: string; branch: string; dirty: number; branches: { name: string; ahead: number; hasUpstream: boolean }[] }

/** At most this many branches a repository lists; the rest are a count. */
const BRANCHES_SHOWN = 6

/** Work not yet safe on a remote, by repository: uncommitted changes, unpushed commits, branches never pushed; then those with nothing left. */
export function deskText(desks: Desk[]): string {
  const s = t().standup
  const lines: string[] = []
  const clean: string[] = []
  for (const d of [...desks].sort((a, b) => a.repo.localeCompare(b.repo))) {
    const items: string[] = []
    if (d.dirty > 0) items.push(`  • ${s.uncommitted(d.dirty, d.branch)}`)
    const left = d.branches.filter(b => b.ahead > 0).sort((a, b) => b.ahead - a.ahead)
    for (const b of left.slice(0, BRANCHES_SHOWN)) items.push(`  • ${b.hasUpstream ? s.unpushed(b.name, b.ahead) : s.neverPushed(b.name, b.ahead)}`)
    if (left.length > BRANCHES_SHOWN) items.push(`  • ${s.more(left.length - BRANCHES_SHOWN)}`)
    if (items.length === 0) clean.push(d.repo)
    else lines.push(d.repo, ...items)
  }
  if (lines.length === 0) return s.allClean
  if (clean.length > 0) lines.push('', s.clean(clean.join(', ')))
  return lines.join('\n')
}
