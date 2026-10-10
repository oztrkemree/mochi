import { expect, mock, test } from 'claude-code/testing'

import type { DayRec, Env } from '../types'
import { detailHeight, detailSvg } from '../hooks/detail'
import { DICTS, LANGS, setLang } from '../hooks/i18n'
import { EMPTY_DAY, summarize } from '../hooks/level'
import { PANEL_H, panelSvg } from '../hooks/panel'
import { bestOutfit, cardMarkdown, cardPath, cardSvg, framed, monthToOffer, wrappedOf, wrappedSvg } from '../hooks/share'
import type { ChatDays } from '../hooks/share'
import { NO_ENV, NO_PANEL } from '../hooks/state'

// These read the English lines, but for the one that goes through every language.
setLang('en')

const TAG = /^<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="(?:[^"<&]|&(?:amp|lt|gt|quot|apos|#\d+);)*")*)\s*(\/?)>$/

/** What keeps the text from being well-formed XML (a tag, an attribute, a stray & or a tag left open); '' when nothing. */
function malformed(xml: string): string {
  const open: string[] = []
  for (const part of xml.split(/(<[^>]*>)/)) {
    if (part.startsWith('<')) {
      const m = TAG.exec(part)
      if (!m) return part.slice(0, 80)
      if (m[1] === '/' && open.pop() !== m[2]) return part
      if (m[1] === '' && m[4] === '') open.push(m[2] ?? '')
    } else if (/&(?!(?:amp|lt|gt|quot|apos|#\d+);)/.test(part)) {
      return part.slice(0, 80)
    }
  }
  return open.join(' ')
}

/** Whether a drawing shows on GitHub as it is: well-formed, small, and pointing at nothing outside itself. */
function isSelfContained(svg: string): boolean {
  const refs = [...svg.matchAll(/href="([^"]*)"|url\(([^)]*)\)/g)].map(m => m[1] ?? m[2] ?? '')
  expect(malformed(svg)).toBe('')
  expect(svg.length < 200_000).toBe(true)
  expect(refs.filter(r => !r.startsWith('data:') && !r.startsWith('#'))).toEqual([])
  expect(svg.includes('@import')).toBe(false)
  return true
}

const day = (rec: Partial<DayRec>): Partial<DayRec> => rec
const NONE = { head: null, face: null, neck: null, held: null, ground: null }

/** Three chats over the end of August and September; two of them in the same folder. */
const CHATS: ChatDays[] = [
  { label: 'web', days: { '2026-09-01': day({ turns: 2, secs: 600, edits: 4 }), '2026-09-02': day({ turns: 5, secs: 1200, commits: 1 }), '2026-09-03': day({ turns: 1, secs: 60 }) } },
  { label: 'api', days: { '2026-08-31': day({ turns: 7, secs: 900 }), '2026-09-02': day({ turns: 3, secs: 4000 }) } },
  { label: 'web', days: { '2026-09-10': day({ turns: 1, secs: 4000, commits: 2 }), 'not a day': day({ turns: 99 }) } },
]

test('the card, the wrapped and the snapshot are well-formed, small and self-contained, in every language, empty or full', async () => {
  const full = summarize(CHATS.map(c => c.days), '2026-09-10')
  const env: Env = { ...NO_ENV, history: full, context: 42, tokens: 84_000, window: 200_000 }
  const odd: ChatDays[] = [...CHATS, { label: '<b>&"x"</b>\u0007', days: { '2026-09-20': day({ turns: 1, secs: 99_999 }) } }]
  for (const l of LANGS) {
    setLang(l)
    for (const svg of [
      cardSvg(null, NONE),
      cardSvg(full, bestOutfit(['crown', 'monocle', 'medal', 'cat'])),
      wrappedSvg(wrappedOf([], 'month', '2026-10-20'), NONE),
      wrappedSvg(wrappedOf(odd, 'month', '2026-10-02'), bestOutfit(['wizard'])),
      wrappedSvg(wrappedOf(odd, 'year', '2026-10-02'), NONE),
      framed(panelSvg({ panel: NO_PANEL, now: 0, width: 720 }).svg, 720, PANEL_H),
      framed(detailSvg(env, 0, 720), 720, detailHeight(detailSvg(env, 0, 720))),
    ]) {
      expect(isSelfContained(svg)).toBe(true)
    }
    const wrapped = wrappedSvg(wrappedOf(odd, 'month', '2026-10-02'), NONE)
    expect(wrapped).toContain('&lt;b&gt;&amp;"x"&lt;/b&gt;')
    expect(wrapped.includes('<b>')).toBe(false)
    expect(cardSvg(null, NONE)).toContain(DICTS[l].share.tagline.replaceAll('&', '&amp;'))
  }
  setLang('en')
  const card = cardSvg(null, NONE)
  // Mochi idles on the card, and the card says where it comes from.
  expect(card).toContain('repeatCount="indefinite"')
  expect(card).toContain('>Level 1<')
  expect(card).toContain('>github.com/oztrkemree/mochi<')
  expect(card).toContain('prefers-color-scheme:light')
  expect(wrappedSvg(wrappedOf([], 'month', '2026-10-20'), NONE)).toContain('a quiet one: no turns yet')
})

test('wrapped adds up every chat, names the folder with the most time, and finds the busiest day and the longest run', async () => {
  const w = wrappedOf(CHATS, 'month', '2026-10-02')
  // In October's first week, September is the month to wrap up; August's last day is not in it.
  expect(w.key).toBe('2026-09')
  expect([w.from, w.to]).toEqual(['2026-09-01', '2026-09-30'])
  expect(w.total.turns).toBe(12)
  expect(w.total.commits).toBe(3)
  expect(w.activeDays).toBe(4)
  expect(w.longest).toBe(3)
  expect(w.busiest).toEqual({ day: '2026-09-02', turns: 8 })
  expect(w.top).toBe('web')
  const svg = wrappedSvg(w, NONE)
  expect(svg).toContain('>September 2026<')
  expect(svg).toContain('busiest day · Sep 2 · 8 turns')
  expect(svg).toContain('most time in web')
  expect(svg).toContain('>3<')
  // Later in the month, the month under way; in January's first week, the year before.
  expect(wrappedOf(CHATS, 'month', '2026-10-12').key).toBe('2026-10')
  expect(wrappedOf(CHATS, 'year', '2027-01-03').key).toBe('2026')
  expect(wrappedOf(CHATS, 'year', '2026-10-02').total.turns).toBe(19)
  expect(wrappedOf([], 'month', '2026-02-11')).toEqual({ key: '2026-02', from: '2026-02-01', to: '2026-02-28', days: {}, total: EMPTY_DAY, activeDays: 0, longest: 0, busiest: null, top: null })
})

test('the month just ended is offered once, in the new month’s first week, when it saw work', async () => {
  const days = { '2026-09-14': day({ turns: 3 }) }
  expect(monthToOffer('2026-10-01', days, undefined)).toBe('2026-09')
  expect(monthToOffer('2026-10-07', days, '2026-08')).toBe('2026-09')
  expect(monthToOffer('2026-10-02', days, '2026-09')).toBe(null)
  expect(monthToOffer('2026-10-09', days, undefined)).toBe(null)
  expect(monthToOffer('2026-10-02', { '2026-09-14': day({ turns: 0 }) }, undefined)).toBe(null)
})

test('the card goes where it is told, and its markdown line shows it on a profile', async () => {
  expect(cardPath('C:\\me\\card.svg', '/proj', '/home/me')).toBe('C:\\me\\card.svg')
  expect(cardPath('/srv/me', '/proj', '/home/me')).toBe('/srv/me/mochi-card.svg')
  expect(cardPath('~/profile/', '/proj', '/home/me')).toBe('/home/me/profile/mochi-card.svg')
  expect(cardPath('docs/me.svg', '/proj/', '/home/me')).toBe('/proj/docs/me.svg')
  expect(cardMarkdown('my card.svg')).toBe('[![Mochi for Claude Code](my%20card.svg)](https://github.com/oztrkemree/mochi)')
  expect(bestOutfit(['beanie', 'crown', 'glasses', 'monocle', 'bowtie', 'medal', 'mug', 'cat'])).toEqual({ head: 'crown', face: 'monocle', neck: 'medal', held: null, ground: 'cat' })
  expect(bestOutfit([])).toEqual(NONE)
})

/** Noon on 2 October 2026 by this machine's clock, whose time zone Mochi reads. */
const OCT2 = Date.UTC(2026, 9, 2, 12, 0) + new Date(Date.UTC(2026, 9, 2, 12, 0)).getTimezoneOffset() * 60_000

test('/mochi card, wrapped and snap write under ~/.claude/mochi/share; a new month’s wrapped is offered once', async ($, on) => {
  mock.store(on, { prefs: { lang: 'en' } })
  mock.env(on, { HOME: '/home/me' })
  const clock = mock.clock(on)
  const written: Record<string, string> = {}
  // The engine hands a path on with the separators (and on Windows the drive) of the system the test runs on.
  const plain = (path: string) => path.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '')
  const toasts: string[] = []
  const other = JSON.stringify({ id: 'other-1', label: 'api', days: CHATS[1]?.days })
  on('session.start', () => ({ cwd: '/proj' }))
  on('session.id', () => ({ value: 'me-1' }) as never)
  on('session.cwd', () => ({ value: '/proj' }) as never)
  on('command.register', () => ({ value: { command: 'mochi' } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('fs.list', ($, e) => ({ value: plain(e.path).endsWith('/days') ? [{ name: 'other-1.json', kind: 'file' as const, size: 9, mtimeMs: OCT2, isLink: false }] : [] }))
  on('fs.read', ($, e) => ({ value: plain(e.path).endsWith('/days/other-1.json') ? other : '' }) as never)
  on('fs.write', ($, e) => {
    written[plain(e.path)] = e.text
    return { value: undefined }
  })
  await clock.set(OCT2)
  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1000)
  expect(toasts.filter(x => x.includes('wrapped'))).toEqual(['Mochi: your September wrapped is ready · /mochi wrapped'])

  const card = await $.command.run({ command: 'mochi', args: 'card' } as never)
  expect(card.text).toContain('/home/me/.claude/mochi/share/mochi-card.svg')
  expect(card.text).toContain('[![Mochi for Claude Code](mochi-card.svg)](https://github.com/oztrkemree/mochi)')
  expect(written['/home/me/.claude/mochi/share/mochi-card.svg']?.startsWith('<svg')).toBe(true)
  // A path the person gives is theirs to choose, relative to the session's folder.
  await $.command.run({ command: 'mochi', args: 'card Profile/Me.svg' } as never)
  expect(written['/proj/Profile/Me.svg']?.startsWith('<svg')).toBe(true)

  const wrapped = await $.command.run({ command: 'mochi', args: 'wrapped' } as never)
  expect(wrapped.text).toBe('September 2026 wrapped: /home/me/.claude/mochi/share/mochi-wrapped-2026-09.svg')
  expect(written['/home/me/.claude/mochi/share/mochi-wrapped-2026-09.svg']).toContain('most time in api')
  const year = await $.command.run({ command: 'mochi', args: 'wrapped year' } as never)
  expect(year.text).toContain('mochi-wrapped-2026.svg')

  const snap = await $.command.run({ command: 'mochi', args: 'snap' } as never)
  expect(snap.text).toBe('Band: /home/me/.claude/mochi/share/mochi-band.svg\nDetails pane: /home/me/.claude/mochi/share/mochi-details.svg')
  for (const name of ['band', 'details']) expect(isSelfContained(written[`/home/me/.claude/mochi/share/mochi-${name}.svg`] ?? '')).toBe(true)

  // Ten minutes on, the history is read again; the offer is not made twice.
  await clock.advance(11 * 60_000)
  expect(toasts.filter(x => x.includes('wrapped')).length).toBe(1)
  // Nothing of it went into the project unasked.
  expect(Object.keys(written).filter(p => p.startsWith('/proj/'))).toEqual(['/proj/Profile/Me.svg'])
})
