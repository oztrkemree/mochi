import type { Peer } from '../../types'
import { age, timeGone } from '../../hooks/facts'
import { ring, usageInk } from '../../hooks/gauge'
import { t } from '../../hooks/i18n'
import type { News } from './news'

/**
 * The usage limits (the five-hour session, the week), as the chats know them.
 * They are the account's, not a chat's: every chat reports the same windows,
 * and the one that wrote last knows best.
 */

/** One usage window: which, percent used (0-100), and when it resets (epoch ms, 0 when not known). */
export type Usage = { kind: string; p: number; resetsAt: number }

/** The session before the week; anything else after, by name. */
const ORDER = ['five_hour', 'seven_day']
const place = (kind: string) => (ORDER.includes(kind) ? ORDER.indexOf(kind) : ORDER.length)

/** The limits as they stand now: each from the chat that wrote last. A window whose reset has passed is empty until a chat says otherwise. */
export function usageOf(peers: readonly Peer[], now: number): Usage[] {
  const latest = new Map<string, { usage: Usage; at: number }>()
  for (const p of peers) {
    for (const w of p.windows ?? []) {
      const had = latest.get(w.kind)
      if (!had || p.at > had.at) latest.set(w.kind, { usage: w, at: p.at })
    }
  }
  return [...latest.values()]
    .map(({ usage }) => (usage.resetsAt > 0 && usage.resetsAt <= now ? { ...usage, p: 0 } : usage))
    .sort((a, b) => place(a.kind) - place(b.kind) || a.kind.localeCompare(b.kind))
}

/** Mochi speaks of a limit when it passes these, in percent. */
const MARKS = [80, 95]
/** A limit used at least this much was worth worrying about, so its reset is worth saying. */
const WORRY = 80

const longName = (kind: string) => t().limit.long[kind] ?? kind
const shortName = (kind: string) => t().limit.short[kind] ?? kind
const comesBack = (u: Usage, now: number) => {
  const span = u.resetsAt > now ? age(u.resetsAt - now) : ''
  return span === '' ? '' : ` · ${t().party.resetsIn(span)}`
}

/** One limit in a few words: "week 91% · resets in 2d". */
export const usageLine = (u: Usage, now: number): string => `${shortName(u.kind)} ${u.p}%${comesBack(u, now)}`

/** What changed in the limits that is worth saying: one passed a mark, or one that was nearly gone is back. */
export function usageNews(before: readonly Usage[], after: readonly Usage[], now: number): News[] {
  const news: News[] = []
  for (const u of after) {
    const was = before.find(b => b.kind === u.kind)
    if (was === undefined) continue
    const id = `limit-${u.kind}`
    if (MARKS.some(m => was.p < m && u.p >= m)) news.push({ id, kind: 'limit', line: `${longName(u.kind)} ${u.p}%${comesBack(u, now)}`, link: '' })
    else if (was.p >= WORRY && u.p < was.p / 2) news.push({ id, kind: 'back', line: t().limit.back(longName(u.kind)), link: '' })
  }
  return news
}

/** The limits as the band's own rings, side by side: how full, in the ink of how serious, with a tick for how much of the window's time has gone. '' with none known. */
export function usageRings(list: readonly Usage[], now: number): string {
  if (list.length === 0) return ''
  const rings = list.map((u, i) => ring({
    id: `use-${u.kind}`, cx: 12 + i * 26, cy: 12, r: 8.5, width: 3.4,
    arcs: [{ key: u.kind, value: u.p, color: usageInk(u.p) }],
    pace: timeGone({ kind: u.kind, percent: u.p, resetsAt: u.resetsAt }, now) ?? undefined,
  }))
  const width = list.length * 26 - 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 24" width="${width}" height="24" aria-hidden="true">${rings.join('')}</svg>`
}

/** One limit for the list: a ring with its percent in the middle, and beside it what it is and when it comes back. */
export function usageCard(u: Usage, now: number): { ring: string; name: string; back: string } {
  const drawn = ring({
    id: `card-${u.kind}`, cx: 19, cy: 19, r: 14.5, width: 4.2, center: String(u.p), centerSize: 10.5,
    arcs: [{ key: u.kind, value: u.p, color: usageInk(u.p) }],
    pace: timeGone({ kind: u.kind, percent: u.p, resetsAt: u.resetsAt }, now) ?? undefined,
    halo: u.p >= 95 ? usageInk(u.p) : undefined,
  })
  const span = u.resetsAt > now ? age(u.resetsAt - now) : ''
  return { ring: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 38" width="38" height="38" aria-hidden="true">${drawn}</svg>`, name: longName(u.kind), back: span === '' ? '' : t().party.resetsIn(span) }
}
