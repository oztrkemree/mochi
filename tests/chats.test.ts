import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { boardLines, boardOf, chatsCard, claimOf, isLinkedWorktree, isWaitLong, resetsPassed } from '../hooks/chats'
import { detailLines } from '../hooks/detail'
import { setLang } from '../hooks/i18n'
import { ALIVE_MS, appLink, appSessionOf, deskOf, peerOf } from '../hooks/live'
import { floorOf, partyOf } from '../hooks/party'
import { openCommand } from '../hooks/system'
import { itemIcon } from '../hooks/rig'
import { EMPTY_DAY } from '../hooks/level'
import { NO_ENV, restorePrefs } from '../hooks/state'

// These read the English lines.
setLang('en')

const NOW = 1_760_000_000_000
const MIN = 60_000
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never

/** A session's engine beneath the plugin, its files kept in memory; returns the files, the system notifications' texts and the clock. */
function machine(on: On, limits: { kind: string; percentUsed: number; resetsAt: string }[] = [], isListing = false) {
  mock.store(on, { prefs: { lang: 'en' } })
  mock.env(on, { HOME: '/h' })
  const clock = mock.clock(on)
  const files = new Map<string, string>()
  // The engine writes a path with the separators (and on Windows the drive) of the system the test runs on.
  const slashed = (path: string) => path.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')
  const alerts: string[] = []
  const runs: string[][] = []
  on('session.start', () => ({ cwd: '/tmp' }))
  on('session.id', () => ({ value: 'me-1' }) as never)
  on('session.root', () => ({ value: '/home/dev/web-app' }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 2000, percent: 1 }, rateLimits: limits, cost: { usd: 0 } } }) as never)
  on('fs.read', ($, e) => {
    const text = files.get(slashed(e.path))
    if (text === undefined) throw new Error('no such file')
    return { value: text } as never
  })
  on('fs.write', ($, e) => {
    files.set(slashed(e.path), e.text)
    return { value: undefined }
  })
  // Listing is off unless asked: then a folder lists the files kept under it, each changed now.
  on('fs.list', ($, e) => ({
    value: isListing ? [...files.keys()].filter(k => k.startsWith(`${slashed(e.path)}/`)).map(k => ({ name: k.slice(slashed(e.path).length + 1), kind: 'file', size: 0, mtimeMs: NOW })) : [],
  }) as never)
  on('process.run', ($, e) => {
    runs.push(e.argv)
    if (e.argv[0] === 'notify-send') alerts.push(e.argv[3] ?? '')
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['terminal'] as never }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, {}) as RenderElement
  })
  return { clock, files, alerts, runs }
}

const peer = (id: string, state: 'busy' | 'asking' | 'idle' | 'error', more: Record<string, unknown> = {}) =>
  ({ id, label: id, state, line: '', since: 0, at: NOW, folder: id, branch: 'main', isWorktree: false, stateAt: 0, ...more })

test('a nearly used-up window is told once, as its reset passes', async () => {
  const at = NOW + 10_000
  const five = { kind: 'five_hour', percent: 96, resetsAt: at }
  const limits = [five, { kind: 'seven_day', percent: 40, resetsAt: at }, { kind: 'spend_limit', percent: 99, resetsAt: at }]
  // The first look only sets the mark.
  expect(resetsPassed(limits, 0, at + 1)).toEqual([])
  expect(resetsPassed(limits, NOW, at - 1)).toEqual([])
  expect(resetsPassed(limits, at - 450, at + 10)).toEqual([five])
  expect(resetsPassed(limits, at + 10, at + 460)).toEqual([])
  expect(resetsPassed([{ ...five, percent: 89 }], at - 450, at + 10)).toEqual([])
  expect(resetsPassed([{ ...five, kind: 'seven_day', percent: 100 }], at - 450, at + 10).length).toBe(1)
})

test('a reset is claimed by the first marker found, and a race by the one read back', async () => {
  expect(claimOf(null, 5, 'a')).toBe('free')
  expect(claimOf('{"at":5,"id":"a"}', 5, 'a')).toBe('mine')
  expect(claimOf('{"at":5,"id":"b"}', 5, 'a')).toBe('theirs')
  // An older reset's marker, one caught mid-write, or nothing to read leaves it free.
  expect(claimOf('{"at":4,"id":"b"}', 5, 'a')).toBe('free')
  expect(claimOf('{"at":5,"i', 5, 'a')).toBe('free')
  expect(claimOf('null', 5, 'a')).toBe('free')
})

test('a wait on the person is told once more after five minutes, once per wait', async () => {
  const asking = { state: 'asking' as const, stateAt: NOW }
  expect(isWaitLong(asking, 0, NOW + 4 * MIN)).toBe(false)
  expect(isWaitLong(asking, 0, NOW + 5 * MIN)).toBe(true)
  expect(isWaitLong(asking, NOW, NOW + 30 * MIN)).toBe(false)
  expect(isWaitLong({ state: 'asking', stateAt: NOW + 6 * MIN }, NOW, NOW + 11 * MIN)).toBe(true)
  expect(isWaitLong({ state: 'busy', stateAt: NOW }, 0, NOW + 9 * MIN)).toBe(false)
  expect(isWaitLong({ state: 'asking', stateAt: 0 }, 0, NOW + 9 * MIN)).toBe(false)
})

test('git tells a linked worktree from the main one', async () => {
  expect(isLinkedWorktree('C:/p/mochi/.git/worktrees/wf-2\nC:/p/mochi/.git\n')).toBe(true)
  expect(isLinkedWorktree('.git\n.git\n')).toBe(false)
  expect(isLinkedWorktree('/p/mochi/.git\n/p/mochi/.git\n')).toBe(false)
  expect(isLinkedWorktree('')).toBe(false)
})

test('the board puts this chat first, then the waiting ones, the longest wait first', async () => {
  const me = peer('mochi', 'busy', { line: 'editing · a.ts', since: NOW - 12 * MIN, stateAt: NOW - MIN, branch: 'mochi-next', isWorktree: true })
  const peers = [
    peer('api', 'busy', { line: 'running · npm test', since: NOW - 3 * MIN }),
    peer('docs', 'asking', { line: 'waiting for your answer', stateAt: NOW - 2 * MIN }),
    peer('blog', 'idle', { line: 'ready', stateAt: NOW - 40 * MIN }),
    peer('wiki', 'asking', { line: 'awaiting approval · rm -rf x', stateAt: NOW - 6 * MIN }),
    peer('web', 'error', { line: 'API error', branch: '' }),
    { ...me, line: 'stale copy of this chat' },
  ]
  expect(boardOf(me, peers).map(p => p.id)).toEqual(['mochi', 'wiki', 'docs', 'web', 'api', 'blog'])
  expect(boardLines(me, peers, NOW)).toEqual([
    'Chats: 6 open',
    '  ● mochi (this chat) · mochi-next (worktree) · working · editing · a.ts · 12m',
    '  ● wiki · main · waiting for you · awaiting approval · rm -rf x · 6m',
    '  ● docs · main · waiting for you · waiting for your answer · 2m',
    '  ● web · error · API error',
    '  ● api · main · working · running · npm test · 3m',
    '  ○ blog · main · idle · 40m',
  ])
  // A file an older Mochi wrote has no branch and no time in its state.
  const old = peerOf({ id: 'x', label: 'old', state: 'idle', line: 'ready', since: 0, at: NOW }, NOW)
  expect(old).toEqual({ id: 'x', label: 'old', state: 'idle', line: 'ready', since: 0, at: NOW, folder: '', branch: '', isWorktree: false, stateAt: 0, title: '' })
  expect(boardLines(undefined, [old!], NOW)).toEqual(['Chats: 1 open', '  ○ old · idle'])
  // A chat the desktop app follows says how far its plan is.
  const planned = peerOf({ id: 'p', label: 'codex', state: 'idle', line: '', since: 0, at: NOW, v: 2, plan: { total: 4, done: 2, now: 'Fixing' } }, NOW)
  expect(boardLines(undefined, [planned!], NOW)).toEqual(['Chats: 1 open', '  ○ codex · idle · 2/4'])
})

test('the details pane draws the board as a card, and as lines in the terminal', async () => {
  const env = {
    ...NO_ENV,
    me: peer('mochi', 'idle', { stateAt: NOW - 3 * MIN }),
    peers: [peer('wiki', 'asking', { line: 'awaiting approval · rm -rf <x>', stateAt: NOW - 6 * MIN, branch: 'fix', isWorktree: true })],
  }
  const card = chatsCard(env, NOW)
  expect(card?.title).toBe('CHATS')
  expect(card?.right).toBe('2 open · 1 waiting for you')
  const svg = card?.body(0, 0, 640) ?? ''
  for (const part of ['mochi', 'this chat', 'wiki', 'fix (worktree)', 'waiting for you', 'rm -rf &lt;x&gt;', '6m', '3m']) expect(svg).toContain(part)
  expect(svg.indexOf('mochi') < svg.indexOf('wiki')).toBe(true)
  expect(/<[^a-zA-Z/!?]/.test(svg)).toBe(false)
  // On the narrowest card the name has no room for the mark; this chat stays first.
  const narrow = card?.body(0, 0, 280) ?? ''
  expect(narrow).not.toContain('this chat')
  expect(narrow.indexOf('mochi') < narrow.indexOf('wiki')).toBe(true)
  expect(chatsCard({ ...env, peers: [] }, NOW)).toBe(null)
  expect(detailLines(env, NOW)).toContain('  ● wiki · fix (worktree) · waiting for you · awaiting approval · rm -rf <x> · 6m')
})

test('a chat with a title is named by it, its folder beside its branch', async () => {
  const me = peer('mochi', 'idle', { title: 'Background agents in Mochi' })
  const peers = [peer('web', 'asking', { title: 'Fix   the\nlogin', line: 'waiting for your answer', stateAt: NOW - 2 * MIN }), peer('api', 'idle')]
  expect(boardLines(me, peers.map(p => peerOf(p, NOW)!), NOW)).toEqual([
    'Chats: 3 open',
    '  ○ Background agents in Mochi (this chat) · mochi · main · idle',
    '  ● Fix the login · web · main · waiting for you · waiting for your answer · 2m',
    '  ○ api · main · idle',
  ])
  const svg = chatsCard({ ...NO_ENV, me, peers: peers.map(p => peerOf(p, NOW)!) }, NOW)?.body(0, 0, 900) ?? ''
  for (const part of ['Background agents in Mochi', 'this chat', 'mochi · main', 'Fix the login', 'web · main']) expect(svg).toContain(part)
})

test('the title Claude Code gives goes in this chat’s file; a new chat’s is read from its transcript at the turn’s end', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('classic.UserPromptSubmit', () => ({}) as never)
  on('fs.stat', ($, e) => ({ value: { kind: 'file', size: (files.get(e.path) ?? '').length, mtimeMs: NOW, isSymlink: false } }) as never)
  await clock.set(NOW)
  await $.session.start(START)
  files.set('/t/me-1.jsonl', '{"type":"user"}\n{"type":"custom-title","customTitle":"Old \\"name\\"","sessionId":"me-1"}\n{"type":"custom-title","customTitle":"Agents and subagents","sessionId":"me-1"}\n')
  await $.classic.UserPromptSubmit({ prompt: 'go', transcript_path: '/t/me-1.jsonl', session_id: 'me-1', cwd: '/w' } as never)
  await $.turn.start({ text: 'go', turnId: 't' } as never)
  await $.turn.complete({ turnId: 't', reason: 'answer', answer: '', durationMs: 1000, isAborted: false } as never)
  await clock.advance(2000)
  expect(JSON.parse(files.get('/h/.claude/mochi/live/me-1.json') ?? '{}').title).toBe('Agents and subagents')
  // A rename reaches the next prompt.
  await $.classic.UserPromptSubmit({ prompt: 'more', transcript_path: '/t/me-1.jsonl', session_title: 'Renamed', session_id: 'me-1', cwd: '/w' } as never)
  expect((await $.command.run({ command: 'mochi', args: 'chats' } as never)).text).toContain('Renamed (this chat)')
})

test('a nearly used-up session that resets is told once, by the chat that claims it', { timeoutMs: 20_000 }, async ($, on) => {
  const at = NOW + 5000
  const { clock, files, alerts } = machine(on, [{ kind: 'five_hour', percentUsed: 97, resetsAt: new Date(at).toISOString() }])
  await clock.set(NOW)
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'mochi-buddy', component: 'AbovePrompt', surface: 'terminal', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} } } as never)
  for (let i = 0; i < 20; i++) await clock.advance(450)
  expect(await ui.find({ text: 'session limit reset · you can carry on' })).toBeDefined()
  expect(JSON.parse(files.get('/h/.claude/mochi/reset-five_hour.json') ?? '{}')).toEqual({ at, id: 'me-1' })
  expect(alerts).toEqual(['session limit reset · you can carry on'])
  for (let i = 0; i < 20; i++) await clock.advance(450)
  expect(alerts.length).toBe(1)
  await ui.unmount()
})

test('a reset another chat claimed is shown here but told only there', async ($, on) => {
  const at = NOW + 5000
  const { clock, files, alerts } = machine(on, [{ kind: 'five_hour', percentUsed: 100, resetsAt: new Date(at).toISOString() }])
  files.set('/h/.claude/mochi/reset-five_hour.json', JSON.stringify({ at, id: 'other' }))
  await clock.set(NOW)
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'mochi-buddy', component: 'AbovePrompt', surface: 'terminal', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} } } as never)
  for (let i = 0; i < 20; i++) await clock.advance(450)
  expect(await ui.find({ text: 'session limit reset · you can carry on' })).toBeDefined()
  expect(alerts).toEqual([])
  await ui.unmount()
})

test('a question left five minutes gets one more notification; /mochi chats lists this chat as waiting', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, alerts } = machine(on)
  on('tool.call', { tool: 'AskUserQuestion' }, () => new Promise(() => {}) as never)
  await clock.set(NOW)
  await $.session.start(START)
  void $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Which one?', header: 'Pick', options: [], multiSelect: false }] } as never).catch(() => undefined)
  await clock.advance(450)
  expect((await $.command.run({ command: 'mochi', args: 'chats' } as never)).text).toBe('Chats: 1 open\n  ● web-app (this chat) · waiting for you · waiting for your answer')
  await clock.advance(4 * MIN)
  expect(alerts).toEqual([])
  await clock.advance(MIN)
  expect(alerts).toEqual(['web-app has been waiting 5m'])
  await clock.advance(MIN)
  expect(alerts.length).toBe(1)
})

/** A Bash call that runs until `finish()`. */
function pendingBash(on: On) {
  const call = { finish: () => {} }
  on('tool.call', { tool: 'Bash' }, () => new Promise(resolve => {
    call.finish = () => resolve({ result: { stdout: '', stderr: '', interrupted: false }, text: '' })
  }) as never)
  return call
}

test('an approved permission leaves the face once its call is over: no wait is told', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, alerts } = machine(on)
  // Beneath Mochi, a settings hook that answers: Mochi never reads the answer (the call's end tells it), so a fixed deny stands in.
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny' } }))
  const bash = pendingBash(on)
  await clock.set(NOW)
  await $.session.start(START)
  const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.advance(450)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } } as never)
  expect((await $.command.run({ command: 'mochi', args: 'chats' } as never)).text).toContain('waiting for you · awaiting approval · npm test')
  bash.finish()
  await call
  await clock.advance(450)
  expect((await $.command.run({ command: 'mochi', args: 'chats' } as never)).text).not.toContain('waiting for you')
  await clock.advance(6 * MIN)
  expect(alerts).toEqual([])
})

test('a subagent’s approved permission gives the face back to the agent; its work goes on, no wait is told', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, alerts } = machine(on)
  // Beneath Mochi, a settings hook that answers: Mochi never reads the answer (the call's end tells it), so a fixed deny stands in.
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny' } }))
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('tool.call', { tool: 'Agent' }, () => new Promise(() => {}) as never)
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok', text: 'ok' }) as never)
  const bash = pendingBash(on)
  await clock.set(NOW)
  await $.session.start(START)
  await $.turn.start({ text: 'go', turnId: 't' } as never)
  void $.tool.call({ tool: 'Agent', description: 'write tests', prompt: 'x', subagent_type: 'general-purpose' } as never).catch(() => undefined)
  await clock.advance(450)
  const call = $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'sub-1' } as never)
  await clock.advance(450)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' }, agent_id: 'sub-1' } as never)
  bash.finish()
  await call
  for (let i = 0; i < 6; i++) {
    await $.tool.call({ tool: 'Read', file_path: '/w/a.ts', agentId: 'sub-1' } as never)
    await clock.advance(MIN)
  }
  const board = (await $.command.run({ command: 'mochi', args: 'chats' } as never)).text
  expect(board).toContain('working · agent · reading · a.ts')
  expect(board).not.toContain('waiting for you')
  expect(alerts).toEqual([])
})

/** This chat's file as it was last written. */
const liveFile = (files: Map<string, string>) => JSON.parse(files.get('/h/.claude/mochi/live/me-1.json') ?? '{}')

test('this chat’s file lists its subagents and what each does; a foreground one ends with its turn, a background one with its own', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `a${++n}` }) as never)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', { tool: 'Read' }, () => ({ result: 'ok', text: 'ok' }) as never)
  await clock.set(NOW)
  await $.session.start(START)
  await $.turn.start({ text: 'go', turnId: 't' } as never)
  await $.agent.spawn({ prompt: 'the secret plan, word for word', description: 'Write the tests', subagentType: 'general-purpose', background: false } as never)
  await $.agent.spawn({ prompt: 'p', description: 'Watch the build', subagentType: 'Explore', background: true } as never)
  await $.tool.call({ tool: 'Read', file_path: '/w/a.ts', agentId: 'a1' } as never)
  await clock.advance(2000)
  const busy = liveFile(files)
  expect(busy.v).toBe(2)
  expect(busy.agents).toEqual([
    { id: 'a1', type: 'general-purpose', task: 'Write the tests', activity: 'reading', since: NOW },
    { id: 'a2', type: 'Explore', task: 'Watch the build', activity: 'thinking', since: NOW },
  ])
  // A subagent's prompt never leaves the chat.
  expect(files.get('/h/.claude/mochi/live/me-1.json')).not.toContain('secret plan')
  await $.turn.complete({ turnId: 't', reason: 'answer', answer: '', durationMs: 4000, isAborted: false } as never)
  await clock.advance(2000)
  const after = liveFile(files)
  expect(after.agents.map((a: { id: string }) => a.id)).toEqual(['a2'])
  expect(after.lastTurn).toEqual({ at: NOW + 2000, reason: 'answer', seconds: 2 })
  await $.turn.complete({ agentId: 'a2', turnId: 't-a2', reason: 'answer', answer: '', durationMs: 1000, isAborted: false } as never)
  await clock.advance(2000)
  expect(liveFile(files).agents).toEqual([])
})

test('a subagent that says nothing for ten minutes is let go from the file', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on)
  on('agent.spawn', () => ({ model: 'm', agentId: 'b1' }) as never)
  await clock.set(NOW)
  await $.session.start(START)
  await $.agent.spawn({ prompt: 'p', description: 'Long wait', subagentType: 'Explore', background: true } as never)
  await clock.advance(9 * MIN)
  expect(liveFile(files).agents.length).toBe(1)
  await clock.advance(2 * MIN)
  expect(liveFile(files).agents).toEqual([])
})

test('this chat’s file says what it waits on the person for, and what its main loop does', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on)
  // Beneath Mochi, a settings hook that answers: Mochi never reads the answer (the call's end tells it), so a fixed deny stands in.
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny' } }))
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('tool.call', { tool: 'AskUserQuestion' }, () => new Promise(() => {}) as never)
  const bash = pendingBash(on)
  await clock.set(NOW)
  await $.session.start(START)
  await $.turn.start({ text: 'go', turnId: 't' } as never)
  const call = $.tool.call({ tool: 'Bash', command: 'npm test' })
  await clock.advance(2000)
  expect(liveFile(files)).toMatchObject({ state: 'busy', activity: 'testing', waitingFor: '' })
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } } as never)
  await clock.advance(2000)
  expect(liveFile(files)).toMatchObject({ state: 'asking', activity: '', waitingFor: 'permission' })
  bash.finish()
  await call
  void $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Which one?', header: 'Pick', options: [], multiSelect: false }] } as never).catch(() => undefined)
  await clock.advance(2000)
  expect(liveFile(files)).toMatchObject({ state: 'asking', waitingFor: 'question' })
})

test('this chat’s file gives its context in steps, its cost to the cent and a used-up window', { timeoutMs: 20_000 }, async ($, on) => {
  const resetsAt = NOW + 60 * MIN
  const { clock, files } = machine(on, [{ kind: 'five_hour', percentUsed: 100, resetsAt: new Date(resetsAt).toISOString() }, { kind: 'seven_day', percentUsed: 40, resetsAt: new Date(resetsAt).toISOString() }])
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(2000)
  expect(liveFile(files)).toMatchObject({ context: 0, cost: 0, limit: { kind: 'five_hour', resetsAt } })
})

test('a peer file is read field by field: an older one has none of the new fields, a bad entry is dropped and long words are cut', async () => {
  const v1 = peerOf({ id: 'x', label: 'old', state: 'busy', line: '', since: 0, at: NOW, agents: [{ id: 'a' }] }, NOW)
  expect(v1?.v).toBeUndefined()
  expect(v1?.agents).toBeUndefined()
  const v2 = peerOf({
    id: 'y', label: 'new', state: 'idle', line: '', since: 0, at: NOW, v: 2, activity: 'juggling', waitingFor: 'coffee', lastTurn: { at: NOW, reason: 'answer', seconds: 'many' },
    agents: [{ id: 'a', type: 'Explore', task: 'x'.repeat(200), activity: 'reading', since: NOW }, { type: 'no id' }, 'nonsense', ...Array.from({ length: 12 }, (_, i) => ({ id: `z${i}` }))],
    context: 230, cost: -3, limit: { kind: 'five_hour' },
  }, NOW)
  expect(v2).toMatchObject({ v: 2, activity: '', waitingFor: '', lastTurn: null, context: 100, cost: 0, limit: null })
  expect(v2?.agents?.length).toBe(8)
  expect(v2?.agents?.[0]).toMatchObject({ id: 'a', type: 'Explore', activity: 'reading' })
  expect(v2?.agents?.[0]?.task.length).toBeLessThanOrEqual(40)
  expect(v2?.agents?.[1]).toEqual({ id: 'z0', type: '', task: '', activity: 'thinking', since: 0 })
})

test('the details pane shows every chat as a Mochi: one the app can open opens its chat, one it cannot shows its card', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files, runs } = machine(on, [], true)
  const opened = () => runs.filter(argv => argv[0] === 'xdg-open')
  const agent = { id: 's1', type: 'Explore', task: 'Look around', activity: 'reading', since: NOW - MIN }
  files.set('/h/.claude/mochi/live/other-1.json', JSON.stringify({
    ...peer('other-1', 'asking', { label: 'api', line: 'awaiting approval · npm test', stateAt: NOW - 2 * MIN }), at: NOW + 60 * MIN,
    v: 2, activity: '', waitingFor: 'permission', lastTurn: null, context: 40, cost: 1.5, limit: null, agents: [agent], app: '',
  }))
  files.set('/h/.claude/mochi/live/other-2.json', JSON.stringify({ ...peer('other-2', 'busy', { label: 'web' }), at: NOW + 60 * MIN }))
  // Claude Code's file of a running session: its name in the app and its desktop session, for a chat whose Mochi leaves them out.
  files.set('/h/.claude/sessions/4242.json', JSON.stringify({ pid: 4242, sessionId: 'other-2', name: 'Fix the login page', entrypoint: 'claude-desktop', hostSessionId: 'local_abc-123' }))
  await clock.set(NOW)
  await $.session.start(START)
  for (let i = 0; i < 12; i++) await clock.advance(450)
  const pane = await $.ui.mount({ plugin: 'mochi-buddy', component: 'Pane', requestId: 'mochi-detay', surface: 'desktop', props: { bodyColumns: 100, bodyRows: 40 } } as never)
  // Where each stands on the floor: the asking one by the door, the busy one at the bench, this chat asleep in the corner.
  const floor = floorOf(partyOf(peer('me-1', 'idle'), [peer('other-1', 'asking'), peer('other-2', 'busy')], NOW), NOW)
  const across = (key: string) => {
    const spot = floor.spots.find(x => x.key === key)
    return spot ? (spot.x0 + spot.x1) / 2 / floor.width : -1
  }
  await pane.post({ fx: across('other-2') }, { in: 'party' })
  expect(opened()).toEqual([['xdg-open', 'claude://code/continue?session=local_abc-123']])
  expect(await pane.find({ key: 'crew:close' })).toBeUndefined()
  // The app cannot open this one: its card shows.
  await pane.post({ fx: across('other-1') }, { in: 'party' })
  expect(opened().length).toBe(1)
  expect(await pane.find({ text: 'api' })).toBeDefined()
  expect(await pane.find({ text: /^awaiting approval · npm test · \d+m$/ })).toBeDefined()
  expect(await pane.find({ text: '  Explore · Look around · reading · 1m' })).toBeDefined()
  expect(await pane.find({ text: 'Tokens per subagent are not measured.' })).toBeDefined()
  expect(await pane.find({ text: 'context 40% · cost $1.50' })).toBeDefined()
  await pane.press({ key: 'crew:close' })
  expect(await pane.find({ key: 'crew:close' })).toBeUndefined()
  await pane.unmount()
  // The name in the app reaches the board too.
  expect((await $.command.run({ command: 'mochi', args: 'chats' } as never)).text).toContain('Fix the login page')
})

test('Claude Code’s file of a session is read for its name and desktop session, and nothing else opens', async () => {
  expect(appSessionOf({ sessionId: 's', name: 'A  name', entrypoint: 'claude-desktop', hostSessionId: 'local_ab-1' })).toEqual({ id: 's', name: 'A name', app: 'local_ab-1' })
  // A terminal session has no desktop session; an id of another shape opens nothing.
  expect(appSessionOf({ sessionId: 's', name: 'x', entrypoint: 'cli', hostSessionId: 'local_ab' })?.app).toBe('')
  expect(appSessionOf({ sessionId: 's', entrypoint: 'claude-desktop', hostSessionId: 'local_a&b=c' })?.app).toBe('')
  expect(appSessionOf({ name: 'no id' })).toBeNull()
  expect(appLink('local_ab-1')).toBe('claude://code/continue?session=local_ab-1')
  expect(appLink('local_a b')).toBe('')
  expect(appLink(undefined)).toBe('')
  // Windows opens an app's link as a link, not as a path.
  expect(openCommand('windows', 'claude://code/continue?session=local_ab-1')).toEqual(['explorer.exe', 'claude://code/continue?session=local_ab-1'])
  expect(openCommand('windows', 'C:/x/y')).toEqual(['explorer.exe', 'C:\\x\\y'])
})

test('this chat’s file lists its usage windows in whole percents, and is written again when one moves by a whole percent', { timeoutMs: 20_000 }, async ($, on) => {
  const resetsAt = NOW + 60 * MIN
  const at = new Date(resetsAt).toISOString()
  const limits = [{ kind: 'five_hour', percentUsed: 33.6, resetsAt: at }, { kind: 'seven_day', percentUsed: 40, resetsAt: at }]
  const { clock, files } = machine(on, limits)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(2000)
  expect(liveFile(files).windows).toEqual([{ kind: 'five_hour', p: 34, resetsAt }, { kind: 'seven_day', p: 40, resetsAt }])
  // The used-up window is told as before.
  expect(liveFile(files).limit).toBeNull()
  // A turn's end measures again: a fraction more leaves the windows as they were, a whole percent more is in the file within two seconds.
  const turn = async () => {
    await $.turn.start({ text: 'go', turnId: 't' } as never)
    await $.turn.complete({ turnId: 't', reason: 'answer', answer: '', durationMs: 1000, isAborted: false } as never)
    await clock.advance(2000)
  }
  limits[0]!.percentUsed = 34.4
  await turn()
  expect(liveFile(files).windows[0]).toEqual({ kind: 'five_hour', p: 34, resetsAt })
  limits[0]!.percentUsed = 35.2
  await turn()
  expect(liveFile(files).windows[0]).toEqual({ kind: 'five_hour', p: 35, resetsAt })
})

test('the person’s look is written for the desktop app (look.json), and again when a pick changes it', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on)
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(20_000)
  const look = () => JSON.parse(files.get('/h/.claude/mochi/look.json') ?? 'null')
  expect(look()).toMatchObject({ v: 1, pick: {}, birthday: '' })
  expect(Array.isArray(look().items)).toBe(true)
  expect(typeof look().tz).toBe('number')
  // Taking the hat off is a pick too: the app's Mochi goes bareheaded as well.
  expect((await $.command.run({ command: 'mochi', args: 'wear none' } as never)).text).toBeTruthy()
  await clock.advance(20_000)
  expect(look().pick.head).toBeNull()
})

test('a wardrobe choice goes to prefs.json, and a newer one made in the desktop app is worn here too', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on)
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(20_000)
  const P = '/h/.claude/mochi/prefs.json'
  const look = () => JSON.parse(files.get('/h/.claude/mochi/look.json') ?? 'null')
  await $.command.run({ command: 'mochi', args: 'wear none' } as never)
  expect(JSON.parse(files.get(P) ?? 'null')).toMatchObject({ v: 1, pick: { head: null } })
  // The app gives the head back to Mochi: this chat wears that too, and does not write it back.
  files.set(P, JSON.stringify({ v: 1, at: NOW + 60_000, pick: {} }))
  await clock.advance(20_000)
  expect(look().pick.head).toBeUndefined()
  expect(JSON.parse(files.get(P) ?? 'null')).toEqual({ v: 1, at: NOW + 60_000, pick: {} })
  // A choice older than the one worn is not worn.
  files.set(P, JSON.stringify({ v: 1, at: NOW, pick: { head: null } }))
  await clock.advance(20_000)
  expect(look().pick.head).toBeUndefined()
})

test('the colour chosen in the desktop app is worn by the band’s Mochi too, while its level opens it', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on, [], true)
  const worked = { ...EMPTY_DAY, turns: 30, commits: 2 }
  files.set('/h/.claude/mochi/days/old-1.json', JSON.stringify({ id: 'old-1', label: 'web', days: { '2025-10-08': worked, '2025-10-09': worked } }))
  files.set('/h/.claude/mochi/prefs.json', JSON.stringify({ v: 1, at: NOW - 60_000, pick: {}, skin: 'peach' }))
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(20_000)
  const band = async () => {
    await $.command.run({ command: 'mochi', args: 'snap' } as never)
    return files.get('/h/.claude/mochi/share/mochi-band.svg') ?? ''
  }
  expect(await band()).toContain('skin-map-peach')
  // Mint opens far later: Mochi keeps its own clay.
  files.set('/h/.claude/mochi/prefs.json', JSON.stringify({ v: 1, at: NOW + 60_000, pick: {}, skin: 'mint' }))
  await clock.advance(20_000)
  expect(await band()).not.toContain('skin-map-')
})

test('a colour chosen in the mod is worn here and goes to prefs.json for the desktop app, while its level opens it', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on, [], true)
  const worked = { ...EMPTY_DAY, turns: 30, commits: 2 }
  files.set('/h/.claude/mochi/days/old-1.json', JSON.stringify({ id: 'old-1', label: 'web', days: { '2025-10-08': worked, '2025-10-09': worked } }))
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(20_000)
  const P = '/h/.claude/mochi/prefs.json'
  const saved = () => JSON.parse(files.get(P) ?? 'null')
  const band = async () => {
    await $.command.run({ command: 'mochi', args: 'snap' } as never)
    return files.get('/h/.claude/mochi/share/mochi-band.svg') ?? ''
  }
  const skin = async (arg: string) => (await $.command.run({ command: 'mochi', args: `skin ${arg}`.trim() } as never)).text
  expect(await skin('')).toContain('Peach')
  expect(await skin('peach')).toBe('Mochi is Peach now.')
  expect(saved()).toMatchObject({ v: 1, skin: 'peach' })
  await clock.advance(20_000)
  expect(await band()).toContain('skin-map-peach')
  // A wardrobe change keeps the colour.
  await $.command.run({ command: 'mochi', args: 'wear none' } as never)
  expect(saved()).toMatchObject({ pick: { head: null }, skin: 'peach' })
  // Mint opens far later, and a colour that does not exist is not one: nothing changes.
  expect(await skin('mint')).toBe('Mint is locked (level 13).')
  expect(await skin('plaid')).toBe('No such colour: plaid')
  expect(saved().skin).toBe('peach')
  // Its own clay takes the colour off, here and for the app; the outfit stays.
  expect(await skin('clay')).toBe('Mochi is Clay now.')
  expect(saved()).toMatchObject({ pick: { head: null } })
  expect(saved().skin).toBeUndefined()
  // The drawing changes once Mochi has held its last pose a moment.
  await clock.advance(20_000)
  expect(await band()).not.toContain('skin-map-')
})

test('the details pane’s wardrobe has a Colour tab: a colour pressed is worn and written for the desktop app', { timeoutMs: 20_000 }, async ($, on) => {
  const { clock, files } = machine(on, [], true)
  const worked = { ...EMPTY_DAY, turns: 30, commits: 2 }
  files.set('/h/.claude/mochi/days/old-1.json', JSON.stringify({ id: 'old-1', label: 'web', days: { '2025-10-08': worked, '2025-10-09': worked } }))
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(20_000)
  const pane = await $.ui.mount({ plugin: 'mochi-buddy', component: 'Pane', requestId: 'mochi-detay', surface: 'desktop', props: { bodyColumns: 100, bodyRows: 40 } } as never)
  await pane.press({ key: 'tab:mochi' } as never)
  await pane.press({ key: 'shelf:colour' } as never)
  // What is locked shows the level that opens it, and no button.
  expect(await pane.find({ key: 'skin:mint' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: 'level 13' })).toBeDefined()
  await pane.press({ key: 'skin:peach' } as never)
  expect(JSON.parse(files.get('/h/.claude/mochi/prefs.json') ?? 'null')).toMatchObject({ skin: 'peach' })
  expect((await pane.find({ type: 'Text', text: /^Colour · / }))?.text).toBe('Colour · Peach')
  await pane.unmount()
})

test('a peer file’s usage windows are read one by one: junk is dropped, percents are whole, four at most; a file without them has none', async () => {
  const at = NOW + 60 * MIN
  const base = { id: 'y', label: 'new', state: 'idle', line: '', since: 0, at: NOW, v: 2 }
  expect(peerOf(base, NOW)?.windows).toEqual([])
  expect(peerOf({ ...base, windows: 'all of them' }, NOW)?.windows).toEqual([])
  const windows = [
    { kind: 'five_hour', p: 33.6, resetsAt: at }, 'nonsense', null, { kind: 'seven_day', p: '40', resetsAt: at }, { p: 5, resetsAt: at }, { kind: 'opus', p: 9 },
    { kind: 'seven_day', p: 140, resetsAt: at }, { kind: 'x'.repeat(90), p: -3, resetsAt: 0 }, { kind: 'a', p: 1, resetsAt: at }, { kind: 'b', p: 2, resetsAt: at },
  ]
  const read = peerOf({ ...base, windows }, NOW)?.windows ?? []
  expect(read.map(w => w.p)).toEqual([34, 100, 0, 1])
  expect(read[0]).toEqual({ kind: 'five_hour', p: 34, resetsAt: at })
  expect(read[1]).toEqual({ kind: 'seven_day', p: 100, resetsAt: at })
  expect(read[2]?.kind.length).toBeLessThanOrEqual(20)
  // An older Mochi's file has none of the newer fields, whatever else is in it.
  expect(peerOf({ ...base, v: undefined, windows }, NOW)?.windows).toBeUndefined()
})

test('the desktop app’s Mochi is out only while its file says shown and is fresh', async () => {
  expect(deskOf({ v: 1, at: NOW, isShown: true, version: '0.1.0' }, NOW)).toBe(true)
  expect(deskOf({ v: 1, at: NOW - ALIVE_MS, isShown: true }, NOW)).toBe(true)
  // Silent for too long: the app was closed without a goodbye.
  expect(deskOf({ v: 1, at: NOW - ALIVE_MS - 1, isShown: true }, NOW)).toBe(false)
  expect(deskOf({ v: 1, at: NOW, isShown: false }, NOW)).toBe(false)
  for (const junk of [null, undefined, 'shown', 7, [], {}, { isShown: true }, { at: NOW, isShown: 'true' }, { at: String(NOW), isShown: true }]) expect(deskOf(junk, NOW)).toBe(false)
  // Mochi stays in the band unless the person asks it to step aside; the older setting, saved on by default, is let go.
  expect(restorePrefs({ lang: 'en' }).stepsAside).toBe(false)
  expect(restorePrefs({ goesOut: true } as never).stepsAside).toBe(false)
  expect(restorePrefs({ stepsAside: true }).stepsAside).toBe(true)
})

const BAND = {
  plugin: 'mochi-buddy',
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
}

test('Mochi stays in the band while the desktop app’s Mochi is out; with the setting on it steps aside, the rest stays, and it is back when the app goes', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, files } = machine(on, [{ kind: 'five_hour', percentUsed: 34, resetsAt: new Date(NOW + 300 * MIN).toISOString() }])
  const APP = '/h/.claude/mochi/app.json'
  let now = NOW
  const pass = async (ms: number) => {
    await clock.advance(ms)
    now += ms
  }
  /** The desktop app writes its file, now. */
  const app = (isShown: boolean) => files.set(APP, JSON.stringify({ v: 1, at: now, isShown, version: '0.1.0' }))
  /** The band as each surface draws it now: the terminal's mascot and facts, its one-line face, and the desktop's panel. */
  const drawn = async () => {
    const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const ascii = (await terminal.find({ text: /╭─────╮/ })) !== undefined
    const facts = (await terminal.find({ text: /context 1%/ })) !== undefined
    await terminal.unmount()
    const line = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, maxRows: 2 } })
    const face = (await line.find({ text: /^\(.{3}\) / })) !== undefined
    await line.unmount()
    const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
    await pass(500)
    const svg = String((await desktop.find({ type: 'Svg' }))?.props.source)
    await desktop.unmount()
    return { ascii, face, facts, mascot: svg.includes('<image href="data:image/webp'), rings: svg.includes('>1%<') && svg.includes('>34%<'), line: svg.includes('class="bub"') }
  }
  const WITH = { ascii: true, face: true, facts: true, mascot: true, rings: true, line: true }
  const WITHOUT = { ...WITH, ascii: false, face: false, mascot: false }
  const beat = () => pass(4000)
  await clock.set(NOW)
  await $.session.start(START)
  await beat()
  // No desktop app: Mochi is in the band.
  expect(await drawn()).toEqual(WITH)
  // The app's Mochi out: by default the band keeps its own too.
  app(true)
  await beat()
  expect(await drawn()).toEqual(WITH)
  app(false)
  await $.command.run({ command: 'mochi', args: 'desktop on' } as never)
  await beat()
  expect(await drawn()).toEqual(WITH)
  // Its Mochi comes out: the band's steps aside at the next read, and everything else stays.
  app(true)
  await beat()
  expect(await drawn()).toEqual(WITHOUT)
  // Hidden in the app: back in the band.
  app(false)
  await beat()
  expect(await drawn()).toEqual(WITH)
  app(true)
  await beat()
  expect(await drawn()).toEqual(WITHOUT)
  // The app quits and takes its file with it.
  files.delete(APP)
  await beat()
  expect(await drawn()).toEqual(WITH)
  // An app that went silent without a goodbye is gone after a while.
  app(true)
  await beat()
  expect(await drawn()).toEqual(WITHOUT)
  await pass(ALIVE_MS)
  expect(await drawn()).toEqual(WITH)
  // With the setting off the band never changes for the app.
  await $.command.run({ command: 'mochi', args: 'desktop off' } as never)
  app(true)
  await beat()
  expect(await drawn()).toEqual(WITH)
  await $.command.run({ command: 'mochi', args: 'desktop on' } as never)
  expect(await drawn()).toEqual(WITHOUT)
  // Hidden is hidden, whatever the app does.
  await $.command.run({ command: 'mochi', args: 'hide' } as never)
  expect(await drawn()).toMatchObject({ ascii: false, facts: false })
})

test('/mochi desktop turns stepping aside for the desktop app off and on, and says which', async ($, on) => {
  const { clock } = machine(on)
  await clock.set(NOW)
  await $.session.start(START)
  const run = async (args: string) => (await $.command.run({ command: 'mochi', args } as never)).text
  const [ON, OFF] = ['Desktop on: while Mochi is out on the desktop, the band is drawn without it.', 'Desktop off: Mochi stays in the band.']
  // Off from the start; alone the word turns it over, with on or off it sets it.
  expect(await run('desktop')).toBe(ON)
  expect(await run('desktop')).toBe(OFF)
  expect(await run('desktop on')).toBe(ON)
  expect(await run('desktop off')).toBe(OFF)
  expect(await run('desktop off')).toBe(OFF)
  // /mochi desk is still the work not yet safe on a remote.
  expect(await run('desk')).not.toBe(OFF)
  expect(await run('desk')).not.toBe(ON)
})

test('the wardrobe stays within what the desktop draws: its pictures together under 160,000 characters on every shelf, every open item still pressable', { timeoutMs: 30_000 }, async ($, on) => {
  const { clock, files } = machine(on, [], true)
  // Years of busy days: nearly everything is open, the heaviest wardrobe there is.
  const big = { ...EMPTY_DAY, turns: 400, commits: 40 }
  const days: Record<string, unknown> = {}
  for (let i = 1; i <= 28; i++) days[`2025-09-${String(i).padStart(2, '0')}`] = big
  files.set('/h/.claude/mochi/days/old-1.json', JSON.stringify({ id: 'old-1', label: 'web', days }))
  files.set('/h/.claude/mochi/prefs.json', JSON.stringify({ v: 1, at: NOW - 60_000, pick: { head: 'fez', face: 'bushybrows', lip: 'mustache', chin: 'goatee', ground: 'sprout' }, skin: 'aurora' }))
  await clock.set(NOW)
  await $.session.start(START)
  await clock.advance(20_000)
  const pane = await $.ui.mount({ plugin: 'mochi-buddy', component: 'Pane', requestId: 'mochi-detay', surface: 'desktop', props: { bodyColumns: 140, bodyRows: 40 } } as never)
  await pane.press({ key: 'tab:mochi' } as never)
  for (const shelf of ['head', 'eyes', 'face', 'lip', 'chin', 'neck', 'held', 'ground', 'colour']) {
    await pane.press({ key: `shelf:${shelf}` } as never)
    const total = ((await pane.findAll({ type: 'Svg' })) as { props: { source: string } }[]).reduce((n, el) => n + el.props.source.length, 0)
    expect({ shelf, over: total > 160_000 }).toEqual({ shelf, over: false })
  }
  await pane.press({ key: 'shelf:head' } as never)
  // The cards show the 1x pictures: the 2x ones are the desktop app's.
  const sources = ((await pane.findAll({ type: 'Svg' })) as { props: { source: string } }[]).map(el => el.props.source)
  expect(sources).toContain(itemIcon('crown', true, true))
  expect(sources).not.toContain(itemIcon('crown', true))
  expect(itemIcon('crown', true, true).length < itemIcon('crown', true).length * 0.7).toBe(true)
  expect(await pane.find({ key: 'wear:fez' })).toBeDefined()
  expect(await pane.find({ key: 'wear:crown' })).toBeDefined()
  await pane.unmount()
})
