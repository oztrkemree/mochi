import type { On, Register } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { register as deployCheer } from '../examples/mochi-deploy-cheer/hooks/register'
import { API_MOODS, cheerOf, isKept, mayReact, reactionOf, signed } from '../hooks/api'
import { exportOf, feedbackUrl, isCleared, isExported } from '../hooks/data'
import { DICTS, LANGS, setLang } from '../hooks/i18n'
import { ASCII_HAT, SEASONAL, SLOT, SLOTS, SLOT_ITEMS, UNLOCKS, hintFor } from '../hooks/level'
import { VECTOR_WEAR, WEAR_AT } from '../hooks/rig'
import { ALL_ITEMS, DEFAULT_PREFS } from '../hooks/state'
import { cols } from '../hooks/text'
import { WEAR } from '../hooks/wear'

// Mochi for other plugins, the wardrobe's rules for new items, and what the
// person can take out of Mochi or clear. These speak English.
setLang('en')

/** Noon on 1 July 2026 by this machine's clock. */
const NOON = Date.UTC(2026, 6, 1, 12, 0) + new Date(Date.UTC(2026, 6, 1, 12, 0)).getTimezoneOffset() * 60_000
const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as never
const HOME = '/home/me'
const DIR = `${HOME}/.claude/mochi`

/**
 * What a session's engine answers beneath the plugins: a home folder in
 * memory under `$.fs`, the store (`store`, as it changes), the clock, and the
 * commands run, with `rm` removing what it names from that folder.
 */
function machine(on: On, files: Record<string, string> = {}, store: Record<string, unknown> = { prefs: { lang: 'en' } }) {
  // The engine writes a path the way the system the test runs on does: on Windows with `\` and a drive.
  const slashed = (path = '') => path.replaceAll('\\', '/').replace(/^[A-Za-z]:(?=\/)/, '')
  const ran: { argv: readonly string[]; cwd: string }[] = []
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.set', ($, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    delete store[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(store) }))
  mock.env(on, { HOME })
  const clock = mock.clock(on)
  on('fs.read', ($, e) => {
    const path = slashed(e.path)
    if (path.endsWith('/.claude-plugin/plugin.json')) return { value: '{ "name": "mochi", "version": "0.2.0" }' }
    const text = files[path]
    return text === undefined ? { deny: `no such file: ${path}` } : { value: text }
  })
  on('fs.write', ($, e) => {
    files[slashed(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.exists', ($, e) => ({ value: Object.keys(files).some(p => p === slashed(e.path) || p.startsWith(`${slashed(e.path)}/`)) }))
  on('fs.list', ($, e) => {
    const dir = `${slashed(e.path)}/`
    const names = new Map<string, 'file' | 'dir'>()
    for (const p of Object.keys(files)) {
      if (!p.startsWith(dir)) continue
      const [first = '', ...rest] = p.slice(dir.length).split('/')
      names.set(first, rest.length > 0 ? 'dir' : 'file')
    }
    return { value: [...names].map(([name, kind]) => ({ name, kind, size: 1, mtimeMs: kind === 'file' ? NOON : 0, isLink: false })) }
  })
  on('process.run', ($, e) => {
    const cwd = slashed(e.init?.cwd)
    ran.push({ argv: e.argv, cwd })
    if (e.argv[0] === 'rm') for (const name of e.argv.slice(3)) delete files[`${cwd}/${name}`]
    return { value: { exitCode: e.argv[0] === 'rm' ? 0 : 1, stdout: '', stderr: '' } } as never
  })
  on('session.start', () => ({ cwd: '/tmp' }))
  on('session.id', () => ({ value: 'chat-1' }) as never)
  on('session.version', () => ({ value: { version: '2.1.293 (Claude Code)' } }) as never)
  on('session.surfaces', () => ({ value: ['terminal'] as never }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 0, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  return { clock, ran, files }
}

/** Answers Mochi's questions with `answer()`, and keeps what was asked. */
function answering(on: On, answer: () => string) {
  const asked: string[] = []
  on('tool.call', { tool: 'AskUserQuestion' }, (($: unknown, e: { questions: { question: string }[] }) => {
    const question = e.questions[0]?.question ?? ''
    asked.push(question)
    return { result: { questions: e.questions, answers: { [question]: answer() } }, text: answer() }
  }) as never)
  return asked
}

/** A plugin that depends on Mochi: `/poke react {…}` or `/poke cheer {…}` passes the JSON on and answers with Mochi's answer. */
const POKE = {
  name: 'poke',
  register: (on => {
    on('command.run', { command: 'poke' }, async ($, e) => {
      const [kind = '', ...rest] = e.args.split(' ')
      const input = JSON.parse(rest.join(' ')) as never
      const answer = kind === 'cheer' ? await $.mochi.celebrate(input) : await $.mochi.react(input)
      return { text: JSON.stringify(answer) }
    })
  }) as Register,
}

const say = async ($: Engine, command: string, args: string) => (await $.command.run({ command, args } as never)).text ?? ''

test('another plugin’s reaction is checked, cut, signed and spaced out', async () => {
  expect(reactionOf({ mood: 'wave', line: 'hello' })).toEqual({ mood: 'wave', line: 'hello', holdMs: 5000 })
  // Only the moods on the list; never Mochi asking, warning or dangerous.
  for (const mood of ['asking', 'scared', 'dizzy', 'squeezed', 'sleeping', 'toString', 42]) expect(reactionOf({ mood, line: 'x' })).toBe(null)
  for (const mood of API_MOODS) expect(reactionOf({ mood, line: 'x' })?.mood).toBe(mood)
  for (const bad of [null, 'wave', [], { mood: 'wave' }, { mood: 'wave', line: 7 }, { mood: 'wave', line: ' \n\t ' }]) expect(reactionOf(bad)).toBe(null)
  // One plain line: no control characters, no direction marks, at most 60 columns.
  const r = reactionOf({ mood: 'success', line: `built\n\u001b[31m ok\u202e\u061c${'x'.repeat(100)}`, holdMs: 99_999 })
  expect(r?.line.startsWith('built [31m ok ')).toBe(true)
  expect(/[؜‮]/.test(r?.line ?? '')).toBe(false)
  expect(cols(r?.line ?? '')).toBe(60)
  expect(r?.holdMs).toBe(15_000)
  expect(reactionOf({ mood: 'wave', line: 'x', holdMs: -5 })?.holdMs).toBe(1000)
  expect(reactionOf({ mood: 'wave', line: 'x', holdMs: Number.NaN })?.holdMs).toBe(5000)
  expect(reactionOf({ mood: 'wave', line: '発行完了'.repeat(20) })?.line.length).toBeLessThan(31)
  expect(cheerOf({ line: 'shipped' })).toEqual({ mood: 'party', line: 'shipped', holdMs: 6000 })
  expect(cheerOf('shipped')).toBe(null)
  expect(signed('deployed', 'mochi-deploy-cheer')).toBe('deployed · mochi-deploy-cheer')
  expect(mayReact(undefined, 5000)).toBe(true)
  expect(mayReact(1000, 10_999)).toBe(false)
  expect(mayReact(1000, 11_000)).toBe(true)
  // Mochi waiting on the person, or warning, keeps its face until it lets go.
  expect(isKept({ mood: 'asking', until: 0 }, 5000)).toBe(true)
  expect(isKept({ mood: 'scared', until: 9000 }, 5000)).toBe(true)
  expect(isKept({ mood: 'scared', until: 4000 }, 5000)).toBe(false)
  expect(isKept({ mood: 'thinking', until: 0 }, 5000)).toBe(false)
})

test('a plugin that depends on Mochi makes it react, now and then, and the person can turn that off', { plugins: [POKE, { name: 'mochi-deploy-cheer', register: deployCheer }] }, async ($, on) => {
  const { clock } = machine(on)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ok', stderr: '', interrupted: false }, text: 'ok' }) as never)
  await clock.set(NOON)
  await $.session.start(START)
  await clock.advance(4000)
  expect(await say($, 'poke', 'react {"mood":"proud","line":"report ready"}')).toBe('{"isShown":true}')
  expect(await say($, 'mochi', 'status')).toContain('report ready · poke')
  // Too soon for the same plugin; a bad call is turned away without using its turn.
  expect(await say($, 'poke', 'react {"mood":"pleased","line":"again"}')).toBe('{"isShown":false,"reason":"often"}')
  await clock.advance(10_000)
  expect(await say($, 'poke', 'react {"mood":"asking","line":"say yes"}')).toBe('{"isShown":false,"reason":"invalid"}')
  expect(await say($, 'poke', 'cheer {"line":"all green"}')).toBe('{"isShown":true}')
  expect(await say($, 'mochi', 'status')).toContain('all green · poke')
  // The example plugin, as shipped: a deploy that finishes is cheered.
  await clock.advance(10_000)
  await $.tool.call({ tool: 'Bash', command: 'npm run deploy' } as never)
  expect(await say($, 'mochi', 'status')).toContain('deployed · mochi-deploy-cheer')
  expect(await say($, 'mochi', 'plugins')).toBe('Reactions from other plugins off.')
  await clock.advance(10_000)
  expect(await say($, 'poke', 'react {"mood":"wave","line":"hi"}')).toBe('{"isShown":false,"reason":"off"}')
  expect(await say($, 'mochi', 'plugins')).toBe('Reactions from other plugins on.')
})

test('an export takes every file Mochi keeps; each reset clears its own and keeps the exports', async () => {
  const take = (dir: string, name: string) => [isExported(dir, name), isCleared('level', dir, name), isCleared('history', dir, name), isCleared('all', dir, name)]
  expect(take('', 'level.json')).toEqual([true, true, true, true])
  expect(take('days', 'abc-1.json')).toEqual([true, false, true, true])
  expect(take('', 'usage.json')).toEqual([true, false, false, true])
  expect(take('live', 'abc-2.json')).toEqual([false, false, false, true])
  expect(take('', 'export-2026-07-01.json')).toEqual([false, false, false, false])
  expect(take('', 'shield.json')).toEqual([true, false, false, false])
  expect(take('days', 'notes.txt')).toEqual([false, false, false, false])
  const out = exportOf(Date.UTC(2026, 6, 1, 9, 0), '0.2.0', { prefs: { lang: 'en' } }, { 'level.json': '{"level":3}', 'days/a.json': 'half{' })
  expect(out).toEqual({ mochi: '0.2.0', exportedAt: '2026-07-01T09:00:00.000Z', store: { prefs: { lang: 'en' } }, files: { 'level.json': { level: 3 }, 'days/a.json': 'half{' } })
})

test('/mochi export writes one file beside the rest; reset asks first, then clears only what it names', async ($, on) => {
  const store: Record<string, unknown> = { prefs: { lang: 'en', hasSound: true } }
  const day = { turns: 4, tools: 9, edits: 2, errors: 0, commits: 1, cost: 0.5, secs: 300, night: 0 }
  const { clock, ran, files } = machine(on, {
    [`${DIR}/level.json`]: '{"level":2,"items":["beanie"]}',
    [`${DIR}/usage.json`]: '[]',
    [`${DIR}/days/other-chat.json`]: JSON.stringify({ id: 'other-chat', label: 'web', days: { '2026-06-30': day } }),
    [`${DIR}/live/other-chat.json`]: '{}',
    [`${DIR}/export-2026-06-01.json`]: '{}',
    [`${DIR}/shield.json`]: '{"add":[]}',
    '/home/me/project/notes.json': '{}',
  }, store)
  let answer = 'Keep'
  const asked = answering(on, () => answer)
  await clock.set(NOON)
  await $.session.start(START)
  await clock.settle()

  expect(await say($, 'mochi', 'export')).toBe('Everything Mochi keeps is in one file: ~/.claude/mochi/export-2026-07-01.json')
  const exported = JSON.parse(files[`${DIR}/export-2026-07-01.json`] ?? '{}') as { mochi: string; store: { prefs: { hasSound: boolean } }; files: Record<string, unknown> }
  expect(exported.mochi).toBe('0.2.0')
  expect(exported.store.prefs.hasSound).toBe(true)
  expect(Object.keys(exported.files).sort()).toEqual(['badges.json', 'days/chat-1.json', 'days/other-chat.json', 'level.json', 'shield.json', 'usage.json'])
  expect((exported.files['days/other-chat.json'] as { days: Record<string, unknown> }).days['2026-06-30']).toEqual(day)

  expect(await say($, 'mochi', 'reset')).toBe('Clear what? /mochi reset level · history · all')
  expect(await say($, 'mochi', 'reset history')).toBe('Nothing was cleared.')
  expect(asked[0]).toContain('history of every chat')
  expect(ran.filter(r => r.argv[0] === 'rm')).toEqual([])

  answer = 'Clear'
  expect(await say($, 'mochi', 'reset level')).toContain('Level memory cleared.')
  expect(ran.filter(r => r.argv[0] === 'rm')).toEqual([{ argv: ['rm', '-f', '--', 'level.json'], cwd: DIR }])
  // The history the level is counted from stays.
  expect(files[`${DIR}/level.json`]).toBeUndefined()
  expect(files[`${DIR}/days/other-chat.json`]).toBeDefined()

  expect(await say($, 'mochi', 'reset history')).toBe('History cleared in every chat; the level starts over.')
  const last = ran.filter(r => r.argv[0] === 'rm').at(-1)
  expect(last?.cwd).toBe(`${DIR}/days`)
  expect(last?.argv.slice(3).toSorted()).toEqual(['chat-1.json', 'other-chat.json'])
  expect(files[`${DIR}/days/other-chat.json`]).toBeUndefined()
  expect(files[`${DIR}/usage.json`]).toBeDefined()
  // The level's memory starts over with the history, so the levels earned again are celebrated again.
  expect(await say($, 'mochi', 'level')).toContain('Level 1 ·')
  expect((JSON.parse(files[`${DIR}/level.json`] ?? '{}') as { level?: number }).level).toBe(1)

  expect(await say($, 'mochi', 'reset all')).toBe('Everything Mochi kept is cleared, and its settings are back to their defaults.')
  // Nothing outside Mochi's folder, and no export, is touched.
  expect(ran.filter(r => r.argv[0] === 'rm').every(r => r.cwd.startsWith(DIR))).toBe(true)
  expect(files['/home/me/project/notes.json']).toBeDefined()
  expect(files[`${DIR}/export-2026-06-01.json`]).toBeDefined()
  expect(files[`${DIR}/export-2026-07-01.json`]).toBeDefined()
  // The shield's rules are the person's own writing: they stay too.
  expect(files[`${DIR}/shield.json`]).toBeDefined()
  expect(files[`${DIR}/live/other-chat.json`]).toBeUndefined()
  expect(await say($, 'mochi', 'status')).toContain('Sound: off')
  // All but the first day, recorded again for the anniversary.
  expect(store).toEqual({ prefs: { ...DEFAULT_PREFS, firstDay: '2026-07-01' } })
})

test('a history cleared in another chat is neither counted nor written back by this one', async ($, on) => {
  const day = { turns: 4, tools: 9, edits: 2, errors: 0, commits: 1, cost: 0.5, secs: 300, night: 0 }
  const { clock, files } = machine(on, {
    [`${DIR}/days/chat-1.json`]: JSON.stringify({ id: 'chat-1', label: 'web', days: { '2026-06-30': day } }),
    [`${DIR}/days/other-chat.json`]: JSON.stringify({ id: 'other-chat', label: 'api', days: { '2026-06-29': { ...day, turns: 100 } } }),
  })
  on('turn.complete', () => ({ text: '' }))
  on('session.end', () => ({ sessionId: 'chat-1' }) as never)
  await clock.set(NOON)
  await $.session.start(START)
  expect(await say($, 'mochi', 'level')).toContain('Level 4 ·')
  // Another chat clears the history: every chat's days go, and its level's memory starts over.
  delete files[`${DIR}/days/chat-1.json`]
  delete files[`${DIR}/days/other-chat.json`]
  files[`${DIR}/level.json`] = '{"level":1,"items":[]}'
  await $.turn.complete({ reason: 'answer', answer: '', durationMs: 1000, isAborted: false, turnId: 't1' } as never)
  const kept = JSON.parse(files[`${DIR}/days/chat-1.json`] ?? '{}') as { days: Record<string, { turns: number }> }
  expect(Object.keys(kept.days)).toEqual(['2026-07-01'])
  expect(kept.days['2026-07-01']?.turns).toBe(1)
  // The other chat's old days are not counted either, so no old level is celebrated as new.
  expect(await say($, 'mochi', 'level')).toContain('Level 1 ·')
  expect((JSON.parse(files[`${DIR}/level.json`] ?? '{}') as { level?: number }).level).toBe(1)
  // Cleared again, the chat's last save on its way out writes nothing back.
  delete files[`${DIR}/days/chat-1.json`]
  await $.session.end({ reason: 'exit', sessionId: 'chat-1' } as never)
  expect((JSON.parse(files[`${DIR}/days/chat-1.json`] ?? '{}') as { days?: object }).days).toEqual({})
})

test('the feedback link carries versions, system, surface and language alone', async ($, on) => {
  const url = feedbackUrl({ mochi: '0.2.0', claude: '2.1.293 (Claude Code)', platform: 'windows', surface: 'desktop', lang: 'Türkçe' })
  expect(url).toBe('https://github.com/oztrkemree/mochi/issues/new?template=bug_report.yml&surface=Claude%20desktop%20app&versions=Claude%20Code%202.1.293%20%C2%B7%20Mochi%200.2.0%20%C2%B7%20Windows%20%C2%B7%20T%C3%BCrk%C3%A7e')
  const query = new URL(url).searchParams
  const keys: string[] = []
  query.forEach((v, k) => keys.push(k))
  expect(keys).toEqual(['template', 'surface', 'versions'])
  expect(query.get('versions')).toBe('Claude Code 2.1.293 · Mochi 0.2.0 · Windows · Türkçe')
  // What is not known is left out; a version never carries anything after it.
  const bare = new URL(feedbackUrl({ mochi: '', claude: '', platform: 'linux', surface: 'vim', lang: 'English' })).searchParams
  expect(bare.get('surface')).toBe('Other')
  expect(bare.get('versions')).toBe('Linux · English')
  expect(new URL(feedbackUrl({ mochi: '0.2.0 /home/me', claude: '2.1.293&title=x', platform: 'mac', surface: 'terminal', lang: 'en' })).searchParams.get('versions')).toBe('Claude Code 2.1.293 · Mochi 0.2.0 · macOS · en')

  const { clock } = machine(on)
  await clock.set(NOON)
  await $.session.start(START)
  const said = await say($, 'mochi', 'feedback')
  expect(said).toContain('https://github.com/oztrkemree/mochi/issues/new?template=bug_report.yml&surface=Terminal&versions=Claude%20Code%202.1.293%20%C2%B7%20Mochi%200.2.0%20%C2%B7%20Linux%20%C2%B7%20English')
  expect(said).not.toContain(HOME)
  expect(said).not.toContain('chat-1')
})

test('every item has art, a place, a slot, a way to get it and a name in every language', async () => {
  const items = Object.keys(WEAR_AT)
  expect(new Set(ALL_ITEMS).size).toBe(ALL_ITEMS.length)
  expect([...ALL_ITEMS].sort()).toEqual([...items].sort())
  expect(Object.keys(WEAR).every(x => items.includes(x))).toBe(true)
  for (const l of LANGS) expect(Object.keys(DICTS[l].item.name).sort()).toEqual([...items].sort())
  for (const item of ALL_ITEMS) {
    const where = `${item}: `
    expect(where + SLOTS.filter(s => SLOT_ITEMS[s].includes(item)).length).toBe(`${where}1`)
    expect(where + SLOTS.includes(SLOT[item])).toBe(`${where}true`)
    // A picture (a WebP the wardrobe shows too), lines inside the 100×100 frame, or both.
    const art = WEAR[item]
    if (art) expect(where + (art.uri.startsWith('data:image/') && art.w > 0 && art.h > 0)).toBe(`${where}true`)
    const vector = VECTOR_WEAR[item]
    if (vector) expect(where + (vector.svg.length > 0 && vector.box.every(v => v >= 0 && v <= 100))).toBe(`${where}true`)
    expect(where + (art !== undefined || vector !== undefined)).toBe(`${where}true`)
    const at = WEAR_AT[item]
    expect(where + [at.x, at.y].every(v => v >= 0 && v <= 100) + (at.w > 0 && at.w <= 100)).toBe(`${where}truetrue`)
    // Earned one way at most, or worn by the date (the party hat both): never neither.
    const earned = UNLOCKS.filter(u => u.item === item).length
    expect(where + (earned <= 1 && earned + SEASONAL.filter(s => s.item === item).length >= 1)).toBe(`${where}true`)
    for (const l of LANGS) {
      const d = DICTS[l].item
      expect(`${where}${l} ` + (d.name[item].trim() !== '' && d.short[item].trim() !== '')).toBe(`${where}${l} true`)
    }
    setLang('en')
    expect(where + (hintFor(item) !== '')).toBe(`${where}true`)
    // A hat has a row in the terminal too: five cells.
    if (SLOT[item] === 'head') expect(where + cols(ASCII_HAT[item] ?? '')).toBe(`${where}5`)
  }
})
