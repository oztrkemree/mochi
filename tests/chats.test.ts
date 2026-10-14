import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { boardLines, boardOf, chatsCard, claimOf, isLinkedWorktree, isWaitLong, resetsPassed } from '../hooks/chats'
import { detailLines } from '../hooks/detail'
import { setLang } from '../hooks/i18n'
import { appLink, appSessionOf, peerOf } from '../hooks/live'
import { floorOf, partyOf } from '../hooks/party'
import { openCommand } from '../hooks/system'
import { NO_ENV } from '../hooks/state'

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

test('a nearly used-up session that resets is told once, by the chat that claims it', async ($, on) => {
  const at = NOW + 5000
  const { clock, files, alerts } = machine(on, [{ kind: 'five_hour', percentUsed: 97, resetsAt: new Date(at).toISOString() }])
  await clock.set(NOW)
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'mochi', component: 'AbovePrompt', surface: 'terminal', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} } } as never)
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
  const ui = await $.ui.mount({ plugin: 'mochi', component: 'AbovePrompt', surface: 'terminal', props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} } } as never)
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
  on('classic.PermissionRequest', () => ({}) as never)
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
  on('classic.PermissionRequest', () => ({}) as never)
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
  on('classic.PermissionRequest', () => ({}) as never)
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
  const pane = await $.ui.mount({ plugin: 'mochi', component: 'Pane', requestId: 'mochi-detay', surface: 'desktop', props: { bodyColumns: 100, bodyRows: 40 } } as never)
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
