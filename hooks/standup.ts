import type { DayRec } from '../types'
import { shiftDay } from './facts'
import { lang, t } from './i18n'
import { duration } from './react'

// /mochi standup: the last day worked and today, as a note to paste where
// the team keeps its stand-up. The commits come from every repository Mochi
// has seen in any chat lately, the turns, time and lines from its own history.

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
