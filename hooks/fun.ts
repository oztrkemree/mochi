import type { Mood } from '../types'
import { local, shiftDay } from './facts'
import { t } from './i18n'
import { onPrompt } from './react'
import type { Reaction } from './react'

// The little things: the days Mochi celebrates (the person's own among them),
// what it does when greeted by name, and the stretch it suggests after long
// work. All of it pure; register.tsx acts on it.

// ---------- the calendar ----------

export type Occasion =
  | 'birthday' | 'anniversary' | 'newYear' | 'lunarNewYear' | 'eidFitr' | 'eidAdha' | 'nowruz' | 'piDay'
  | 'hanami' | 'chuseok' | 'diwali' | 'halloween' | 'hacktoberfest' | 'xmas' | 'friday13'

/** The person's own days: a birthday ("MM-DD") and the first day Mochi ran ("2026-10-09"); '' for none. */
export type Own = { birthday: string; firstDay: string }
export const NO_OWN: Own = { birthday: '', firstDay: '' }

/**
 * The days that move with the moon (Nowruz with the equinox), "MM-DD" by
 * year, as most calendars give them; a sighting a day later still falls in
 * the span. Needs extending in 2030.
 */
const MOVING: Record<'lunarNewYear' | 'eidFitr' | 'eidAdha' | 'nowruz' | 'chuseok' | 'diwali', Record<number, string>> = {
  lunarNewYear: { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03' },
  eidFitr: { 2026: '03-20', 2027: '03-09', 2028: '02-26', 2029: '02-14', 2030: '02-04' },
  eidAdha: { 2026: '05-27', 2027: '05-16', 2028: '05-05', 2029: '04-24', 2030: '04-13' },
  nowruz: { 2026: '03-21', 2027: '03-21', 2028: '03-20', 2029: '03-20', 2030: '03-21' },
  chuseok: { 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12' },
  diwali: { 2026: '11-08', 2027: '10-29', 2028: '10-17', 2029: '11-05', 2030: '10-26' },
}

/** The span's first day when `today` is in it. */
const within = (today: string, from: string, to: string): string | null => (today >= from && today <= to ? from : null)

/** The same days every year, "MM-DD" to "MM-DD". */
const yearly = (from: string, to: string) => (today: string) => within(today, `${today.slice(0, 4)}-${from}`, `${today.slice(0, 4)}-${to}`)

/** A moving day, with days before and after it. */
const moving = (name: keyof typeof MOVING, before: number, after: number) => (today: string) => {
  const date = MOVING[name][Number(today.slice(0, 4))]
  if (date === undefined) return null
  const day = `${today.slice(0, 4)}-${date}`
  return within(today, shiftDay(day, -before), shiftDay(day, after))
}

/** Whether `today` is the yearly "MM-DD"; a 29 February falls on the 28th in other years. */
function isDay(today: string, mmdd: string): boolean {
  const isLeap = new Date(Date.UTC(Number(today.slice(0, 4)), 1, 29)).getUTCDate() === 29
  return today.slice(5) === (mmdd === '02-29' && !isLeap ? '02-28' : mmdd)
}

/** Each occasion's rule: the first day of its span, when `today` is in it. Where two dress the same slot, the first wins. */
const RULES: [Occasion, (today: string, own: Own) => string | null][] = [
  ['birthday', (d, o) => (o.birthday !== '' && isDay(d, o.birthday) ? d : null)],
  ['anniversary', (d, o) => (o.firstDay !== '' && o.firstDay.slice(0, 4) < d.slice(0, 4) && isDay(d, o.firstDay.slice(5)) ? d : null)],
  ['newYear', d => (d.endsWith('-12-31') ? d : d.endsWith('-01-01') ? shiftDay(d, -1) : null)],
  ['lunarNewYear', moving('lunarNewYear', 0, 2)],
  ['eidFitr', moving('eidFitr', 0, 2)],
  ['eidAdha', moving('eidAdha', 0, 3)],
  ['nowruz', moving('nowruz', 0, 3)],
  ['piDay', yearly('03-14', '03-14')],
  ['hanami', yearly('04-01', '04-10')],
  ['chuseok', moving('chuseok', 1, 1)],
  ['diwali', moving('diwali', 2, 2)],
  ['halloween', yearly('10-24', '11-01')],
  ['hacktoberfest', yearly('10-01', '10-31')],
  ['xmas', yearly('12-18', '12-30')],
  ['friday13', d => (d.endsWith('-13') && new Date(`${d}T00:00:00Z`).getUTCDay() === 5 ? d : null)],
]

/** The occasions on a local day ("2026-11-08"), each with the first day of its span, the most particular first. */
export function occasions(today: string, own: Own = NO_OWN): { name: Occasion; from: string }[] {
  return RULES.flatMap(([name, rule]) => {
    const from = rule(today, own)
    return from === null ? [] : [{ name, from }]
  })
}

const GREET_MOOD: Partial<Record<Occasion, Mood>> = { birthday: 'party', anniversary: 'party', newYear: 'party', piDay: 'pleased', friday13: 'nervous' }

/** What Mochi says the first time a chat starts on an occasion. */
export function greeting(name: Occasion, today: string, own: Own): Reaction {
  const g = t().fun.greet
  const line = name === 'anniversary' ? g.anniversary(Number(today.slice(0, 4)) - Number(own.firstDay.slice(0, 4))) : g[name]
  const mood = GREET_MOOD[name] ?? 'wave'
  return { mood, line, holdMs: 8000, ...(mood === 'party' ? { sound: 'party' as const } : {}) }
}

/**
 * The occasion to greet on `today` when one is not greeted yet ("name:first
 * day" in `greeted`), with the keys that mark all of today's as greeted: one
 * greeting a day, and one for each occasion however many days it spans.
 */
export function dueGreeting(today: string, own: Own, greeted: readonly string[]): { name: Occasion; keys: string[] } | null {
  const on = occasions(today, own).map(o => ({ name: o.name, key: `${o.name}:${o.from}` }))
  const due = on.find(o => !greeted.includes(o.key))
  return due ? { name: due.name, keys: on.map(o => o.key) } : null
}

/** A birthday as typed ("4-23", "04-23", "04/23"), as "MM-DD"; null for anything that is not a day of the year. */
export function parseBirthday(text: string): string | null {
  const m = /^(\d{1,2})[-/](\d{1,2})$/.exec(text.trim())
  const month = Number(m?.[1])
  const day = Number(m?.[2])
  // A leap year, so that 29 February is a day too.
  const d = new Date(Date.UTC(2024, month - 1, day))
  if (m === null || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The first day Mochi ran here: the one recorded, or an earlier day a chat's file knows; today when there is none. */
export function firstDayOf(known: string, today: string, chats: readonly Record<string, unknown>[]): string {
  const days = chats.flatMap(c => Object.keys(c)).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
  return [known === '' ? today : known, ...days].sort()[0] ?? today
}

// ---------- surprises ----------

/** Mochi's name as people write it: in Latin letters, Cyrillic, katakana, Hangul or Chinese. */
const NAME = /(?<![a-z])mochi(?![a-z])|(?<![а-яё])(моти|мочи)(?![а-яё])|モチ(?![ァ-ヺー])|모찌|모치|麻糬/iu
const GOOD_NIGHT = /good ?night|iyi geceler|iyi uykular|buenas noches|gute nacht|bonne nuit|boa noite|спокойной ночи|доброй ночи|晚安|おやすみ|잘 ?자|안녕히 주무세요/iu
const LOVE = /love (you|u)\b|seni seviyorum|seviyorum seni|te quiero|te amo|amo voc[eê]|ich liebe dich|hab dich lieb|je t['’]aime|люблю|爱你|愛你|愛してる|大好き|사랑해/iu
const HELLO = /(?<!\p{L})(hi|hello|hey|hiya|merhaba|selam|hola|hallo|salut|bonjour|ol[aá]|oi|привет|здравствуй)(?!\p{L})|你好|こんにちは|안녕/iu

/** A short prompt that says good night, or loves, thanks or greets Mochi by name: a moment of its own; null otherwise. */
export function promptEgg(text: string): Reaction | null {
  const said = text.trim()
  if (said.length > 60) return null
  const w = t().fun
  const isNamed = NAME.test(said)
  if (isNamed && LOVE.test(said)) return { mood: 'love', line: w.love, holdMs: 4000 }
  if (GOOD_NIGHT.test(said)) return { mood: 'stretch', line: w.goodNight, holdMs: 4000 }
  if (!isNamed) return null
  // Thanks and praise, as the ordinary reaction to a prompt reads them.
  if (onPrompt(said, false).mood === 'pleased') return { mood: 'pleased', line: w.welcome, holdMs: 3000 }
  if (HELLO.test(said)) return { mood: 'wave', line: w.hello, holdMs: 3000 }
  return null
}

/** Whether the local clock says 13:37. */
export function isLeet(now: number, tz: number): boolean {
  const l = local(now, tz)
  return l.hour === 13 && l.minute === 37
}

// ---------- breaks ----------

/** Work this long without a break earns a suggested stretch, at most this often. */
export const BREAK_AFTER = 2 * 60 * 60_000
/** A quiet gap this long counts as a break. */
const BREAK_GAP = 15 * 60_000

/** When the current stretch of work began, given the last thing done; 0 once a quiet gap ended it. */
export function workFrom(from: number, lastActivity: number, now: number): number {
  if (now - lastActivity >= BREAK_GAP) return 0
  return from === 0 ? lastActivity : from
}

/** Whether to suggest a stretch: two hours of work, and no suggestion in the last two. */
export const isBreakDue = (from: number, lastStretch: number, now: number): boolean =>
  from > 0 && now - from >= BREAK_AFTER && now - lastStretch >= BREAK_AFTER
