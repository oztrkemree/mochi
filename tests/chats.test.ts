import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { boardLines, boardOf, chatsCard, claimOf, isLinkedWorktree, isWaitLong, resetsPassed } from '../hooks/chats'
import { detailLines } from '../hooks/detail'
import { setLang } from '../hooks/i18n'
import { peerOf } from '../hooks/live'
import { NO_ENV } from '../hooks/state'

// These read the English lines.
setLang('en')

const NOW = 1_760_000_000_000
const MIN = 60_000
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never

/** A session's engine beneath the plugin, its files kept in memory; returns the files, the system notifications' texts and the clock. */
function machine(on: On, limits: { kind: string; percentUsed: number; resetsAt: string }[] = []) {
  mock.store(on, { prefs: { lang: 'en' } })
  mock.env(on, { HOME: '/h' })
  const clock = mock.clock(on)
  const files = new Map<string, string>()
  // The engine writes a path with the separators (and on Windows the drive) of the system the test runs on.
  const slashed = (path: string) => path.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')
  const alerts: string[] = []
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
  on('fs.list', () => ({ value: [] }))
  on('process.run', ($, e) => {
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
  return { clock, files, alerts }
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
  expect(old).toEqual({ id: 'x', label: 'old', state: 'idle', line: 'ready', since: 0, at: NOW, folder: '', branch: '', isWorktree: false, stateAt: 0 })
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
  void $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Which one?', header: 'Pick', options: [], multiSelect: false }] } as never)
  await clock.advance(450)
  expect((await $.command.run({ command: 'mochi', args: 'chats' } as never)).text).toBe('Chats: 1 open\n  ● web-app (this chat) · waiting for you · waiting for your answer')
  await clock.advance(4 * MIN)
  expect(alerts).toEqual([])
  await clock.advance(MIN)
  expect(alerts).toEqual(['web-app has been waiting 5m'])
  await clock.advance(MIN)
  expect(alerts.length).toBe(1)
})
