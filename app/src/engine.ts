import type { Activity, DayRec, Peer, Plan } from '../../types'
import { isEarly } from '../../hooks/badges'
import { addDay, season } from '../../hooks/level'
import { peerLabel } from '../../hooks/live'
import { toolKind } from '../../hooks/panel'
import { isCommit } from '../../hooks/react'

/**
 * Agents that have no Mochi of their own inside them (Codex, or Claude Code
 * without the mod) tell the app what they do through their hooks: the app's
 * `hook` command leaves each call as a file in the inbox, and this turns the
 * calls into what the mod writes for a chat of its own: where the chat stands
 * (live/<id>.json) and what the day's work came to (days/<id>.json).
 */

/** One hook call from the inbox: which tool sent it, when, the chat it belongs to, and what the tool said. */
export type Hooked = {
  source: string; at: number; name: string; id: string; event: Record<string, unknown>
  /** For a request for permission whose hook waits on Mochi's bubble: the name to answer it by, and until when it waits. */
  ask: { id: string; until: number } | null
}

/** The agents known from their hook calls, by chat. */
export type Sessions = Map<string, Peer>

/** An agent at work that says nothing for this long was stopped without a word (its window closed, its process killed). */
export const STALLED_AFTER_MS = 30 * 60_000
/** An agent at rest this long has most likely gone without saying so; its next call brings it back. */
export const GONE_AFTER_MS = 2 * 60 * 60_000

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * A chat's name, which is also its files' name. A Claude Code chat goes by its
 * session alone, as the mod names it: whichever of the two follows the chat,
 * its days land in the same file. Another agent's goes by the agent too.
 */
const idOf = (source: string, session: string): string => (source === 'claude' ? session : `${source}-${session}`)

/** A file from the inbox, if it is a hook call of a session. */
export function hookedOf(file: string): Hooked | null {
  let v: { source?: unknown; at?: unknown; event?: unknown; ask?: { id?: unknown; until?: unknown } | null }
  try {
    v = JSON.parse(file)
  } catch {
    return null
  }
  if (typeof v !== 'object' || v === null || typeof v.at !== 'number' || typeof v.event !== 'object' || v.event === null) return null
  const event = v.event as Record<string, unknown>
  const source = text(v.source)
  const session = text(event.session_id)
  if (!/^[a-z][a-z0-9]{0,19}$/.test(source) || !/^[A-Za-z0-9_-]{1,110}$/.test(session)) return null
  const ask = typeof v.ask === 'object' && v.ask !== null && typeof v.ask.id === 'string' && /^[0-9]{1,20}-[0-9]{1,10}-ask$/.test(v.ask.id) && typeof v.ask.until === 'number' ? { id: v.ask.id, until: v.ask.until } : null
  return { source, at: v.at, name: text(event.hook_event_name), id: idOf(source, session), event, ask }
}

const TESTS = /(^|[\s;&|(])(((p?npm|yarn|bun|cargo|go|dotnet|swift|deno|mvn|gradle\w*)\s+(run\s+)?test)|pytest|jest|vitest|rspec|phpunit|ctest)\b/

const commandOf = (input: unknown): string => (typeof input === 'object' && input !== null ? text((input as { command?: unknown }).command) : '')
/** Codex writes files with a tool of its own name. */
const isEdit = (tool: string): boolean => tool === 'apply_patch' || toolKind(tool) === 'edit'
/** The tools whose call the mod counts as an edit (hooks/register.tsx), and Codex's own: a list of tasks draws as writing but edits no file. */
const countsAsEdit = (tool: string): boolean => /^(Edit|MultiEdit|Write|NotebookEdit|apply_patch)$/.test(tool)

/** What a tool call is, by the tool's name and, for a command, what it runs. */
function activityFor(tool: string, input: unknown): Activity {
  if (isEdit(tool)) return 'writing'
  switch (toolKind(tool)) {
    case 'read': return 'reading'
    case 'search': return 'searching'
    case 'web': return 'web'
    case 'agent': return 'agent'
    case 'ask': return 'waiting'
    case 'bash': return TESTS.test(commandOf(input)) ? 'testing' : 'running'
    // A tool this does not know is still the agent doing something.
    default: return 'running'
  }
}

/** Whether a turn is running in a chat: it works or waits on the person, and says since when. */
const isInTurn = (p: Peer | undefined): p is Peer => p !== undefined && (p.state === 'busy' || p.state === 'asking') && p.since > 0

/**
 * How a call ends the chat's turn, as the mod names a turn's end: '' when it ends none.
 * Claude Code says nothing when the person cuts a turn short; what it does say, a while later,
 * is that it waits for input (idle_prompt). While the chat still reads as working, that is the turn's end.
 */
function endOf(h: Hooked, before: Peer | undefined): '' | 'answer' | 'aborted' | 'error' {
  if (h.name === 'Stop') return 'answer'
  if (h.name === 'Interrupt') return 'aborted'
  if (h.name === 'StopFailure') return 'error'
  if (h.name === 'Notification' && text(h.event.notification_type) === 'idle_prompt' && before?.state === 'busy' && before.since > 0) return 'aborted'
  return ''
}

/** A call of a subagent still running after its chat's turn ended: the chat itself rests, and stays at rest. */
const isLeftBehind = (h: Hooked, p: Peer): boolean => text(h.event.agent_id) !== '' && !isInTurn(p)

/**
 * When the turn a call ends was over. A stop says so as it happens; that Claude Code waits for input
 * is said a minute or more after, and that minute is not work: the turn was over when the chat was last heard.
 */
const endedAt = (h: Hooked, before: Peer): number => (h.name === 'Notification' ? before.at : h.at)

const rested = (p: Peer, at: number, reason: string): Peer =>
  ({ ...p, state: reason === 'error' ? 'error' : 'idle', stateAt: at, activity: '', waitingFor: '', agents: [], lastTurn: { at, reason, seconds: p.since > 0 ? Math.max(0, Math.round((at - p.since) / 1000)) : 0 } })

const working = (p: Peer, at: number, activity: Activity): Peer =>
  ({ ...p, state: 'busy', stateAt: p.state === 'busy' ? p.stateAt : at, since: p.state === 'idle' || p.state === 'error' ? at : p.since, activity, waitingFor: '' })

const asking = (p: Peer, at: number, waitingFor: 'permission' | 'question' | 'plan'): Peer =>
  ({ ...p, state: 'asking', stateAt: p.state === 'asking' ? p.stateAt : at, since: p.state === 'idle' || p.state === 'error' ? at : p.since, waitingFor })

/**
 * A chat with what Claude Code's status line says of it: how full its context
 * is, what it cost, and the usage limits. Each is taken only if it is the
 * number it should be; what the call does not say stays as it was.
 */
function withStatus(p: Peer, status: unknown): Peer {
  if (typeof status !== 'object' || status === null) return p
  const v = status as { context?: unknown; cost?: unknown; windows?: unknown }
  const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0
  const windows = Array.isArray(v.windows)
    ? v.windows.flatMap(w => (typeof w === 'object' && w !== null && typeof w.kind === 'string' && num(w.p) && num(w.resetsAt) ? [{ kind: w.kind as string, p: Math.min(100, Math.round(w.p)), resetsAt: w.resetsAt }] : [])).slice(0, 4)
    : p.windows ?? []
  const full = windows.find(w => w.p >= 100)
  return {
    ...p,
    context: num(v.context) ? Math.min(100, Math.round(v.context)) : p.context,
    cost: num(v.cost) ? v.cost : p.cost,
    windows,
    limit: full ? { kind: full.kind, resetsAt: full.resetsAt } : null,
  }
}

/**
 * A chat's plan after a call that wrote it: the to-do list whole (its counts and the step under way, as the hook keeps them), or
 * tasks one by one: one more made, one done, one dropped, one under way.
 * shortcut: a task done twice counts twice, as the hook keeps no task's id; the counts are kept within 0 and all.
 */
function withPlan(p: Peer, event: Record<string, unknown>): Peer {
  const input = (event.tool_input ?? {}) as { plan?: { total?: unknown; done?: unknown; now?: unknown }; status?: unknown; now?: unknown }
  const was = p.plan ?? { total: 0, done: 0, now: '' }
  const count = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.round(x)) : 0)
  let plan: Plan
  switch (text(event.tool_name)) {
    case 'TodoWrite':
      plan = { total: count(input.plan?.total), done: count(input.plan?.done), now: text(input.plan?.now) }
      break
    case 'TaskCreate':
      plan = { ...was, total: was.total + 1 }
      break
    case 'TaskUpdate':
      plan = input.status === 'completed' ? { ...was, done: was.done + 1, now: '' }
        : input.status === 'deleted' ? { ...was, total: Math.max(0, was.total - 1) }
        : input.status === 'in_progress' ? { ...was, now: text(input.now) }
        : was
      break
    default:
      return p
  }
  return { ...p, plan: plan.total > 0 ? { ...plan, done: Math.min(plan.done, plan.total), now: plan.now.slice(0, 60) } : null }
}

/** The agents after one more hook call. */
export function noted(sessions: Sessions, h: Hooked): Sessions {
  if (h.name === 'SessionEnd') {
    sessions.delete(h.id)
    return sessions
  }
  const prompt = text(h.event.prompt)
  const known = sessions.get(h.id)
  let p: Peer = known ?? {
    id: h.id, label: peerLabel(text(h.event.cwd), prompt), state: 'idle', line: '', since: 0, at: h.at, folder: text(h.event.cwd), branch: '', isWorktree: false, stateAt: h.at, title: '',
    v: 2, activity: '', waitingFor: '', lastTurn: null, agents: [], context: -1, cost: 0, limit: null, app: '',
  }
  const title = text(h.event.session_title)
  if (title !== '') p = { ...p, title }
  const end = endOf(h, known)
  if (end !== '') p = rested(p, endedAt(h, p), end)
  switch (h.name) {
    case 'StatusLine':
      p = withStatus(p, h.event.status)
      break
    case 'UserPromptSubmit':
      p = { ...working({ ...p, state: 'idle' }, h.at, 'thinking'), stateAt: h.at }
      break
    case 'PreToolUse': {
      if (isLeftBehind(h, p)) break
      const tool = text(h.event.tool_name)
      // A question or a plan stops the turn for the person, the same as a request for permission.
      p = toolKind(tool) === 'ask' ? asking(p, h.at, tool === 'ExitPlanMode' ? 'plan' : 'question') : working(p, h.at, activityFor(tool, h.event.tool_input))
      break
    }
    case 'PostToolUse':
      if (!isLeftBehind(h, p)) p = withPlan(working(p, h.at, 'thinking'), h.event)
      break
    case 'PostToolUseFailure':
      if (!isLeftBehind(h, p)) p = working(p, h.at, 'thinking')
      break
    case 'PermissionRequest':
      p = asking(p, h.at, 'permission')
      break
    case 'Notification':
      if (text(h.event.notification_type) === 'permission_prompt' && p.state !== 'asking') p = asking(p, h.at, 'permission')
      break
    case 'SubagentStart': {
      const agent = text(h.event.agent_id)
      if (agent !== '' && !p.agents?.some(a => a.id === agent)) p = { ...p, agents: [...(p.agents ?? []), { id: agent, type: text(h.event.agent_type), task: '', activity: 'thinking' as const, since: h.at }].slice(-8) }
      break
    }
    case 'SubagentStop':
      p = { ...p, agents: (p.agents ?? []).filter(a => a.id !== text(h.event.agent_id)) }
      break
  }
  sessions.set(h.id, { ...p, at: h.at })
  return sessions
}

/** The agents as chats seen now: the gone left out (and forgotten), the stalled at rest, each as fresh as a file just written. */
export function agentPeers(sessions: Sessions, now: number): Peer[] {
  const peers: Peer[] = []
  for (const [id, p] of sessions) {
    const silent = now - p.at
    if (silent >= GONE_AFTER_MS) {
      sessions.delete(id)
      continue
    }
    // Only a chat at work goes quiet without a word: one that waits on the person says nothing because it waits.
    peers.push({ ...(p.state === 'busy' && silent >= STALLED_AFTER_MS ? { ...p, state: 'idle' as const, activity: '' as const, waitingFor: '' as const, agents: [] } : p), at: now })
  }
  return peers
}

/** The chats taken as stopped because they went silent at work. That they rest now is no news of a turn that finished. */
export function stalledOf(sessions: Sessions, now: number): Set<string> {
  return new Set([...sessions].filter(([, p]) => p.state === 'busy' && now - p.at >= STALLED_AFTER_MS).map(([id]) => id))
}

/** Whether a chat is named by the person's first words and not by its folder: the mod keeps such a name off pictures to share. */
export const isNamedByPrompt = (p: Pick<Peer, 'label' | 'folder'>): boolean => peerLabel(p.folder ?? '', '') !== p.label

// ---------- the day's record ----------

/** A turn that ended at `at`, as the day counts it: by the person's own clock a night one before five, an early one from five to seven. */
const turnAt = (since: number, at: number, tz: number): Partial<DayRec> =>
  ({ turns: 1, secs: Math.max(0, Math.round((at - since) / 1000)), ...(season(at, tz).isNight ? { night: 1 } : {}), ...(isEarly(at, tz) ? { early: 1 } : {}) })

/**
 * What one hook call adds to its chat's day, counted as the mod counts its own
 * chats (hooks/register.tsx), so work in Codex earns what work in Claude Code
 * does. `before` is the chat as it stood before the call, `tz` the person's
 * clock in minutes from UTC. Null for a call that adds nothing.
 */
export function tallyOf(h: Hooked, before: Peer | undefined, tz: number): Partial<DayRec> | null {
  const tool = text(h.event.tool_name)
  if (h.name === 'PostToolUse' || h.name === 'PostToolUseFailure') {
    // A subagent's calls are its own: the mod counts the chat's.
    if (text(h.event.agent_id) !== '') return null
    if (h.name === 'PostToolUseFailure') return { tools: 1, errors: 1 }
    return { tools: 1, ...(countsAsEdit(tool) ? { edits: 1 } : {}), ...(toolKind(tool) === 'bash' && isCommit(commandOf(h.event.tool_input)) ? { commits: 1 } : {}) }
  }
  // A turn is one that was running: a second stop, or one for a chat first heard of now, ends nothing.
  if (!isInTurn(before)) return null
  if (endOf(h, before) !== '') return turnAt(before.since, endedAt(h, before), tz)
  // A new prompt, or the chat closing, while a turn still reads as running: that turn ended without a word, when the chat was last heard.
  if (h.name === 'UserPromptSubmit' || h.name === 'SessionEnd') return turnAt(before.since, before.at, tz)
  return null
}

/**
 * A chat's days file with one more record added to a day: the file the mod
 * keeps for a chat of its own (days/<id>.json), which every Mochi sums into the
 * one history. `held` is the file as it stands, null before there is one.
 */
export function dayFile(held: string | null, id: string, label: string, isLabelFromPrompt: boolean, day: string, rec: Partial<DayRec>): string {
  let days: Record<string, Partial<DayRec>> = {}
  try {
    const v: unknown = JSON.parse(held ?? 'null')
    const kept = typeof v === 'object' && v !== null ? (v as { days?: unknown }).days : null
    if (typeof kept === 'object' && kept !== null) days = kept as Record<string, Partial<DayRec>>
  } catch {
    // Not a days file: this day starts it.
  }
  return `${JSON.stringify({ id, label, isLabelFromPrompt, days: { ...days, [day]: addDay(days[day] ?? {}, rec) } })}\n`
}

// ---------- a request for permission, answered from the bubble ----------

/** A request for permission that waits on Mochi's bubble: its name, until when it waits, the chat that asks, for which tool, and what the person sees of it. */
export type Request = { id: string; until: number; chat: string; tool: string; what: string; canAllow: boolean }

/** As much of a command as the bubble shows. A longer one is not all seen, so it cannot be allowed from here. */
const SHOWN_MAX = 160

/**
 * The request a hook call makes of the bubble, if its hook waits on it. A yes
 * is offered only for a shell command shown whole and on one line: the person
 * answers for what they see. An edit shows its file but not its change, and
 * another tool nothing, so those can be refused here or opened, never waved
 * through.
 */
export function requestOf(h: Hooked): Request | null {
  if (h.name !== 'PermissionRequest' || h.ask === null) return null
  const input = typeof h.event.tool_input === 'object' && h.event.tool_input !== null ? (h.event.tool_input as { command?: unknown; file_path?: unknown; cut?: unknown; odd?: unknown }) : {}
  const command = text(input.command)
  const all = command || text(input.file_path)
  // The shell's own tool, given nothing but the command, and a command of plain characters: a letter that does not show,
  // or one that turns the line around, makes a command read as another.
  const isWhole = text(h.event.tool_name) === 'Bash' && command !== '' && input.cut !== true && input.odd !== true && command.length <= SHOWN_MAX && /^[\x20-\x7E]+$/.test(command)
  return { id: h.ask.id, until: h.ask.until, chat: h.id, tool: text(h.event.tool_name), what: all.length > SHOWN_MAX ? `${all.slice(0, SHOWN_MAX)}…` : all, canAllow: isWhole }
}

/** The calls that mean a waiting request was answered elsewhere: the call went on or failed, the turn ended, or the person said something new. Any other word from the chat leaves it waiting. */
const SETTLES = ['PostToolUse', 'PostToolUseFailure', 'Stop', 'StopFailure', 'Interrupt', 'UserPromptSubmit', 'SessionEnd']
export const settles = (h: Hooked): boolean => SETTLES.includes(h.name)
