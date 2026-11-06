import type { Mood } from '../types'
import { local, shiftDay } from './facts'
import { lang, t } from './i18n'
import { onPrompt } from './react'
import type { Reaction } from './react'

// The little things: the days Mochi celebrates (the person's own among them),
// what it does when greeted by name, and the stretch it suggests after long
// work. All of it pure; register.tsx acts on it.

// ---------- the calendar ----------

export type Occasion =
  | 'birthday' | 'anniversary' | 'newYear' | 'piDay' | 'hanami' | 'halloween' | 'hacktoberfest' | 'friday13'

/** The person's own days: a birthday ("MM-DD") and the first day Mochi ran ("2026-10-09"); '' for none. */
export type Own = { birthday: string; firstDay: string }
export const NO_OWN: Own = { birthday: '', firstDay: '' }

/** The span's first day when `today` is in it. */
const within = (today: string, from: string, to: string): string | null => (today >= from && today <= to ? from : null)

/** The same days every year, "MM-DD" to "MM-DD". */
const yearly = (from: string, to: string) => (today: string) => within(today, `${today.slice(0, 4)}-${from}`, `${today.slice(0, 4)}-${to}`)

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
  ['piDay', yearly('03-14', '03-14')],
  ['hanami', yearly('04-01', '04-10')],
  ['halloween', yearly('10-24', '11-01')],
  ['hacktoberfest', yearly('10-01', '10-31')],
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

/** A birthday ("04-23") in words in the language in use ("April 23", "23 Nisan"): a day typed the other way round shows. */
export const birthdayName = (mmdd: string): string =>
  new Date(`2024-${mmdd}T12:00:00Z`).toLocaleDateString(lang(), { month: 'long', day: 'numeric', timeZone: 'UTC' })

/** The first day Mochi ran here: the one recorded, or an earlier day a chat's file knows; today when there is none. */
export function firstDayOf(known: string, today: string, chats: readonly Record<string, unknown>[]): string {
  const days = chats.flatMap(c => Object.keys(c)).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
  return [known === '' ? today : known, ...days].sort()[0] ?? today
}

// ---------- surprises ----------

/** Mochi's name as people write it: in Latin letters, Cyrillic, katakana, Hangul, Chinese, Devanagari or Arabic. */
const NAME = /(?<![a-z])mochi(?![a-z])|(?<![а-яёіїєґ])(моти|мочи|моті|мочі)(?![а-яёіїєґ])|モチ(?![ァ-ヺー])|모찌|모치|麻糬|मोची|موتشي/iu
const GOOD_NIGHT = /good ?night|iyi geceler|iyi uykular|buenas noches|gute nacht|bonne nuit|boa noite|buona ?notte|dobranoc|selamat tidur|спокойной ночи|доброй ночи|(на )?добраніч|晚安|おやすみ|잘 ?자(요)?(?!\p{L})|안녕히 주무세요|शुभ ?रात्रि|تصبح(ين)? على خير|ليلة سعيدة/iu
// Not "te quiero preguntar" (I want to ask you), nor "не люблю" (I do not like).
const LOVE = /love (you|u)\b(?! to\b)|seni seviyorum|seviyorum seni|te quiero(?! +\p{L}+[aei]r(?!\p{L}))|te amo|amo voc[eê]|ich liebe dich|hab dich lieb|je t['’]aime|ti amo|ti voglio bene|kocham ci[eę]|(sayang|cinta) (kamu|kau)|люблю тебя|тебя люблю|кохаю тебе|тебе кохаю|люблю тебе|тебе люблю|爱你|愛你|愛してる|大好き|사랑해|(तुमसे|आपसे) प्यार|[أا]حبك|بحبك/iu
const HELLO = /(?<!\p{L})(hi|hello|hey|hiya|merhaba|selam|hola|hallo|salut|bonjour|ol[aá]|oi|ciao|cze[sś][cć]|halo|привет|здравствуй|привіт)(?!\p{L})|你好|こんにちは|안녕|नमस्ते|नमस्कार|مرحب|[أا]هلا|السلام عليكم/iu

/** A short prompt that says good night, or loves, thanks, greets or just calls Mochi by name: a moment of its own; null otherwise. */
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
  // A greeting, or the name alone ("mochi", "Mochi?"), waves.
  if (HELLO.test(said) || said.replace(NAME, '').replace(/[\p{P}\p{S}\s]/gu, '') === '') return { mood: 'wave', line: w.hello, holdMs: 3000 }
  return null
}

/** A regex for words that start at a word's edge, in Turkish and English; a Turkish ending may follow. */
const word = (...alts: string[]) => new RegExp(`(?<!\\p{L})(${alts.join('|')})`, 'iu')

/** Words that would be hard to take back: production, a deploy, a forced push, a wipe. */
const RISKY = /\brm\s+-rf\b|\bprod(uction)?\b|canl[ıi]ya|\bdeploy|force[- ]push|push\s+(-f|--force)\b|drop\s+(table|database)|reset\s+--hard|(?<!\p{L})sil(?!\p{L})|delete\s+all/iu
/** An apology, which comes before any frustration in the same breath ("sorry, wrong file"). */
const SORRY = word('pardon', '[oö]z[uü]r', 'sorry', 'my bad', 'oops', 'hay aksi', 'kusura bakma')
const BUG = /(?<!\p{L})bugs?(?!\p{L})|\bhata|\berror|exception|\bcrash|[cç][oö]k[uü]yor|traceback/iu

type TypingLine = keyof ReturnType<typeof t>['fun']['typing']

/**
 * What the draft may be about, in the order Mochi looks, with the face it
 * makes and what it says: the first that matches wins.
 */
const TOPICS: [RegExp, Mood, TypingLine][] = [
  [word('[sş]ifre', 'password', 'secret', 'token', 'api[ _-]?key', '\\.env(?!\\p{L})', 'credential'), 'scared', 'secret'],
  // The secret word: the band turns into a disco while it stands (see the panel's `disco`).
  [word('disko', 'disco', 'dans', 'dance'), 'party', 'disco'],
  [word('conflict', '<<<<<<<', '[cç]ak[ıi][sş]ma'), 'nervous', 'conflict'],
  [word('regex', 'regexp', 'regular expression', 'd[uü]zenli ifade'), 'dizzy', 'regex'],
  [/(^|[^\p{L}])(a?(ha){2,}|(he){2,}|j?sj?sj|lol|lmao|rofl|kdkd|asdf)(?!\p{L})|😂|🤣/iu, 'pleased', 'laugh'],
  [word('vay', 'wow', 'omg', 'inan[ıi]lmaz', 'no way', 'insane'), 'shocked', 'wow'],
  [word('do[gğ]um g[uü]n', 'birthday', 'iyi ki do[gğ]dun'), 'party', 'birthday'],
  [word('hafta ?sonu', 'weekend', 'cuma(?!\\p{L})', 'friday', 'tgif'), 'party', 'weekend'],
  [word('pazartesi', 'monday'), 'tired', 'monday'],
  [word('iyi geceler', 'good ?night', 'gn(?!\\p{L})', 'nighty'), 'sleepy', 'night'],
  [word('g[uü]nayd[ıi]n', 'good morning', 'morning(?!\\p{L})'), 'wave', 'morning'],
  [word('selam', 'merhaba', 'naber', 'hello', 'hey(?!\\p{L})', 'hi(?!\\p{L})', 'sa(?!\\p{L})'), 'wave', 'hi'],
  [word('kahve', '[cç]ay(?!\\p{L})', 'coffee', 'tea(?!\\p{L})', 'mola', 'break(?!\\p{L})'), 'stretch', 'coffee'],
  [word('ac[ıi]kt[ıi]m', 'yemek', '[oö][gğ]le', 'pizza', 'd[oö]ner', 'lunch', 'dinner', 'hungry', 'burger', 'snack'), 'wink', 'food'],
  [word('uykum', 'yorgun', 'yoruldum', 'bitkin', 'tired', 'sleepy', 'exhausted'), 'sleepy', 'tired'],
  [word('merge', 'release', 'ship(?!\\p{L})', 'yay[ıi]nla', 'launch'), 'proud', 'ship'],
  [word('test', 'spec(?!\\p{L})', 'coverage'), 'nervous', 'test'],
  [word('refactor', 'temizle', 'toparla', 'clean ?up', 'tidy'), 'writing', 'tidy'],
  [word('yava[sş]', 'slow', 'performans', 'performance', 'optimi[sz]e', 'h[ıi]zland[ıi]r'), 'running', 'fast'],
  [word('acil', 'hemen', 'asap', 'urgent', 'deadline', '[cç]abuk'), 'running', 'rush'],
  [word('yard[ıi]m', 'help', 'tak[ıi]ld[ıi]m', 'stuck', 'anlamad[ıi]m'), 'wave', 'help'],
  [word('ortala', 'center', 'centre', 'flexbox', 'align'), 'thinking', 'center'],
]

/**
 * Mochi reading over the person's shoulder as they type: a face and a few
 * words for what the draft says so far, before it is sent; null leaves it listening.
 */
export function typingMood(text: string): { mood: Mood; line: string } | null {
  const said = text.trim()
  if (said === '') return null
  const w = t().fun.typing
  if (RISKY.test(said)) return { mood: 'scared', line: w.careful }
  if (SORRY.test(said)) return { mood: 'wink', line: w.sorry }
  const plain = onPrompt(said, false).mood
  if (plain === 'shocked') return { mood: 'shocked', line: w.whoa }
  if (plain === 'nervous') return { mood: 'nervous', line: w.uhoh }
  if (BUG.test(said)) return { mood: 'dizzy', line: w.bug }
  if (plain === 'pleased') return { mood: 'love', line: w.aww }
  const topic = TOPICS.find(([re]) => re.test(said))
  if (topic) return { mood: topic[1], line: w[topic[2]] }
  if (NAME.test(said)) return { mood: 'wave', line: t().fun.hello }
  if (said.endsWith('?')) return { mood: 'thinking', line: w.question }
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
