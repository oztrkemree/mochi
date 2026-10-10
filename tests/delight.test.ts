import type { On, RenderElement } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { BADGES, badgesOf, badgeSvg, commandBadges, isEarly, langBit, provenBy, turnBadges } from '../hooks/badges'
import { birthdayName, dueGreeting, firstDayOf, greeting, isBreakDue, isLeet, occasions, parseBirthday, promptEgg, workFrom } from '../hooks/fun'
import { ASCII_HAT, addDay, EMPTY_DAY, hintFor, outfitFor, summarize, wearable } from '../hooks/level'
import { DICTS, LANGS, setLang } from '../hooks/i18n'
import { LOOKS, asciiRows } from '../hooks/looks'
import { MOOD_INK } from '../hooks/panel'
import { POSES, VECTOR_WEAR, WEAR_AT, svgFor } from '../hooks/rig'
import { ALL_ITEMS, restorePrefs } from '../hooks/state'
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

test('the calendar knows the days that move with the moon, the fixed ones and the person’s own', async () => {
  const on = (day: string, own = { birthday: '', firstDay: '' }) => occasions(day, own).map(o => o.name)
  expect(on('2026-02-17')).toEqual(['lunarNewYear'])
  expect(on('2026-02-19')).toEqual(['lunarNewYear'])
  expect(on('2026-02-20')).toEqual([])
  expect(on('2026-03-21')).toEqual(['eidFitr', 'nowruz'])
  expect(on('2027-05-16')).toEqual(['eidAdha'])
  expect(on('2028-10-03')).toEqual(['chuseok', 'hacktoberfest'])
  expect(on('2026-11-06')).toEqual(['diwali'])
  expect(on('2026-04-05')).toEqual(['hanami'])
  expect(on('2026-03-14')).toEqual(['piDay'])
  expect(on('2026-11-13')).toEqual(['friday13'])
  expect(on('2026-10-10')).toEqual(['hacktoberfest'])
  expect(on('2026-10-28')).toEqual(['halloween', 'hacktoberfest'])
  expect(on('2026-12-24')).toEqual(['xmas'])
  expect(occasions('2027-01-01')).toEqual([{ name: 'newYear', from: '2026-12-31' }])
  // The table of moving days ends with 2030.
  expect(on('2031-01-23')).toEqual([])
  expect(on('2027-04-23', { birthday: '04-23', firstDay: '' })).toEqual(['birthday'])
  expect(on('2027-02-28', { birthday: '02-29', firstDay: '' })).toEqual(['birthday'])
  expect(on('2028-02-28', { birthday: '02-29', firstDay: '' })).toEqual(['eidFitr'])
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
  expect(greeting('diwali', '2026-11-08', own)).toEqual({ mood: 'wave', line: 'happy diwali', holdMs: 8000 })
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

test('the date dresses Mochi, and its things can be put on that day only', async () => {
  const noon = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12, 0)
  const birthday = { birthday: '07-01', firstDay: '' }
  expect(outfitFor({}, [], noon(2026, 7, 1), 0, 'idle', true, birthday)).toEqual({ ...NONE, head: 'partyhat', ground: 'cake' })
  expect(outfitFor({}, [], noon(2026, 11, 8), 0, 'idle', true)).toEqual({ ...NONE, ground: 'diya' })
  expect(outfitFor({}, [], noon(2026, 4, 3), 0, 'idle', true).head).toBe('sakura')
  expect(outfitFor({}, [], Date.UTC(2026, 1, 17, 8, 0), 0, 'idle', true).held).toBe('envelope')
  expect(outfitFor({}, [], noon(2026, 3, 20), 0, 'success', false).held).toBe(null)
  expect(outfitFor({}, [], noon(2027, 10, 9), 0, 'idle', true, { birthday: '', firstDay: '2026-10-09' }).neck).toBe('rosette')
  expect(outfitFor({ neck: null }, [], noon(2026, 10, 10), 0, 'idle', true).neck).toBe(null)
  expect(wearable(null, noon(2026, 9, 25), 0)).toContain('songpyeon')
  expect(wearable(null, noon(2026, 9, 28), 0).includes('songpyeon')).toBe(false)
  expect(wearable(null, noon(2026, 7, 1), 0, birthday)).toContain('cake')
  expect(hintFor('sakura')).toBe('Apr 1 – 10')
  expect(hintFor('envelope')).toBe('Lunar New Year')
  expect(hintFor('partyhat')).toBe('50 commits')
})

test('every new thing to wear is drawn, and every mood has its pose, look, ink and words', async () => {
  for (const item of ALL_ITEMS) {
    expect(WEAR[item] !== undefined || VECTOR_WEAR[item] !== undefined).toBe(true)
    expect(WEAR_AT[item]).toBeDefined()
  }
  for (const item of ['sakura', 'pin', 'rosette', 'candy', 'lantern', 'envelope', 'diya', 'sprouts', 'songpyeon', 'cake'] as const) {
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
  expect(restorePrefs({ lang: 'en', open: { level: true } } as never).open).toEqual({ level: true, wardrobe: false, badges: false })
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
  await pane.press({ key: 'fold:wardrobe' } as never)
  expect((await pane.find({ type: 'Text', text: /^Beside · / }))?.text).toBe('Beside · birthday cake (auto)')
  expect(await pane.find({ key: 'badge:green' })).toBeUndefined()
  await pane.press({ key: 'fold:badges' } as never)
  expect(await pane.find({ key: 'badge:green' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '0/12 earned' })).toBeDefined()
  await pane.unmount()
  expect(await run('birthday')).toBe('Birthday: July 1. To change it: /mochi birthday MM-DD · none')
  expect(await run('birthday 02-30')).toBe('Not a date: 02-30. Use MM-DD, e.g. /mochi birthday 04-23')
  expect(await run('birthday off')).toBe('Birthday removed.')
  expect(await run('breaks')).toBe('Breaks off.')
  expect(await run('breaks')).toBe('Breaks on: after two hours of work without a pause, Mochi suggests a stretch.')
  expect((await run('badges')).startsWith('Badges 0/12: none yet\nTo earn: first green (a test run that passes), first push (a git push)')).toBe(true)
  // The words of the language in use work too.
  await run('lang tr')
  expect(await run('mola')).toBe('Mola hatırlatması kapalı.')
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
  expect(toasts.filter(x => x.includes('badge'))).toEqual(['Mochi: new badge: first green, comeback · /mochi badges'])
  expect(JSON.parse(files['mochi/badges.json'] ?? '')).toEqual(['green', 'comeback'])
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ text: 'new badge: first green, comeback' })).toBeDefined()
  await ui.unmount()
  await $.tool.call({ tool: 'Bash', command: 'npm test' })
  await $.tool.call({ tool: 'Bash', command: 'git push origin main' })
  expect(toasts.filter(x => x.includes('badge')).length).toBe(2)
  expect(((await $.command.run({ command: 'mochi', args: 'badges' } as never)).text ?? '').split('\n')[0]).toBe('Badges 3/12: first green, comeback, first push')
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
  expect(toasts.filter(x => x.includes('badge'))).toEqual(['Mochi: new badge: team lead · /mochi badges'])
})

test('a turn of half an hour that ends well is a marathon', async ($, on) => {
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
  expect(toasts).toContain('Mochi: new badge: marathon · /mochi badges')
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
