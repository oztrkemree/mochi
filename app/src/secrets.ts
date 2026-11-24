import type { DayRec, History } from '../../types'

/**
 * Achievements that stay hidden until they are won: each is proven by the
 * history itself, so every Mochi that reads the same days shows the same ones.
 */

/** The hidden achievements, in the order they are listed. */
export const SECRETS = ['weekender', 'fullWeek', 'eraser', 'oneLiner', 'nightAndDawn', 'evenSteven'] as const
/** One of the hidden achievements. */
export type Secret = (typeof SECRETS)[number]

const DAY = 86_400_000

const field = (r: DayRec | undefined, f: keyof DayRec): number => r?.[f] ?? 0
const activeKey = (h: History, key: string): boolean => field(h.days[key], 'turns') > 0
const nextKey = (key: string): string => new Date(Date.parse(key + 'T12:00:00Z') + DAY).toISOString().slice(0, 10)
const weekday = (key: string): number => new Date(key + 'T12:00:00Z').getUTCDay()

/** The secrets the history proves now. */
export function secretsNow(h: History): Secret[] {
  const keys = Object.keys(h.days)
  const proven = new Set<Secret>()
  for (const key of keys) {
    const r = h.days[key]
    const day = weekday(key)
    if (day === 6 && activeKey(h, key) && activeKey(h, nextKey(key))) proven.add('weekender')
    if (day === 1 && activeKey(h, key)) {
      let k = key
      let run = true
      for (let i = 0; i < 7 && run; i++) {
        run = activeKey(h, k)
        k = nextKey(k)
      }
      if (run) proven.add('fullWeek')
    }
    if (field(r, 'del') > field(r, 'add') && field(r, 'del') >= 100) proven.add('eraser')
    if (field(r, 'turns') === 1 && field(r, 'commits') >= 1) proven.add('oneLiner')
    if (field(r, 'night') > 0 && field(r, 'early') > 0) proven.add('nightAndDawn')
    if (field(r, 'add') === field(r, 'del') && field(r, 'add') >= 50) proven.add('evenSteven')
  }
  return SECRETS.filter(s => proven.has(s))
}

/** The secrets won so far: those kept (`kept` is the stored text, null for none) and those proven now; never fewer than were kept. `keep` is the new text to store, null when nothing changed. */
export function secretsWon(kept: string | null, now: readonly Secret[]): { won: Secret[]; fresh: Secret[]; keep: string | null } {
  const keptList = keptOf(kept)
  const fresh = SECRETS.filter(s => now.includes(s) && !keptList.includes(s))
  const won = [...keptList, ...fresh]
  return { won, fresh, keep: fresh.length > 0 ? JSON.stringify(won) : null }
}

const keptOf = (text: string | null): Secret[] => {
  if (text === null) return []
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(v)) return []
  return [...new Set(v)].filter((s): s is Secret => (SECRETS as readonly unknown[]).includes(s))
}
