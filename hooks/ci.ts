import type { Ci, Env, Pr } from '../types'
import type { Card } from './detail'
import { ago } from './facts'
import { t } from './i18n'
import { duration } from './react'
import { clip, cols } from './text'

// CI after a push: what the person's own gh says about the pushed commit's
// workflow runs and the branch's open pull request, read into plain values.
// Mochi asks gh at the start, when the details pane opens, and after a push
// in this chat (every half minute while its runs go); gh makes the network
// calls, on the person's own login.

/** What `gh run list` and `gh pr view` are asked for. */
export const RUN_FIELDS = 'status,conclusion,name,workflowName,event,createdAt,updatedAt'
export const PR_FIELDS = 'number,title,state,reviewDecision,statusCheckRollup'

/** A push that sends commits: not a dry run, not a deletion. */
export function isPushing(cmd: string): boolean {
  const m = /\bgit\s+push\b([^;&|]*)/i.exec(cmd)
  return m !== null && !/\s(--dry-run|-n|--delete|-d)(?=\s|$)/.test(m[1] ?? '')
}

/** Why gh stays silent: not installed, not signed in, or the folder is not a GitHub repository. */
export type GhTrouble = 'missing' | 'auth' | 'notGithub'

/** What a failed gh call says about gh itself; null when the trouble is elsewhere (no pull request, the network). */
export function ghTrouble(exitCode: number, stderr: string): GhTrouble | null {
  // Checked first: gh suggests `gh auth login` here too.
  if (/none of the git remotes|no git remotes|not a git repository/i.test(stderr)) return 'notGithub'
  if (exitCode === 4 || /gh auth login|not logged in/i.test(stderr)) return 'auth'
  return null
}

const parse = (json: string): unknown => {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

const at = (v: unknown): number => (typeof v === 'string' ? Date.parse(v) || 0 : 0)

/** Conclusions that are not a failure; a cancelled run is neither. */
const FINE = new Set(['success', 'skipped', 'neutral'])

type Run = { status: string; conclusion?: unknown; name?: unknown; workflowName?: unknown; event?: unknown; createdAt?: unknown; updatedAt?: unknown }

/** Runs created this long before the push still count, for a clock a little off GitHub's. */
const SKEW_MS = 60_000
/** The events a push starts runs on: a commit on the default branch also collects runs for issues, schedules and the like. */
const PUSH_EVENTS = new Set(['push', 'pull_request', 'pull_request_target'])

/**
 * `gh run list --json` for one commit, read into where the CI of its push
 * stands; null when the output is not that. Runs from an earlier push of the
 * same commit (one that was already up to date) do not count.
 */
export function ciOf(json: string, sha: string, pushedAt: number): Ci | null {
  const list = parse(json)
  if (!Array.isArray(list)) return null
  const isRun = (r: unknown): r is Run => typeof r === 'object' && r !== null && typeof (r as Run).status === 'string'
  const runs = list.filter(isRun).filter(r => (r.event === undefined || PUSH_EVENTS.has(String(r.event))) && at(r.createdAt) >= pushedAt - SKEW_MS)
  const done = runs.filter(r => r.status === 'completed')
  const failed = done.filter(r => r.conclusion !== 'cancelled' && !FINE.has(String(r.conclusion)))
  const name = (r: Run) => (typeof r.workflowName === 'string' && r.workflowName !== '' ? r.workflowName : typeof r.name === 'string' ? r.name : '')
  const state: Ci['state'] = runs.length === 0 ? 'waiting'
    : done.length < runs.length ? 'running'
    : failed.length > 0 ? 'failed'
    : done.some(r => r.conclusion === 'cancelled') ? 'cancelled'
    : 'passed'
  const isOver = state !== 'waiting' && state !== 'running'
  return {
    sha, pushedAt, state, total: runs.length, done: done.length,
    failed: [...new Set(failed.map(name).filter(Boolean))],
    startedAt: runs.length > 0 ? Math.min(...runs.map(r => at(r.createdAt))) : 0,
    endedAt: isOver ? Math.max(...runs.map(r => at(r.updatedAt))) : 0,
  }
}

const REVIEW: Record<string, Pr['review']> = { APPROVED: 'approved', CHANGES_REQUESTED: 'changes', REVIEW_REQUIRED: 'required' }

/** `gh pr view --json` read into the branch's open pull request; null when it is closed, merged or not that output. */
export function prOf(json: string): Pr | null {
  const v = parse(json) as { number?: unknown; title?: unknown; state?: unknown; reviewDecision?: unknown; statusCheckRollup?: unknown } | null
  if (typeof v !== 'object' || v === null || typeof v.number !== 'number' || typeof v.title !== 'string' || v.state !== 'OPEN') return null
  const pr: Pr = { number: v.number, title: v.title, review: REVIEW[String(v.reviewDecision)] ?? '', passed: 0, failed: 0, pending: 0 }
  for (const c of Array.isArray(v.statusCheckRollup) ? v.statusCheckRollup : []) {
    const s = (typeof c === 'object' && c !== null ? c : {}) as Record<string, unknown>
    // A check run has a status and a conclusion; a commit status has a state.
    const result = s.__typename === 'StatusContext' ? String(s.state) : s.status === 'COMPLETED' ? String(s.conclusion) : 'PENDING'
    if (result === 'PENDING' || result === 'EXPECTED') pr.pending += 1
    else if (FINE.has(result.toLowerCase())) pr.passed += 1
    else pr.failed += 1
  }
  return pr
}

/** Where a push's CI stands, in one line: "ci running · 2/5", "ci passed · 3 checks · 2m 10s", "ci failed · build". */
export function ciLine(ci: Ci): string {
  const d = t().ci
  if (ci.state === 'running') return d.running(ci.done, ci.total)
  if (ci.state === 'passed') return d.passed(ci.total, duration((ci.endedAt - ci.startedAt) / 1000))
  if (ci.state === 'failed') return d.failed(`${clip(ci.failed[0] ?? '?', 28)}${ci.failed.length > 1 ? ` +${ci.failed.length - 1}` : ''}`)
  if (ci.state === 'cancelled') return d.cancelled
  return d.waiting
}

export const CI_INK: Record<Ci['state'], string> = { waiting: '#A59D96', running: '#F2B84B', passed: '#4CC38A', failed: '#F0645A', cancelled: '#9A918B' }

const REVIEW_INK: Record<Pr['review'], string> = { approved: '#4CC38A', changes: '#F0645A', required: '#F2B84B', '': '' }

/** A pull request's review decision and checks, in words. */
function prFacts(pr: Pr): string[] {
  const d = t().ci
  const total = pr.passed + pr.failed + pr.pending
  return [
    ...(pr.review !== '' ? [d.review[pr.review]] : []),
    ...(total > 0 ? [d.checks(pr.passed, total)] : []),
    ...(pr.failed > 0 ? [d.failing(pr.failed)] : []),
  ]
}

/** The branch's pull request in one short line for the band: "PR #12 · approved · checks 4/5"; its title when nothing else is known. */
export function prLine(pr: Pr): string {
  const facts = prFacts(pr)
  return t().ci.pr(pr.number, facts.length > 0 ? facts.join(' · ') : clip(pr.title, 28))
}

/** A pull request's colour: red with a failing check, amber while some run, green once they pass. */
const prInk = (pr: Pr): string => (pr.failed > 0 ? CI_INK.failed : pr.pending > 0 ? CI_INK.running : pr.passed > 0 ? CI_INK.passed : CI_INK.waiting)

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/**
 * The desktop panel's CI mark: while runs go, a breathing dot and their line;
 * otherwise the branch's pull request. It ends at `right` on the baseline `y`;
 * none when wider than `room`.
 */
export function ciMark(ci: Ci | null | undefined, pr: Pr | null | undefined, right: number, y: number, room: number): { svg: string; width: number } {
  const isRunning = ci?.state === 'running'
  if (!isRunning && !pr) return { svg: '', width: 0 }
  const text = ci && isRunning ? ciLine(ci) : pr ? prLine(pr) : ''
  const width = cols(text) * 6 + 12
  if (width > room) return { svg: '', width: 0 }
  const x = right - width
  const ink = isRunning || !pr ? CI_INK.running : prInk(pr)
  return {
    svg: `<circle cx="${x + 3.5}" cy="${y - 3.8}" r="3" fill="${ink}">${isRunning ? '<animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>' : ''}</circle>` +
      `<text class="t" x="${x + 11}" y="${y}" font-size="11" fill="${ink}">${esc(text)}</text>`,
    width,
  }
}

/** The details pane's CI card: the last push's runs and the branch's open pull request; null when there is neither. */
export function ciCard(env: Env, now: number): Card | null {
  const ci = env.ci ?? null
  const pr = env.pr ?? null
  if (ci === null && pr === null) return null
  const rows = (ci ? 1 : 0) + (pr ? 1 : 0)
  return {
    title: t().ci.title,
    right: ci ? `${ci.sha.slice(0, 7)}${ci.endedAt > 0 ? ` · ${ago(now - ci.endedAt)}` : ''}` : '',
    content: 16 + (rows - 1) * 22,
    body: (x, y, w) => {
      let out = ''
      let cy = y + 8
      const dot = (ink: string, isPulsing: boolean) =>
        `<circle cx="${x + 4}" cy="${cy}" r="4" fill="${ink}">${isPulsing ? '<animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite"/>' : ''}</circle>`
      if (ci) {
        out += dot(CI_INK[ci.state], ci.state === 'running' || ci.state === 'waiting') +
          `<text class="t fg" x="${x + 16}" y="${cy + 4}" font-size="12" font-weight="600">${esc(clip(ciLine(ci), Math.floor((w - 16) / 6.6)))}</text>`
        cy += 22
      }
      if (pr) {
        const facts = prFacts(pr)
        const factsW = facts.length > 0 ? cols(facts.join(' · ')) * 6 + 16 : 0
        const ink = prInk(pr)
        const review = pr.review !== '' ? `<tspan fill="${REVIEW_INK[pr.review]}">${esc(facts[0] ?? '')}</tspan>` : ''
        const rest = facts.slice(pr.review !== '' ? 1 : 0).join(' · ')
        out += dot(ink, pr.pending > 0) +
          `<text class="t fg" x="${x + 16}" y="${cy + 4}" font-size="12">${esc(clip(t().ci.pr(pr.number, pr.title), Math.max(8, Math.floor((w - 16 - factsW) / 6.6))))}</text>` +
          (facts.length > 0
            ? `<text class="t faint" x="${x + w}" y="${cy + 4}" font-size="11" text-anchor="end">${review}${review && rest ? ' · ' : ''}${esc(rest)}</text>`
            : '')
      }
      return out
    },
  }
}

/** The same, as lines for the terminal's details. */
export function ciLines(env: Env, now: number): string[] {
  const ci = env.ci ?? null
  const pr = env.pr ?? null
  return [
    ...(ci ? [`${ciLine(ci)}${ci.endedAt > 0 ? ` · ${ago(now - ci.endedAt)}` : ''}`] : []),
    ...(pr ? [[t().ci.pr(pr.number, pr.title), ...prFacts(pr)].join(' · ')] : []),
  ]
}
