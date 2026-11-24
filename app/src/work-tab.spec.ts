import { expect, test } from 'vitest'

import { setLang } from '../../hooks/i18n'
import { effortOf } from './effort'
import { bandsOf, spell } from './work-tab'

const file = (id: string, label: string, secs: number) => JSON.stringify({ id, label, isLabelFromPrompt: false, days: { '2026-11-24': { secs } } })

test('the river keeps a stream for each of the six projects with the most time, and one for the rest and the unmatched', () => {
  setLang('en')
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((p, i) => file(p, `p-${p}`, (10 - i) * 600)).concat(file('x', 'fervent-boyd-1df155', 300))
  const bands = bandsOf(effortOf(files, [], '2026-11-24', 7))
  expect(bands.map(b => b.name)).toEqual(['p-a', 'p-b', 'p-c', 'p-d', 'p-e', 'p-f', '2 more'])
  // p-g (2400) + p-h (1800) + the unmatched chat (300).
  expect(bands[6]!.daily[6]!.secs).toBe(4500)
  expect(new Set(bands.map(b => b.ink)).size).toBe(7)
})

test('with no project past the six, the last stream is the unmatched, and with none of those there is no last stream', () => {
  setLang('en')
  expect(bandsOf(effortOf([file('a', 'shop', 600), file('x', 'fervent-boyd-1df155', 300)], [], '2026-11-24', 7)).map(b => b.name)).toEqual(['shop', 'Unmatched'])
  expect(bandsOf(effortOf([file('a', 'shop', 600)], [], '2026-11-24', 7)).map(b => b.name)).toEqual(['shop'])
})

test('time is said in minutes under an hour, else in hours with one decimal, in the person’s language', () => {
  setLang('en')
  expect(spell(45 * 60)).toBe('45 min')
  expect(spell(3.25 * 3600)).toBe('3.3 h')
  expect(spell(104.5 * 3600)).toBe('105 h')
  setLang('tr')
  expect(spell(3.25 * 3600)).toBe('3,3 sa')
  expect(spell(20 * 60)).toBe('20 dk')
  setLang('en')
})
