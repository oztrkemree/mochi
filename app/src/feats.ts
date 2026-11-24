import type { Badge, History } from '../../types'
import { BADGES } from '../../hooks/badges'
import { SLOT_ITEMS, levelOf, unlocked, xpOf } from '../../hooks/level'

/**
 * Achievements: the mod's badges, and sixty milestones more counted from the
 * same history every Mochi reads, so the room shows the same progress whoever
 * did the work. Each has a theme and a tier; a milestone also says how far
 * along it is.
 */

export const CATS = ['talk', 'code', 'ship', 'time', 'steady', 'mochi'] as const
export type Cat = (typeof CATS)[number]
export const TIERS = ['easy', 'medium', 'hard', 'impossible'] as const
export type Tier = (typeof TIERS)[number]

/** What a milestone counts. Hours are of turns' time; a day's most is of the last 126 days the history keeps. */
export const METRICS = ['turns', 'dayTurns', 'edits', 'tools', 'added', 'removed', 'langs', 'commits', 'dayCommits', 'hours', 'night', 'early', 'days', 'streak', 'level', 'items', 'badges'] as const
export type Metric = (typeof METRICS)[number]

const CAT_OF: Record<Metric, Cat> = {
  turns: 'talk', dayTurns: 'talk', edits: 'code', tools: 'code', added: 'code', removed: 'code', langs: 'code', commits: 'ship', dayCommits: 'ship',
  hours: 'time', night: 'time', early: 'time', days: 'steady', streak: 'steady', level: 'mochi', items: 'mochi', badges: 'mochi',
}

export type Milestone = { id: string; tier: Tier; metric: Metric; target: number }

const m = (id: string, tier: Tier, metric: Metric, target: number): Milestone => ({ id, tier, metric, target })

/** The sixty: ten easy, twenty medium, twenty hard, ten all but impossible. None asks what a badge already does. */
export const MILESTONES: Milestone[] = [
  m('hello', 'easy', 'turns', 1), m('firstEdit', 'easy', 'edits', 1), m('firstCommit', 'easy', 'commits', 1), m('handy', 'easy', 'tools', 50),
  m('again', 'easy', 'days', 2), m('chatty', 'easy', 'turns', 10), m('firstHour', 'easy', 'hours', 1), m('lateOne', 'easy', 'night', 1),
  m('earlyOne', 'easy', 'early', 1), m('levelTwo', 'easy', 'level', 2),

  m('talker', 'medium', 'turns', 250), m('storyteller', 'medium', 'turns', 1000), m('editor', 'medium', 'edits', 500), m('shipper', 'medium', 'commits', 50),
  m('toolbox', 'medium', 'tools', 2500), m('tenHours', 'medium', 'hours', 10), m('dayAndNight', 'medium', 'hours', 25), m('tenDays', 'medium', 'days', 10),
  m('monthOfDays', 'medium', 'days', 30), m('threeInRow', 'medium', 'streak', 3), m('fortnight', 'medium', 'streak', 14), m('tenThousand', 'medium', 'added', 10_000),
  m('pruner', 'medium', 'removed', 5_000), m('nightShift', 'medium', 'night', 25), m('dawnPatrol', 'medium', 'early', 25), m('levelTen', 'medium', 'level', 10),
  m('dresser', 'medium', 'items', 25), m('bigDay', 'medium', 'dayTurns', 50), m('shippingDay', 'medium', 'dayCommits', 10), m('trilingual', 'medium', 'langs', 3),

  m('orator', 'hard', 'turns', 5_000), m('tenThousandTurns', 'hard', 'turns', 10_000), m('sculptor', 'hard', 'edits', 10_000), m('architect', 'hard', 'edits', 20_000),
  m('fleet', 'hard', 'commits', 1_000), m('workshop', 'hard', 'tools', 25_000), m('hundredHours', 'hard', 'hours', 100), m('marathoner', 'hard', 'hours', 250),
  m('seasons', 'hard', 'days', 150), m('twoHundred', 'hard', 'days', 200), m('unbroken', 'hard', 'streak', 45), m('twoMonths', 'hard', 'streak', 60),
  m('novelist', 'hard', 'added', 100_000), m('minimalist', 'hard', 'removed', 50_000), m('nocturne', 'hard', 'night', 300), m('levelQuarter', 'hard', 'level', 25),
  m('levelForty', 'hard', 'level', 40), m('collector', 'hard', 'items', 100), m('wildDay', 'hard', 'dayTurns', 200), m('polymath', 'hard', 'langs', 6),

  m('legend', 'impossible', 'turns', 50_000), m('million', 'impossible', 'edits', 100_000), m('armada', 'impossible', 'commits', 10_000), m('thousandHours', 'impossible', 'hours', 1_000),
  m('yearRound', 'impossible', 'days', 365), m('hundredInRow', 'impossible', 'streak', 100), m('library', 'impossible', 'added', 1_000_000), m('levelSeventyFive', 'impossible', 'level', 75),
  m('everything', 'impossible', 'items', Object.values(SLOT_ITEMS).flat().length), m('allBadges', 'impossible', 'badges', BADGES.length),
]

/** Where the mod's badges stand among them: a theme and a tier each. */
export const BADGE_PLACE: Record<Badge, { cat: Cat; tier: Tier }> = {
  green: { cat: 'code', tier: 'easy' }, push: { cat: 'ship', tier: 'easy' }, steady: { cat: 'talk', tier: 'medium' }, comeback: { cat: 'code', tier: 'medium' },
  tidy: { cat: 'code', tier: 'medium' }, team: { cat: 'talk', tier: 'medium' }, owl: { cat: 'time', tier: 'medium' }, bird: { cat: 'time', tier: 'medium' },
  polyglot: { cat: 'code', tier: 'hard' }, marathon: { cat: 'time', tier: 'medium' }, week: { cat: 'steady', tier: 'medium' }, hundred: { cat: 'ship', tier: 'medium' },
  month: { cat: 'steady', tier: 'hard' }, fivehundred: { cat: 'ship', tier: 'hard' }, regular: { cat: 'steady', tier: 'hard' }, craftsman: { cat: 'code', tier: 'hard' },
  bulldozer: { cat: 'code', tier: 'hard' }, vampire: { cat: 'time', tier: 'hard' },
}

const bits = (n: number) => {
  let count = 0
  for (let v = n >>> 0; v > 0; v >>>= 1) count += v & 1
  return count
}

/** Every count a milestone may ask of, from the history, what the wardrobe holds and the badges won. */
export function countsOf(h: History, badges: readonly Badge[]): Record<Metric, number> {
  const t = h.total
  const days = Object.values(h.days)
  return {
    turns: t.turns, dayTurns: Math.max(0, ...days.map(d => d.turns ?? 0)), edits: t.edits, tools: t.tools, added: t.add ?? 0, removed: t.del ?? 0, langs: bits(t.langs ?? 0),
    commits: t.commits, dayCommits: Math.max(0, ...days.map(d => d.commits ?? 0)), hours: Math.floor((t.secs ?? 0) / 3600), night: t.night, early: t.early ?? 0,
    days: h.activeDays, streak: Math.max(h.bestStreak, h.streak), level: levelOf(xpOf(h)).level, items: unlocked(h).length, badges: badges.length,
  }
}

/** One achievement as the room shows it: a badge (`badge` set) or a milestone, how far along, and whether it is done. */
export type Feat = { id: string; cat: Cat; tier: Tier; done: boolean; now: number; target: number; badge?: Badge; metric?: Metric }

export function featsOf(h: History, badges: readonly Badge[]): Feat[] {
  const counts = countsOf(h, badges)
  const fromBadges: Feat[] = BADGES.map(b => ({ id: b, ...BADGE_PLACE[b], done: badges.includes(b), now: badges.includes(b) ? 1 : 0, target: 1, badge: b }))
  const fromCounts: Feat[] = MILESTONES.map(x => ({ id: x.id, cat: CAT_OF[x.metric], tier: x.tier, metric: x.metric, target: x.target, now: Math.min(counts[x.metric], x.target), done: counts[x.metric] >= x.target }))
  return [...fromBadges, ...fromCounts]
}

/** How many of a group are done, of all. */
export const tally = (feats: readonly Feat[]): { done: number; all: number } => ({ done: feats.filter(f => f.done).length, all: feats.length })
