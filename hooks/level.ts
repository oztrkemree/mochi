import type { DayRec, Env, History, Item, Mood, Outfit, Prefs } from '../types'
import { dayKey, local, shiftDay } from './facts'
import { NO_OWN, occasions } from './fun'
import type { Occasion, Own } from './fun'
import { t } from './i18n'
import { POSES } from './rig'

// Mochi grows with the work done in every chat: experience from turns,
// edits, commits and days, levels from experience, and things to wear that
// the levels (and a few habits) unlock. The days it celebrates (see
// hooks/fun.ts) and the hour dress it too.

/** An item's name, and its one-word form for the wardrobe's buttons, in the language in use. */
export const itemName = (i: Item): string => t().item.name[i]
export const itemShort = (i: Item): string => t().item.short[i]

export type Slot = keyof Outfit
export const SLOTS: Slot[] = ['head', 'face', 'neck', 'held', 'ground']
export const slotName = (s: Slot): string => t().item.slot[s]

/** Each slot's items, in the order the wardrobe shows them (roughly the order they unlock). */
export const SLOT_ITEMS: Record<Slot, Item[]> = {
  head: ['beanie', 'headphones', 'hardhat', 'gradcap', 'chefhat', 'cowboy', 'crown', 'pirate', 'viking', 'wizard', 'partyhat', 'propeller', 'fez', 'nightcap', 'witchhat', 'santahat', 'sakura'],
  face: ['glasses', 'sunglasses', 'mustache', 'monocle'],
  neck: ['bowtie', 'necktie', 'scarf', 'evileye', 'medal', 'pin', 'rosette'],
  held: ['mug', 'tea', 'pencil', 'simit', 'wrench', 'balloon', 'candy', 'lantern', 'envelope'],
  ground: ['cactus', 'duck', 'cat', 'gift', 'pumpkin', 'diya', 'sprouts', 'songpyeon', 'cake'],
}

export const SLOT: Record<Item, Slot> = Object.fromEntries(
  SLOTS.flatMap(slot => SLOT_ITEMS[slot].map(item => [item, slot])),
) as Record<Item, Slot>

/** The ids that changed when they were made English, as an older version saved them (in prefs and level.json). */
const OLD_IDS: Record<string, Item> = {
  baret: 'hardhat', tac: 'crown', parti: 'partyhat', cadi: 'witchhat', noel: 'santahat', gece: 'nightcap', kulaklik: 'headphones', kep: 'gradcap',
  kovboy: 'cowboy', korsan: 'pirate', sef: 'chefhat', sihirbaz: 'wizard', fes: 'fez', pervane: 'propeller', bere: 'beanie',
  gunes: 'sunglasses', gozluk: 'glasses', biyik: 'mustache', monokl: 'monocle',
  papyon: 'bowtie', madalya: 'medal', atki: 'scarf', kravat: 'necktie', nazar: 'evileye',
  kupa: 'mug', cay: 'tea', kalem: 'pencil', anahtar: 'wrench', balon: 'balloon',
  balkabagi: 'pumpkin', ordek: 'duck', kaktus: 'cactus', kedi: 'cat', hediye: 'gift',
}

/** The item an id names, its own or the one an older version saved; null for anything else. */
export function itemOf(v: unknown): Item | null {
  if (typeof v !== 'string') return null
  if (Object.hasOwn(SLOT, v)) return v as Item
  return Object.hasOwn(OLD_IDS, v) ? OLD_IDS[v] ?? null : null
}

type Need = { level?: number; commits?: number; night?: number; edits?: number; streak?: number; turns?: number; days?: number }

/** What unlocks each item that can be earned: a level, or a habit. */
export const UNLOCKS: ({ item: Item } & Need)[] = [
  { item: 'beanie', level: 1 }, { item: 'glasses', level: 1 }, { item: 'mug', level: 1 }, { item: 'tea', level: 1 },
  { item: 'bowtie', level: 2 }, { item: 'sunglasses', level: 2 },
  { item: 'headphones', level: 3 }, { item: 'pencil', level: 3 },
  { item: 'necktie', level: 4 }, { item: 'simit', level: 4 },
  { item: 'hardhat', level: 5 }, { item: 'wrench', level: 5 },
  { item: 'scarf', level: 6 }, { item: 'cactus', level: 6 },
  { item: 'gradcap', level: 7 }, { item: 'mustache', level: 7 },
  { item: 'chefhat', level: 8 }, { item: 'duck', level: 8 },
  { item: 'cowboy', level: 9 }, { item: 'evileye', level: 9 },
  { item: 'crown', level: 10 }, { item: 'monocle', level: 10 },
  { item: 'pirate', level: 11 },
  { item: 'viking', level: 12 }, { item: 'cat', level: 12 },
  { item: 'wizard', level: 13 },
  { item: 'medal', level: 15 },
  { item: 'balloon', turns: 100 },
  { item: 'gift', days: 30 },
  { item: 'fez', streak: 7 },
  { item: 'partyhat', commits: 50 },
  { item: 'propeller', edits: 500 },
  { item: 'nightcap', night: 20 },
]

type Dressed = Exclude<Occasion, 'piDay' | 'friday13'>

/** What each occasion puts on by the date alone (see hooks/fun.ts). */
const DRESS: Record<Dressed, Partial<Outfit>> = {
  birthday: { head: 'partyhat', ground: 'cake' },
  anniversary: { neck: 'rosette' },
  newYear: { head: 'partyhat' },
  lunarNewYear: { held: 'envelope' },
  eidFitr: { held: 'candy' },
  eidAdha: { held: 'lantern' },
  nowruz: { ground: 'sprouts' },
  hanami: { head: 'sakura' },
  chuseok: { ground: 'songpyeon' },
  diwali: { ground: 'diya' },
  halloween: { head: 'witchhat', ground: 'pumpkin' },
  hacktoberfest: { neck: 'pin' },
  xmas: { head: 'santahat' },
}

/** Worn by the date alone, with the occasion that brings each. */
export const SEASONAL: { item: Item; season: Dressed }[] = (Object.entries(DRESS) as [Dressed, Partial<Outfit>][])
  .flatMap(([season, wear]) => Object.values(wear).filter((item): item is Item => typeof item === 'string').map(item => ({ item, season })))

/** What it takes, in a few words: "level 5", "50 commits". */
export function hintFor(item: Item): string {
  const h = t().item.hint
  const u = UNLOCKS.find(x => x.item === item)
  if (u === undefined) {
    const s = SEASONAL.find(x => x.item === item)
    return s ? h[s.season] : ''
  }
  if (u.level !== undefined) return u.level <= 1 ? h.start : h.level(u.level)
  if (u.turns !== undefined) return h.turns(u.turns)
  if (u.days !== undefined) return h.days(u.days)
  if (u.streak !== undefined) return h.streak(u.streak)
  if (u.commits !== undefined) return h.commits(u.commits)
  if (u.edits !== undefined) return h.edits(u.edits)
  return h.night(u.night ?? 0)
}

export const EMPTY_DAY: DayRec = { turns: 0, tools: 0, edits: 0, errors: 0, commits: 0, cost: 0, secs: 0, night: 0, add: 0, del: 0, early: 0, langs: 0 }

/** Two days' records added, field by field (the languages joined); a field an older record lacks counts as 0. */
export function addDay(a: Partial<DayRec>, b: Partial<DayRec>): DayRec {
  const out = { ...EMPTY_DAY }
  for (const k of Object.keys(EMPTY_DAY) as (keyof DayRec)[]) out[k] = k === 'langs' ? (a.langs ?? 0) | (b.langs ?? 0) : (a[k] ?? 0) + (b[k] ?? 0)
  return out
}

/** Every chat's days added into one history, as of `today`. */
export function summarize(chats: readonly Record<string, Partial<DayRec>>[], today: string): History {
  const days: Record<string, DayRec> = {}
  for (const chat of chats) {
    for (const [key, rec] of Object.entries(chat)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || typeof rec !== 'object' || rec === null) continue
      days[key] = addDay(days[key] ?? EMPTY_DAY, rec)
    }
  }
  const keys = Object.keys(days).sort()
  const total = keys.reduce((a, k) => addDay(a, days[k] ?? EMPTY_DAY), EMPTY_DAY)
  const activeDays = keys.filter(k => (days[k]?.turns ?? 0) > 0).length
  let at = (days[today]?.turns ?? 0) > 0 ? today : shiftDay(today, -1)
  let streak = 0
  while ((days[at]?.turns ?? 0) > 0) {
    streak += 1
    at = shiftDay(at, -1)
  }
  let best = 0
  let run = 0
  let prev = ''
  for (const k of keys) {
    if ((days[k]?.turns ?? 0) === 0) continue
    run = prev !== '' && shiftDay(prev, 1) === k ? run + 1 : 1
    prev = k
    best = Math.max(best, run)
  }
  const kept: Record<string, DayRec> = {}
  for (const k of keys.slice(-126)) kept[k] = days[k] ?? EMPTY_DAY
  return { days: kept, total, activeDays, streak, bestStreak: best }
}

export function xpOf(h: History | null): number {
  if (h === null) return 0
  return Math.round(h.total.turns * 10 + h.total.edits * 2 + h.total.commits * 25 + h.activeDays * 30)
}

/** The level for an amount of experience, with the experience its level starts at and the next one needs. */
export function levelOf(xp: number): { level: number; at: number; next: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1
  return { level, at: (level - 1) ** 2 * 100, next: level ** 2 * 100 }
}

export function unlocked(h: History | null): Item[] {
  const { level } = levelOf(xpOf(h))
  const t = h?.total
  const isMet = (u: Need) =>
    (u.level !== undefined && level >= u.level) ||
    (u.commits !== undefined && (t?.commits ?? 0) >= u.commits) ||
    (u.night !== undefined && (t?.night ?? 0) >= u.night) ||
    (u.edits !== undefined && (t?.edits ?? 0) >= u.edits) ||
    (u.turns !== undefined && (t?.turns ?? 0) >= u.turns) ||
    (u.days !== undefined && (h?.activeDays ?? 0) >= u.days) ||
    (u.streak !== undefined && Math.max(h?.bestStreak ?? 0, h?.streak ?? 0) >= u.streak)
  return UNLOCKS.filter(isMet).map(u => u.item)
}

/** What can be put on now: the items earned and those of the day's occasions. */
export function wearable(h: History | null, now: number, tz: number, own: Own = NO_OWN): Item[] {
  const on = occasions(dayKey(now, tz), own).map(o => o.name)
  return [...new Set([...unlocked(h), ...SEASONAL.filter(x => on.includes(x.season)).map(x => x.item)])]
}

/** What the date and hour put on by themselves: the day's occasions, slot by slot, the first one's where two meet. */
export function season(now: number, tz: number, own: Own = NO_OWN): Partial<Outfit> & { isNight: boolean; isMorning: boolean } {
  const { hour } = local(now, tz)
  const dress: Partial<Outfit> = {}
  for (const o of occasions(dayKey(now, tz), own)) {
    const wear: Partial<Outfit> = (DRESS as Partial<Record<Occasion, Partial<Outfit>>>)[o.name] ?? {}
    for (const slot of SLOTS) dress[slot] ??= wear[slot]
  }
  return { ...dress, isNight: hour < 5, isMorning: hour >= 6 && hour < 11 }
}

/** Items worn by themselves when nothing is chosen, from the most to the least earned. */
export const HEAD_RANK: Item[] = ['crown', 'wizard', 'viking', 'pirate', 'cowboy', 'chefhat', 'gradcap', 'hardhat', 'headphones']
const NECK_RANK: Item[] = ['medal', 'evileye', 'bowtie']
const MUG_MOODS: ReadonlySet<Mood> = new Set(['idle', 'listening', 'pleased', 'sleepy'])

/**
 * What Mochi has on, slot by slot: the person's choice where there is one
 * (null for nothing); elsewhere the day's occasion (a pumpkin at Halloween, a
 * cake on the person's birthday), then sleep and the night (a night cap),
 * then the best item earned; coffee in the morning. A held item only while
 * the pose leaves the hand free.
 */
export function outfitFor(pick: Partial<Outfit>, items: readonly Item[], now: number, tz: number, mood: Mood, canHold: boolean, own: Own = NO_OWN): Outfit {
  const s = season(now, tz, own)
  const isAsleep = mood === 'sleeping' || mood === 'sleepy'
  const head = pick.head !== undefined ? pick.head : s.head ?? (isAsleep || s.isNight ? 'nightcap' : HEAD_RANK.find(i => items.includes(i)) ?? null)
  const neck = pick.neck !== undefined ? pick.neck : s.neck ?? NECK_RANK.find(i => items.includes(i)) ?? null
  const held = pick.held !== undefined ? pick.held : s.held ?? (s.isMorning && MUG_MOODS.has(mood) ? 'mug' : null)
  return {
    head,
    face: pick.face ?? null,
    neck,
    held: canHold ? held : null,
    ground: pick.ground !== undefined ? pick.ground : s.ground ?? null,
  }
}

/** Whether the pose leaves the right hand down and empty, to hold a cup or a balloon. */
const canHold = (mood: Mood) => POSES[mood].held === undefined && POSES[mood].armR >= -40 && POSES[mood].armR <= 0

/** What Mochi has on now: the person's choice (while it can still be worn), what it earned, the season and the hour. */
export function outfitNow(p: Prefs, v: Env, mood: Mood, now: number): Outfit {
  const ok = wearable(v.history, now, v.tz, p)
  const pick: Partial<Outfit> = {}
  for (const slot of SLOTS) {
    const chosen = p.pick[slot]
    if (chosen === null || (chosen !== undefined && ok.includes(chosen))) pick[slot] = chosen
  }
  return outfitFor(pick, unlocked(v.history), now, v.tz, mood, canHold(mood), p)
}

/** The terminal's hat row (five cells) for a head item. */
export const ASCII_HAT: Partial<Record<Item, string>> = {
  hardhat: ' ▄█▄ ', crown: ' ╻╻╻ ', partyhat: '  ▲  ', witchhat: ' ▁▲▁ ', santahat: ' ▄▀° ', nightcap: ' ▄▀° ', headphones: ' ╭─╮ ', gradcap: ' ▀▀▀ ',
  cowboy: '▁▄█▄▁', pirate: ' ▀▄▀ ', chefhat: ' ▐█▌ ', viking: '╯▄█▄╰', wizard: '  ▲* ', fez: '  ▆  ', propeller: ' ─┼─ ', beanie: '  ▄° ',
  sakura: ' ✿ ✿ ',
}
