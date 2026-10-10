import type { EngineInterface, On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

import type { Env } from '../types'
import { NO_LOG, countRules, hasRule, isNewer, newsFor, newsLines, permKey, pickTip, projectKey, rulesOf, settleRule, shownTip, tipLines, turnTips, withRule } from '../hooks/coach'
import type { TurnNote } from '../hooks/coach'
import { LANGS, setLang } from '../hooks/i18n'
import { EMPTY_DAY } from '../hooks/level'
import { NO_ENV } from '../hooks/state'

// These read the English lines; each test that speaks another language says so.
setLang('en')

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never
const NOW = 1_760_000_000_000
const MIN = 60_000
const slashed = (path: string) => path.replaceAll('\\', '/')

/**
 * What a session's engine answers beneath the plugin, with files in memory
 * (keyed by path, `/` for a separator), the toasts and the questions asked.
 */
function world(on: On, store: Record<string, unknown>, files: Record<string, string>, answer = 'Add') {
  on('store.get', ($, e) => ({ value: store[e.key] }) as never)
  on('store.set', ($, e) => {
    store[e.key] = e.value
    return { value: undefined } as never
  })
  mock.env(on, { HOME: '/home/me' })
  const clock = mock.clock(on)
  const toasts: string[] = []
  const asked: string[] = []
  const find = (path: string) => Object.keys(files).find(k => slashed(path).endsWith(k))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('session.id', () => ({ value: 'c-1' }) as never)
  on('session.root', () => ({ value: '/work/app' }) as never)
  on('session.turns', () => ({ value: 3 }) as never)
  on('session.surfaces', () => ({ value: ['terminal'] as never }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }) as never)
  on('fs.list', () => ({ value: [] }))
  on('fs.exists', ($, e) => ({ value: find(e.path) !== undefined }))
  on('fs.read', ($, e) => {
    const key = find(e.path)
    if (key === undefined) throw new Error('ENOENT')
    return { value: files[key] } as never
  })
  on('fs.write', ($, e) => {
    const path = slashed(e.path)
    files[find(path) ?? path] = e.text
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('tool.call', { tool: 'AskUserQuestion' }, (($: unknown, e: { questions: { question: string }[] }) => {
    const question = e.questions[0]?.question ?? ''
    asked.push(question)
    return { result: { questions: e.questions, answers: { [question]: answer } }, text: answer }
  }) as never)
  return { clock, toasts, asked }
}

/** Lets the timer run for `ms`, beat by beat. */
async function wait(clock: MockClock, ms: number) {
  for (let i = 0; i < ms / 450; i++) await clock.advance(450)
}

/** A turn that ends for `reason`, then a quiet while. */
async function answer($: EngineInterface, clock: MockClock, reason: 'answer' | 'aborted') {
  await $.turn.start({ text: 'go', turnId: 't' })
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: reason === 'aborted', turnId: 't', reason })
  await wait(clock, 15_000)
}

/** A prompt from `kind` and the turn it starts, then a quiet while. */
async function turn($: EngineInterface, clock: MockClock, text: string, kind = 'composer') {
  await $.prompt.submit({ text, origin: { kind } } as never)
  await answer($, clock, 'answer')
}

test('standing instructions are found in ten languages; requests, complaints and questions are not', () => {
  const found = {
    en: ['Please use pnpm.', "Don't add comments", 'Always run the tests before you commit', 'Fix the login bug. Use pnpm, not npm!'],
    tr: ['pnpm kullan', 'Yorum ekleme.', 'Her zaman testleri çalıştır'],
    es: ['Usa pnpm', 'No añadas comentarios'],
    de: ['Verwende pnpm', 'Keine Kommentare hinzufügen'],
    fr: ["N’ajoute pas de commentaires", 'Utilise pnpm'],
    pt: ['Não adicione comentários', 'Sempre rode os testes'],
    ru: ['Не добавляй комментарии', 'Используй pnpm'],
    zh: ['不要添加注释', '使用 pnpm'],
    ja: ['コメントを追加しないで', '常にpnpmを使ってください'],
    ko: ['항상 pnpm 사용해', '주석 달지 마세요'],
  }
  expect(Object.values(found).map(list => list.map(rulesOf))).toEqual([
    [['use pnpm'], ["don't add comments"], ['always run the tests before you commit'], ['use pnpm, not npm']],
    [['pnpm kullan'], ['yorum ekleme'], ['her zaman testleri çalıştır']],
    [['usa pnpm'], ['no añadas comentarios']],
    [['verwende pnpm'], ['keine kommentare hinzufügen']],
    [["n'ajoute pas de commentaires"], ['utilise pnpm']],
    [['não adicione comentários'], ['sempre rode os testes']],
    [['не добавляй комментарии'], ['используй pnpm']],
    [['不要添加注释'], ['使用 pnpm']],
    [['コメントを追加しないで'], ['常にpnpmを使って']],
    [['항상 pnpm 사용해'], ['주석 달지 마세요']],
  ])
  const none = [
    'use this helper here', "I don't know why it fails", "don't know", 'why do you never use pnpm?', 'no worries', 'never',
    'fix the failing test in auth.ts', 'always use the new parser for every file in the src folder from now on',
    'bunu kullan', 'testler hâlâ çalışmıyor', 'her zaman böyle oluyordu', 'no es correcto', 'keine Ahnung', 'ça ne marche pas',
    'não funciona', 'не работает', '这个不要改', '用户登录失败', '为什么不能用？', 'これを使って', 'テストが失敗した', '이거 고쳐줘',
    `use pnpm\n${'x'.repeat(2000)}`,
  ]
  for (const text of none) expect([text, rulesOf(text)]).toEqual([text, []])
})

test('the third time an instruction is given in a project, Mochi asks; add and never settle it, not now counts again', () => {
  const app = projectKey('C:\\work\\app\\')
  expect(app).toBe('C:/work/app')
  let log = NO_LOG
  const say = (project: string, rules: string[]) => {
    const r = countRules(log, project, rules)
    log = r.log
    return r.ask
  }
  expect(say(app, ['use pnpm'])).toBe(null)
  expect(say('/other', ['use pnpm'])).toBe(null)
  expect(say(app, ['use pnpm', "don't add comments"])).toBe(null)
  expect(say(app, ['use pnpm'])).toBe('use pnpm')
  expect(log.rules[app]).toEqual({ "don't add comments": 1, 'use pnpm': 3 })
  log = settleRule(log, app, 'use pnpm', true)
  expect(say(app, ['use pnpm'])).toBe(null)
  expect(log.rules[app]?.['use pnpm']).toBe(-1)
  log = settleRule(log, '/other', 'use pnpm', false)
  expect(say('/other', ['use pnpm'])).toBe(null)
  expect(say('/other', ['use pnpm'])).toBe(null)
  expect(say('/other', ['use pnpm'])).toBe('use pnpm')

  expect(hasRule('# Rules\n- Use  pnpm, not npm.\n', 'use pnpm')).toBe(true)
  expect(hasRule('# Rules\n', 'use pnpm')).toBe(false)
  expect(withRule('', 'use pnpm')).toBe('- use pnpm\n')
  expect(withRule('# App', 'use pnpm')).toBe('# App\n- use pnpm\n')
  expect(withRule('# App\n', 'use pnpm')).toBe('# App\n- use pnpm\n')
})

test('a tip waits for its situation, and shows at most once an hour, three times a day and twice ever', () => {
  const at = Date.UTC(2026, 9, 10, 8, 0)
  const now = (hours: number) => at + hours * 60 * MIN
  expect(pickTip(NO_LOG, { wear: { at, arg: '' }, rewind: { at, arg: '' } }, at, 0)).toBe('rewind')
  expect(pickTip(NO_LOG, { rewind: { at, arg: '' } }, at + 31 * MIN, 0)).toBe(null)
  let log = shownTip(NO_LOG, 'rewind', at, 0)
  expect(pickTip(log, { rewind: { at: now(0.5), arg: '' } }, now(0.5), 0)).toBe(null)
  expect(pickTip(log, { rewind: { at: now(1.1), arg: '' } }, now(1.1), 0)).toBe('rewind')
  log = shownTip(log, 'rewind', now(1.1), 0)
  expect(pickTip(log, { rewind: { at: now(3), arg: '' } }, now(3), 0)).toBe(null)
  log = shownTip(log, 'compact', now(3), 0)
  expect(log.today).toBe(3)
  expect(pickTip(log, { mcp: { at: now(5), arg: '' } }, now(5), 0)).toBe(null)
  expect(pickTip(log, { mcp: { at: now(24), arg: '' } }, now(24), 0)).toBe('mcp')

  const turn: TurnNote = { reason: 'answer', errorRun: 0, isLongFirst: false, hasPlanned: false, hasPick: false }
  const t0 = NOW
  expect(turnTips(NO_ENV, turn, t0)).toEqual([])
  expect(turnTips(NO_ENV, { ...turn, reason: 'aborted' }, t0)).toEqual(['rewind'])
  expect(turnTips(NO_ENV, { ...turn, errorRun: 3 }, t0)).toEqual(['rewind'])
  expect(turnTips(NO_ENV, { ...turn, isLongFirst: true }, t0)).toEqual(['plan'])
  expect(turnTips(NO_ENV, { ...turn, isLongFirst: true, hasPlanned: true }, t0)).toEqual([])
  expect(turnTips({ ...NO_ENV, tokens: 150_000, window: 200_000 }, turn, t0)).toEqual(['compact'])
  const slices = [{ name: 'MCP tools', tokens: 30_000, color: '' }, { name: 'Messages', tokens: 10_000, color: '' }]
  expect(turnTips({ ...NO_ENV, tokens: 40_000, window: 200_000, slices }, turn, t0)).toEqual(['mcp'])
  const git = (changed: number, lastCommit: number): Env['git'] => ({ branch: 'main', ahead: 0, behind: 0, files: [], changed, lastCommit })
  expect(turnTips({ ...NO_ENV, git: git(12, t0 - 2 * 60 * MIN) }, turn, t0)).toEqual(['commit'])
  expect(turnTips({ ...NO_ENV, git: git(12, t0 - 10 * MIN) }, turn, t0)).toEqual([])
  expect(turnTips({ ...NO_ENV, git: git(3, 0) }, turn, t0)).toEqual([])
  const history = { days: {}, total: { ...EMPTY_DAY, turns: 25 }, activeDays: 1, streak: 1, bestStreak: 1 }
  expect(turnTips({ ...NO_ENV, history }, turn, t0)).toEqual(['rings', 'wear'])
  expect(turnTips({ ...NO_ENV, history }, { ...turn, hasPick: true }, t0)).toEqual(['rings'])

  expect(permKey('Bash', { command: '  npm install left-pad' })).toBe('npm')
  expect(permKey('PowerShell', { command: 'Remove-Item build -Recurse' })).toBe('Remove-Item')
  expect(permKey('mcp__github__create_issue', {})).toBe('github')
  expect(permKey('WebFetch', { url: 'https://example.com' })).toBe('WebFetch')
  expect(tipLines('permissions', 'npm').text).toContain('npm')
  expect(tipLines('commit', '12').text.startsWith('12 files changed')).toBe(true)
  expect(tipLines('rewind', '').line).toBe('Esc Esc · rewind')
})

test('what is new: versions compare by number, and every language has notes for this release', () => {
  expect(isNewer('0.3.0', '0.2.0')).toBe(true)
  expect(isNewer('0.10.0', '0.9.9')).toBe(true)
  expect(isNewer('1.0.0', '0.99.0')).toBe(true)
  expect(isNewer('0.3.0', '0.3.0')).toBe(false)
  expect(isNewer('0.3', '0.3.0')).toBe(false)
  expect(isNewer('0.2.0', '0.3.0')).toBe(false)
  const lines = newsLines('0.3.0').split('\n')
  expect(lines[0]).toBe(`Mochi 0.3.0 · ${newsFor('0.3.0')?.headline}`)
  expect(lines.length > 2).toBe(true)
  expect(newsLines('9.9.9')).toBe('No notes for Mochi 9.9.9.')
  for (const l of LANGS) {
    setLang(l)
    expect([l, (newsFor('0.3.0')?.notes.length ?? 0) > 0]).toEqual([l, true])
  }
  setLang('en')
})

test('an instruction typed a third time is offered for CLAUDE.md, and written only on add', async ($, on) => {
  const files: Record<string, string> = { '/work/app/CLAUDE.md': '# App\n' }
  const { clock, asked } = world(on, { prefs: { lang: 'en' } }, files)
  await clock.set(NOW)
  await $.session.start(START)
  const say = (text: string, kind = 'composer') => turn($, clock, text, kind)
  await say('Please use pnpm.')
  await say('Use pnpm!')
  // Another plugin's prompt is not the person's word.
  await say('use pnpm', 'plugin')
  expect(asked).toEqual([])
  await say('use pnpm')
  expect(asked).toEqual(['Add “use pnpm” to CLAUDE.md?'])
  expect(files['/work/app/CLAUDE.md']).toBe('# App\n- use pnpm\n')
  const log = JSON.parse(files[Object.keys(files).find(k => k.endsWith('/.claude/mochi/coach.json')) ?? ''] ?? '{}') as { rules: Record<string, Record<string, number>> }
  expect(Object.values(log.rules)).toEqual([{ 'use pnpm': -1 }])
  // Once added, never asked again.
  for (let i = 0; i < 3; i++) await say('use pnpm')
  expect(asked.length).toBe(1)
  // With tips off, nothing is counted or asked.
  expect((await $.command.run({ command: 'mochi', args: 'tips' } as never)).text).toBe('Tips off.')
  for (let i = 0; i < 3; i++) await say("don't add comments")
  expect(asked.length).toBe(1)
  expect(files['/work/app/CLAUDE.md']).toBe('# App\n- use pnpm\n')
})

test('“never for this” leaves CLAUDE.md alone and is not asked again', async ($, on) => {
  const files: Record<string, string> = {}
  const { clock, asked } = world(on, { prefs: { lang: 'en' } }, files, 'Never for this')
  await clock.set(NOW)
  await $.session.start(START)
  for (let i = 0; i < 6; i++) await turn($, clock, 'never use any')
  expect(asked).toEqual(['Add “never use any” to CLAUDE.md?'])
  expect(Object.keys(files).some(k => k.endsWith('CLAUDE.md'))).toBe(false)
})

test('the first start ever takes the tour, and says nothing of what is new; /mochi tour replays it', async ($, on) => {
  const manifest = { '/.claude-plugin/plugin.json': JSON.stringify({ name: 'mochi', version: '0.3.0' }) }
  const store: Record<string, unknown> = {}
  const fresh = world(on, store, manifest)
  await fresh.clock.set(NOW)
  await $.session.start(START)
  await wait(fresh.clock, 40_000)
  expect(fresh.toasts.filter(x => x.startsWith('Hi, I’m Mochi') || x.startsWith('The rings') || x.includes('/mochi wear'))).toHaveLength(3)
  expect(fresh.toasts.some(x => x.includes('/mochi news'))).toBe(false)
  expect(store.version).toBe('0.3.0')
  expect((await $.command.run({ command: 'mochi', args: 'tour' } as never)).text).toBe('The tour starts in a moment: watch Mochi.')
  await wait(fresh.clock, 40_000)
  expect(fresh.toasts.filter(x => x.startsWith('Hi, I’m Mochi'))).toHaveLength(2)
})

test('after an update, the new version is told once in a toast, and /mochi news prints its notes', async ($, on) => {
  const manifest = { '/.claude-plugin/plugin.json': JSON.stringify({ name: 'mochi', version: '0.3.0' }) }
  const store: Record<string, unknown> = { prefs: { lang: 'en' }, version: '0.2.0' }
  const w = world(on, store, manifest)
  await w.clock.set(NOW)
  await $.session.start(START)
  await wait(w.clock, 20_000)
  expect(w.toasts.filter(x => x.includes('/mochi news'))).toEqual([`Mochi 0.3.0: ${newsFor('0.3.0')?.headline} · /mochi news`])
  expect(w.toasts.some(x => x.startsWith('Hi, I’m Mochi'))).toBe(false)
  expect(store.version).toBe('0.3.0')
  const news = (await $.command.run({ command: 'mochi', args: 'news' } as never)).text
  expect(news).toBe(newsLines('0.3.0'))
})

test('a stopped turn calls for the rewind tip once Mochi is idle, in a toast that says how to turn tips off', async ($, on) => {
  const w = world(on, { prefs: { lang: 'en' }, version: '0.2.0' }, {})
  await w.clock.set(NOW)
  await $.session.start(START)
  await answer($, w.clock, 'aborted')
  const tips = w.toasts.filter(x => x.includes('/mochi tips turns these off'))
  expect(tips).toHaveLength(1)
  expect(tips[0]).toContain('/rewind')
  // Within the hour, the next stop says nothing.
  await answer($, w.clock, 'aborted')
  expect(w.toasts.filter(x => x.includes('/mochi tips turns these off'))).toHaveLength(1)
})
