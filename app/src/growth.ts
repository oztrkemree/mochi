import type { Badge, DayRec, History } from '../../types'
import { badgeName, badgesOf, provenBy } from '../../hooks/badges'
import { t } from '../../hooks/i18n'
import { itemName, itemOf, levelOf, summarize, unlocked, xpOf } from '../../hooks/level'

/**
 * What the work adds up to: the one history every Mochi counts from every
 * chat's days, the level it makes, and the badges it proves. All of it is the
 * mod's own counting (hooks/level.ts, hooks/badges.ts), so the level is the
 * same whether the work was in Claude Code with the mod or in a chat the app
 * followed, and a level or a badge is celebrated once, by whichever Mochi saw it first.
 */

/** Every chat's days added into one history, from the text of their files; what is not a days file adds nothing. */
export function historyOf(files: readonly string[], today: string): History {
  const chats: Record<string, Partial<DayRec>>[] = []
  for (const text of files) {
    try {
      const v: unknown = JSON.parse(text)
      const days = typeof v === 'object' && v !== null ? (v as { days?: unknown }).days : null
      if (typeof days === 'object' && days !== null && !Array.isArray(days)) chats.push(days as Record<string, Partial<DayRec>>)
    } catch {
      // A file caught half-written counts next time.
    }
  }
  return summarize(chats, today)
}

/** Where the level stands: the level, the experience in all, how far into this level and how long it is, what is left to the next, the streak, and today's turns. */
export type Growth = { level: number; xp: number; into: number; span: number; toNext: number; streak: number; best: number; activeDays: number; today: number; turns: number; commits: number }

export function growthOf(h: History): Growth {
  const xp = xpOf(h)
  const { level, at, next } = levelOf(xp)
  const days = Object.keys(h.days).sort()
  const last = days[days.length - 1]
  return {
    level, xp, into: xp - at, span: next - at, toNext: next - xp, streak: h.streak, best: Math.max(h.bestStreak, h.streak), activeDays: h.activeDays,
    // The last day in the history is today when there was work today; the streak says so.
    today: last !== undefined && h.streak > 0 ? (h.days[last]?.turns ?? 0) : 0, turns: h.total.turns, commits: h.total.commits,
  }
}

/** What to say and what to keep: `line` is news for the bubble (null for none), `keep` the file's new text (null to leave it). */
type Told = { line: string | null; keep: string | null }

/**
 * A new level, or new things to wear, against what was last celebrated
 * (level.json, `kept`: its text, null when there is no file). As the mod does:
 * what stands now is kept; it is said only when something was kept before, so
 * a level reached long ago is not news the day the app arrives.
 */
export function levelNews(kept: string | null, h: History): Told {
  const level = levelOf(xpOf(h)).level
  const items = unlocked(h)
  let saved: { level?: unknown; items?: unknown } | null = null
  if (kept !== null) {
    try {
      const v: unknown = JSON.parse(kept)
      if (typeof v !== 'object' || v === null) return { line: null, keep: null }
      saved = v as { level?: unknown; items?: unknown }
    } catch {
      // Caught half-written: looked at again next time, never written over.
      return { line: null, keep: null }
    }
  }
  const was = typeof saved?.level === 'number' ? saved.level : 1
  const had = Array.isArray(saved?.items) ? saved.items.map(itemOf) : []
  const fresh = items.filter(i => !had.includes(i))
  if (saved !== null && was >= level && fresh.length === 0) return { line: null, keep: null }
  const keep = JSON.stringify({ level: Math.max(level, saved === null ? level : was), items: [...new Set([...had.filter((i): i is NonNullable<typeof i> => i !== null), ...items])] })
  if (saved === null) return { line: null, keep }
  const parts = [...(was < level ? [t().st.level(level)] : []), ...(fresh.length > 0 ? [t().st.newItems([...fresh.slice(0, 4).map(itemName), ...(fresh.length > 4 ? [`+${fresh.length - 4}`] : [])].join(', '))] : [])]
  return { line: parts.join(' · '), keep }
}

/**
 * The badges the history proves, against those kept (badges.json). New ones
 * are added to the list, never taken from it, and said; with no file yet they
 * are kept and not said, as with the level.
 */
export function badgesNews(kept: string | null, h: History): Told & { badges?: Badge[] } {
  let had: Badge[] | null = null
  if (kept !== null) {
    try {
      had = badgesOf(JSON.parse(kept))
    } catch {
      had = null
    }
    // There but not a list of badges: never written over with less.
    if (had === null) return { line: null, keep: null }
  }
  const fresh = provenBy(h).filter(b => !(had ?? []).includes(b))
  const badges = [...(had ?? []), ...fresh]
  if (fresh.length === 0) return { line: null, keep: null, badges }
  return { line: had === null ? null : t().fun.newBadge(fresh.map(badgeName).join(', ')), keep: JSON.stringify(badges), badges }
}
