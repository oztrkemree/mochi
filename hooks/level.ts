import type { DayRec, History, Item, Mood, Outfit } from '../types'
import { local, shiftDay } from './facts'
import { t } from './i18n'

// Mochi grows with the work done in every chat: experience from turns,
// edits, commits and days, levels from experience, and things to wear that
// the levels (and a few habits) unlock. The season and the hour dress it too.

/** An item's name, and its one-word form for the wardrobe's buttons, in the language in use. */
export const itemName = (i: Item): string => t().item.name[i]
export const itemShort = (i: Item): string => t().item.short[i]

export type Slot = keyof Outfit
export const SLOTS: Slot[] = ['head', 'face', 'neck', 'held', 'ground']
export const slotName = (s: Slot): string => t().item.slot[s]

/** Each slot's items, in the order the wardrobe shows them (roughly the order they unlock). */
export const SLOT_ITEMS: Record<Slot, Item[]> = {
  head: ['bere', 'kulaklik', 'baret', 'kep', 'sef', 'kovboy', 'tac', 'korsan', 'viking', 'sihirbaz', 'parti', 'pervane', 'fes', 'gece', 'cadi', 'noel'],
  face: ['gozluk', 'gunes', 'biyik', 'monokl'],
  neck: ['papyon', 'kravat', 'atki', 'nazar', 'madalya'],
  held: ['kupa', 'cay', 'kalem', 'simit', 'anahtar', 'balon'],
  ground: ['kaktus', 'ordek', 'kedi', 'hediye', 'balkabagi'],
}

export const SLOT: Record<Item, Slot> = Object.fromEntries(
  SLOTS.flatMap(slot => SLOT_ITEMS[slot].map(item => [item, slot])),
) as Record<Item, Slot>

type Need = { level?: number; commits?: number; night?: number; edits?: number; streak?: number; turns?: number; days?: number }

/** What unlocks each item that can be earned: a level, or a habit. */
export const UNLOCKS: ({ item: Item } & Need)[] = [
  { item: 'bere', level: 1 }, { item: 'gozluk', level: 1 }, { item: 'kupa', level: 1 }, { item: 'cay', level: 1 },
  { item: 'papyon', level: 2 }, { item: 'gunes', level: 2 },
  { item: 'kulaklik', level: 3 }, { item: 'kalem', level: 3 },
  { item: 'kravat', level: 4 }, { item: 'simit', level: 4 },
  { item: 'baret', level: 5 }, { item: 'anahtar', level: 5 },
  { item: 'atki', level: 6 }, { item: 'kaktus', level: 6 },
  { item: 'kep', level: 7 }, { item: 'biyik', level: 7 },
  { item: 'sef', level: 8 }, { item: 'ordek', level: 8 },
  { item: 'kovboy', level: 9 }, { item: 'nazar', level: 9 },
  { item: 'tac', level: 10 }, { item: 'monokl', level: 10 },
  { item: 'korsan', level: 11 },
  { item: 'viking', level: 12 }, { item: 'kedi', level: 12 },
  { item: 'sihirbaz', level: 13 },
  { item: 'madalya', level: 15 },
  { item: 'balon', turns: 100 },
  { item: 'hediye', days: 30 },
  { item: 'fes', streak: 7 },
  { item: 'parti', commits: 50 },
  { item: 'pervane', edits: 500 },
  { item: 'gece', night: 20 },
]

/** Worn by the date alone, never unlocked. */
export const SEASONAL: { item: Item; season: 'halloween' | 'xmas' }[] = [
  { item: 'cadi', season: 'halloween' },
  { item: 'balkabagi', season: 'halloween' },
  { item: 'noel', season: 'xmas' },
]

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

export const EMPTY_DAY: DayRec = { turns: 0, tools: 0, edits: 0, errors: 0, commits: 0, cost: 0, secs: 0, night: 0 }

export function addDay(a: DayRec, b: Partial<DayRec>): DayRec {
  return {
    turns: a.turns + (b.turns ?? 0), tools: a.tools + (b.tools ?? 0), edits: a.edits + (b.edits ?? 0), errors: a.errors + (b.errors ?? 0),
    commits: a.commits + (b.commits ?? 0), cost: a.cost + (b.cost ?? 0), secs: a.secs + (b.secs ?? 0), night: a.night + (b.night ?? 0),
  }
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

/** What can be put on now: the items earned and those in season. */
export function wearable(h: History | null, now: number, tz: number): Item[] {
  const s = season(now, tz)
  return [...unlocked(h), ...SEASONAL.filter(x => x.item === s.head || x.item === s.ground).map(x => x.item)]
}

/** What the date and hour put on by themselves. */
export function season(now: number, tz: number): Partial<Outfit> & { isNight: boolean; isMorning: boolean } {
  const { month, day, hour } = local(now, tz)
  const isHalloween = (month === 10 && day >= 24) || (month === 11 && day === 1)
  const isXmas = month === 12 && day >= 18 && day <= 30
  const isNewYear = (month === 12 && day === 31) || (month === 1 && day === 1)
  const head: Item | undefined = isHalloween ? 'cadi' : isXmas ? 'noel' : isNewYear ? 'parti' : undefined
  return {
    ...(head ? { head } : {}),
    ...(isHalloween ? { ground: 'balkabagi' as const } : {}),
    isNight: hour < 5,
    isMorning: hour >= 6 && hour < 11,
  }
}

/** Items worn by themselves when nothing is chosen, from the most to the least earned. */
const HEAD_RANK: Item[] = ['tac', 'sihirbaz', 'viking', 'korsan', 'kovboy', 'sef', 'kep', 'baret', 'kulaklik']
const NECK_RANK: Item[] = ['madalya', 'nazar', 'papyon']
const MUG_MOODS: ReadonlySet<Mood> = new Set(['idle', 'listening', 'pleased', 'sleepy'])

/**
 * What Mochi has on, slot by slot: the person's choice where there is one
 * (null for nothing); elsewhere the season, then sleep and the night (a night
 * cap), then the best item earned; coffee in the morning, a pumpkin at
 * Halloween. A held item only while the pose leaves the hand free.
 */
export function outfitFor(pick: Partial<Outfit>, items: readonly Item[], now: number, tz: number, mood: Mood, canHold: boolean): Outfit {
  const s = season(now, tz)
  const isAsleep = mood === 'sleeping' || mood === 'sleepy'
  const head = pick.head !== undefined ? pick.head : s.head ?? (isAsleep || s.isNight ? 'gece' : HEAD_RANK.find(i => items.includes(i)) ?? null)
  const neck = pick.neck !== undefined ? pick.neck : NECK_RANK.find(i => items.includes(i)) ?? null
  const held = pick.held !== undefined ? pick.held : s.isMorning && MUG_MOODS.has(mood) ? 'kupa' : null
  return {
    head,
    face: pick.face ?? null,
    neck,
    held: canHold ? held : null,
    ground: pick.ground !== undefined ? pick.ground : s.ground ?? null,
  }
}

/** The terminal's hat row (five cells) for a head item. */
export const ASCII_HAT: Partial<Record<Item, string>> = {
  baret: ' ▄█▄ ', tac: ' ╻╻╻ ', parti: '  ▲  ', cadi: ' ▁▲▁ ', noel: ' ▄▀° ', gece: ' ▄▀° ', kulaklik: ' ╭─╮ ', kep: ' ▀▀▀ ',
  kovboy: '▁▄█▄▁', korsan: ' ▀▄▀ ', sef: ' ▐█▌ ', viking: '╯▄█▄╰', sihirbaz: '  ▲* ', fes: '  ▆  ', pervane: ' ─┼─ ', bere: '  ▄° ',
}
