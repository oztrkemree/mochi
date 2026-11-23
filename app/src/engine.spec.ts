import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { summarize, xpOf } from '../../hooks/level'
import { peerOf } from '../../hooks/live'
import { GONE_AFTER_MS, STALLED_AFTER_MS, agentPeers, dayFile, hookedOf, noted, tallyOf } from './engine'

setLang('en')

/** 2025-10-09 08:53:20 UTC. */
const NOW = 1_760_000_000_000
const SEC = 1000

/** One hook call as the app's own `hook` command leaves it in the inbox. */
const hook = (at: number, name: string, more: Record<string, unknown> = {}, source = 'codex') =>
  hookedOf(JSON.stringify({ source, at, event: { hook_event_name: name, session_id: 's1', cwd: '/Users/me/code/shop', ...more } }))!

const run = (...calls: ReturnType<typeof hook>[]) => calls.reduce(noted, new Map())

test('a prompt puts the agent to work, each tool call says what it does, and the turn’s end rests it with how long it took', () => {
  let s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'add a dark mode toggle' }))
  expect(agentPeers(s, NOW)).toMatchObject([{ id: 'codex-s1', label: 'shop', state: 'busy', activity: 'thinking', since: NOW }])

  s = noted(s, hook(NOW + SEC, 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'rg toggle src' } }))
  expect(agentPeers(s, NOW + SEC)[0].activity).toBe('running')
  s = noted(s, hook(NOW + 2 * SEC, 'PreToolUse', { tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch' } }))
  expect(agentPeers(s, NOW + 2 * SEC)[0].activity).toBe('writing')
  s = noted(s, hook(NOW + 3 * SEC, 'PreToolUse', { tool_name: 'Bash', tool_input: { command: 'pnpm test --run' } }))
  expect(agentPeers(s, NOW + 3 * SEC)[0].activity).toBe('testing')
  s = noted(s, hook(NOW + 4 * SEC, 'PostToolUse', { tool_name: 'Bash' }))
  expect(agentPeers(s, NOW + 4 * SEC)[0]).toMatchObject({ state: 'busy', activity: 'thinking' })

  s = noted(s, hook(NOW + 30 * SEC, 'Stop'))
  expect(agentPeers(s, NOW + 30 * SEC)[0]).toMatchObject({ state: 'idle', activity: '', lastTurn: { at: NOW + 30 * SEC, reason: 'answer', seconds: 30 } })
})

test('a request for permission waits on the person until the call goes on; a turn cut short is not a finished one', () => {
  let s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'clean up' }), hook(NOW + SEC, 'PermissionRequest', { tool_name: 'Bash' }))
  expect(agentPeers(s, NOW + SEC)[0]).toMatchObject({ state: 'asking', waitingFor: 'permission', stateAt: NOW + SEC })
  s = noted(s, hook(NOW + 5 * SEC, 'PostToolUse', { tool_name: 'Bash' }))
  expect(agentPeers(s, NOW + 5 * SEC)[0]).toMatchObject({ state: 'busy', waitingFor: '' })
  s = noted(s, hook(NOW + 6 * SEC, 'Interrupt'))
  expect(agentPeers(s, NOW + 6 * SEC)[0]).toMatchObject({ state: 'idle', lastTurn: { reason: 'aborted', seconds: 6 } })
  s = noted(s, hook(NOW + 7 * SEC, 'UserPromptSubmit', { prompt: 'again' }))
  s = noted(s, hook(NOW + 8 * SEC, 'StopFailure'))
  expect(agentPeers(s, NOW + 8 * SEC)[0].state).toBe('error')
})

test('a question to the person and a plan to approve wait on the person too, each by its name', () => {
  let s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'x' }, 'claude'), hook(NOW + SEC, 'PreToolUse', { tool_name: 'AskUserQuestion' }, 'claude'))
  expect(agentPeers(s, NOW + SEC)[0]).toMatchObject({ state: 'asking', waitingFor: 'question', stateAt: NOW + SEC })
  s = noted(s, hook(NOW + 9 * SEC, 'PostToolUse', { tool_name: 'AskUserQuestion' }, 'claude'))
  expect(agentPeers(s, NOW + 9 * SEC)[0]).toMatchObject({ state: 'busy', waitingFor: '' })
  s = noted(s, hook(NOW + 10 * SEC, 'PreToolUse', { tool_name: 'ExitPlanMode' }, 'claude'))
  expect(agentPeers(s, NOW + 10 * SEC)[0]).toMatchObject({ state: 'asking', waitingFor: 'plan' })
})

test('a Claude Code chat goes by the name the mod gives it, another agent’s by the agent and the session; both are names a file can have', () => {
  let s = run(hook(NOW, 'PreToolUse', { tool_name: 'Read' }), hook(NOW, 'SessionStart', { session_title: 'Fix the cart' }, 'claude'))
  expect(agentPeers(s, NOW).map(p => [p.id, p.state, p.title])).toEqual([['codex-s1', 'busy', ''], ['s1', 'idle', 'Fix the cart']])
  s = noted(s, hook(NOW + SEC, 'SessionEnd'))
  expect(agentPeers(s, NOW + SEC).map(p => p.id)).toEqual(['s1'])
})

test('what the app writes of a chat reads back as a chat the way the mod reads its own', () => {
  const s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'x' }), hook(NOW + SEC, 'SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }))
  const written = JSON.parse(JSON.stringify({ ...agentPeers(s, NOW + SEC)[0], by: 'app' }))
  expect(peerOf(written, NOW + SEC)).toMatchObject({ id: 'codex-s1', state: 'busy', v: 2, agents: [{ id: 'a1', type: 'Explore' }] })
})

test('what is not a hook call is nothing: other text, a call with no session, an odd source or session name', () => {
  expect(hookedOf('not json')).toBeNull()
  expect(hookedOf(JSON.stringify({ source: 'codex', at: NOW, event: { hook_event_name: 'Stop' } }))).toBeNull()
  expect(hookedOf(JSON.stringify({ source: 'co dex!', at: NOW, event: { hook_event_name: 'Stop', session_id: 's1' } }))).toBeNull()
  expect(hookedOf(JSON.stringify({ source: 'codex', at: 'now', event: { hook_event_name: 'Stop', session_id: 's1' } }))).toBeNull()
  // A session's name becomes a file's: one that could leave the folder is no session.
  expect(hookedOf(JSON.stringify({ source: 'codex', at: NOW, event: { hook_event_name: 'Stop', session_id: '../../x' } }))).toBeNull()
})

test('an agent says nothing while it rests, so it stays as it was; one silent at work is taken as stopped, one at rest for hours as gone', () => {
  const s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'x' }))
  // Still at work a while later, and written as seen now, so it never reads as a file gone stale.
  expect(agentPeers(s, NOW + STALLED_AFTER_MS - 1)[0]).toMatchObject({ state: 'busy', at: NOW + STALLED_AFTER_MS - 1 })
  expect(agentPeers(s, NOW + STALLED_AFTER_MS)[0].state).toBe('idle')
  expect(agentPeers(s, NOW + GONE_AFTER_MS - 1)).toHaveLength(1)
  expect(agentPeers(s, NOW + GONE_AFTER_MS)).toHaveLength(0)
})

// ---------- the day's record ----------

test('work in a chat the app follows counts as the mod counts its own: tools, edits, commits, errors, and each turn with its seconds', () => {
  const s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'x' }))
  const busy = s.get('codex-s1')
  expect(tallyOf(hook(NOW, 'UserPromptSubmit', { prompt: 'x' }), undefined, 0)).toBeNull()
  expect(tallyOf(hook(NOW + SEC, 'PreToolUse', { tool_name: 'Edit' }), busy, 0)).toBeNull()
  expect(tallyOf(hook(NOW + SEC, 'PostToolUse', { tool_name: 'Read' }), busy, 0)).toEqual({ tools: 1 })
  expect(tallyOf(hook(NOW + SEC, 'PostToolUse', { tool_name: 'Edit' }), busy, 0)).toEqual({ tools: 1, edits: 1 })
  expect(tallyOf(hook(NOW + SEC, 'PostToolUse', { tool_name: 'apply_patch' }), busy, 0)).toEqual({ tools: 1, edits: 1 })
  expect(tallyOf(hook(NOW + SEC, 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'git commit -m "fix the cart"' } }), busy, 0)).toEqual({ tools: 1, commits: 1 })
  expect(tallyOf(hook(NOW + SEC, 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'git status' } }), busy, 0)).toEqual({ tools: 1 })
  // A commit that failed is no commit.
  expect(tallyOf(hook(NOW + SEC, 'PostToolUseFailure', { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }), busy, 0)).toEqual({ tools: 1, errors: 1 })
  expect(tallyOf(hook(NOW + 90 * SEC, 'Stop'), busy, 0)).toEqual({ turns: 1, secs: 90 })
  expect(tallyOf(hook(NOW + 90 * SEC, 'StopFailure'), busy, 0)).toEqual({ turns: 1, secs: 90 })
})

test('a turn is counted once: a stop with no turn running adds nothing', () => {
  const s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'x' }), hook(NOW + 5 * SEC, 'Stop'))
  expect(tallyOf(hook(NOW + 6 * SEC, 'Stop'), s.get('codex-s1'), 0)).toBeNull()
  expect(tallyOf(hook(NOW, 'Stop'), undefined, 0)).toBeNull()
})

test('a turn that ends before five in the morning is a night one, between five and seven an early one, by the person’s own clock', () => {
  const busy = run(hook(NOW, 'UserPromptSubmit', { prompt: 'x' })).get('codex-s1')
  // 08:53 UTC is 03:53 five hours west, and 05:53 three hours west.
  expect(tallyOf(hook(NOW + SEC, 'Stop'), busy, -300)).toEqual({ turns: 1, secs: 1, night: 1 })
  expect(tallyOf(hook(NOW + SEC, 'Stop'), busy, -180)).toEqual({ turns: 1, secs: 1, early: 1 })
})

test('a chat’s days are kept in the mod’s own file shape, added to what the file held, and earn the same experience', () => {
  const first = dayFile(null, 'codex-s1', 'shop', '2026-11-23', { turns: 2, edits: 5 })
  expect(JSON.parse(first)).toEqual({ id: 'codex-s1', label: 'shop', isLabelFromPrompt: false, days: { '2026-11-23': { turns: 2, tools: 0, edits: 5, errors: 0, commits: 0, cost: 0, secs: 0, night: 0, add: 0, del: 0, early: 0, langs: 0 } } })
  const second = JSON.parse(dayFile(first, 'codex-s1', 'shop', '2026-11-23', { turns: 1, commits: 1, secs: 90 }))
  expect(second.days['2026-11-23']).toMatchObject({ turns: 3, edits: 5, commits: 1, secs: 90 })
  // 3 turns × 10 + 5 edits × 2 + 1 commit × 25 + 1 active day × 30.
  expect(xpOf(summarize([second.days], '2026-11-23'))).toBe(95)
  // Another day is another record; a file that is not days starts over.
  expect(Object.keys(JSON.parse(dayFile(JSON.stringify(second), 'codex-s1', 'shop', '2026-11-24', { turns: 1 })).days)).toEqual(['2026-11-23', '2026-11-24'])
  expect(JSON.parse(dayFile('half a fi', 'codex-s1', 'shop', '2026-11-24', { turns: 1 })).days['2026-11-24'].turns).toBe(1)
})
