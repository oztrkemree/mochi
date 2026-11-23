import type { Ci, DayRec, Inbox, Pull } from '../../types'
import { CI_INK, ciLine, ciOf, ghTrouble, isPushing } from '../../hooks/ci'
import { ago, dayKey, parseGit } from '../../hooks/facts'
import { t } from '../../hooks/i18n'
import { inboxOf, prsText, sorted, statesOf } from '../../hooks/prs'
import { type Commit, type Desk, deskText, standupText } from '../../hooks/standup'

/**
 * The pocket's Today side, from the person's own git and gh, in the mod's
 * own words: the stand-up, what is not yet safe on a remote, the pull
 * requests waiting on them. And the two things said of a chat's folder: the
 * CI of what it pushed, and changes left uncommitted too long.
 */

/** The commits as the app reads them (`repo\tat\tsubject`, at in seconds), with the local day each was made. */
export function commitsOf(lines: readonly string[], tz: number): (Commit & { day: string })[] {
  return lines.flatMap(line => {
    const [repo = '', at = '', ...rest] = line.split('\t')
    const ms = Number(at) * 1000
    return repo === '' || !Number.isFinite(ms) || ms <= 0 ? [] : [{ repo, at: ms, subject: rest.join('\t'), day: dayKey(ms, tz) }]
  })
}

/** Each repository's desk from what git printed: its branch, its changes, the branches with commits no remote has. */
export function desksOf(raw: readonly unknown[]): Desk[] {
  return raw.flatMap(r => {
    const v = (r ?? {}) as { repo?: unknown; status?: unknown; branches?: unknown }
    if (typeof v.repo !== 'string' || typeof v.status !== 'string') return []
    const git = parseGit(v.status, '')
    const branches = Array.isArray(v.branches)
      ? v.branches.flatMap(b => {
          const x = (b ?? {}) as { name?: unknown; ahead?: unknown; hasUpstream?: unknown }
          return typeof x.name === 'string' && typeof x.ahead === 'number' ? [{ name: x.name, ahead: x.ahead, hasUpstream: x.hasUpstream === true }] : []
        })
      : []
    return [{ repo: v.repo, branch: git?.branch ?? '', dirty: git?.changed ?? 0, branches }]
  })
}

export const standupOf = (today: string, days: Record<string, DayRec>, commits: (Commit & { day: string })[]): string => standupText(today, days, commits)
export const deskOf = (desks: Desk[]): string => deskText(desks)

/** What gh said, run by the app: its exit code and output, or null when it could not be run. */
export type Ran = { code: number; stdout: string; stderr: string } | null

/** One pull request in the box: what it is, how it stands, where it opens. */
export type PullRow = { text: string; state: string; url: string }
export type PullBox = { sections: { title: string; rows: PullRow[] }[]; copy: string; note: string }

/** The pull request box from one gh call: the sections the mod shows, or why there is nothing to show. */
export function pullBoxOf(ran: Ran, now: number): PullBox {
  const s = t().prs
  const none = (note: string): PullBox => ({ sections: [], copy: '', note })
  if (ran === null) return none(s.noAnswer)
  if (ran.code !== 0) {
    const why = ghTrouble(ran.code, ran.stderr)
    return none(why === null ? s.noAnswer : s.trouble(t().ci[why]))
  }
  const inbox: Inbox | null = inboxOf(ran.stdout)
  if (inbox === null) return none(s.noAnswer)
  const { review, seen, mine, old } = sorted(inbox, now)
  const row = (p: Pull, state: string): PullRow => ({ text: `${p.repo} #${p.number} ${p.title}`, state, url: p.url })
  const sections = [
    { title: s.review(review.length), rows: review.map(p => row(p, `${p.author} · ${ago(now - p.updatedAt)}`)) },
    { title: s.seen(seen.length), rows: seen.map(p => row(p, `${p.author} · ${ago(now - p.committedAt)}`)) },
    { title: s.mine(mine.length), rows: mine.map(p => row(p, statesOf(p).map(x => s[x]).join(', '))) },
  ].filter(x => x.rows.length > 0)
  return { sections, copy: prsText(inbox, now, true), note: sections.length === 0 ? s.none : old > 0 ? s.old(old, 30) : '' }
}

// ---------- said of a chat's folder ----------

/** How long changes may wait for a commit before Mochi says so, as in the mod. */
export const COMMIT_STALE_MS = 90 * 60_000

/** How a chat's folder stands, as the app reads it (lastCommit in seconds, 0 for none). */
export type FolderState = { root: string; changed: number; lastCommit: number }

/** The nudge to commit when a turn ends: changes there, and no commit for a while; null when there is nothing to say. */
export function nudgeOf(s: FolderState | null, now: number): string | null {
  if (s === null || s.changed === 0) return null
  const last = s.lastCommit * 1000
  if (last > 0 && now - last <= COMMIT_STALE_MS) return null
  return t().st.commitNudge(s.changed, last > 0 ? t().st.lastCommit(ago(now - last)) : t().st.noCommits)
}

/** Whether a chat's call pushed: a shell command that ran and pushed, after which its CI is watched. */
export function pushed(event: { hook_event_name?: unknown; tool_name?: unknown; tool_input?: { command?: unknown } }): boolean {
  const command = event.tool_input?.command
  return event.hook_event_name === 'PostToolUse' && event.tool_name === 'Bash' && typeof command === 'string' && isPushing(command)
}

/** The CI of a pushed commit as gh lists its runs; null while gh cannot say. Done once it passed, failed or was cancelled. */
export function ciNow(ran: { sha?: unknown; out?: Ran } | null, pushedAt: number): Ci | null {
  if (ran === null || typeof ran.sha !== 'string' || !ran.out || ran.out.code !== 0) return null
  return ciOf(ran.out.stdout, ran.sha, pushedAt)
}

export const isOver = (ci: Ci): boolean => ci.state === 'passed' || ci.state === 'failed' || ci.state === 'cancelled'
export const ciSaid = (ci: Ci): { line: string; ink: string } => ({ line: ciLine(ci), ink: CI_INK[ci.state] })
