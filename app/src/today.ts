import type { Ci } from '../../types'
import { CI_INK, ciLine, ciOf, isPushing } from '../../hooks/ci'
import { ago } from '../../hooks/facts'
import { t } from '../../hooks/i18n'

/**
 * What Mochi says of a chat's folder, in the mod's own words: the CI of what
 * it pushed, and changes left uncommitted too long.
 */

/** What gh said, run by the app: its exit code and output, or null when it could not be run. */
export type Ran = { code: number; stdout: string; stderr: string } | null

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

/** How long a CI is watched at most, and how long with no run to show (no workflow, or the folder on another commit by now). */
export const CI_MOST_MS = 30 * 60_000
export const CI_SILENT_MS = 2 * 60_000

/** What to do after a look at a pushed commit's CI: say how it ended, stop watching, or look again. */
export function ciStep(ci: Ci | null, waited: number): 'say' | 'stop' | 'again' {
  if (ci && isOver(ci)) return 'say'
  if (waited > CI_MOST_MS || ((ci === null || ci.state === 'waiting') && waited > CI_SILENT_MS)) return 'stop'
  return 'again'
}

export const isOver = (ci: Ci): boolean => ci.state === 'passed' || ci.state === 'failed' || ci.state === 'cancelled'
export const ciSaid = (ci: Ci): { line: string; ink: string } => ({ line: ciLine(ci), ink: CI_INK[ci.state] })
