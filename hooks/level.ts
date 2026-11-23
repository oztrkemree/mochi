import type { Badge, DayRec, Env, History, Item, Mood, Outfit, Prefs } from '../types'
import { badgeName, provenBy } from './badges'
import { dayKey, local, shiftDay } from './facts'
import { NO_OWN, occasions } from './fun'
import type { Occasion, Own } from './fun'
import { t } from './i18n'
import { POSES } from './rig'

// Mochi grows with the work done in every chat: experience from turns,
// edits, commits and days, levels from experience, and things to wear that
// the levels, habits and badges unlock. Nothing is opened by the date: the
// days it celebrates (see hooks/fun.ts) and the hour only dress Mochi in
// what it has earned.

/** An item's name, and its one-word form for the wardrobe's buttons, in the language in use. */
export const itemName = (i: Item): string => t().item.name[i]
export const itemShort = (i: Item): string => t().item.short[i]

export type Slot = keyof Outfit
export const SLOTS: Slot[] = ['head', 'eyes', 'face', 'lip', 'chin', 'neck', 'held', 'ground']
export const slotName = (s: Slot): string => t().item.slot[s]

/** Each slot's items, in the order the wardrobe shows them (roughly the order they unlock). */
export const SLOT_ITEMS: Record<Slot, Item[]> = {
  head: ['beanie', 'hardhat', 'gradcap', 'chefhat', 'cowboy', 'crown', 'pirate', 'viking', 'wizard', 'partyhat', 'propeller', 'fez', 'nightcap', 'witchhat', 'santahat', 'sakura',
    'bandana', 'sailorhat', 'strawhat', 'daisyhat', 'leaf', 'catears', 'bunnyears', 'flowercrown', 'beret', 'tophat', 'jester', 'nursecap', 'sombrero', 'antlers', 'farmer', 'sunflowercrown', 'bee', 'halo', 'unicorn', 'shortcake', 'rainbow', 'dragon', 'astronaut',
    'bowler', 'flatcap', 'explorer', 'baseballcap'],
  eyes: ['glasses', 'sunglasses', 'monocle',
    'heartglasses', 'eyepatch', 'goggles', 'starglasses', 'cinema3d', 'nerdglasses', 'visor',
    'aviators', 'cateye', 'pixelshades', 'masquerade', 'divemask', 'vrheadset'],
  face: ['clownnose', 'catwhiskers', 'plaster', 'freckles', 'bushybrows', 'eyelashes', 'fangs', 'teardrop',
    'goldstars', 'wheat', 'facemask', 'lollipop', 'bubblegum', 'rose'],
  lip: ['mustache', 'pencilstache', 'chevron', 'handlebar', 'horseshoe', 'walrus'],
  chin: ['beard', 'goatee', 'soulpatch', 'chinstrap', 'wizardbeard', 'braidbeard'],
  neck: ['bowtie', 'necktie', 'scarf', 'evileye', 'medal', 'pin', 'rosette',
    'spikedcollar', 'pearls', 'bellcollar', 'neckerchief', 'lei', 'goldchain', 'overalls',
    'sailorcollar', 'whistle', 'lanyard', 'camera', 'stethoscope', 'binoculars', 'headphones', 'bib', 'ruff', 'bolotie', 'boa', 'locket'],
  held: ['mug', 'tea', 'pencil', 'simit', 'wrench', 'balloon', 'candy', 'lantern', 'envelope',
    'flag', 'whisk', 'pinwheel', 'compass', 'key', 'icecream', 'cupcake', 'sunflower', 'clover', 'toadstool', 'cactuspot', 'wand', 'potion', 'paddle', 'joystick', 'bubblewand', 'rollingpin', 'harmonica', 'tambourine'],
  ground: ['sprout', 'bunny', 'horse', 'cactus', 'duck', 'cat', 'gift', 'pumpkin', 'diya', 'songpyeon', 'cake',
    'mushroom', 'frog', 'robot', 'ramen', 'snail', 'campfire', 'bonsai', 'penguin', 'lavalamp', 'taco', 'tent', 'hedgehog', 'wateringcan', 'macaron', 'arcade', 'snowman', 'rocket', 'watermelon', 'chest', 'axolotl'],
}

export const SLOT: Record<Item, Slot> = Object.fromEntries(
  SLOTS.flatMap(slot => SLOT_ITEMS[slot].map(item => [item, slot])),
) as Record<Item, Slot>

/** The ids that changed when they were made English, as an older version saved them (in prefs and level.json). */
const OLD_IDS: Record<string, Item> = {
  baret: 'hardhat', tac: 'crown', parti: 'partyhat', cadi: 'witchhat', noel: 'santahat', gece: 'nightcap', kep: 'gradcap',
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

type Need = { level?: number; badge?: Badge; commits?: number; night?: number; edits?: number; streak?: number; turns?: number; days?: number }

/** What unlocks each item: a level, a habit or a badge (the hard ones). One way each. */
export const UNLOCKS: ({ item: Item } & Need)[] = ([
  { item: 'beanie', level: 1 }, { item: 'glasses', level: 1 }, { item: 'mug', level: 1 }, { item: 'tea', level: 1 }, { item: 'sprout', level: 1 },
  { item: 'bowtie', level: 2 }, { item: 'sunglasses', level: 2 }, { item: 'bunny', level: 2 },
  { item: 'pencil', level: 3 }, { item: 'horse', level: 3 },
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
  { item: 'bandana', level: 3 },
  { item: 'sailorhat', level: 11 },
  { item: 'strawhat', level: 13 },
  { item: 'daisyhat', level: 14 },
  { item: 'leaf', level: 14 },
  { item: 'catears', level: 15 },
  { item: 'bunnyears', level: 16 },
  { item: 'flowercrown', level: 16 },
  { item: 'beret', level: 17 },
  { item: 'tophat', level: 17 },
  { item: 'jester', level: 18 },
  { item: 'nursecap', level: 18 },
  { item: 'sombrero', level: 19 },
  { item: 'antlers', level: 20 },
  { item: 'farmer', level: 20 },
  { item: 'sunflowercrown', level: 21 },
  { item: 'bee', level: 21 },
  { item: 'halo', level: 22 },
  { item: 'unicorn', level: 22 },
  { item: 'shortcake', level: 23 },
  { item: 'rainbow', level: 23 },
  { item: 'dragon', level: 24 },
  { item: 'astronaut', level: 25 },
  { item: 'bowler', level: 19 },
  { item: 'flatcap', level: 24 },
  { item: 'explorer', level: 25 },
  { item: 'baseballcap', level: 26 }, { item: 'sakura', level: 26 },
  { item: 'heartglasses', level: 27 },
  { item: 'eyepatch', level: 27 },
  { item: 'beard', level: 28 },
  { item: 'goggles', level: 28 },
  { item: 'starglasses', level: 29 },
  { item: 'cinema3d', level: 29 },
  { item: 'nerdglasses', level: 30 },
  { item: 'visor', level: 30 },
  { item: 'clownnose', level: 31 },
  { item: 'catwhiskers', level: 31 },
  { item: 'plaster', level: 32 },
  { item: 'freckles', level: 32 },
  { item: 'bushybrows', level: 33 },
  { item: 'eyelashes', level: 33 },
  { item: 'fangs', level: 34 },
  { item: 'teardrop', level: 34 },
  { item: 'spikedcollar', level: 35 },
  { item: 'pearls', level: 35 },
  { item: 'bellcollar', level: 36 }, { item: 'songpyeon', level: 36 },
  { item: 'neckerchief', level: 37 },
  { item: 'lei', level: 37 },
  { item: 'goldchain', level: 38 }, { item: 'diya', level: 38 },
  { item: 'overalls', level: 39 }, { item: 'sailorcollar', level: 39 },
  { item: 'icecream', level: 40 }, { item: 'cupcake', level: 40 },
  { item: 'sunflower', level: 41 }, { item: 'clover', level: 41 },
  { item: 'toadstool', level: 42 }, { item: 'cactuspot', level: 42 },
  { item: 'wand', level: 43 }, { item: 'potion', level: 43 },
  { item: 'paddle', level: 44 }, { item: 'joystick', level: 44 },
  { item: 'bubblewand', level: 45 }, { item: 'rollingpin', level: 45 },
  { item: 'harmonica', level: 46 }, { item: 'tambourine', level: 46 },
  { item: 'mushroom', level: 47 }, { item: 'frog', level: 47 },
  { item: 'robot', level: 48 }, { item: 'ramen', level: 48 },
  { item: 'snail', level: 49 }, { item: 'campfire', level: 49 },
  { item: 'bonsai', level: 50 }, { item: 'penguin', level: 50 },
  { item: 'lavalamp', level: 51 }, { item: 'taco', level: 51 },
  { item: 'tent', level: 52 }, { item: 'hedgehog', level: 52 },
  { item: 'wateringcan', level: 53 }, { item: 'macaron', level: 53 },
  { item: 'arcade', level: 54 }, { item: 'snowman', level: 54 },
  { item: 'rocket', level: 55 }, { item: 'watermelon', level: 55 },
  { item: 'chest', level: 56 }, { item: 'axolotl', level: 56 },
  { item: 'ruff', level: 57 }, { item: 'bolotie', level: 57 },
  { item: 'boa', level: 58 }, { item: 'locket', level: 58 },
  { item: 'aviators', level: 59 }, { item: 'cateye', level: 59 },
  { item: 'pixelshades', level: 60 }, { item: 'masquerade', level: 60 },
  { item: 'divemask', level: 61 }, { item: 'vrheadset', level: 61 },
  { item: 'walrus', level: 62 }, { item: 'braidbeard', level: 62 },
  { item: 'balloon', turns: 100 },
  { item: 'gift', days: 30 },
  { item: 'fez', streak: 7 },
  { item: 'partyhat', commits: 50 },
  { item: 'propeller', edits: 500 },
  { item: 'nightcap', night: 20 },
  { item: 'flag', streak: 14 },
  { item: 'whisk', commits: 100 },
  { item: 'pinwheel', turns: 500 },
  { item: 'compass', days: 60 },
  { item: 'key', night: 50 },
  { item: 'whistle', streak: 21 },
  { item: 'lanyard', days: 90 },
  { item: 'camera', turns: 1000 },
  { item: 'stethoscope', edits: 1000 },
  { item: 'binoculars', commits: 200 },
  { item: 'headphones', night: 100 },
  { item: 'bib', turns: 2000 },
  { item: 'goldstars', days: 120 },
  { item: 'wheat', commits: 300 },
  { item: 'facemask', edits: 2000 },
  { item: 'lollipop', turns: 3000 },
  { item: 'bubblegum', streak: 30 },
  { item: 'rose', night: 150 },
  { item: 'goatee', days: 14 },
  { item: 'soulpatch', commits: 25 },
  { item: 'pencilstache', turns: 200 },
  { item: 'chevron', edits: 250 },
  { item: 'handlebar', streak: 10 },
  { item: 'chinstrap', turns: 750 },
  { item: 'horseshoe', commits: 150 },
  { item: 'wizardbeard', night: 75 },
  { item: 'pin', badge: 'hundred' },
  { item: 'rosette', badge: 'month' }, { item: 'santahat', badge: 'month' },
  { item: 'cake', badge: 'fivehundred' },
  { item: 'lantern', badge: 'regular' },
  { item: 'envelope', badge: 'craftsman' },
  { item: 'candy', badge: 'bulldozer' },
  { item: 'witchhat', badge: 'vampire' }, { item: 'pumpkin', badge: 'vampire' },
// By level, the habits and badges after them, so the first one still locked is the next to come.
] satisfies ({ item: Item } & Need)[]).sort((a, b) => (a.level ?? Infinity) - (b.level ?? Infinity))

type Dressed = Exclude<Occasion, 'piDay' | 'friday13'>

/** What each occasion puts on by the date alone (see hooks/fun.ts). */
const DRESS: Record<Dressed, Partial<Outfit>> = {
  birthday: { head: 'partyhat', ground: 'cake' },
  anniversary: { neck: 'rosette' },
  newYear: { head: 'partyhat' },
  hanami: { head: 'sakura' },
  halloween: { head: 'witchhat', ground: 'pumpkin' },
  hacktoberfest: { neck: 'pin' },
}

/** What it takes, in a few words: "level 5", "50 commits", a badge's name. */
export function hintFor(item: Item): string {
  const h = t().item.hint
  const u = UNLOCKS.find(x => x.item === item)
  if (u === undefined) return ''
  if (u.level !== undefined) return u.level <= 1 ? h.start : h.level(u.level)
  if (u.badge !== undefined) return badgeName(u.badge)
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

/**
 * Level n starts at STEP × (n − 1)² experience. It is worked out from the
 * history every time, so a gentler step lifts everyone's level at once, and
 * what it opens is celebrated on the next look.
 */
const STEP = 60

/** The level for an amount of experience, with the experience its level starts at and the next one needs. */
export function levelOf(xp: number): { level: number; at: number; next: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / STEP)) + 1
  return { level, at: (level - 1) ** 2 * STEP, next: level ** 2 * STEP }
}

export function unlocked(h: History | null): Item[] {
  const { level } = levelOf(xpOf(h))
  const badges = provenBy(h)
  const t = h?.total
  const isMet = (u: Need) =>
    (u.level !== undefined && level >= u.level) ||
    (u.badge !== undefined && badges.includes(u.badge)) ||
    (u.commits !== undefined && (t?.commits ?? 0) >= u.commits) ||
    (u.night !== undefined && (t?.night ?? 0) >= u.night) ||
    (u.edits !== undefined && (t?.edits ?? 0) >= u.edits) ||
    (u.turns !== undefined && (t?.turns ?? 0) >= u.turns) ||
    (u.days !== undefined && (h?.activeDays ?? 0) >= u.days) ||
    (u.streak !== undefined && Math.max(h?.bestStreak ?? 0, h?.streak ?? 0) >= u.streak)
  return UNLOCKS.filter(isMet).map(u => u.item)
}


/** What the date and hour would put on: the day's occasions, slot by slot, the first one's where two meet (worn only if earned). */
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
export const HEAD_RANK: Item[] = ['crown', 'wizard', 'viking', 'pirate', 'cowboy', 'chefhat', 'gradcap', 'hardhat']
const NECK_RANK: Item[] = ['medal', 'evileye', 'bowtie']
const MUG_MOODS: ReadonlySet<Mood> = new Set(['idle', 'listening', 'pleased', 'sleepy'])

/**
 * What Mochi has on, slot by slot: the person's choice where there is one
 * (null for nothing); elsewhere the day's occasion if the item is earned (a
 * pumpkin at Halloween, a cake on the person's birthday), then sleep and the night (a night cap),
 * then the best item earned; coffee in the morning. A held item only while
 * the pose leaves the hand free.
 */
export function outfitFor(pick: Partial<Outfit>, items: readonly Item[], now: number, tz: number, mood: Mood, canHold: boolean, own: Own = NO_OWN): Outfit {
  const s = season(now, tz, own)
  const dressed = (i: Item | null | undefined) => (i != null && items.includes(i) ? i : undefined)
  const isAsleep = mood === 'sleeping' || mood === 'sleepy'
  const head = pick.head !== undefined ? pick.head : dressed(s.head) ?? (isAsleep || s.isNight ? 'nightcap' : HEAD_RANK.find(i => items.includes(i)) ?? null)
  const neck = pick.neck !== undefined ? pick.neck : dressed(s.neck) ?? NECK_RANK.find(i => items.includes(i)) ?? null
  const held = pick.held !== undefined ? pick.held : dressed(s.held) ?? (s.isMorning && MUG_MOODS.has(mood) ? 'mug' : null)
  return {
    head,
    eyes: pick.eyes ?? null,
    face: pick.face ?? null,
    lip: pick.lip ?? null,
    chin: pick.chin ?? null,
    neck,
    held: canHold ? held : null,
    ground: pick.ground !== undefined ? pick.ground : dressed(s.ground) ?? null,
  }
}

/** Whether the pose leaves the right hand down and empty, to hold a cup or a balloon. */
const canHold = (mood: Mood) => POSES[mood].held === undefined && POSES[mood].armR >= -40 && POSES[mood].armR <= 0

/** The person's look as another program reads it (look.json): their own picks, what is open to them, and what the seasons go by. */
export type Look = { pick: Partial<Outfit>; items: Item[]; tz: number; birthday: string; firstDay: string }

/** The look this chat's Mochi wears by, for the desktop app; null until the history is read. */
export function lookOf(p: Prefs, v: Env): Look | null {
  if (v.history === null) return null
  const items = unlocked(v.history)
  const pick: Partial<Outfit> = {}
  for (const slot of SLOTS) {
    const chosen = p.pick[slot]
    if (chosen === null || (chosen !== undefined && items.includes(chosen))) pick[slot] = chosen
  }
  return { pick, items, tz: v.tz, birthday: p.birthday, firstDay: p.firstDay }
}

/** A choice as a file holds it, slot by slot: an item, null for nothing; an item this version does not know is left to Mochi. */
export function pickOf(value: unknown): Partial<Outfit> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const picked = value as Record<string, unknown>
  const pick: Partial<Outfit> = {}
  for (const slot of SLOTS) {
    if (picked[slot] === null) pick[slot] = null
    else {
      const item = itemOf(picked[slot])
      if (item !== null) pick[slot] = item
    }
  }
  return pick
}

/** The wardrobe choice last made in either Mochi, the mod or the desktop app, and when (prefs.json). */
export type Choice = { at: number; pick: Partial<Outfit>; /** Mochi's colour (hooks/skins.ts), chosen in the desktop app; absent for its own clay. */ skin?: string }

/** prefs.json's content; null when there is none, or not one this version reads. */
export function choiceFrom(text: string | null): Choice | null {
  try {
    const v = JSON.parse(text ?? '') as { v?: unknown; at?: unknown; pick?: unknown; skin?: unknown }
    if (v.v !== 1 || typeof v.at !== 'number') return null
    return { at: v.at, pick: pickOf(v.pick), ...(typeof v.skin === 'string' && /^[a-z]{2,16}$/.test(v.skin) ? { skin: v.skin } : {}) }
  } catch {
    return null
  }
}

export const choiceText = (c: Choice): string => JSON.stringify({ v: 1, at: c.at, pick: c.pick, ...(c.skin ? { skin: c.skin } : {}) })

/** A look file's content, checked field by field: a version this does not know, or no picks or items, is no look. */
export function lookFrom(value: unknown): Look | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as { v?: unknown; pick?: unknown; items?: unknown; tz?: unknown; birthday?: unknown; firstDay?: unknown }
  if (v.v !== 1 || typeof v.pick !== 'object' || v.pick === null || Array.isArray(v.pick) || !Array.isArray(v.items)) return null
  return {
    pick: pickOf(v.pick),
    items: v.items.map(itemOf).filter((i): i is Item => i !== null),
    tz: typeof v.tz === 'number' && Math.abs(v.tz) <= 14 * 60 ? v.tz : 0,
    birthday: typeof v.birthday === 'string' && /^\d\d-\d\d$/.test(v.birthday) ? v.birthday : '',
    firstDay: typeof v.firstDay === 'string' && /^\d{4}-\d\d-\d\d$/.test(v.firstDay) ? v.firstDay : '',
  }
}

/** What a Mochi wears in a mood by a look, as the band's Mochi would. */
export const dressAs = (look: Look, mood: Mood, now: number): Outfit => outfitFor(look.pick, look.items, now, look.tz, mood, canHold(mood), look)

/** What Mochi has on now: the person's choice (while it can still be worn), what it earned, the season and the hour. */
export function outfitNow(p: Prefs, v: Env, mood: Mood, now: number): Outfit {
  const ok = unlocked(v.history)
  const pick: Partial<Outfit> = {}
  for (const slot of SLOTS) {
    const chosen = p.pick[slot]
    if (chosen === null || (chosen !== undefined && ok.includes(chosen))) pick[slot] = chosen
  }
  return outfitFor(pick, unlocked(v.history), now, v.tz, mood, canHold(mood), p)
}

/** The terminal's hat row (five cells) for a head item. */
export const ASCII_HAT: Partial<Record<Item, string>> = {
  hardhat: ' ▄█▄ ', crown: ' ╻╻╻ ', partyhat: '  ▲  ', witchhat: ' ▁▲▁ ', santahat: ' ▄▀° ', nightcap: ' ▄▀° ', gradcap: ' ▀▀▀ ',
  cowboy: '▁▄█▄▁', pirate: ' ▀▄▀ ', chefhat: ' ▐█▌ ', viking: '╯▄█▄╰', wizard: '  ▲* ', fez: '  ▆  ', propeller: ' ─┼─ ', beanie: '  ▄° ',
  sakura: ' ✿ ✿ ',
  bandana: '▗▄▄▄◢',
  sailorhat: ' ▄▄▄ ',
  strawhat: '▁▂▆▂▁',
  daisyhat: ' ▆▆▆ ',
  leaf: ' ◢█◣ ',
  catears: '▲   ▲',
  bunnyears: '▐▌ ▐▌',
  flowercrown: ' ✿✿✿ ',
  beret: ' ▂▆▂ ',
  tophat: '▁▐█▌▁',
  jester: '▲▼▲▼▲',
  nursecap: ' ▀+▀ ',
  sombrero: '▁▃▆▃▁',
  antlers: 'Y   Y',
  farmer: '▂▄✿▄▂',
  sunflowercrown: ' ❀❀❀ ',
  bee: 'o╲ ╱o',
  halo: ' ═══ ',
  unicorn: '  ╱  ',
  shortcake: ' ▄♥▄ ',
  rainbow: '╭───╮',
  dragon: '◢▀▀▀◣',
  astronaut: '▐███▌',
  bowler: ' ▟█▙ ',
  flatcap: '▁▄▆▄▁',
  explorer: '▁▟█▙▁',
  baseballcap: '▄██▄▁',
}
