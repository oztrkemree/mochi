import type { Env, FileDiff, Git, Limit, Sample } from '../types'
import { t } from './i18n'

/** `git status --porcelain=v1 -b` and `git log -1 --format=%ct`, read into one record. */
export function parseGit(status: string, lastCommit: string): Git | null {
  const lines = status.split('\n').filter(l => l.length > 0)
  const head = lines[0]
  if (head === undefined || !head.startsWith('## ')) return null
  const header = head.slice(3).replace(/^(No commits yet on|Initial commit on) /, '')
  const branch = (header.split('...')[0] ?? header).replace(/ \[.*\]$/, '').trim() || 'HEAD'
  const ahead = Number(/ahead (\d+)/.exec(header)?.[1] ?? 0)
  const behind = Number(/behind (\d+)/.exec(header)?.[1] ?? 0)
  const files = lines.slice(1).map(l => ({ code: l.slice(0, 2), path: (l.slice(3).split(' -> ').pop() ?? '').replace(/^"|"$/g, '') }))
  const at = Number(lastCommit.trim())
  return { branch, ahead, behind, files: files.slice(0, 40), changed: files.length, lastCommit: Number.isFinite(at) && at > 0 ? at * 1000 : 0 }
}

/** A /context category's name in the language in use, or as it came. */
export const categoryName = (name: string): string => t().ctx.category[name.toLowerCase()] ?? name

/** How close the context is to compaction: 0 calm, 1 at 70%, 2 at 85%, 3 at 95% of the point. */
export function warnLevel(env: Pick<Env, 'tokens' | 'window' | 'compactAt'>): number {
  const limit = env.compactAt > 0 ? env.compactAt : env.window
  if (limit <= 0 || env.tokens <= 0) return 0
  const r = env.tokens / limit
  return r >= 0.95 ? 3 : r >= 0.85 ? 2 : r >= 0.7 ? 1 : 0
}

/** The largest category in use, with its share of the window. */
export function biggest(env: Pick<Env, 'slices' | 'window'>): { name: string; percent: number } | null {
  const top = [...env.slices].sort((a, b) => b.tokens - a.tokens)[0]
  if (!top || env.window <= 0) return null
  return { name: categoryName(top.name), percent: Math.round((top.tokens / env.window) * 100) }
}

/** What the mascot says when the context crosses a warning level. */
export function contextWarning(env: Env, level: number): string {
  const top = biggest(env)
  const d = t().ctx
  const head = level >= 3 ? d.compactSoon : d.percent(Math.round(env.context))
  return [head, ...(top ? [d.biggest(top.name, top.percent)] : []), d.hint].join(' · ')
}

/** How long, in its largest whole unit: "5m", "2h", "3d" (as the language writes them); "" under a minute. */
export function age(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000)
  const u = t().unit
  if (m < 1) return ''
  if (m < 60) return u(m, 'm')
  const h = Math.floor(m / 60)
  return h < 24 ? u(h, 'h') : u(Math.floor(h / 24), 'd')
}

/** 2 hours ago → "2h ago"; less than a minute → "just now". */
export function ago(ms: number): string {
  const span = age(ms)
  return span === '' ? t().justNow : t().ago(span)
}

/** A path's parts, split on `/` and on Windows's `\`. */
const partsOf = (path: string): string[] => path.split(/[\\/]/).filter(Boolean)

/** The last part of a path: "app.ts" from "/a/b/app.ts" or "C:\a\app.ts". */
export const baseName = (path: string): string => partsOf(path).pop() ?? path

/** The folder part of a path, with the path's own separator, shortened from the left. */
export function dirOf(path: string, max = 28): string {
  const dir = partsOf(path).slice(0, -1).join(path.includes('\\') ? '\\' : '/')
  return [...dir].length > max ? `…${[...dir].slice(-max + 1).join('')}` : dir
}

// ---------- local time ----------

/** The machine's local calendar and clock at `at`, from its UTC offset in minutes. */
export function local(at: number, tz: number) {
  const d = new Date(at + tz * 60_000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), dow: d.getUTCDay() }
}

const pad = (v: number) => String(v).padStart(2, '0')
/** "15:40" today, "Fri 14:00" another day. */
export function clockAt(at: number, now: number, tz: number): string {
  const a = local(at, tz)
  const b = local(now, tz)
  const time = `${pad(a.hour)}:${pad(a.minute)}`
  return a.year === b.year && a.month === b.month && a.day === b.day ? time : `${t().days[a.dow]} ${time}`
}

/** The local day as "2026-10-09". */
export function dayKey(at: number, tz: number): string {
  const l = local(at, tz)
  return `${l.year}-${pad(l.month)}-${pad(l.day)}`
}

/** The day `by` days from `key`. */
export function shiftDay(key: string, by: number): string {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + by * 86_400_000)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// ---------- the usage forecast ----------

const HOUR = 60 * 60_000
const WEEK = 7 * 24 * HOUR
/** Every reading is kept two days; the week's, one an hour, five weeks, to learn the habits from. */
const DENSE = 48 * HOUR
const LEARN = 5 * WEEK
/** The hours of readings the habits need before they are trusted over the plain average. */
const HABIT_LEAST = 72

/** The five-hour window's pace: read over the last hour, at least ten minutes of it. */
const PACE = { look: HOUR, least: 10 * 60_000 }

/** The readings worth keeping, oldest first: all of the last two days, then the week's thinned to the last one in each hour. */
export function keepSamples(list: readonly Sample[], now: number): Sample[] {
  const out: Sample[] = []
  for (const s of [...list].sort((a, b) => a.at - b.at)) {
    const old = now - s.at >= DENSE
    if (old && (s.kind !== 'seven_day' || now - s.at >= LEARN)) continue
    const prev = out[out.length - 1]
    if (old && prev && Math.floor(prev.at / HOUR) === Math.floor(s.at / HOUR)) out[out.length - 1] = s
    else out.push(s)
  }
  return out.slice(-2000)
}

/** Adds a reading: a changed figure always, the same one every ten minutes. */
export function addSample(list: readonly Sample[], kind: string, p: number, now: number): Sample[] {
  const last = [...list].reverse().find(s => s.kind === kind)
  if (last && last.p === p && now - last.at < 10 * 60_000) return [...list]
  return keepSamples([...list, { kind, at: now, p }], now)
}

/** The hour of the week, 0 for Sunday's first, in local time. */
const hourOfWeek = (at: number, tz: number) => {
  const l = local(at, tz)
  return l.dow * 24 + l.hour
}

/**
 * How much of the week's window the user spends in each hour of the week, in
 * points an hour, learned from the readings: what rose between two readings is
 * spread evenly over the time between them, so the hours the computer slept
 * through count as idle. `hours` is how many hours of readings it rests on.
 */
export function weekHabit(samples: readonly Sample[], resetsAt: number, tz: number): { rate: (at: number) => number; hours: number; week: number } {
  const spent = new Array<number>(168).fill(0)
  const seen = new Array<number>(168).fill(0)
  const own = samples.filter(s => s.kind === 'seven_day')
  const windowOf = (at: number) => Math.floor((at - resetsAt) / WEEK)
  for (let i = 1; i < own.length; i++) {
    const a = own[i - 1]
    const b = own[i]
    if (!a || !b || b.at <= a.at || b.at - a.at > 24 * HOUR) continue
    // A reset in between: what came before it says nothing of what came after.
    if (b.p < a.p - 0.5 || (resetsAt > 0 && windowOf(a.at) !== windowOf(b.at))) continue
    const rise = Math.max(0, b.p - a.p)
    for (let at = a.at; at < b.at; ) {
      const end = Math.min(b.at, (Math.floor(at / HOUR) + 1) * HOUR)
      const h = hourOfWeek(at, tz)
      seen[h] = (seen[h] ?? 0) + (end - at) / HOUR
      spent[h] = (spent[h] ?? 0) + (rise * (end - at)) / (b.at - a.at)
      at = end
    }
  }
  const sum = (xs: number[]) => xs.reduce((x, y) => x + y, 0)
  const hours = sum(seen)
  const overall = hours > 0 ? sum(spent) / hours : 0
  // An hour of the week not seen yet borrows the same hour of the other days, then the average.
  const ofDay = Array.from({ length: 24 }, (_, h) => {
    const days = [0, 1, 2, 3, 4, 5, 6].map(d => d * 24 + h)
    const s = sum(days.map(i => seen[i] ?? 0))
    return s >= 1 ? sum(days.map(i => spent[i] ?? 0)) / s : overall
  })
  const rates = spent.map((x, i) => ((seen[i] ?? 0) >= 0.5 ? x / (seen[i] ?? 1) : (ofDay[i % 24] ?? overall)))
  return { rate: at => rates[hourOfWeek(at, tz)] ?? overall, hours, week: sum(rates) }
}

/** The points the habit expects between two moments. */
function expected(rate: (at: number) => number, from: number, to: number): number {
  let total = 0
  for (let at = from; at < to; ) {
    const end = Math.min(to, (Math.floor(at / HOUR) + 1) * HOUR)
    total += (rate(at) * (end - at)) / HOUR
    at = end
  }
  return total
}

/**
 * When the week's window runs out. Once Mochi has three days of readings it
 * walks the hours to the reset at the user's own rhythm (busy afternoons, idle
 * nights and weekends), scaled by how this week and this last day compare with
 * usual; before that, at the week's average pace so far, nights included.
 */
function forecastWeek(samples: readonly Sample[], limit: Limit, now: number, tz: number): number | null {
  if (limit.resetsAt <= now) return null
  const start = limit.resetsAt - WEEK
  const habit = weekHabit(samples.filter(s => s.at <= now), limit.resetsAt, tz)
  if (habit.hours < HABIT_LEAST) {
    if (now - start < 12 * HOUR || limit.percent < 2) return null
    const fullAt = now + ((100 - limit.percent) * (now - start)) / limit.percent
    return fullAt < limit.resetsAt ? fullAt : null
  }
  // This week against the usual, and the last day against the usual: busier lately counts for half.
  const own = samples.filter(s => s.kind === 'seven_day' && s.at >= Math.max(start, now - 24 * HOUR) && s.at <= now)
  const ratio = (got: number, want: number) => (want >= 1 ? Math.min(3, Math.max(0.33, got / want)) : null)
  const ofWeek = ratio(limit.percent, expected(habit.rate, start, now))
  const first = own[0]
  const ofDay = first && now - first.at >= 6 * HOUR ? ratio(limit.percent - first.p, expected(habit.rate, first.at, now)) : null
  const scale = ofWeek !== null && ofDay !== null ? (ofWeek + ofDay) / 2 : (ofWeek ?? ofDay ?? 1)
  let left = 100 - limit.percent
  for (let at = now; at < limit.resetsAt; ) {
    const end = Math.min(limit.resetsAt, (Math.floor(at / HOUR) + 1) * HOUR)
    const burn = (habit.rate(at) * scale * (end - at)) / HOUR
    if (burn >= left) return at + ((end - at) * left) / burn
    left -= burn
    at = end
  }
  return null
}

/**
 * When the window runs out before its reset: the five-hour one at the pace of
 * the last hour, the week's at the user's own rhythm (see `forecastWeek`);
 * null when it would not, or the readings are too few or too short to say.
 */
export function forecastFull(samples: readonly Sample[], limit: Limit, now: number, tz = 0): number | null {
  if (limit.percent >= 100) return null
  if (limit.kind === 'seven_day') return forecastWeek(samples, limit, now, tz)
  if (limit.kind !== 'five_hour') return null
  const pace = PACE
  const own = samples.filter(s => s.kind === limit.kind && s.at <= now)
  // Only the current window: a reading lower than the one before is a reset.
  let start = 0
  for (let i = 1; i < own.length; i++) if ((own[i]?.p ?? 0) < (own[i - 1]?.p ?? 0) - 0.5) start = i
  const recent = own.slice(start).filter(s => s.at >= now - pace.look)
  const first = recent[0]
  if (first === undefined || now - first.at < pace.least) return null
  const rise = limit.percent - first.p
  if (rise < 2) return null
  const fullAt = now + ((100 - limit.percent) * (now - first.at)) / rise
  if (limit.resetsAt > 0 && fullAt >= limit.resetsAt) return null
  return fullAt
}

/** When each usage window runs out at this pace, rounded to the minute so the panel does not redraw for nothing. */
export function forecasts(v: Env, now: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of v.limits) {
    const at = forecastFull(v.samples, l, now, v.tz)
    if (at !== null) out[l.kind] = Math.round(at / 60_000) * 60_000
  }
  return out
}

// ---------- what changed in the files ----------

const lines = (text: string): string[] => (text === '' ? [] : text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'))
const short = (line: string) => (line.length > 200 ? `${line.slice(0, 199)}…` : line)

/**
 * What an edit did, line by line: the lines both texts share at the start and
 * the end set aside, what is left was removed and added. One line of context
 * before, and at most four lines a side, for the pane.
 */
export function lineDelta(before: string, after: string): { add: number; del: number; ctx: string; old: string[]; new: string[] } {
  const a = lines(before)
  const b = lines(after)
  let head = 0
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1
  const old = a.slice(head, a.length - tail)
  const neu = b.slice(head, b.length - tail)
  return { add: neu.length, del: old.length, ctx: head > 0 && old.length + neu.length > 0 ? short(a[head - 1] ?? '') : '', old: old.slice(0, 4).map(short), new: neu.slice(0, 4).map(short) }
}

/** `git diff --numstat` read into lines added and removed per path; a binary file has none. */
export function parseNumstat(text: string): Record<string, { add: number; del: number } | null> {
  const out: Record<string, { add: number; del: number } | null> = {}
  for (const line of text.split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line)
    if (!m) continue
    const path = (m[3] ?? '').replace(/^"|"$/g, '')
    const was = out[path]
    out[path] = m[1] === '-' ? null : { add: Number(m[1]) + (was?.add ?? 0), del: Number(m[2]) + (was?.del ?? 0) }
  }
  return out
}

/**
 * `git diff` read into its lines, each marked as kept, removed or added, the
 * hunks' `@@` lines kept as they are; the headers left out. The first `cap`
 * lines are kept, and how many more there were.
 */
export function parseDiff(path: string, text: string, cap = 60): FileDiff {
  const all: FileDiff['lines'] = []
  let isBody = false
  for (const line of lines(text)) {
    if (line.startsWith('@@')) isBody = true
    if (!isBody || line.startsWith('\\')) continue
    const sign = line[0]
    all.push({ kind: sign === '+' ? 'new' : sign === '-' ? 'old' : 'ctx', text: line.startsWith('@@') ? line : line.slice(1) })
  }
  return { path, lines: all.slice(0, cap), more: Math.max(0, all.length - cap) }
}

/** A new file not yet added, as a diff: all its lines added; none for one that is not text. */
export function freshDiff(path: string, text: string, cap = 60): FileDiff {
  const all = text.includes('\0') ? [] : lines(text)
  return { path, lines: all.slice(0, cap).map(line => ({ kind: 'new' as const, text: line })), more: Math.max(0, all.length - cap) }
}

/** How many lines a file's text has; a last line without its newline counts too. */
export const lineCount = (text: string): number => lines(text).length

/** The repository's changes with their line counts: tracked from the diff, a new untracked file all added. */
export function withLines(git: Git, numstat: Record<string, { add: number; del: number } | null>, counts: Record<string, number>, root: string): Git {
  return {
    ...git,
    root,
    files: git.files.map(f => {
      const n = numstat[f.path]
      if (n) return { ...f, add: n.add, del: n.del }
      if (f.code === '??' && counts[f.path] !== undefined) return { ...f, add: counts[f.path], del: 0 }
      return f
    }),
  }
}
