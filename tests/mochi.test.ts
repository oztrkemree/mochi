import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { asciiRows, kaomoji, LOOKS } from '../hooks/looks'
import { detailSvg, levelSummary, levelSvg } from '../hooks/detail'
import { addSample, clockAt, contextWarning, dayKey, dirOf, forecastFull, freshDiff, lineCount, lineDelta, parseDiff, parseGit, parseNumstat, shiftDay, warnLevel, weekHabit, withLines } from '../hooks/facts'
import { NEW_WATCH, danger, watchCall } from '../hooks/guard'
import { itemOf, levelOf, outfitFor, summarize, unlocked, xpOf } from '../hooks/level'
import { peerLabel, peerNews, peersLine } from '../hooks/live'
import { DICTS, LANGS, pickLang, setLang } from '../hooks/i18n'
import { NO_ENV, NO_INFO, restorePrefs } from '../hooks/state'
import { alertCommand, langCodes, langCommand, openCommand, removeCommand } from '../hooks/system'
import { clip, cols } from '../hooks/text'

// Most of these read the Turkish lines; one test below speaks English.
setLang('tr')
import { panelSvg } from '../hooks/panel'
import { paramsAt, svgFor, target, TRANSITION_MS } from '../hooks/rig'
import { afterTool, beforeTool, duration, flowEnd, flowLine, isScary, onPrompt, onTurnEnd } from '../hooks/react'

const BAND = {
  plugin: 'mochi',
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 11 },
    view: {},
  },
}

/** What a session's engine answers beneath the plugin. */
function engine(on: On, store: Record<string, unknown> = { prefs: { lang: 'tr' } }, statuses: (string | undefined)[] = []) {
  mock.store(on, store)
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/tmp' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        window: 200000, tokens: 84000, percent: 42,
        breakdown: ({ categories: [
          { name: 'System prompt', tokens: 4000, color: 'promptBorder', isDeferred: false, kind: 'used' },
          { name: 'Messages', tokens: 80000, color: 'claude', isDeferred: false, kind: 'used' },
          { name: 'Free space', tokens: 116000, color: 'inactive', isDeferred: false, kind: 'free' },
        ] }) as never,
      },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 34, resetsAt: '2025-10-09T12:20:00.000Z' },
        { kind: 'seven_day', percentUsed: 61, resetsAt: '2025-10-13T09:00:00.000Z' },
      ],
      cost: { usd: 1.234 },
    },
  }))
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('ui.status', ($, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('session.surfaces', () => ({ value: ['terminal'] as never }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, {}) as RenderElement
  })
  return clock
}

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never

/** Noon on 1 July 2026 by this machine's clock, whose time zone Mochi reads. */
const NOON = Date.UTC(2026, 6, 1, 12, 0) + new Date(Date.UTC(2026, 6, 1, 12, 0)).getTimezoneOffset() * 60_000

test('every mood draws five rows of nine cells and a bounded svg', async () => {
  for (const mood of Object.keys(LOOKS) as (keyof typeof LOOKS)[]) {
    for (const frame of [0, 1, 2, 3]) {
      const rows = asciiRows(mood, frame)
      expect(rows.length).toBe(5)
      for (const row of rows) expect([...row].length >= 9 && [...row].length <= 10).toBe(true)
    }
    expect(kaomoji(mood, 0).startsWith('(')).toBe(true)
    for (const scene of [{ context: -1, agents: 0 }, { context: 92, agents: 3 }]) {
      const svg = svgFor({ mood, scene, from: { params: paramsAt(null, 'party', 5000), mood: 'party', scene: { context: 10, agents: 1 } } })
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      expect(svg.length < 131072).toBe(true)
    }
  }
})

test('a new shot starts where the old one stands and eases into its own pose', async () => {
  const mid = paramsAt(target('idle'), 'error', TRANSITION_MS / 2)
  const idle = target('idle')
  const error = target('error')
  expect(mid.armL > idle.armL && mid.armL < error.armL).toBe(true)
  expect(mid.x > 0 && mid.x < 1).toBe(true)
  expect(paramsAt(target('idle'), 'error', TRANSITION_MS + 1).x).toBe(1)
  const svg = svgFor({ mood: 'success', scene: { context: 40, agents: 0 }, from: { params: mid, mood: 'error', scene: { context: 35, agents: 0 } } })
  expect(svg).toContain('keySplines')
  expect(svg).toContain('values="0;0;1" keyTimes="0;0.2;1" dur="0.4s"')
  const still = svgFor({ mood: 'idle', scene: { context: 40, agents: 0 }, from: null })
  expect(still.includes('keySplines')).toBe(false)
})

test('the panel draws even from state an older version stored', async () => {
  const old = { label: 'boşta', detail: 'hazır', context: { percent: 40 } } as never
  // Item ids from before they were English.
  const worn = { context: 40, agents: 0, outfit: { head: 'tac', held: 'kupa', face: 'gozluk' } as never }
  const { svg } = panelSvg({ panel: { shot: { mood: 'idle', scene: worn, at: 1, from: { params: target('wave'), mood: 'wave', scene: worn } }, info: old, infoFrom: old, infoAt: 1 }, now: 5000, width: 770 })
  expect(svg).toContain('hazır')
  expect(svg).toContain('context')
})

test('tool calls name what they touch', async () => {
  expect(beforeTool({ tool: 'Read', file_path: '/a/b/app.ts' })).toEqual({ mood: 'reading', line: 'okuyor · app.ts', holdMs: 0 })
  expect(beforeTool({ tool: 'Write', file_path: 'C:\\Users\\me\\mochi\\hooks\\a.ts' }).line).toBe('oluşturuyor · a.ts')
  expect(dirOf('C:\\Users\\me\\mochi\\hooks\\a.ts')).toBe('C:\\Users\\me\\mochi\\hooks')
  expect(dirOf('/p/hooks/rig.ts')).toBe('p/hooks')
  expect(beforeTool({ tool: 'Bash', command: 'rm -rf build' }).mood).toBe('scared')
  expect(beforeTool({ tool: 'Bash', command: 'npm test' }).line).toBe('test · npm test')
  expect(beforeTool({ tool: 'Edit', file_path: 'x.ts' }).line).toBe('düzenliyor · x.ts')
  expect(beforeTool({ tool: 'WebFetch', url: 'https://github.com/a/b' }).line).toBe('açıyor · github.com')
  expect(beforeTool({ tool: 'AskUserQuestion' }).mood).toBe('asking')
  expect(isScary('git push --force origin main')).toBe(true)
  expect(isScary('git push origin main')).toBe(false)
})

test('outcomes', async () => {
  expect(afterTool({ tool: 'Bash', command: 'npm test' }, {}, 0, 14)?.line).toBe('testler geçti · 14sn')
  expect(afterTool({ tool: 'Bash', command: 'npm test' }, { isError: true }, 1, 3)?.line).toBe('testler kaldı')
  expect(afterTool({ tool: 'Bash', command: 'ls' }, { isError: true }, 3, 1)?.mood).toBe('dizzy')
  expect(afterTool({ tool: 'Edit', file_path: 'a.ts' }, { deny: 'no' }, 1, 0)?.line).toBe('reddedildi · a.ts')
  expect(afterTool({ tool: 'Read' }, {}, 0, 1)).toBe(null)
})

test('prompts and turn ends stay plain', async () => {
  expect(onPrompt('teşekkürler', false).mood).toBe('pleased')
  expect(onPrompt('neden calismiyor bu', false).mood).toBe('nervous')
  expect(onPrompt('selam', true).mood).toBe('shocked')
  expect(onPrompt('bir fonksiyon yaz', false)).toEqual({ mood: 'thinking', line: 'düşünüyor', holdMs: 0 })
  expect(onTurnEnd({ reason: 'aborted', seconds: 3, tools: 0, edits: 0, errors: 0 }).line).toBe('durduruldu')
  expect(onTurnEnd({ reason: 'answer', seconds: 400, tools: 3, edits: 0, errors: 0 })).toEqual({ mood: 'tired', line: 'bitti · 6dk 40sn · 3 araç', holdMs: 12000, sound: 'ding' })
  expect(onTurnEnd({ reason: 'answer', seconds: 20, tools: 3, edits: 2, errors: 0 }).line).toBe('bitti · 20sn · 3 araç · 2 düzenleme')
  expect(duration(75)).toBe('1dk 15sn')
})

test('ultracode: the workflow and its agents have a face of their own', async () => {
  expect(beforeTool({ tool: 'Workflow', name: 'review-changes' })).toEqual({ mood: 'agent', line: 'ultracode · review-changes', holdMs: 0 })
  expect(beforeTool({ tool: 'Workflow', script: "export const meta = { name: 'find-flaky-tests', description: 'x' }" }).line).toBe('ultracode · find-flaky-tests')
  expect(beforeTool({ tool: 'Workflow' }).line).toBe('ultracode · workflow')
  expect(onPrompt('ultracode ile hepsini tara', false)).toEqual({ mood: 'agent', line: 'ultracode', holdMs: 0 })
  expect(flowLine(2, 9)).toBe('ultracode · 7/9 · 2 ajan')
  expect(flowEnd(9, 9, 252)).toEqual({ mood: 'party', line: 'ultracode · bitti · 9 ajan · 4dk 12sn', holdMs: 12000, sound: 'party' })
  // A run none of whose agents answered was stopped: no party.
  expect(flowEnd(3, 0, 40)).toEqual({ mood: 'shocked', line: 'ultracode · durduruldu', holdMs: 6000 })
  // Re-run by file or by run id, the call has no name of its own.
  expect(beforeTool({ tool: 'Workflow', scriptPath: 'C:\\s\\review-changes-wf_b8f1738e-d35.js' }).line).toBe('ultracode · review-changes')
})

test('the band shows the running tool; the desktop panel shows it with context and limits', async ($, on) => {
  const statuses: (string | undefined)[] = []
  const clock = engine(on, { prefs: { lang: 'tr' } }, statuses)
  let release = () => {}
  on('tool.call', () => new Promise(resolve => {
    release = () => resolve({ result: 'ok', text: 'ok' })
  }))
  await clock.set(1_760_000_000_000)
  await $.session.start(START)

  const pending: Promise<unknown> = $.tool.call({ tool: 'Bash', command: 'npm run build' } as never)
  for (let i = 0; i < 20; i++) await clock.advance(700)
  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await terminal.find({ text: /çalıştırıyor · npm run build · 1[34]sn/ })).toBeDefined()
  expect(await terminal.find({ text: /context %42/ })).toBeDefined()
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  for (let i = 0; i < 4; i++) await clock.advance(700)
  const svg = await desktop.find({ type: 'Svg' })
  const source = String(svg?.props.source)
  expect(await desktop.find({ type: 'Client', key: 'hit' })).toBeDefined()
  expect(await desktop.find({ key: 'details' })).toBeUndefined()
  expect(svg?.props.isInteractive).toBeUndefined()
  expect(source).toContain('<image href="data:image/webp')
  expect(source).toContain('>çalıştırıyor</tspan>')
  expect(source).toContain('>npm run build</tspan>')
  expect(source).toContain('>42%<')
  expect(source).toContain('84k/200k')
  expect(source).toContain('oturum')
  expect(source).toContain('>34%<')
  expect(source).toContain('hafta')
  expect(source).toContain('$1.23')
  expect(source).toContain('#7AA2F7')
  await desktop.unmount()
  release()
  await pending
})

test('a failing test run shows on both surfaces; hide and /mochi bring it back', async ($, on) => {
  const clock = engine(on)
  await clock.set(1_760_000_000_000)
  on('tool.call', () => ({ isError: true as const, result: undefined, text: '1 failing' }))
  await $.session.start(START)
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const terminal = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await terminal.find({ text: 'testler kaldı' })).toBeDefined()
  await terminal.unmount()
  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await clock.advance(500)
  expect(String((await desktop.find({ type: 'Svg' }))?.props.source)).toContain('testler kaldı')
  await desktop.unmount()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'hide' })).toBeUndefined()
  expect(await ui.find({ text: 'testler kaldı' })).toBeDefined()
  await $.command.run({ command: 'mochi', args: 'gizle' } as never)
  expect(await ui.find({ text: 'testler kaldı' })).toBeUndefined()
  const ran = await $.command.run({ command: 'mochi', args: '' } as never)
  expect(ran.text).toBe('Mochi açık.')
  expect(await ui.find({ text: 'testler kaldı' })).toBeDefined()
  await ui.unmount()
})

test('git status reads into branch, ahead, behind and files', async () => {
  const git = parseGit('## main...origin/main [ahead 2, behind 1]\n M hooks/rig.ts\n?? art/new.png\nR  a.ts -> b.ts\n', '1760000000\n')
  expect(git).toEqual({
    branch: 'main', ahead: 2, behind: 1, changed: 3, lastCommit: 1_760_000_000_000,
    files: [{ code: ' M', path: 'hooks/rig.ts' }, { code: '??', path: 'art/new.png' }, { code: 'R ', path: 'b.ts' }],
  })
  expect(parseGit('## No commits yet on dev\n', '')?.branch).toBe('dev')
  expect(parseGit('fatal: not a git repository', '')).toBe(null)
})

const ENV = {
  context: 88, agents: 0, turnTools: 0, tokens: 860_000, window: 1_000_000, compactAt: 967_000, cost: 12.5, last: '',
  slices: [{ name: 'Messages', tokens: 800_000, color: '' }, { name: 'System tools', tokens: 60_000, color: '' }],
  allSlices: [
    { name: 'Messages', tokens: 800_000, color: '', kind: 'used' }, { name: 'System tools', tokens: 60_000, color: '', kind: 'used' },
    { name: 'Free space', tokens: 107_000, color: '', kind: 'free' }, { name: 'Autocompact buffer', tokens: 33_000, color: '', kind: 'buffer' },
  ],
  limits: [{ kind: 'five_hour', percent: 59, resetsAt: 9_000_000 }, { kind: 'seven_day', percent: 37, resetsAt: 90_000_000 }],
  recent: [], kinds: { read: 12, edit: 5, bash: 3 }, startedAt: 1,
  turns: [{ at: 1, seconds: 40, tools: 6, edits: 2, errors: 0, cost: 0.4 }, { at: 2, seconds: 95, tools: 12, edits: 0, errors: 1, cost: 0.9 }],
  files: [{ path: '/p/hooks/rig.ts', reads: 4, edits: 3, at: 1 }, { path: '/p/hooks/panel.ts', reads: 2, edits: 1, at: 2 }],
  git: { branch: 'main', ahead: 1, behind: 0, changed: 2, lastCommit: 0, files: [{ code: ' M', path: 'hooks/rig.ts' }, { code: '??', path: 'x.png' }] },
  samples: [], peers: [], history: null, tz: 180, lastEdit: null, badges: [],
}

test('the context warns in three steps and names the largest part', async () => {
  expect(warnLevel({ tokens: 600_000, window: 1_000_000, compactAt: 967_000 })).toBe(0)
  expect(warnLevel({ tokens: 700_000, window: 1_000_000, compactAt: 967_000 })).toBe(1)
  expect(warnLevel({ tokens: 860_000, window: 1_000_000, compactAt: 967_000 })).toBe(2)
  expect(warnLevel({ tokens: 930_000, window: 1_000_000, compactAt: 967_000 })).toBe(3)
  expect(contextWarning(ENV, 2)).toBe('context %88 · en büyük: mesajlar %80 · /compact iyi olur')
})

test('the detail pane draws every section', async () => {
  const svg = detailSvg(ENV, 5_000_000, 520)
  for (const part of ['BU OTURUM', 'CONTEXT', 'oturum · 5 saat', 'hafta · 7 gün', 'SON TURLAR', 'DEĞİŞİKLİKLER', 'ARAÇLAR', 'rig.ts', 'mesajlar', 'Sıkıştırmaya yaklaşıyor', 'main  ·  ↑1']) {
    expect(svg).toContain(part)
  }
  expect(/<[^a-zA-Z/!?]/.test(svg)).toBe(false)
})

test('the panel shows the branch and marks the compaction point', async () => {
  const info = {
    label: 'boşta', detail: 'hazır', context: { percent: 88, tokens: 860_000, window: 1_000_000, slices: ENV.slices }, limits: ENV.limits,
    cost: 12.5, agents: 0, tools: 0, isBusy: false, recent: [], last: '', compactPct: 96.7, warn: 2,
    git: { branch: 'main', changed: 2, ahead: 1, behind: 0, lastCommit: 0 },
  }
  const { svg, card } = panelSvg({ panel: { shot: { mood: 'idle', scene: { context: 88, agents: 0 }, at: 1, from: null }, info, infoFrom: null, infoAt: 1 }, now: 5000, width: 725 })
  expect(card.x + card.w).toBe(725)
  expect(svg).toContain('main  ·  2 değişiklik  ·  ↑1')
  expect(svg).toContain('stroke="#F0645A" stroke-width="1.6" stroke-linecap="round"/>')
  expect(svg).toContain('fill="#F0645A">context')
})

test('a click on the meter card opens the detail pane', async ($, on) => {
  const clock = engine(on)
  const opened: string[] = []
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  await clock.set(1_760_000_000_000)
  await $.session.start(START)
  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await clock.advance(500)
  const region = await desktop.drawn({ in: 'hit' })
  expect(JSON.stringify(region)).toContain('"height":6')
  await desktop.pointer({ type: 'down', x: 2, y: 1, button: 'left', in: 'hit' })
  expect(opened).toEqual([])
  await desktop.pointer({ type: 'up', x: 2, y: 1, button: 'left', in: 'hit' })
  expect(opened).toEqual(['mochi-detay'])
  await desktop.unmount()
})

const DAY = { turns: 0, tools: 0, edits: 0, errors: 0, commits: 0, cost: 0, secs: 0, night: 0 }

test('the shield names what a command would destroy, and lets ordinary ones pass', async () => {
  expect(danger('rm -rf build')).toBe('dosya ve klasörleri kalıcı siler')
  expect(danger('rm -r -f dist')).toBe('dosya ve klasörleri kalıcı siler')
  expect(danger('git push --force origin main')).toBe('uzaktaki dalın geçmişini ezer')
  expect(danger('git reset --hard HEAD~1')).toBe('kaydedilmemiş değişiklikleri siler')
  expect(danger('git checkout -- .')).toBe('kaydedilmemiş değişiklikleri geri alır')
  expect(danger('npm publish')).toBe('paketi herkese yayınlar')
  expect(danger('psql -c "DROP TABLE users"')).toBe('veritabanından tablo siler')
  for (const ok of ['ls -la', 'rm notes.txt', 'git push origin main', 'git checkout main', 'npm test', 'grep -r foo .', 'git branch -d old']) {
    expect(danger(ok)).toBe(null)
  }
})

test('a stopped dangerous command never runs; an approved one does', async ($, on) => {
  const clock = engine(on)
  await clock.set(1_760_000_000_000)
  let answer = 'Durdur'
  const asked: string[] = []
  const ask = (e: { questions: { question: string }[] }) => {
    const question = e.questions[0]?.question ?? ''
    asked.push(question)
    return { result: { questions: e.questions, answers: { [question]: answer } }, text: answer }
  }
  on('tool.call', { tool: 'AskUserQuestion' }, (($: unknown, e: never) => ask(e)) as never)
  const ran: string[] = []
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    ran.push(e.command)
    return { result: { stdout: '', stderr: '', interrupted: false }, text: '' } as never
  })
  on('tool.call', { tool: 'PowerShell' }, ($, e) => {
    ran.push(e.command)
    return { result: '', text: '' } as never
  })
  await $.session.start(START)
  const stopped = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(stopped.deny).toContain('Mochi')
  expect(ran).toEqual([])
  expect(asked[0]).toContain('dosya ve klasörleri kalıcı siler')
  expect(asked[0]).toContain('rm -rf build')
  answer = 'Çalıştır'
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(ran).toEqual(['rm -rf build'])
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(asked.length).toBe(2)
  answer = 'Durdur'
  expect((await $.tool.call({ tool: 'PowerShell', command: 'git reset --hard HEAD~3' })).deny).toContain('Mochi')
  expect(asked.length).toBe(3)
  // Alone, /mochi kalkan only says how the shield stands; with its word for off, it turns off.
  await $.command.run({ command: 'mochi', args: 'kalkan' } as never)
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(asked.length).toBe(4)
  await $.command.run({ command: 'mochi', args: 'kalkan kapat' } as never)
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(asked.length).toBe(4)
  expect(ran.length).toBe(3)
})

test('the loop watch speaks once when the same thing fails or repeats', async () => {
  let w = NEW_WATCH
  const step = (args: { tool: string } & Record<string, unknown>, isFail: boolean, text: string) => {
    const r = watchCall(w, args, isFail, text)
    w = r.watch
    return r.alarm
  }
  const test = { tool: 'Bash', command: 'npm test' }
  expect(step(test, true, 'FAIL 3 tests in 1.2s')).toBe(null)
  expect(step(test, true, 'FAIL 3 tests in 1.4s')).toBe(null)
  expect(step(test, true, 'FAIL 3 tests in 0.9s')).toBe('aynı komut 3. kez hata verdi')
  expect(step(test, true, 'FAIL 3 tests in 0.9s')).toBe(null)
  w = NEW_WATCH
  expect(step({ tool: 'Bash', command: 'a' }, true, 'Error: cannot find module x')).toBe(null)
  expect(step({ tool: 'Bash', command: 'b' }, true, 'Error: cannot find module x')).toBe(null)
  expect(step({ tool: 'Bash', command: 'c' }, true, 'Error: cannot find module x')).toBe('aynı hata 3. kez')
  w = NEW_WATCH
  const read = { tool: 'Read', file_path: '/a.ts' }
  for (let i = 0; i < 3; i++) expect(step(read, false, 'same')).toBe(null)
  expect(step(read, false, 'same')).toBe('aynı şeyi 4. kez yapıyor, sonuç değişmiyor')
  w = NEW_WATCH
  const poll = { tool: 'Bash', command: 'sleep 30; gh run view' }
  for (let i = 0; i < 6; i++) expect(step(poll, false, 'in progress')).toBe(null)
  const wait = { tool: 'PowerShell', command: 'Start-Sleep 30; gh run view' }
  for (let i = 0; i < 6; i++) expect(step(wait, false, 'in progress')).toBe(null)
})

test('the loop alarm reaches the band', async ($, on) => {
  const clock = engine(on)
  await clock.set(1_760_000_000_000)
  on('tool.call', { tool: 'Bash' }, () => ({ isError: true as const, result: undefined, text: 'error: tsc failed with 4 errors' }) as never)
  await $.session.start(START)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Bash', command: 'npx tsc' })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: /döngü · aynı komut 3\. kez hata verdi/ })).toBeDefined()
  await ui.unmount()
})

test('the forecast reads the pace and says when a window runs out', async () => {
  const now = 1_760_000_000_000
  let samples = addSample([], 'five_hour', 40, now - 30 * 60_000)
  samples = addSample(samples, 'five_hour', 55, now - 10 * 60_000)
  const limit = { kind: 'five_hour', percent: 70, resetsAt: now + 3 * 60 * 60_000 }
  // 30 points in 30 minutes: the last 30 in 30 more.
  expect(forecastFull(samples, limit, now)).toBe(now + 30 * 60_000)
  expect(forecastFull(samples, { ...limit, resetsAt: now + 20 * 60_000 }, now)).toBe(null)
  expect(forecastFull(addSample([], 'five_hour', 69, now - 2 * 60_000), limit, now)).toBe(null)
  const reset = addSample(addSample(samples, 'five_hour', 3, now - 5 * 60_000), 'five_hour', 4, now - 4 * 60_000)
  expect(forecastFull(reset, { ...limit, percent: 4 }, now)).toBe(null)
  // The week, read before any habit is known: a busy day does not stand for the whole week.
  const monday = Date.UTC(2026, 9, 12, 9, 0)
  const friday = Date.UTC(2026, 9, 16, 9, 0)
  let week = addSample([], 'seven_day', 11, monday - 24 * 60 * 60_000)
  week = addSample(week, 'seven_day', 21, monday)
  expect(forecastFull(week, { kind: 'seven_day', percent: 21, resetsAt: friday }, monday, 180)).toBe(null)
  expect(forecastFull(week, { kind: 'seven_day', percent: 80, resetsAt: friday }, monday, 180)).toBe(monday + (20 * 3 * 24 * 60 * 60_000) / 80)
  expect(clockAt(Date.UTC(2026, 9, 9, 12, 40), Date.UTC(2026, 9, 9, 10, 0), 180)).toBe('15:40')
  expect(clockAt(Date.UTC(2026, 9, 9, 11, 0), Date.UTC(2026, 9, 7, 10, 0), 180)).toBe('Cum 14:00')
  expect(dayKey(Date.UTC(2026, 9, 9, 22, 30), 180)).toBe('2026-10-10')
  expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
})

test('the week forecast learns when the user works and when they rest', () => {
  const H = 60 * 60_000
  // Two past weeks of 9-to-6 weekdays, 1.5 points an hour, every reading on the hour, nothing at night or on weekends.
  const reset = Date.UTC(2026, 9, 16, 6, 0) // Friday 09:00 local
  let samples: ReturnType<typeof addSample> = []
  let p = 0
  const now = Date.UTC(2026, 9, 12, 9, 0) // Monday 12:00 local
  for (let at = reset - 3 * 7 * 24 * H; at <= now; at += H) {
    if ((at - reset) % (7 * 24 * H) === 0) p = 0
    const l = new Date(at + 180 * 60_000)
    const working = l.getUTCDay() >= 1 && l.getUTCDay() <= 5 && l.getUTCHours() >= 9 && l.getUTCHours() < 18
    samples = addSample(samples, 'seven_day', p, at)
    if (working && at < now) p += 1.5
  }
  // Old readings are thinned to one an hour, the oldest past five weeks dropped.
  expect(samples.every(s => now - s.at < 5 * 7 * 24 * H)).toBe(true)
  const habit = weekHabit(samples, reset, 180)
  expect(habit.hours).toBeGreaterThan(72)
  expect(Math.round(habit.week * 2) / 2).toBe(5 * 9 * 1.5)
  // A usual Monday noon: Friday afternoon plus Monday's three hours, the week ends near 67, never full.
  expect(forecastFull(samples, { kind: 'seven_day', percent: p, resetsAt: reset }, now, 180)).toBe(null)
  // Twice as busy as usual this week: it runs out on a working afternoon, not in the night.
  const full = forecastFull(samples, { kind: 'seven_day', percent: 2 * p, resetsAt: reset }, now, 180)
  expect(full).not.toBe(null)
  const at = new Date((full ?? 0) + 180 * 60_000)
  expect(at.getUTCHours() >= 9 && at.getUTCHours() < 18).toBe(true)
  expect(full ?? 0).toBeLessThan(reset)
})

test('days add up into a history, a level and things to wear', async () => {
  const a = { '2026-10-08': { ...DAY, turns: 30, edits: 20, commits: 2 }, '2026-10-09': { ...DAY, turns: 10, night: 3 } }
  const b = { '2026-10-09': { ...DAY, turns: 5, commits: 1 }, '2026-10-05': { ...DAY, turns: 2 } }
  const h = summarize([a, b], '2026-10-09')
  expect(h.days['2026-10-09']?.turns).toBe(15)
  expect(h.total.turns).toBe(47)
  expect(h.activeDays).toBe(3)
  expect(h.streak).toBe(2)
  expect(xpOf(h)).toBe(47 * 10 + 20 * 2 + 3 * 25 + 3 * 30)
  expect(levelOf(0)).toEqual({ level: 1, at: 0, next: 100 })
  expect(levelOf(450)).toEqual({ level: 3, at: 400, next: 900 })
  expect(unlocked(h)).toEqual(['beanie', 'glasses', 'mug', 'tea', 'sprout', 'bowtie', 'sunglasses', 'bunny', 'pencil', 'horse', 'bandana'])
  const noon = Date.UTC(2026, 6, 1, 9, 0)
  const none = { head: null, face: null, neck: null, held: null, ground: null }
  expect(outfitFor({}, ['bowtie', 'hardhat'], noon, 180, 'idle', true)).toEqual({ ...none, head: 'hardhat', neck: 'bowtie' })
  expect(outfitFor({}, [], Date.UTC(2026, 6, 1, 5, 0), 180, 'idle', true).held).toBe('mug')
  expect(outfitFor({}, [], Date.UTC(2026, 6, 1, 23, 0), 180, 'writing', false).head).toBe('nightcap')
  expect(outfitFor({}, ['hardhat', 'witchhat', 'pin', 'pumpkin'], Date.UTC(2026, 9, 28, 9, 0), 180, 'idle', true)).toEqual({ ...none, head: 'witchhat', neck: 'pin', ground: 'pumpkin' })
  expect(outfitFor({}, ['hardhat'], Date.UTC(2026, 9, 28, 9, 0), 180, 'idle', true)).toEqual({ ...none, head: 'hardhat' })
  expect(outfitFor({ head: 'hardhat' }, ['hardhat'], Date.UTC(2026, 9, 28, 9, 0), 180, 'idle', true).head).toBe('hardhat')
  expect(outfitFor({ head: null, neck: null, ground: null }, ['hardhat', 'bowtie'], noon, 180, 'idle', true)).toEqual(none)
  expect(outfitFor({ face: 'glasses', held: 'balloon' }, [], noon, 180, 'idle', true)).toEqual({ ...none, face: 'glasses', held: 'balloon' })
  expect(outfitFor({ held: 'balloon' }, [], noon, 180, 'success', false).held).toBe(null)
})

test('the wardrobe puts on, takes off and goes back to automatic', async ($, on) => {
  const clock = engine(on)
  await clock.set(NOON)
  await $.session.start(START)
  const pane = await $.ui.mount({ plugin: 'mochi', component: 'Pane', requestId: 'mochi-detay', surface: 'desktop', props: { bodyColumns: 100, bodyRows: 40 } } as never)
  expect(await pane.find({ key: 'wear:glasses' })).toBeUndefined()
  await pane.press({ key: 'tab:mochi' } as never)
  expect(await pane.find({ type: 'Text', text: /^\d+\/\d+ açık$/ })).toBeDefined()
  // One slot at a time; what is locked is shown with what unlocks it, and no button.
  expect(await pane.find({ key: 'wear:viking' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: 'seviye 12' })).toBeDefined()
  await pane.press({ key: 'shelf:face' } as never)
  expect(await pane.find({ key: 'wear:glasses' })).toBeDefined()
  await pane.press({ key: 'wear:glasses' } as never)
  expect((await pane.find({ type: 'Text', text: /^Yüz · / }))?.text).toBe('Yüz · gözlük')
  // On the desktop the whole card is clickable: a clear region over it posts for the button.
  await pane.post({}, { in: 'tap:wear:glasses' })
  expect((await pane.find({ type: 'Text', text: /^Yüz · / }))?.text).toBe('Yüz · boş')
  await pane.post({}, { in: 'tap:shelf:head' })
  const said = await $.command.run({ command: 'mochi', args: 'aksesuar viking' } as never)
  expect(said.text).toBe('viking kaskı kilitli (seviye 12).')
  await $.command.run({ command: 'mochi', args: 'aksesuar bere' } as never)
  expect((await pane.find({ type: 'Text', text: /^Baş · / }))?.text).toBe('Baş · bere')
  await pane.press({ key: 'wear:auto' } as never)
  expect((await pane.find({ type: 'Text', text: /^Baş · / }))?.text).toBe('Baş · boş (otomatik)')
  await pane.unmount()
})

test('what an older version saved under the Turkish item ids carries over', async ($, on) => {
  expect(itemOf('gozluk')).toBe('glasses')
  expect(itemOf('glasses')).toBe('glasses')
  expect(itemOf('toString')).toBe(null)
  expect(restorePrefs({ pick: { head: 'tac', face: 'gozluk', neck: 'baret', held: null } } as never).pick).toEqual({ head: 'crown', face: 'glasses', held: null })
  expect(restorePrefs({ wear: 'kedi' } as never).pick).toEqual({ ground: 'cat' })
  const clock = engine(on, { prefs: { lang: 'en', pick: { face: 'gozluk' } } })
  await clock.set(NOON)
  await $.session.start(START)
  expect((await $.command.run({ command: 'mochi', args: 'wear' } as never)).text).toContain('Face: glasses\n')
  expect((await $.command.run({ command: 'mochi', args: 'wear bere' } as never)).text).toBe('beanie put on.')
  // An exact name wins over a longer one it begins: the tea glass, not the teardrop.
  expect((await $.command.run({ command: 'mochi', args: 'wear tea' } as never)).text).toBe('tea glass put on.')
  setLang('tr')
})

test('the other chats are named and their news is told once', async () => {
  expect(peerLabel('/home/dev/projects/web-app', '')).toBe('web-app')
  expect(peerLabel('/home/dev/x/scratch-2026-10-09-a9bcb5', 'show me every animation on one page')).toBe('show me every')
  expect(peerLabel('C:\\Users\\dev\\Projects\\web-app', '')).toBe('web-app')
  expect(peerLabel('C:\\Users\\dev', 'fix the build please now')).toBe('fix the build please')
  expect(peerLabel('C:\\Users\\dev\\', 'fix it')).toBe('fix it')
  expect(peerLabel('D:\\', 'fix it')).toBe('fix it')
  const now = 1_760_000_000_000
  const busy = { id: 'a', label: 'web', state: 'busy' as const, line: 'çalıştırıyor', since: now - 5 * 60_000, at: now }
  expect(peerNews([busy], [{ ...busy, state: 'asking', line: 'onay bekliyor · rm -rf x' }], now)).toEqual([{ kind: 'asking', line: '‘web’ seni bekliyor' }])
  expect(peerNews([busy], [{ ...busy, state: 'idle', since: 0 }], now)).toEqual([{ kind: 'done', line: '‘web’ bitti · 5dk' }])
  expect(peerNews([busy], [{ ...busy, state: 'error' }], now).map(n => n.kind)).toEqual(['failed'])
  expect(peerNews([], [busy], now)).toEqual([])
  expect(peersLine([busy, { ...busy, id: 'b', label: 'wiki', state: 'asking' }])).toBe('wiki seni bekliyor')
  expect(peersLine([{ ...busy, state: 'idle' }])).toBe(null)
})

test('the detail pane shows the other chats, the calendar and the level', async () => {
  const today = dayKey(5_000_000_000_000, 180)
  const history = summarize([{ [today]: { ...DAY, turns: 12, edits: 30 }, [shiftDay(today, -1)]: { ...DAY, turns: 40 } }], today)
  const env = {
    ...ENV, history,
    peers: [{ id: 'x', label: 'web-app', state: 'asking' as const, line: 'onay bekliyor · rm -rf build', since: 0, at: 5_000_000_000_000 }],
    limits: [{ kind: 'five_hour', percent: 70, resetsAt: 5_000_000_000_000 + 3 * 3_600_000 }],
    samples: [{ kind: 'five_hour', at: 5_000_000_000_000 - 30 * 60_000, p: 40 }],
  }
  const svg = detailSvg(env, 5_000_000_000_000, 640)
  for (const part of ['SOHBETLER', 'web-app', 'onay bekliyor', 'GEÇMİŞ', 'bugün tur', 'bu hızla', 'dolar']) {
    expect(svg).toContain(part)
  }
  expect(/<[^a-zA-Z/!?]/.test(svg)).toBe(false)
  const level = levelSvg(env, 5_000_000_000_000, 500)
  expect(level).toContain('Seviye 3')
  expect(level).toContain('sıradaki: kravat')
  expect(levelSummary(env)).toBe('Seviye 3 · %' + levelSummary(env).split('%')[1])
  expect(levelSummary(env)).toContain('sıradaki: kravat (seviye 4)')
})

test('an edit is told in lines: what went, what came, one line before', async () => {
  const d = lineDelta('a\nb\nc\nd\n', 'a\nb\nX\nY\nd\n')
  expect(d).toEqual({ add: 2, del: 1, ctx: 'b', old: ['c'], new: ['X', 'Y'] })
  expect(lineDelta('', 'one\ntwo')).toEqual({ add: 2, del: 0, ctx: '', old: [], new: ['one', 'two'] })
  expect(lineDelta('same', 'same')).toEqual({ add: 0, del: 0, ctx: '', old: [], new: [] })
  expect(lineDelta('x', Array.from({ length: 9 }, (_, i) => `l${i}`).join('\n')).new.length).toBe(4)
})

test('git line counts reach the changes', async () => {
  expect(parseNumstat('12\t3\thooks/rig.ts\n-\t-\tart/a.png\n')).toEqual({ 'hooks/rig.ts': { add: 12, del: 3 }, 'art/a.png': null })
  expect([lineCount(''), lineCount('a\n'), lineCount('a\r\nb'), lineCount('a\n\nb\n')]).toEqual([0, 1, 2, 3])
  const git = parseGit('## main\n M hooks/rig.ts\n?? new.ts\n', '1760000000')
  expect(git).not.toBe(null)
  const full = withLines(git!, parseNumstat('12\t3\thooks/rig.ts\n'), { 'new.ts': 10 }, '/r')
  expect(full.files).toEqual([{ code: ' M', path: 'hooks/rig.ts', add: 12, del: 3 }, { code: '??', path: 'new.ts', add: 10, del: 0 }])
  const env = {
    ...ENV, git: full,
    files: [{ path: '/r/hooks/rig.ts', reads: 1, edits: 2, at: 4_000_000, add: 12, del: 3 }],
    lastEdit: { path: '/r/hooks/rig.ts', at: 4_000_000, ctx: 'const a = 1', old: ['const b = 2'], new: ['const b = 3', 'const c = <4>'], add: 2, del: 1 },
  }
  const svg = detailSvg(env, 5_000_000, 640)
  for (const part of ['DEĞİŞİKLİKLER', '2 dosya · +22 −3', '+12', 'new.ts', 'SON DÜZENLEME', 'const b = 3', 'const c = &lt;4&gt;', 'bu sohbette Claude değiştirdi']) {
    expect(svg).toContain(part)
  }
  expect(/<[^a-zA-Z/!?]/.test(svg)).toBe(false)
  // On Windows git writes the root with `/`, Claude the files with `\`.
  const windows = { ...env, git: { ...full, root: 'C:/r' }, files: [{ ...env.files[0]!, path: 'C:\\r\\hooks\\rig.ts' }], lastEdit: { ...env.lastEdit, path: 'C:\\r\\hooks\\rig.ts' } }
  const drawn = detailSvg(windows, 5_000_000, 640)
  expect(drawn).toContain('bu sohbette Claude değiştirdi')
  expect(drawn).toContain('>rig.ts</tspan>')
})

test('a file pressed in Changes shows its diff until pressed again', async ($, on) => {
  const parsed = parseDiff('a.ts', 'diff --git a/a.ts b/a.ts\nindex 1..2 100644\n--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n keep\n-old\n+new\n\\ No newline at end of file\n', 2)
  expect(parsed).toEqual({ path: 'a.ts', lines: [{ kind: 'ctx', text: '@@ -1,2 +1,2 @@' }, { kind: 'ctx', text: 'keep' }], more: 2 })
  expect(freshDiff('b.bin', 'a\0b').lines).toEqual([])
  const clock = engine(on)
  const prints = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } }) as never
  on('process.run', ($, e) => {
    const a = e.argv.join(' ')
    if (a.includes('status')) return prints('## main\n M hooks/rig.ts\n?? new.ts\n')
    if (a.includes('log -1')) return prints('1760000000\n')
    if (a.includes('--show-toplevel')) return prints('/r\n')
    if (a.includes('--numstat')) return prints('1\t1\thooks/rig.ts\n')
    if (a.endsWith('HEAD -- hooks/rig.ts')) return prints('diff --git a/hooks/rig.ts b/hooks/rig.ts\n--- a/hooks/rig.ts\n+++ b/hooks/rig.ts\n@@ -1,2 +1,2 @@\n const a = 1\n-const b = 2\n+const b = 3\n')
    return { value: { exitCode: 1, stdout: '', stderr: '' } } as never
  })
  on('fs.read', ($, e) => ({ value: e.path.endsWith('new.ts') ? 'hello\nworld\n' : '' }) as never)
  await clock.set(NOON)
  await $.session.start(START)
  for (let i = 0; i < 10; i++) await clock.advance(450)
  const pane = await $.ui.mount({ plugin: 'mochi', component: 'Pane', requestId: 'mochi-detay', surface: 'terminal', props: { bodyColumns: 100, bodyRows: 40 } } as never)
  expect(await pane.find({ type: 'Text', text: '  + const b = 3' })).toBeUndefined()
  await pane.press({ key: 'diff:hooks/rig.ts' } as never)
  expect(await pane.find({ type: 'Text', text: '  − const b = 2' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '  + const b = 3' })).toBeDefined()
  expect((await pane.find({ key: 'diff:hooks/rig.ts' }))?.text).toBe('• rig.ts ✕')
  // Another file takes its place; pressed again, it is put away.
  await pane.press({ key: 'diff:new.ts' } as never)
  expect(await pane.find({ type: 'Text', text: '  + const b = 3' })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: '  + world' })).toBeDefined()
  await pane.press({ key: 'diff:new.ts' } as never)
  expect(await pane.find({ type: 'Text', text: '  + world' })).toBeUndefined()
  await pane.unmount()
  // On the desktop the drawing shows it in the last edit's place.
  const svg = detailSvg({ ...ENV, git: { branch: 'main', ahead: 0, behind: 0, changed: 1, lastCommit: 1, files: [{ code: ' M', path: 'a.ts', add: 1, del: 1 }] }, diff: parsed }, 5_000_000, 640)
  for (const part of ['DOSYA FARKI', '>keep<', '… 2 satır daha']) expect(svg).toContain(part)
})

test('the level folds open and shut, and stays as left', async ($, on) => {
  const clock = engine(on)
  await clock.set(NOON)
  await $.session.start(START)
  const pane = await $.ui.mount({ plugin: 'mochi', component: 'Pane', requestId: 'mochi-detay', surface: 'desktop', props: { bodyColumns: 100, bodyRows: 40 } } as never)
  await pane.press({ key: 'tab:past' } as never)
  expect((await pane.find({ key: 'fold:level' }))?.text).toBe('▾')
  await pane.press({ key: 'fold:level' } as never)
  expect((await pane.find({ key: 'fold:level' }))?.text).toBe('▸')
  await pane.press({ key: 'fold:level' } as never)
  expect((await pane.find({ key: 'fold:level' }))?.text).toBe('▾')
  await pane.unmount()
})

test('in Arabic the drawings order their lines right to left; code stays as written', async () => {
  const shot = { mood: 'idle' as const, scene: { context: -1, agents: 0 }, at: 1, from: null }
  const draw = () => [panelSvg({ panel: { shot, info: { ...NO_INFO, detail: 'يحرر · app.ts' }, infoFrom: null, infoAt: 1 }, now: 2, width: 900 }).svg, detailSvg(NO_ENV, 2, 560)]
  setLang('ar')
  for (const svg of draw()) expect(svg).toContain('<style>text.t{direction:rtl;unicode-bidi:embed;text-anchor:end}text.t[text-anchor="end"]{text-anchor:start}')
  setLang('en')
  for (const svg of draw()) expect(svg).not.toContain('direction:rtl')
  setLang('tr')
})

test('every language has every word, and the language is picked from names and codes', async () => {
  const shape = (v: unknown): unknown =>
    typeof v === 'function' ? 'fn' : Array.isArray(v) ? v.length : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v
  const en = shape(DICTS.en) as Record<string, unknown>
  for (const l of LANGS) {
    // The command words differ by language; everything else has the same shape.
    const own = shape(DICTS[l]) as Record<string, Record<string, unknown>>
    const strip = (d: Record<string, unknown>) => JSON.stringify(d, (k, v: unknown) => (k === 'words' ? null : v))
    expect(strip(own)).toBe(strip(en))
    expect(DICTS[l].unit(5, 'm').length > 0).toBe(true)
  }
  expect(pickLang('tr-TR')).toBe('tr')
  expect(pickLang('constructor')).toBe(null)
  expect(pickLang('zh_CN.UTF-8')).toBe('zh')
  expect(pickLang('japanese')).toBe('ja')
  expect(pickLang('Türkçe')).toBe('tr')
  expect(pickLang('it-IT')).toBe('it')
  expect(pickLang('uk_UA.UTF-8')).toBe('uk')
  expect(pickLang('Polski')).toBe('pl')
  expect(pickLang('हिन्दी')).toBe('hi')
  expect(pickLang('Bahasa Indonesia')).toBe('id')
  expect(pickLang('arabic')).toBe('ar')
  expect(pickLang('nl-NL')).toBe(null)
})

test('a new install speaks the system’s language; /mochi lang changes it and English words always work', async ($, on) => {
  const clock = engine(on, {})
  const prints = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } })
  on('process.run', ($, e) => (e.argv[0] === 'uname' ? prints('Darwin\n') : e.argv[0] === 'defaults' ? prints('(\n    "de-DE",\n    "en-US"\n)') : { value: { exitCode: 1, stdout: '', stderr: '' } }) as never)
  on('tool.call', { tool: 'Bash' }, () => new Promise(() => {}) as never)
  await clock.set(1_760_000_000_000)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const said = await $.command.run({ command: 'mochi', args: 'lang' } as never)
  expect(said.text).toContain('Deutsch')
  const en = await $.command.run({ command: 'mochi', args: 'lang en' } as never)
  expect(en.text).toBe('Language: English.')
  void $.tool.call({ tool: 'Bash', command: 'npm run build' } as never)
  await clock.advance(500)
  expect(await ui.find({ text: /running · npm run build/ })).toBeDefined()
  const glasses = await $.command.run({ command: 'mochi', args: 'wear glasses' } as never)
  expect(glasses.text).toBe('glasses put on.')
  const back = await $.command.run({ command: 'mochi', args: 'lang tr' } as never)
  expect(back.text).toBe('Dil: Türkçe.')
  const word = await $.command.run({ command: 'mochi', args: 'aksesuar yok' } as never)
  expect(word.text).toBe('Bütün aksesuarlar çıkarıldı.')
  // A language by the name the list offers, whose letters folding would change (ї, й, Hangul); an unknown one echoed as typed.
  for (const [name, code] of [['Українська', 'uk'], ['Русский', 'ru'], ['한국어', 'ko'], ['Türkçe', 'tr']] as const) {
    expect((await $.command.run({ command: 'mochi', args: `lang ${name}` } as never)).text).toBe(DICTS[code].cmd.langSet(name))
  }
  expect((await $.command.run({ command: 'mochi', args: 'lang Klingon' } as never)).text?.startsWith('Bilinmeyen dil: Klingon.')).toBe(true)
  setLang('tr')
  await ui.unmount()
})

test('on Windows: the home is USERPROFILE, the language the display one, and old files go with del', async ($, on) => {
  const clock = engine(on, {})
  mock.env(on, { OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\me', HOME: 'C:\\msys64\\home\\me' })
  on('session.id', () => ({ value: 'abc-1' }) as never)
  // The engine writes a path with the separators of the system the test runs on.
  const slashed = (path = '') => path.replaceAll('\\', '/')
  const ran: { argv: readonly string[]; cwd?: string }[] = []
  on('process.run', ($, e) => {
    ran.push({ argv: e.argv, cwd: slashed(e.init?.cwd) })
    // reg names the key before its values: none of its words is taken for a language.
    const reg = '\r\nHKEY_CURRENT_USER\\Control Panel\\Desktop\\MuiCached\r\n    MachinePreferredUILanguages    REG_MULTI_SZ    ko-KR\\0en-US\r\n\r\nEnd of search: 1 match(es) found.\r\n'
    return { value: e.argv[0] === 'reg' ? { exitCode: 0, stdout: reg, stderr: '' } : { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  const listed: string[] = []
  on('fs.list', ($, e) => {
    listed.push(slashed(e.path))
    return { value: slashed(e.path).endsWith('/live') ? [{ name: 'old-2.json', kind: 'file' as const, size: 2, mtimeMs: NOON - 60 * 60_000, isLink: false }] : [] }
  })
  await clock.set(NOON)
  await $.session.start(START)
  expect((await $.command.run({ command: 'mochi', args: 'lang' } as never)).text).toContain('언어: 한국어.')
  expect(listed).toContain('C:/Users/me/.claude/mochi/days')
  expect(ran.some(r => r.argv[0] === 'uname')).toBe(false)
  expect(ran).toContainEqual({ argv: ['cmd', '/d', '/c', 'del', '/f', '/q', 'old-2.json'], cwd: 'C:/Users/me/.claude/mochi/live' })
  setLang('tr')
})

test('dozing or hidden, the timer makes its rounds on every fifth beat; work wakes it at once', async ($, on) => {
  const clock = engine(on)
  let frames = 0
  let reads = 0
  on('state.set', ($, e, next) => {
    if (e.key === 'frame') frames += 1
    return next(e)
  })
  // Each round of the timer reads the figures; a skipped beat reads none.
  on('state.get', ($, e, next) => {
    if (e.key === 'env') reads += 1
    return next(e)
  })
  on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
  await clock.set(NOON)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(4 * 60_000)
  expect(await ui.find({ text: /^boşta · \ddk$/ })).toBeDefined()
  frames = 0
  for (let i = 0; i < 10; i++) await clock.advance(450)
  expect(frames).toBe(2)
  await $.tool.call({ tool: 'Read', file_path: 'C:\\r\\app.ts' } as never)
  expect(await ui.find({ text: 'okuyor · app.ts' })).toBeDefined()
  frames = 0
  for (let i = 0; i < 4; i++) await clock.advance(450)
  expect(frames).toBe(4)
  // Hidden, awake or not, the timer does its rounds as seldom as when dozing.
  reads = 0
  for (let i = 0; i < 10; i++) await clock.advance(450)
  const shown = reads
  await $.command.run({ command: 'mochi', args: 'gizle' } as never)
  reads = 0
  for (let i = 0; i < 10; i++) await clock.advance(450)
  expect(reads * 4 <= shown).toBe(true)
  await ui.unmount()
})

test('each system is asked its own way, and no word is spliced into a script', async () => {
  const text = 'onay bekliyor · rm -rf "$HOME"; `x` $(y)'
  for (const platform of ['mac', 'windows'] as const) {
    const alert = alertCommand(platform, 'Mochi', 'web-app', text)
    expect(alert.argv[0]).toBe(platform === 'mac' ? 'osascript' : 'powershell')
    expect(alert.argv.some(a => a.includes('rm -rf') || a.includes('web-app'))).toBe(false)
    expect(alert.env).toEqual({ MOCHI_TITLE: 'Mochi', MOCHI_SUBTITLE: 'web-app', MOCHI_TEXT: text })
  }
  expect(alertCommand('linux', 'Mochi', 'web-app', '-x').argv).toEqual(['notify-send', '--', 'Mochi · web-app', '-x'])
  expect(removeCommand('windows', ['a-1.json', 'b&calc.json', '..\\c.json', 'd_2.json'])).toEqual(['cmd', '/d', '/c', 'del', '/f', '/q', 'a-1.json', 'd_2.json'])
  expect(removeCommand('mac', ['a-1.json'])).toEqual(['rm', '-f', '--', 'a-1.json'])
  expect(removeCommand('linux', ['x y.json'])).toBe(null)
  expect(langCommand('mac')?.[0]).toBe('defaults')
  expect(langCommand('windows')?.[0]).toBe('reg')
  expect(langCommand('linux')).toBe(null)
  // The person's own display language before the machine's, and none of reg's other words.
  expect(langCodes('HKEY_CURRENT_USER\\Control Panel\\Desktop\r\n    PreferredUILanguages    REG_MULTI_SZ    tr-TR\r\n\r\nHKEY_CURRENT_USER\\Control Panel\\Desktop\\MuiCached\r\n    MachinePreferredUILanguages    REG_MULTI_SZ    en-US\r\n'))
    .toEqual(['tr-TR', 'en-US'])
  expect(langCodes('(\n    "de-DE",\n    "en-US"\n)')).toEqual(['de-DE', 'en-US'])
  // What the pane made is opened by the system's own app; explorer reads no shell syntax.
  expect(openCommand('windows', 'C:/Users/Ada Lovelace/x.svg')).toEqual(['explorer.exe', 'C:\\Users\\Ada Lovelace\\x.svg'])
  expect(openCommand('mac', 'https://github.com/x')).toEqual(['open', 'https://github.com/x'])
})

test('wide characters clip by the room they take, and marks on a letter take none', async () => {
  expect(cols('読み込み中')).toBe(10)
  expect(cols('reading')).toBe(7)
  expect(clip('読み込み中です', 9)).toBe('読み込み…')
  expect(clip('reading', 9)).toBe('reading')
  expect(cols('नमस्ते')).toBe(4)
  expect(cols('مَرْحَبًا')).toBe(5)
  expect(clip('नमस्ते दुनिया', 5)).toBe('नमस्ते…')
})
