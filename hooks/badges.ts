import type { Badge, DayRec, History } from '../types'
import { baseName, local, shiftDay } from './facts'
import { t } from './i18n'
import { isPush, isTest } from './react'

// Badges: twelve things earned once from real work. The days alone prove
// some (a streak, a tidy day, nights and early mornings, languages in a
// week); the rest are earned the moment they happen (a green test run, a
// push, a long turn that ends well). Each is celebrated once, like a level.

/** Every badge, in the order the details pane shows them. */
export const BADGES: Badge[] = ['green', 'push', 'steady', 'comeback', 'tidy', 'team', 'owl', 'bird', 'polyglot', 'marathon', 'week', 'hundred']

/** A badge's name, and how it is earned, in the language in use. */
export const badgeName = (b: Badge): string => t().fun.badge.name[b]
export const badgeHint = (b: Badge): string => t().fun.badge.hint[b]

// ---------- languages ----------

/** Languages by file extension; a language's place here is its bit in a day's `langs`. */
const LANG_EXT = [
  'ts tsx mts cts', 'js jsx mjs cjs', 'py', 'go', 'rs', 'java', 'kt kts', 'swift', 'c h', 'cpp cc cxx hpp hh', 'cs', 'rb', 'php', 'sh bash zsh fish',
  'ps1 psm1', 'sql', 'html htm', 'css scss sass less', 'lua', 'dart', 'scala', 'ex exs', 'hs', 'clj cljs', 'r', 'jl', 'zig', 'vue', 'svelte', 'm mm',
].map(group => group.split(' '))

/** The bit of the language a file is written in; 0 for one that is not code Mochi knows. */
export function langBit(path: string): number {
  const name = baseName(path)
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  const at = LANG_EXT.findIndex(group => group.includes(ext))
  return at < 0 ? 0 : 1 << at
}

/** How many languages a day's (or a week's) bits hold. */
function langCount(bits: number): number {
  let n = 0
  for (let b = bits; b !== 0; b &= b - 1) n += 1
  return n
}

// ---------- earning them ----------

/** The badges the history alone proves. */
export function provenBy(h: History | null): Badge[] {
  if (h === null) return []
  const days = Object.entries(h.days)
  const daysWith = (has: (d: DayRec) => boolean) => days.filter(([, d]) => has(d)).length
  // The languages of the seven days up to `key`.
  const week = (key: string) => Array.from({ length: 7 }, (_, i) => h.days[shiftDay(key, -i)]?.langs ?? 0).reduce((a, b) => a | b, 0)
  const isProven: Partial<Record<Badge, boolean>> = {
    tidy: days.some(([, d]) => d.del > d.add),
    owl: daysWith(d => d.night > 0) >= 5,
    bird: daysWith(d => d.early > 0) >= 5,
    polyglot: days.some(([key]) => langCount(week(key)) >= 5),
    week: Math.max(h.bestStreak, h.streak) >= 7,
    hundred: h.total.commits >= 100,
  }
  return BADGES.filter(b => isProven[b] === true)
}

/** What a finished shell command earns: a green test run (a comeback when the turn's tests were red before it), or a push. */
export function commandBadges(cmd: string, isOk: boolean, wasRed: boolean): Badge[] {
  if (!isOk) return []
  if (isTest(cmd)) return wasRed ? ['green', 'comeback'] : ['green']
  return isPush(cmd) ? ['push'] : []
}

/**
 * After a turn: the turns in a row now without an error, and what the turn
 * earns (the tenth such turn, or half an hour of work that ended well).
 */
export function turnBadges(reason: string, seconds: number, errors: number, calm: number): { calm: number; badges: Badge[] } {
  const isWell = reason !== 'aborted' && reason !== 'error' && reason !== 'refusal'
  const next = isWell && errors === 0 ? calm + 1 : 0
  const badges: Badge[] = [...(next === 10 ? ['steady' as const] : []), ...(isWell && seconds > 30 * 60 ? ['marathon' as const] : [])]
  return { calm: next, badges }
}

/** Subagents running at once that earn the team badge. */
export const TEAM_AT = 3

/** Whether the local hour is an early one, 5:00 to 7:00 (the night runs until 5:00). */
export function isEarly(now: number, tz: number): boolean {
  const { hour } = local(now, tz)
  return hour >= 5 && hour < 7
}

/** The badges a saved list names, oldest first; null for anything but a list. */
export function badgesOf(v: unknown): Badge[] | null {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is Badge => (BADGES as unknown[]).includes(x)))] : null
}

// ---------- drawing them ----------

/** Each badge's colour and its sign, drawn in white on a 24×24 medal. */
const LOOK: Record<Badge, { ink: string; sign: string }> = {
  green: { ink: '#4CC38A', sign: '<path d="M7.6 12.3l3 3 5.8-6.2"/>' },
  push: { ink: '#7AA2F7', sign: '<path d="M12 16.8V7.6M8.2 11.2L12 7.4l3.8 3.8"/>' },
  steady: { ink: '#73DACA', sign: '<path d="M6.4 12.4h2.8l1.5-3.4 2.6 6.6 1.5-3.2h2.8"/>' },
  comeback: { ink: '#F2B84B', sign: '<path d="M16.4 10.2a4.8 4.8 0 1 0 .4 3.6M16.8 6.8v3.4h-3.4"/>' },
  tidy: { ink: '#B794F6', sign: '<path d="M7.2 13.4h7.4M15.8 7.2v3M14.3 8.7h3"/>' },
  team: { ink: '#9ECE6A', sign: '<g fill="#fff" stroke="none"><circle cx="7.6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="16.4" cy="12" r="1.7"/></g>' },
  owl: { ink: '#8C7CF0', sign: '<path d="M14 7.2a5.2 5.2 0 1 0 3 8.6 4.3 4.3 0 0 1-3-8.6z" fill="#fff"/>' },
  bird: { ink: '#F2994A', sign: '<path d="M6.8 15.6h10.4M8.8 15.6a3.2 3.2 0 0 1 6.4 0M12 8v1.8M7.9 9.9l1.2 1.2M16.1 9.9l-1.2 1.2"/>' },
  polyglot: { ink: '#7DCFFF', sign: '<circle cx="12" cy="12" r="4.9"/><path d="M7.1 12h9.8M12 7.1c-2.1 2.7-2.1 7.1 0 9.8M12 7.1c2.1 2.7 2.1 7.1 0 9.8"/>' },
  marathon: { ink: '#F07CB8', sign: '<circle cx="12" cy="13" r="4.5"/><path d="M12 13v-2.5M10.6 7.3h2.8M16 8.6l1 -1"/>' },
  week: { ink: '#E08A6A', sign: '<path d="M8.6 8h6.8l-4 9"/>' },
  hundred: { ink: '#E9B949', sign: '<path d="M6.4 9.4l1.4-1.2v7.6"/><ellipse cx="11.6" cy="12" rx="1.9" ry="3.8"/><ellipse cx="16.6" cy="12" rx="1.9" ry="3.8"/>' },
}

/** A badge's medal for the details pane: in its colour once earned, grey and faded until then. */
export function badgeSvg(b: Badge, isEarned: boolean): string {
  const look = LOOK[b]
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">' +
    `<g opacity="${isEarned ? 1 : 0.4}"><circle cx="12" cy="12" r="11" fill="${isEarned ? look.ink : '#8C8580'}"/>` +
    '<ellipse cx="9" cy="6.6" rx="5.4" ry="2.8" fill="#fff" opacity="0.22"/><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="0.8"/>' +
    `<g stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">${look.sign}</g></g></svg>`
}
