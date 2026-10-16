import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { BADGES, badgesOf, badgeSvg, commandBadges, isEarly, langBit, provenBy, turnBadges } from '../hooks/badges'
import { birthdayName, dueGreeting, firstDayOf, greeting, isBreakDue, isLeet, occasions, parseBirthday, promptEgg, workFrom } from '../hooks/fun'
import { ASCII_HAT, addDay, EMPTY_DAY, hintFor, outfitFor, summarize, unlocked } from '../hooks/level'
import { DICTS, LANGS, setLang } from '../hooks/i18n'
import { LOOKS, asciiRows } from '../hooks/looks'
import { MOOD_INK } from '../hooks/panel'
import { POSES, VECTOR_WEAR, WEAR_AT, svgFor } from '../hooks/rig'
import { ALL_ITEMS, layoutOf, reordered, restorePrefs, stepped } from '../hooks/state'
import { WEAR } from '../hooks/wear'

// The days Mochi celebrates, the badges it gives for real work, its small
// surprises and the stretch it suggests. These read the English lines.
setLang('en')

const BAND = {
  plugin: 'mochi',
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 11 }, view: {} },
}
const PANE = { plugin: 'mochi', component: 'Pane', requestId: 'mochi-detay', surface: 'desktop', props: { bodyColumns: 100, bodyRows: 40 } } as never
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never

/** What a session's engine answers beneath the plugin; toasts are collected, nothing is run. */
function engine(on: On, store: Record<string, unknown> = { prefs: { lang: 'en' } }, toasts: string[] = []) {
  mock.store(on, store)
  const clock = mock.clock(on)
  on('session.start', () => ({ cwd: '/tmp' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 84000, percent: 42 }, rateLimits: [], cost: { usd: 0 } } }) as never)
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.surfaces', () => ({ value: ['terminal'] as never }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }) as never)
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, {}) as RenderElement
  })
  return clock
}

/**
 * Mochi's files, in memory by their folder and name ("mochi/badges.json"):
 * the engine writes a path with the separators of the system the test runs on.
 * A `locked` one is there but cannot be read.
 */
function memoryFiles(on: On, locked = new Set<string>()): Record<string, string> {
  const files: Record<string, string> = {}
  const key = (path: string) => path.split(/[\\/]/).slice(-2).join('/')
  on('fs.read', ($, e) => {
    const text = files[key(e.path)]
    if (text === undefined) throw new Error(`no such file: ${e.path}`)
    if (locked.has(key(e.path))) throw new Error(`busy: ${e.path}`)
    return { value: text } as never
  })
  on('fs.exists', ($, e) => ({ value: files[key(e.path)] !== undefined }) as never)
  on('fs.write', ($, e) => {
    files[key(e.path)] = e.text
    return { value: undefined } as never
  })
  on('fs.list', () => ({ value: [] }))
  return files
}

/** A local time on this machine's clock, whose time zone Mochi reads. */
const at = (y: number, m: number, d: number, hour: number, minute = 0) => {
  const utc = Date.UTC(y, m - 1, d, hour, minute)
  return utc + new Date(utc).getTimezoneOffset() * 60_000
}

const NONE = { head: null, face: null, neck: null, held: null, ground: null }

test('the calendar knows the fixed days and the person’s own', async () => {
  const on = (day: string, own = { birthday: '', firstDay: '' }) => occasions(day, own).map(o => o.name)
  expect(on('2026-02-20')).toEqual([])
  expect(on('2028-10-03')).toEqual(['hacktoberfest'])
  expect(on('2026-04-05')).toEqual(['hanami'])
  expect(on('2026-03-14')).toEqual(['piDay'])
  expect(on('2026-11-13')).toEqual(['friday13'])
  expect(on('2026-10-10')).toEqual(['hacktoberfest'])
  expect(on('2026-10-28')).toEqual(['halloween', 'hacktoberfest'])
  expect(on('2026-12-24')).toEqual([])
  expect(occasions('2027-01-01')).toEqual([{ name: 'newYear', from: '2026-12-31' }])
  expect(on('2027-04-23', { birthday: '04-23', firstDay: '' })).toEqual(['birthday'])
  expect(on('2027-02-28', { birthday: '02-29', firstDay: '' })).toEqual(['birthday'])
  expect(on('2028-02-28', { birthday: '02-29', firstDay: '' })).toEqual([])
  expect(on('2028-02-29', { birthday: '02-29', firstDay: '' })).toEqual(['birthday'])
  expect(on('2027-10-09', { birthday: '', firstDay: '2026-10-09' })).toEqual(['anniversary', 'hacktoberfest'])
  expect(on('2026-10-09', { birthday: '', firstDay: '2026-10-09' })).toEqual(['hacktoberfest'])
})

test('each occasion is greeted once, however many days it spans', async () => {
  const own = { birthday: '', firstDay: '2026-10-09' }
  expect(dueGreeting('2026-10-28', own, ['hacktoberfest:2026-10-01'])).toEqual({ name: 'halloween', keys: ['halloween:2026-10-24', 'hacktoberfest:2026-10-01'] })
  expect(dueGreeting('2026-10-30', own, ['halloween:2026-10-24', 'hacktoberfest:2026-10-01'])).toBe(null)
  expect(dueGreeting('2026-07-01', own, [])).toBe(null)
  expect(greeting('anniversary', '2028-10-09', own)).toEqual({ mood: 'party', line: '2 years together today', holdMs: 8000, sound: 'party' })
  expect(greeting('friday13', '2026-11-13', own).mood).toBe('nervous')
  expect(greeting('halloween', '2026-10-28', own)).toEqual({ mood: 'wave', line: 'happy halloween', holdMs: 8000 })
  expect(parseBirthday('4-23')).toBe('04-23')
  expect(parseBirthday('04/23')).toBe('04-23')
  expect(parseBirthday('02-29')).toBe('02-29')
  // Said back in words, so that a day typed the other way round shows.
  expect(birthdayName('05-04')).toBe('May 4')
  for (const bad of ['02-30', '13-01', '00-10', '23.04', 'tomorrow', '']) expect(parseBirthday(bad)).toBe(null)
  expect(firstDayOf('', '2026-10-10', [{ '2026-09-01': {}, x: 1 }, {}])).toBe('2026-09-01')
  expect(firstDayOf('2026-08-01', '2026-10-10', [{ '2026-09-01': {} }])).toBe('2026-08-01')
  expect(firstDayOf('', '2026-10-10', [])).toBe('2026-10-10')
})

test('the date dresses Mochi in what it has earned, and opens nothing by itself', async () => {
  const noon = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12, 0)
  const birthday = { birthday: '07-01', firstDay: '' }
  const all = ['partyhat', 'cake', 'witchhat', 'pumpkin', 'sakura', 'rosette'] as const
  expect(outfitFor({}, all, noon(2026, 7, 1), 0, 'idle', true, birthday)).toEqual({ ...NONE, head: 'partyhat', ground: 'cake' })
  expect(outfitFor({}, all, noon(2026, 10, 28), 0, 'idle', true)).toEqual({ ...NONE, head: 'witchhat', ground: 'pumpkin' })
  expect(outfitFor({}, all, noon(2026, 4, 3), 0, 'idle', true).head).toBe('sakura')
  expect(outfitFor({}, all, noon(2026, 12, 31), 0, 'idle', true).head).toBe('partyhat')
  expect(outfitFor({}, all, noon(2026, 3, 20), 0, 'success', false).held).toBe(null)
  expect(outfitFor({}, all, noon(2027, 10, 9), 0, 'idle', true, { birthday: '', firstDay: '2026-10-09' }).neck).toBe('rosette')
  expect(outfitFor({ neck: null }, all, noon(2026, 10, 10), 0, 'idle', true).neck).toBe(null)
  // Not earned: the day does not give it.
  expect(outfitFor({}, [], noon(2026, 7, 1), 0, 'idle', true, birthday)).toEqual(NONE)
  expect(outfitFor({}, [], noon(2026, 4, 3), 0, 'idle', true).head).toBe(null)
  expect(unlocked(null)).not.toContain('songpyeon')
  expect(hintFor('sakura')).toBe('level 26')
  expect(hintFor('envelope')).toBe('craftsman')
  expect(hintFor('partyhat')).toBe('50 commits')
})

test('every new thing to wear is drawn, and every mood has its pose, look, ink and words', async () => {
  for (const item of ALL_ITEMS) {
    expect(WEAR[item] !== undefined || VECTOR_WEAR[item] !== undefined).toBe(true)
    expect(WEAR_AT[item]).toBeDefined()
  }
  for (const item of ['sakura', 'pin', 'rosette', 'candy', 'lantern', 'envelope', 'diya', 'songpyeon', 'cake'] as const) {
    const vector = VECTOR_WEAR[item]
    expect(vector).toBeDefined()
    const svg = svgFor({ mood: 'idle', scene: { context: -1, agents: 0, outfit: { ...NONE, [WEAR_AT[item].ground ? 'ground' : item === 'sakura' ? 'head' : ['pin', 'rosette'].includes(item) ? 'neck' : 'held']: item } }, from: null })
    expect(svg).toContain(vector?.svg.slice(0, 40) ?? '-')
    expect(/<[^a-zA-Z/!?]/.test(svg)).toBe(false)
  }
  expect([...(ASCII_HAT.sakura ?? '')].length).toBe(5)
  for (const mood of ['stretch', 'love', 'wink'] as const) {
    expect(POSES[mood]).toBeDefined()
    expect(MOOD_INK[mood].startsWith('#')).toBe(true)
    for (const l of LANGS) expect(DICTS[l].mood[mood].length > 0).toBe(true)
    for (const frame of [0, 1, 2]) for (const row of asciiRows(mood, frame)) expect([...row].length).toBe(9)
  }
  expect(LOOKS.wink.eyes[0]).toBe('^ ~')
  expect(svgFor({ mood: 'love', scene: { context: -1, agents: 0 }, from: null })).toContain('fill="#FF7A95"')
})

test('badges come from real work: tests, pushes, calm turns, long days and many languages', async () => {
  expect(commandBadges('npm test', true, false)).toEqual(['green'])
  expect(commandBadges('npx vitest run', true, true)).toEqual(['green', 'comeback'])
  expect(commandBadges('npm test', false, true)).toEqual([])
  expect(commandBadges('git push origin main', true, false)).toEqual(['push'])
  expect(commandBadges('ls', true, false)).toEqual([])
  let calm = 0
  for (let i = 1; i <= 10; i++) {
    const turned = turnBadges('answer', 20, 0, calm)
    calm = turned.calm
    expect(turned.badges).toEqual(i === 10 ? ['steady'] : [])
  }
  expect(turnBadges('answer', 20, 1, 9)).toEqual({ calm: 0, badges: [] })
  expect(turnBadges('answer', 31 * 60, 2, 0)).toEqual({ calm: 0, badges: ['marathon'] })
  expect(turnBadges('aborted', 31 * 60, 0, 3)).toEqual({ calm: 0, badges: [] })
  expect(isEarly(Date.UTC(2026, 0, 5, 3, 30), 180)).toBe(true)
  expect(isEarly(Date.UTC(2026, 0, 5, 4, 0), 180)).toBe(false)
  expect(langBit('C:\\work\\app.tsx')).toBe(langBit('/work/app.ts'))
  expect(langBit('/work/README.md')).toBe(0)
  expect(langBit('/work/Makefile')).toBe(0)
  expect(badgesOf(['green', 'nope', 'green', 'push'])).toEqual(['green', 'push'])
  expect(badgesOf({ green: true })).toBe(null)
  // A day an older version wrote has no lines or languages: they count as none.
  expect(addDay({ turns: 2, langs: 1 } as never, { turns: 1, langs: 4, add: 3 })).toEqual({ ...EMPTY_DAY, turns: 3, langs: 5, add: 3 })

  const day = (i: number) => `2026-09-${String(i).padStart(2, '0')}`
  const days: Record<string, Partial<typeof EMPTY_DAY>> = {}
  const langs = ['a.ts', 'b.py', 'c.go', 'd.rs', 'e.java'].map(langBit)
  for (let i = 1; i <= 7; i++) days[day(i)] = { turns: 1, night: i <= 5 ? 1 : 0, early: i <= 4 ? 1 : 0, langs: langs[i - 1] ?? 0, add: 10, del: i === 7 ? 30 : 0 }
  const h = summarize([days], day(7))
  expect(provenBy(h)).toEqual(['tidy', 'owl', 'polyglot', 'week'])
  expect(provenBy(summarize([{ ...days, [day(9)]: { turns: 1, early: 1, commits: 100 } }], day(9)))).toEqual(['tidy', 'owl', 'bird', 'polyglot', 'week', 'hundred'])
  expect(provenBy(null)).toEqual([])
  // The hard ones come from totals.
  const big = summarize([{ [day(1)]: { turns: 1, commits: 500, edits: 5000, del: 10000, night: 150 } }], day(1))
  expect(provenBy(big)).toEqual(['tidy', 'hundred', 'fivehundred', 'craftsman', 'bulldozer', 'vampire'])
  expect(unlocked(big)).toEqual(expect.arrayContaining(['cake', 'envelope', 'candy', 'witchhat', 'pumpkin', 'pin']))
  expect(unlocked(h)).not.toContain('cake')
  for (const b of BADGES) {
    expect(badgeSvg(b, true).startsWith('<svg')).toBe(true)
    expect(badgeSvg(b, false)).toContain('#8C8580')
    for (const l of LANGS) expect(DICTS[l].fun.badge.name[b].length > 0 && DICTS[l].fun.badge.hint[b].length > 0).toBe(true)
  }
})

test('a few words to Mochi get a moment of their own', async () => {
  expect(promptEgg('good night')).toEqual({ mood: 'stretch', line: 'good night', holdMs: 4000 })
  expect(promptEgg('iyi geceler, yarın devam')?.mood).toBe('stretch')
  expect(promptEgg('おやすみ')?.mood).toBe('stretch')
  expect(promptEgg('I love you Mochi')).toEqual({ mood: 'love', line: 'love you too', holdMs: 4000 })
  expect(promptEgg('mochi je t’aime')?.mood).toBe('love')
  expect(promptEgg('모찌 사랑해')?.mood).toBe('love')
  expect(promptEgg('I love you')).toBe(null)
  expect(promptEgg('thanks mochi!')).toEqual({ mood: 'pleased', line: 'you’re welcome', holdMs: 3000 })
  expect(promptEgg('hi Mochi')).toEqual({ mood: 'wave', line: 'hello', holdMs: 3000 })
  expect(promptEgg('merhaba mochi')?.mood).toBe('wave')
  expect(promptEgg('hi')).toBe(null)
  // Its name alone is a greeting too.
  expect(promptEgg('mochi')).toEqual({ mood: 'wave', line: 'hello', holdMs: 3000 })
  expect(promptEgg('Mochi?')?.mood).toBe('wave')
  expect(promptEgg('모찌!')?.mood).toBe('wave')
  expect(promptEgg('mochi build')).toBe(null)
  expect(promptEgg('mochila de viaje')).toBe(null)
  expect(promptEgg('te quiero mucho, mochi')?.mood).toBe('love')
  expect(promptEgg('mochi, te quiero preguntar algo')).toBe(null)
  expect(promptEgg('моти, я тебя люблю')?.mood).toBe('love')
  expect(promptEgg('моти, я не люблю такой код')).toBe(null)
  expect(promptEgg('잘 자요')?.mood).toBe('stretch')
  expect(promptEgg('이 문자열을 잘 자르는 함수')).toBe(null)
  expect(promptEgg('buonanotte')?.mood).toBe('stretch')
  expect(promptEgg('на добраніч')?.mood).toBe('stretch')
  expect(promptEgg('शुभ रात्रि')?.mood).toBe('stretch')
  expect(promptEgg('mochi, kocham cię')?.mood).toBe('love')
  expect(promptEgg('aku sayang kamu, mochi')?.mood).toBe('love')
  expect(promptEgg('موتشي، أحبك')?.mood).toBe('love')
  expect(promptEgg('grazie mochi')?.mood).toBe('pleased')
  expect(promptEgg('мочі, дякую')?.mood).toBe('pleased')
  expect(promptEgg('मोची, धन्यवाद')?.mood).toBe('pleased')
  expect(promptEgg('cześć mochi')?.mood).toBe('wave')
  expect(promptEgg('مرحبًا موتشي')?.mood).toBe('wave')
  expect(promptEgg('hi mochi, please refactor the whole parser and add tests for every case')).toBe(null)
  expect(isLeet(Date.UTC(2026, 0, 1, 10, 37), 180)).toBe(true)
  expect(isLeet(Date.UTC(2026, 0, 1, 10, 38), 180)).toBe(false)
})

test('two hours of work without a quiet gap earn a suggested stretch, at most every two hours', async () => {
  const t0 = 1_800_000_000_000
  let from = 0
  for (let m = 0; m <= 120; m += 10) from = workFrom(from, t0 + m * 60_000, t0 + m * 60_000 + 1000)
  expect(from).toBe(t0)
  expect(isBreakDue(from, 0, t0 + 121 * 60_000)).toBe(true)
  expect(isBreakDue(from, t0 + 121 * 60_000, t0 + 130 * 60_000)).toBe(false)
  expect(isBreakDue(from, 0, t0 + 100 * 60_000)).toBe(false)
  // A quarter of an hour of quiet is a break.
  expect(workFrom(from, t0 + 120 * 60_000, t0 + 135 * 60_000)).toBe(0)
  expect(isBreakDue(0, 0, t0 + 200 * 60_000)).toBe(false)
  expect(restorePrefs({ lang: 'en' }).hasBreaks).toBe(true)
  // Saved choices with no language, or one Mochi does not speak, follow the system and Claude Code.
  expect(restorePrefs({ isCompact: true } as never).lang).toBe('auto')
  expect(restorePrefs({ lang: 'xx' } as never).lang).toBe('auto')
  expect(restorePrefs({ lang: 'tr' }).lang).toBe('tr')
  expect(restorePrefs({ lang: 'en', open: { level: true, chats: false } } as never).open).toEqual({
    chats: false, changes: true, context: false, activity: true, level: true, wardrobe: true, badges: false, settings: true, more: true,
  })
})

test('the first start on a special day greets it; a greeted one is not greeted again', async ($, on) => {
  const clock = engine(on)
  await clock.set(at(2026, 10, 28, 12))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: 'happy halloween' })).toBeDefined()
  await ui.unmount()
})

test('a day already greeted starts as usual', async ($, on) => {
  const clock = engine(on, { prefs: { lang: 'en' }, greeted: ['halloween:2026-10-24', 'hacktoberfest:2026-10-01'] })
  await clock.set(at(2026, 10, 28, 12))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: 'ready' })).toBeDefined()
  expect(await ui.find({ text: 'happy halloween' })).toBeUndefined()
  await ui.unmount()
})

test('the details pane: tabs, rows that fold, switches for every setting and every action', async ($, on) => {
  const clock = engine(on)
  const copied: string[] = []
  on('ui.copy', ($, e) => {
    copied.push(e.text)
    return { value: undefined } as never
  })
  on('tool.call', { tool: 'AskUserQuestion' }, (($: unknown, e: { questions: { question: string }[] }) =>
    ({ result: { questions: e.questions, answers: { [e.questions[0]?.question ?? '']: 'Keep' } }, text: 'Keep' })) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  const run = async (args: string) => (await $.command.run({ command: 'mochi', args } as never)).text ?? ''
  const pane = await $.ui.mount(PANE)
  // "Now" first: the meters, then rows; one with nothing to show is left out, the context starts folded.
  expect((await pane.find({ key: 'tab:now' }))?.text).toBe('Now')
  expect((await pane.find({ key: 'fold:context' }))?.text).toBe('▸')
  expect(await pane.find({ key: 'fold:chats' })).toBeUndefined()
  await pane.post({}, { in: 'tap:fold:context' })
  expect((await pane.find({ key: 'fold:context' }))?.text).toBe('▾')
  // The tab is kept; another one shows its own rows.
  await pane.press({ key: 'tab:past' })
  expect(await pane.find({ key: 'fold:context' })).toBeUndefined()
  expect((await pane.find({ key: 'fold:level' }))?.text).toBe('▾')
  await pane.press({ key: 'tab:settings' })
  // A switch shows where a setting stands; the whole row turns it, as its command would.
  expect(await pane.find({ key: 'set:sound' })).toBeUndefined()
  await pane.post({}, { in: 'tap:set:sound' })
  expect(await run('sound')).toBe('Sound off.')
  await pane.post({}, { in: 'tap:set:shield' })
  expect(await run('shield')).toContain('Shield off.')
  await pane.post({}, { in: 'tap:set:shield' })
  // The size is the terminal band's alone: the desktop pane does not offer it.
  expect(await pane.find({ key: 'size:small' })).toBeUndefined()
  // The birthday field and the language picker.
  await pane.input({ key: 'bday', text: '07-01', kind: 'submit' })
  expect(await run('birthday')).toBe('Birthday: July 1. To change it: /mochi birthday MM-DD · none')
  await pane.press({ key: 'bday:off' })
  expect(await run('birthday')).toContain('No birthday set.')
  await pane.select({ key: 'lang', value: 'tr' })
  expect((await pane.find({ key: 'tab:settings' }))?.text).toBe('Ayarlar')
  await pane.select({ key: 'lang', value: 'en' })
  // Every other action of /mochi, its answer shown above the buttons until dismissed.
  await pane.press({ key: 'do:tour' })
  expect(await pane.find({ type: 'Text', text: 'The tour starts in a moment: watch Mochi.' })).toBeDefined()
  expect(await pane.find({ key: 'said:copy' })).toBeUndefined()
  await pane.press({ key: 'said:close' })
  expect(await pane.find({ type: 'Text', text: 'The tour starts in a moment: watch Mochi.' })).toBeUndefined()
  await pane.press({ key: 'do:feedback' })
  expect(await pane.find({ type: 'Link' })).toBeDefined()
  expect(await pane.find({ key: 'said:open' })).toBeDefined()
  await pane.press({ key: 'said:copy' })
  expect(copied[0]).toMatch(/^https:\/\/github\.com\//)
  // A reset still asks first.
  await pane.press({ key: 'do:reset:history' })
  expect(await pane.find({ type: 'Text', text: 'Nothing was cleared.' })).toBeDefined()
  await pane.unmount()
})

test('each tab is arranged: its blocks dragged into place, hidden, moved by buttons and put back', async ($, on) => {
  const clock = engine(on)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'arrange' })
  expect((await pane.find({ key: 'arrange' }))?.text).toBe('Done')
  const rows = async () => ((await pane.find({ type: 'Client', key: 'arrange' }))?.props.props as { rows: { id: string; isHidden: boolean }[] }).rows
  expect((await rows()).map(r => r.id)).toEqual(['overview', 'chats', 'changes', 'context'])
  // Two rows to a block: held on the first and let go on the third, the overview drops there.
  await pane.resize({ columns: 80, rows: 8, in: 'arrange' })
  await pane.pointer({ type: 'down', x: 4, y: 0, button: 'left', in: 'arrange' })
  await pane.pointer({ type: 'move', x: 4, y: 5, button: 'left', in: 'arrange' })
  await pane.pointer({ type: 'up', x: 4, y: 5, button: 'left', in: 'arrange' })
  expect((await rows()).map(r => r.id)).toEqual(['chats', 'changes', 'overview', 'context'])
  // A click at the right of a row hides it; an order that is not exactly the tab's blocks is let be.
  await pane.pointer({ type: 'down', x: 76, y: 6, button: 'left', in: 'arrange' })
  await pane.pointer({ type: 'up', x: 76, y: 6, button: 'left', in: 'arrange' })
  await pane.post({ order: ['chats', 'changes', 'nonsense', 'context'] }, { in: 'arrange' })
  expect((await rows()).map(r => r.id)).toEqual(['chats', 'changes', 'overview', 'context'])
  expect((await rows()).find(r => r.id === 'context')?.isHidden).toBe(true)
  // Another tab arranges its own.
  await pane.press({ key: 'tab:past' })
  expect((await rows()).map(r => r.id)).toEqual(['activity', 'level', 'badges'])
  await pane.press({ key: 'tab:now' })
  await pane.press({ key: 'arrange' })
  // Out of arranging: a hidden block is not drawn.
  expect(await pane.find({ key: 'fold:context' })).toBeUndefined()
  await pane.press({ key: 'arrange' })
  await pane.press({ key: 'arrange:reset' })
  expect((await rows()).map(r => r.id)).toEqual(['overview', 'chats', 'changes', 'context'])
  expect((await rows()).some(r => r.isHidden)).toBe(false)
  await pane.unmount()
  // Where nothing can be dragged, buttons move a block within its tab and hide it.
  const term = await $.ui.mount({ ...(PANE as object), surface: 'terminal' } as never)
  await term.press({ key: 'move:overview:down' })
  await term.press({ key: 'hide:more' })
  expect((await term.find({ key: 'hide:more' }))?.text).toBe('Show')
  expect(await term.find({ key: 'move:chats:up' })).toBeUndefined()
  expect(await term.find({ key: 'move:activity:up' })).toBeUndefined()
  await term.press({ key: 'arrange' })
  expect(await term.find({ key: 'fold:more' })).toBeUndefined()
  await term.unmount()
  // What an older version saved, or a newer block it never named, falls into place.
  expect(layoutOf(['more', 'level', 'x', 'more'], ['level', 'y']).order).toEqual(['overview', 'chats', 'changes', 'context', 'activity', 'more', 'level', 'wardrobe', 'badges', 'settings'])
  expect(layoutOf(undefined, undefined)).toEqual({ order: ['overview', 'chats', 'changes', 'context', 'activity', 'level', 'wardrobe', 'badges', 'settings', 'more'], hidden: [] })
  const all = layoutOf(undefined, undefined).order
  expect(stepped(all, 'activity', 'up')).toEqual(all)
  expect(stepped(all, 'level', 'down').slice(4, 8)).toEqual(['activity', 'badges', 'wardrobe', 'level'])
  expect(reordered(all, ['more', 'settings'])?.slice(-2)).toEqual(['more', 'settings'])
  expect(reordered(all, ['more'])).toBeNull()
})

test('/mochi birthday, breaks and badges', async ($, on) => {
  const clock = engine(on)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  const run = async (args: string) => (await $.command.run({ command: 'mochi', args } as never)).text ?? ''
  expect(await run('birthday')).toBe('No birthday set. To add it: /mochi birthday MM-DD (it stays on this machine)')
  expect(await run('birthday 7-1')).toBe('Birthday set: July 1. It stays on this machine.')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: 'happy birthday!' })).toBeDefined()
  await ui.unmount()
  const pane = await $.ui.mount(PANE)
  await pane.press({ key: 'tab:mochi' } as never)
  await pane.press({ key: 'shelf:ground' } as never)
  expect((await pane.find({ type: 'Text', text: /^Beside · / }))?.text).toBe('Beside · empty (auto)')
  await pane.press({ key: 'tab:past' } as never)
  expect(await pane.find({ key: 'badge:green' })).toBeUndefined()
  await pane.press({ key: 'fold:badges' } as never)
  expect(await pane.find({ key: 'badge:green' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '0/18 earned' })).toBeDefined()
  await pane.unmount()
  expect(await run('birthday')).toBe('Birthday: July 1. To change it: /mochi birthday MM-DD · none')
  expect(await run('birthday 02-30')).toBe('Not a date: 02-30. Use MM-DD, e.g. /mochi birthday 04-23')
  expect(await run('birthday off')).toBe('Birthday removed.')
  expect(await run('breaks')).toBe('Breaks off.')
  expect(await run('breaks')).toBe('Breaks on: after two hours of work without a pause, Mochi suggests a stretch.')
  // On or off sets it; only a bare word turns it over. /mochi status says how each stands.
  expect(await run('breaks off')).toBe('Breaks off.')
  expect(await run('breaks off')).toBe('Breaks off.')
  expect(await run('tips off')).toBe('Tips off.')
  expect(await run('status')).toContain('Tips: off · Breaks: off · Plugin reactions: on')
  expect(await run('breaks on')).toBe('Breaks on: after two hours of work without a pause, Mochi suggests a stretch.')
  expect((await run('badges')).startsWith('Badges 0/18: none yet\nTo earn: first green (a test run that passes), first push (a git push)')).toBe(true)
  // The words of the language in use work too.
  await run('lang tr')
  expect(await run('mola')).toBe('Mola hatırlatması kapalı.')
  expect(await run('mola kapat')).toBe('Mola hatırlatması kapalı.')
  expect(await run('doğumgünü 04-23')).toBe('Doğum günü kaydedildi: 23 Nisan. Yalnızca bu bilgisayarda kalır.')
  setLang('en')
})

test('badges are earned from real work, kept in a file of Mochi’s own, and celebrated once', async ($, on) => {
  const toasts: string[] = []
  const clock = engine(on, { prefs: { lang: 'en' } }, toasts)
  mock.env(on, { HOME: '/home/me' })
  on('session.id', () => ({ value: 'chat-1' }) as never)
  const files = memoryFiles(on)
  let isRed = true
  on('tool.call', { tool: 'Bash' }, ($, e) => (isRed && e.command === 'npm test'
    ? { isError: true as const, result: undefined, text: '1 failing' }
    : { result: { stdout: '', stderr: '', interrupted: false }, text: '' }) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  await clock.settle()
  expect(files['mochi/badges.json']).toBe('[]')
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  isRed = false
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(toasts.filter(x => x.includes('badge'))).toEqual(['new badge: first green, comeback · /mochi badges'])
  expect(JSON.parse(files['mochi/badges.json'] ?? '')).toEqual(['green', 'comeback'])
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: 'new badge: first green, comeback' })).toBeDefined()
  await ui.unmount()
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  expect(toasts.filter(x => x.includes('badge')).length).toBe(2)
  expect(((await $.command.run({ command: 'mochi', args: 'badges' } as never)).text ?? '').split('\n')[0]).toBe('Badges 3/18: first green, comeback, first push')
})

test('a badge earned while a question is open is told in a toast; the question keeps the face', { timeoutMs: 30_000 }, async ($, on) => {
  const toasts: string[] = []
  const clock = engine(on, { prefs: { lang: 'en' } }, toasts)
  mock.env(on, { HOME: '/home/me' })
  on('session.id', () => ({ value: 'chat-4' }) as never)
  memoryFiles(on)
  on('tool.call', { tool: 'Edit' }, () => ({ result: '', text: '' }) as never)
  on('tool.call', { tool: 'AskUserQuestion' }, () => new Promise(() => {}) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  await clock.settle()
  // Lines removed today make a tidy day, which the history proves at its next reading, ten minutes on.
  await $.tool.call({ tool: 'Edit', file_path: '/home/me/app/a.ts', old_string: 'a\nb\nc\nd\n', new_string: '' } as never)
  void $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Which one?', header: 'Pick', options: [], multiSelect: false }] } as never).catch(() => undefined)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  for (let i = 0; i < 11; i++) await clock.advance(60_000)
  expect(toasts.filter(x => x.includes('tidy day'))).toEqual(['new badge: tidy day · /mochi badges'])
  expect(await ui.find({ text: /waiting for your answer/ })).toBeDefined()
  await ui.unmount()
})

test('awards at once celebrate a badge once, and a file that cannot be read a moment is never overwritten', async ($, on) => {
  const toasts: string[] = []
  const clock = engine(on, { prefs: { lang: 'en' } }, toasts)
  mock.env(on, { HOME: '/home/me' })
  on('session.id', () => ({ value: 'chat-3' }) as never)
  const locked = new Set(['mochi/badges.json'])
  const files = memoryFiles(on, locked)
  files['mochi/badges.json'] = '["push"]'
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }) as never)
  on('tool.call', { tool: 'Agent' }, async () => {
    await clock.sleep(60_000)
    return { result: 'ok', text: 'ok' } as never
  })
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  await clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  expect(files['mochi/badges.json']).toBe('["push"]')
  locked.clear()
  // Five agents started together: the third, fourth and fifth each find three or more running.
  const agents = [1, 2, 3, 4, 5].map(() => $.tool.call({ tool: 'Agent', description: 'look', prompt: 'look' } as never))
  await clock.settle()
  await clock.advance(60_000)
  await Promise.all(agents)
  expect(JSON.parse(files['mochi/badges.json'] ?? '')).toEqual(['push', 'team'])
  expect(toasts.filter(x => x.includes('badge'))).toEqual(['new badge: team lead · /mochi badges'])
})

test('a turn of half an hour that ends well is a marathon', { timeoutMs: 20_000 }, async ($, on) => {
  const toasts: string[] = []
  const clock = engine(on, { prefs: { lang: 'en', hasAlert: false } }, toasts)
  mock.env(on, { HOME: '/home/me' })
  on('session.id', () => ({ value: 'chat-2' }) as never)
  memoryFiles(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'build it', turnId: 't1' })
  await clock.set(at(2026, 7, 1, 12, 31))
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', durationMs: 31 * 60_000, isAborted: false } as never)
  expect(toasts).toContain('new badge: marathon · /mochi badges')
})

test('a subagent starting its own turn does not start the chat\'s turn over', { timeoutMs: 20_000 }, async ($, on) => {
  const toasts: string[] = []
  const clock = engine(on, { prefs: { lang: 'en', hasAlert: false } }, toasts)
  mock.env(on, { HOME: '/home/me' })
  on('session.id', () => ({ value: 'chat-3' }) as never)
  memoryFiles(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  await clock.settle()
  await $.turn.start({ text: 'build it', turnId: 't1' })
  await clock.set(at(2026, 7, 1, 12, 20))
  await $.turn.start({ text: 'look around', turnId: 't-a1', agentId: 'a1' } as never)
  await $.turn.complete({ agentId: 'a1', turnId: 't-a1', reason: 'answer', answer: '', durationMs: 60_000, isAborted: false } as never)
  await clock.set(at(2026, 7, 1, 12, 31))
  await $.turn.complete({ turnId: 't1', reason: 'answer', answer: 'done', durationMs: 31 * 60_000, isAborted: false } as never)
  expect(toasts).toContain('new badge: marathon · /mochi badges')
})

// Two hours of the timer's beats take a few seconds.
test('after two hours of work an idle Mochi suggests a stretch, one for all the chats', { timeoutMs: 30_000 }, async ($, on) => {
  const start = at(2026, 7, 1, 9)
  // Another chat suggested one a minute in.
  const clock = engine(on, { prefs: { lang: 'en' }, stretchAt: start + 60_000 })
  on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
  await clock.set(start)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  for (let i = 0; i < 12; i++) {
    await $.tool.call({ tool: 'Read', file_path: '/r/app.ts' } as never)
    await clock.advance(10 * 60_000)
  }
  await $.tool.call({ tool: 'Read', file_path: '/r/app.ts' } as never)
  await clock.advance(30_000)
  expect(await ui.find({ text: /without a break/ })).toBeUndefined()
  await $.tool.call({ tool: 'Read', file_path: '/r/app.ts' } as never)
  await clock.advance(35_000)
  expect(await ui.find({ text: '2h 1m without a break · a stretch?' })).toBeDefined()
  await ui.unmount()
})

test('at 13:37 an idle Mochi winks, once', async ($, on) => {
  const clock = engine(on)
  await clock.set(at(2026, 7, 1, 13, 36) + 40_000)
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await clock.advance(21_000)
  expect(await ui.find({ text: '13:37' })).toBeDefined()
  await clock.advance(5000)
  expect(await ui.find({ text: 'ready' })).toBeDefined()
  await ui.unmount()
})

test('good night to Mochi gets a yawn and a stretch, even from its sleep', async ($, on) => {
  const clock = engine(on)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  await clock.set(at(2026, 7, 1, 23))
  await $.session.start(START)
  await clock.advance(5 * 60_000)
  await $.prompt.submit({ text: 'good night mochi' } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: 'good night' })).toBeDefined()
  await ui.unmount()
})

test('once the reply to a good night is done, Mochi goes to sleep and sleeps on', async ($, on) => {
  const clock = engine(on)
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', () => ({ turnId: 't' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await clock.set(at(2026, 7, 1, 23))
  await $.session.start(START)
  await $.prompt.submit({ text: 'iyi geceler' } as never)
  await $.turn.start({ text: 'iyi geceler', turnId: 't' } as never)
  await $.turn.complete({ answer: '', durationMs: 1000, isAborted: false, turnId: 't', reason: 'answer' } as never)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: 'good night' })).toBeDefined()
  // Past the minute and a half that makes a quiet Mochi sleepy at night, it does not wake to doze.
  for (let i = 0; i < 3; i++) await clock.advance(60_000)
  expect(await ui.find({ text: 'good night' })).toBeDefined()
  await ui.unmount()
})

test('ultracode: the agents of a workflow show as a count, and the last one ending is a party', async ($, on) => {
  const clock = engine(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `w${++n}` }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spawn = (agentIndex: number) => $.agent.spawn({ prompt: 'p', description: 'd', workflow: { runId: 'wf_1', agentIndex } } as never)
  const finish = (agentId: string) => $.turn.complete({ agentId, turnId: `t-${agentId}`, reason: 'answer', answer: '', durationMs: 1000, isAborted: false } as never)
  await spawn(1)
  await spawn(2)
  // The greeting holds the face for three seconds; the count comes after it.
  await clock.advance(4000)
  expect(await ui.find({ text: /ultracode · 0\/2 · 2 agents/ })).toBeDefined()
  await finish('w1')
  await clock.advance(1000)
  expect(await ui.find({ text: /ultracode · 1\/2 · 1 agent/ })).toBeDefined()
  // Between two stages the last agent ends and the next starts: that is no ending.
  await finish('w2')
  await clock.advance(1000)
  await spawn(3)
  await clock.advance(1000)
  expect(await ui.find({ text: /ultracode · 2\/3 · 1 agent/ })).toBeDefined()
  expect(await ui.find({ text: /ultracode · done/ })).toBeUndefined()
  await finish('w3')
  await clock.advance(4000)
  expect(await ui.find({ text: /ultracode · done · 3 agents/ })).toBeDefined()
  await ui.unmount()
})

test('background agents keep a count after the turn that sent them ends, without ultracode in front', async ($, on) => {
  const clock = engine(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `b${++n}` }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spawn = (background: boolean) => $.agent.spawn({ prompt: 'p', description: 'd', background } as never)
  const finish = (agentId: string) => $.turn.complete({ agentId, turnId: `t-${agentId}`, reason: 'answer', answer: '', durationMs: 1000, isAborted: false } as never)
  await spawn(true)
  await spawn(true)
  // A foreground one counts while its Agent call runs, not here.
  await spawn(false)
  await clock.advance(4000)
  expect(await ui.find({ text: /^0\/2 · 2 agents/ })).toBeDefined()
  expect(await ui.find({ text: /ultracode/ })).toBeUndefined()
  await finish('b1')
  await finish('b2')
  await clock.advance(4000)
  expect(await ui.find({ text: /^done · 2 agents/ })).toBeDefined()
  await ui.unmount()
})

test('ultracode: agents asking at once give the count back, and a stopped run is no party', async ($, on) => {
  const clock = engine(on)
  let n = 0
  const gates: Record<string, () => void> = {}
  on('agent.spawn', () => ({ model: 'm', agentId: `w${++n}` }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  on('classic.PermissionRequest', () => ({}) as never)
  on('tool.call', ($, e) => new Promise(resolve => {
    gates[String(e.agentId)] = () => resolve({ result: 'ok', text: 'ok' } as never)
  }) as never)
  await clock.set(at(2026, 7, 1, 12))
  await $.session.start(START)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const spawn = (agentIndex: number) => $.agent.spawn({ prompt: 'p', description: 'd', workflow: { runId: 'wf_1', agentIndex } } as never)
  const finish = (agentId: string, reason: string) => $.turn.complete({ agentId, turnId: `t-${agentId}`, reason, answer: '', durationMs: 1000, isAborted: reason === 'aborted' } as never)
  await spawn(1)
  await spawn(2)
  await clock.advance(4000)
  expect(await ui.find({ text: /ultracode · 0\/2 · 2 agents/ })).toBeDefined()
  const a = $.tool.call({ tool: 'Bash', command: 'npm test', agentId: 'w1' } as never)
  const b = $.tool.call({ tool: 'Bash', command: 'npm run build', agentId: 'w2' } as never)
  await clock.advance(450)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' }, agent_id: 'w1' } as never)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm run build' }, agent_id: 'w2' } as never)
  await clock.advance(450)
  expect(await ui.find({ text: /awaiting approval/ })).toBeDefined()
  gates.w1?.()
  await a
  gates.w2?.()
  await b
  await clock.advance(1500)
  expect(await ui.find({ text: /ultracode · 0\/2 · 2 agents/ })).toBeDefined()
  expect(await ui.find({ text: /awaiting approval/ })).toBeUndefined()
  // Stopped, both: the run is over, but nothing was done.
  await finish('w1', 'aborted')
  await finish('w2', 'aborted')
  await clock.advance(4000)
  expect(await ui.find({ text: /ultracode · stopped/ })).toBeDefined()
  expect(await ui.find({ text: /ultracode · done/ })).toBeUndefined()
  await ui.unmount()
})
