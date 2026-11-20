import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { GONE_AFTER_MS, STALLED_AFTER_MS, agentPeers, hookedOf, noted } from './agents'

setLang('en')

const NOW = 1_760_000_000_000
const SEC = 1000

/** One hook call as the app's own `hook` command leaves it in the inbox. */
const hook = (at: number, name: string, more: Record<string, unknown> = {}, source = 'codex') =>
  hookedOf(JSON.stringify({ source, at, event: { hook_event_name: name, session_id: 's1', cwd: '/Users/me/code/shop', ...more } }))!

const run = (...calls: ReturnType<typeof hook>[]) => calls.reduce(noted, new Map())

test('a prompt puts the agent to work, each tool call says what it does, and the turn’s end rests it with how long it took', () => {
  let s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'add a dark mode toggle' }))
  expect(agentPeers(s, NOW)).toMatchObject([{ id: 'codex:s1', label: 'shop', state: 'busy', activity: 'thinking', since: NOW }])

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

test('a session is known from its first call whatever that is, by the tool that sent it, and is gone when it ends', () => {
  let s = run(hook(NOW, 'PreToolUse', { tool_name: 'Read' }), hook(NOW, 'SessionStart', {}, 'claude'))
  expect(agentPeers(s, NOW).map(p => [p.id, p.state])).toEqual([['codex:s1', 'busy'], ['claude:s1', 'idle']])
  s = noted(s, hook(NOW + SEC, 'SessionEnd'))
  expect(agentPeers(s, NOW + SEC).map(p => p.id)).toEqual(['claude:s1'])
})

test('what is not a hook call is nothing: other text, a call with no session, an unknown source name', () => {
  expect(hookedOf('not json')).toBeNull()
  expect(hookedOf(JSON.stringify({ source: 'codex', at: NOW, event: { hook_event_name: 'Stop' } }))).toBeNull()
  expect(hookedOf(JSON.stringify({ source: 'co dex!', at: NOW, event: { hook_event_name: 'Stop', session_id: 's1' } }))).toBeNull()
  expect(hookedOf(JSON.stringify({ source: 'codex', at: 'now', event: { hook_event_name: 'Stop', session_id: 's1' } }))).toBeNull()
})

test('an agent says nothing while it rests, so it stays as it was; one silent at work is taken as stopped, one at rest for hours as gone', () => {
  const s = run(hook(NOW, 'UserPromptSubmit', { prompt: 'x' }))
  // Still at work a while later, and written as seen now, so it never reads as a file gone stale.
  expect(agentPeers(s, NOW + STALLED_AFTER_MS - 1)[0]).toMatchObject({ state: 'busy', at: NOW + STALLED_AFTER_MS - 1 })
  expect(agentPeers(s, NOW + STALLED_AFTER_MS)[0].state).toBe('idle')
  expect(agentPeers(s, NOW + GONE_AFTER_MS - 1)).toHaveLength(1)
  expect(agentPeers(s, NOW + GONE_AFTER_MS)).toHaveLength(0)
})
