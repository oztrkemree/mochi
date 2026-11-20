import type { Activity, Peer } from '../../types'
import { peerLabel } from '../../hooks/live'
import { toolKind } from '../../hooks/panel'

/**
 * Agents that have no Mochi of their own inside them (Codex, or Claude Code
 * without the mod) tell the app what they do through their hooks: the app's
 * `hook` command leaves each call as a file in the inbox, and this turns the
 * calls into the same picture of a chat the mod writes for itself.
 */

/** One hook call from the inbox: which tool sent it, when, and what the tool said. */
export type Hooked = { source: string; at: number; name: string; session: string; event: Record<string, unknown> }

/** The agents known from their hook calls, by source and session. */
export type Sessions = Map<string, Peer>

/** An agent at work that says nothing for this long was stopped without a word (its window closed, its process killed). */
export const STALLED_AFTER_MS = 30 * 60_000
/** An agent at rest this long has most likely gone without saying so; its next call brings it back. */
export const GONE_AFTER_MS = 2 * 60 * 60_000

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

/** A file from the inbox, if it is a hook call of a session. */
export function hookedOf(file: string): Hooked | null {
  let v: { source?: unknown; at?: unknown; event?: unknown }
  try {
    v = JSON.parse(file)
  } catch {
    return null
  }
  if (typeof v !== 'object' || v === null || typeof v.at !== 'number' || typeof v.event !== 'object' || v.event === null) return null
  const event = v.event as Record<string, unknown>
  const source = text(v.source)
  const session = text(event.session_id)
  if (!/^[a-z][a-z0-9-]{0,19}$/.test(source) || session === '' || session.length > 120) return null
  return { source, at: v.at, name: text(event.hook_event_name), session, event }
}

const TESTS = /(^|[\s;&|(])(((p?npm|yarn|bun|cargo|go|dotnet|swift|deno|mvn|gradle\w*)\s+(run\s+)?test)|pytest|jest|vitest|rspec|phpunit|ctest)\b/

/** What a tool call is, by the tool's name and, for a command, what it runs. */
function activityFor(tool: string, input: unknown): Activity {
  const command = typeof input === 'object' && input !== null ? text((input as { command?: unknown }).command) : ''
  if (tool === 'apply_patch') return 'writing'
  switch (toolKind(tool)) {
    case 'read': return 'reading'
    case 'search': return 'searching'
    case 'edit': return 'writing'
    case 'web': return 'web'
    case 'agent': return 'agent'
    case 'ask': return 'waiting'
    case 'bash': return TESTS.test(command) ? 'testing' : 'running'
    // A tool this does not know is still the agent doing something.
    default: return 'running'
  }
}

const rested = (p: Peer, at: number, reason: string): Peer =>
  ({ ...p, state: reason === 'error' ? 'error' : 'idle', stateAt: at, activity: '', waitingFor: '', agents: [], lastTurn: { at, reason, seconds: p.since > 0 ? Math.max(0, Math.round((at - p.since) / 1000)) : 0 } })

const working = (p: Peer, at: number, activity: Activity): Peer =>
  ({ ...p, state: 'busy', stateAt: p.state === 'busy' ? p.stateAt : at, since: p.state === 'idle' || p.state === 'error' ? at : p.since, activity, waitingFor: '' })

/** The agents after one more hook call. */
export function noted(sessions: Sessions, h: Hooked): Sessions {
  const id = `${h.source}:${h.session}`
  if (h.name === 'SessionEnd') {
    sessions.delete(id)
    return sessions
  }
  const prompt = text(h.event.prompt)
  const known = sessions.get(id)
  let p: Peer = known ?? {
    id, label: peerLabel(text(h.event.cwd), prompt), state: 'idle', line: '', since: 0, at: h.at, folder: text(h.event.cwd), branch: '', isWorktree: false, stateAt: h.at, title: '',
    v: 2, activity: '', waitingFor: '', lastTurn: null, agents: [], context: -1, cost: 0, limit: null, app: '',
  }
  switch (h.name) {
    case 'UserPromptSubmit':
      p = { ...working({ ...p, state: 'idle' }, h.at, 'thinking'), stateAt: h.at }
      break
    case 'PreToolUse':
      p = working(p, h.at, activityFor(text(h.event.tool_name), h.event.tool_input))
      break
    case 'PostToolUse':
    case 'PostToolUseFailure':
      p = working(p, h.at, 'thinking')
      break
    case 'PermissionRequest':
      p = { ...p, state: 'asking', stateAt: h.at, waitingFor: 'permission' }
      break
    case 'Notification':
      if (text(h.event.notification_type) === 'permission_prompt') p = { ...p, state: 'asking', stateAt: p.state === 'asking' ? p.stateAt : h.at, waitingFor: 'permission' }
      break
    case 'Stop':
      p = rested(p, h.at, 'answer')
      break
    case 'Interrupt':
      p = rested(p, h.at, 'aborted')
      break
    case 'StopFailure':
      p = rested(p, h.at, 'error')
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
  sessions.set(id, { ...p, at: h.at })
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
    peers.push({ ...(p.state !== 'idle' && silent >= STALLED_AFTER_MS ? { ...p, state: 'idle' as const, activity: '' as const, waitingFor: '' as const, agents: [] } : p), at: now })
  }
  return peers
}
