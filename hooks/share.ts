import type { DayRec, History, Item, Mood, Outfit } from '../types'
import { shiftDay } from './facts'
import { DEFS, STYLE } from './gauge'
import { t } from './i18n'
import { EMPTY_DAY, HEAD_RANK, SLOT_ITEMS, addDay, levelOf, xpOf } from './level'
import type { Slot } from './level'
import { mascotInner } from './rig'
import { clip } from './text'

// What Mochi makes to be shown elsewhere: a card for a profile README, a
// month or a year wrapped up, and the band and details as they stand. Each
// drawing carries all it shows (an image proxy drops what it would fetch)
// and reads on a light page and on a dark one.

/** Where Mochi lives, as the drawings print it. */
export const REPO = 'github.com/oztrkemree/mochi'
export const CARD_W = 495
export const CARD_H = 195
/** How wide a snapshot draws the band and the details. */
export const SNAP_W = 720

const n = (v: number) => String(Math.round(v * 100) / 100)
/** Text made safe to sit in a drawing: markup escaped, the control characters XML forbids dropped. */
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const thousands = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, t().thousands)

/** The card under everything, dark or light with the page. */
export const BG = '<style>.bg{fill:#1E1B19;stroke:#fff;stroke-opacity:.09}@media (prefers-color-scheme:light){.bg{fill:#FFFCF8;stroke:#000;stroke-opacity:.09}}</style>'

const open = (w: number, h: number, title: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img"><title>${esc(title)}</title>${STYLE}${BG}${DEFS}` +
  `<rect class="bg" x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="16"/>`

/** Mochi in a mood and an outfit, its loops running, in a square at (x, y) with a glow behind. */
const mascot = (mood: Mood, outfit: Outfit, x: number, y: number, size: number) =>
  `<circle cx="${n(x + size / 2)}" cy="${n(y + size * 0.58)}" r="${n(size * 0.32)}" fill="#E08A6A" opacity="0.18" filter="url(#haze)"/>` +
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100" overflow="visible">${mascotInner({ mood, scene: { context: -1, agents: 0, outfit }, from: null })}</svg>`

/** A figure over its label. */
const stat = (value: string, label: string, x: number, y: number, room: number) =>
  `<text class="t fg" x="${n(x)}" y="${y}" font-size="19" font-weight="650" font-variant-numeric="tabular-nums">${esc(value)}</text>` +
  `<text class="t dim" x="${n(x)}" y="${y + 15}" font-size="10.5">${esc(clip(label, Math.floor(room / 5.4)))}</text>`

// ---------- the card ----------

/** The card for a profile README: Mochi in what it wears now, its level and the work behind it. */
export function cardSvg(h: History | null, outfit: Outfit): string {
  const xp = xpOf(h)
  const lv = levelOf(xp)
  const progress = (xp - lv.at) / Math.max(1, lv.next - lv.at)
  const total = h?.total ?? EMPTY_DAY
  const d = t().share
  const x = 190
  const w = CARD_W - 24 - x
  const col = w / 3
  const stats: [number, string][] = [
    [h?.streak ?? 0, t().detail.streak], [h?.bestStreak ?? 0, d.longest], [h?.activeDays ?? 0, d.activeDays],
    [total.turns, t().detail.stats.turns], [total.commits, d.commits], [total.edits, t().detail.stats.edits],
  ]
  return open(CARD_W, CARD_H, `Mochi · ${t().detail.levelN(lv.level)}`) +
    mascot('idle', outfit, 6, 6, 172) +
    `<text class="t fg" x="${x}" y="40" font-size="22" font-weight="700">${esc(t().detail.levelN(lv.level))}</text>` +
    `<text class="t dim" x="${x + w}" y="40" font-size="11" text-anchor="end" font-variant-numeric="tabular-nums">${thousands(xp)} XP</text>` +
    `<rect class="trackf" x="${x}" y="50" width="${w}" height="8" rx="4"/><rect x="${x}" y="50" width="${n(Math.max(8, w * progress))}" height="8" rx="4" fill="#E08A6A"/>` +
    `<text class="t dim" x="${x}" y="76" font-size="11">${esc(clip(t().detail.toNext(thousands(lv.next - xp)), Math.floor(w / 5.9)))}</text>` +
    stats.map(([v, label], i) => stat(thousands(v), label, x + col * (i % 3), 106 + Math.floor(i / 3) * 40, col - 8)).join('') +
    `<text class="t dim" x="92" y="184" font-size="10.5" font-weight="600" text-anchor="middle">${esc(clip(d.tagline, 30))}</text>` +
    `<text class="t faint" x="${x + w}" y="184" font-size="10" text-anchor="end">${REPO}</text>` +
    '</svg>'
}

/** The markdown line that shows the card in a README, linked to Mochi's page. */
export const cardMarkdown = (file: string) => `[![${t().share.tagline}](${encodeURI(file)})](https://${REPO})`

/** Where `/mochi card <path>` writes: an absolute path as given, `~` in the home, a relative one under the session's folder; a folder gets the card's own name. */
export function cardPath(arg: string, cwd: string, home: string): string {
  const path = /^([A-Za-z]:)?[\\/]/.test(arg) ? arg : /^~([\\/]|$)/.test(arg) && home !== '' ? `${home}${arg.slice(1)}` : `${cwd.replace(/[\\/]+$/, '')}/${arg}`
  return /\.svg$/i.test(path) ? path : `${path.replace(/[\\/]+$/, '')}/mochi-card.svg`
}

// ---------- wrapped ----------

/** One chat's days and its name, as its file in `days/` keeps them. */
export type ChatDays = { label: string; days: Record<string, Partial<DayRec>> }

/** A month or a year of work, every chat's added up. */
export type Wrapped = {
  /** "2026-09" for a month, "2026" for a year. */
  key: string
  from: string
  to: string
  days: Record<string, DayRec>
  total: DayRec
  activeDays: number
  /** The most days in a row with work. */
  longest: number
  busiest: { day: string; turns: number } | null
  /** The chat name with the most time. */
  top: string | null
}

/**
 * The period to wrap up: in a new one's first week the one just ended, if it
 * saw work; otherwise the one under way.
 */
export function periodKey(kind: 'month' | 'year', today: string, days: Record<string, Partial<DayRec>>): string {
  const cut = kind === 'month' ? 7 : 4
  const now = today.slice(0, cut)
  const before = shiftDay(today, -7).slice(0, cut)
  return before !== now && Object.entries(days).some(([k, d]) => k.startsWith(before) && (d.turns ?? 0) > 0) ? before : now
}

/** A period's title: "September 2026", "2026". */
export function periodTitle(key: string): string {
  const d = t().share
  return key.length === 4 ? d.year(Number(key)) : d.month(monthName(key), Number(key.slice(0, 4)))
}

/** A month's name in full, from its key ("2026-09"). */
export const monthName = (key: string): string => t().share.months[Number(key.slice(5, 7)) - 1] ?? key

/** The month or year to wrap up as of `today`, every chat's days added up and the time told by chat name. */
export function wrappedOf(chats: readonly ChatDays[], kind: 'month' | 'year', today: string): Wrapped {
  const all: Record<string, DayRec> = {}
  for (const c of chats) {
    for (const [k, rec] of Object.entries(c.days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof rec === 'object' && rec !== null) all[k] = addDay(all[k] ?? EMPTY_DAY, rec)
    }
  }
  const key = periodKey(kind, today, all)
  const from = kind === 'month' ? `${key}-01` : `${key}-01-01`
  const to = kind === 'month' ? shiftDay(`${shiftDay(`${key}-28`, 4).slice(0, 7)}-01`, -1) : `${key}-12-31`
  const days: Record<string, DayRec> = {}
  for (const [k, rec] of Object.entries(all)) if (k.startsWith(key)) days[k] = rec
  const total = Object.values(days).reduce(addDay, EMPTY_DAY)
  let longest = 0
  let run = 0
  let busiest: Wrapped['busiest'] = null
  for (let k = from; k <= to; k = shiftDay(k, 1)) {
    const turns = days[k]?.turns ?? 0
    run = turns > 0 ? run + 1 : 0
    longest = Math.max(longest, run)
    if (turns > (busiest?.turns ?? 0)) busiest = { day: k, turns }
  }
  // Chats in the same folder share a name: their time adds up.
  const time: Record<string, DayRec> = {}
  for (const c of chats) {
    if (c.label === '') continue
    for (const [k, rec] of Object.entries(c.days)) if (k.startsWith(key) && typeof rec === 'object' && rec !== null) time[c.label] = addDay(time[c.label] ?? EMPTY_DAY, rec)
  }
  const top = Object.entries(time).filter(([, r]) => r.turns > 0).sort((a, b) => b[1].secs - a[1].secs || b[1].turns - a[1].turns)[0]?.[0] ?? null
  return { key, from, to, days, total, activeDays: Object.values(days).filter(r => r.turns > 0).length, longest, busiest, top }
}

/** The best Mochi has earned, slot by slot: the finest hat, the latest of the rest, hands free to cheer. */
export function bestOutfit(items: readonly Item[]): Outfit {
  const first = (list: readonly Item[]) => list.find(i => items.includes(i)) ?? null
  const latest = (slot: Slot) => first([...SLOT_ITEMS[slot]].reverse())
  return { head: first(HEAD_RANK) ?? latest('head'), face: latest('face'), neck: latest('neck'), held: null, ground: latest('ground') }
}

/** The month to offer as wrapped: the one just ended, in a new month's first week, when it saw work and was not offered yet. */
export function monthToOffer(today: string, days: Record<string, Partial<DayRec>>, offered: unknown): string | null {
  const key = periodKey('month', today, days)
  return key !== today.slice(0, 7) && key !== offered ? key : null
}

/** A day, as deep as its turns beside the busiest one's. */
function cell(x: number, y: number, w: number, h: number, turns: number, most: number): string {
  if (turns === 0) return `<rect class="trackf" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="2.5"/>`
  const q = turns / most
  const op = q <= 0.25 ? 0.35 : q <= 0.5 ? 0.55 : q <= 0.75 ? 0.78 : 1
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="2.5" fill="#D97757" fill-opacity="${op}"/>`
}

/** Every day of the period as a cell: a month in one row, a year in weeks from Monday. */
function strip(w: Wrapped, y: number): { svg: string; height: number } {
  const room = CARD_W - 48
  const most = Math.max(1, ...Object.values(w.days).map(r => r.turns))
  const count = Math.round((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000) + 1
  let svg = ''
  if (w.key.length === 7) {
    const step = room / count
    for (let i = 0; i < count; i++) {
      svg += cell(24 + i * step, y, step - 2.4, 18, w.days[shiftDay(w.from, i)]?.turns ?? 0, most)
      if (i % 7 === 0) svg += `<text class="t faint" x="${n(24 + i * step + (step - 2.4) / 2)}" y="${y + 32}" font-size="9" text-anchor="middle">${i + 1}</text>`
    }
    return { svg, height: 36 }
  }
  const lead = (new Date(Date.parse(w.from)).getUTCDay() + 6) % 7
  const step = room / Math.ceil((lead + count) / 7)
  for (let i = 0; i < count; i++) {
    const key = shiftDay(w.from, i)
    const col = Math.floor((lead + i) / 7)
    svg += cell(24 + col * step, y + ((lead + i) % 7) * step, step - 1.6, step - 1.6, w.days[key]?.turns ?? 0, most)
    if (key.endsWith('-01')) svg += `<text class="t faint" x="${n(24 + col * step)}" y="${n(y + 7 * step + 9)}" font-size="9">${esc(t().months[Number(key.slice(5, 7)) - 1] ?? '')}</text>`
  }
  return { svg, height: Math.round(7 * step + 14) }
}

/** A month or a year wrapped up, to share: Mochi in the best it has earned, the work in figures, every day as a cell. */
export function wrappedSvg(w: Wrapped, outfit: Outfit): string {
  const d = t().share
  const x = 176
  const room = CARD_W - 24 - x
  const col = room / 3
  const hours = Math.round(w.total.secs / 3600)
  const stats: [string, string][] = [
    [w.total.secs > 0 && hours === 0 ? '<1' : thousands(hours), d.hours], [thousands(w.total.turns), t().detail.stats.turns], [thousands(w.total.edits), t().detail.stats.edits],
    [thousands(w.total.commits), d.commits], [String(w.activeDays), d.activeDays], [String(w.longest), d.longest],
  ]
  const days = strip(w, 202)
  const y = 202 + days.height
  const H = y + 64
  const busiest = w.busiest
    ? d.busiest(d.date(t().months[Number(w.busiest.day.slice(5, 7)) - 1] ?? '', Number(w.busiest.day.slice(8, 10))), w.busiest.turns)
    : d.quiet
  return open(CARD_W, H, `Mochi · ${periodTitle(w.key)}`) +
    // A quiet period finds Mochi asleep.
    mascot(w.activeDays > 0 ? 'party' : 'sleeping', outfit, 4, 14, 160) +
    `<text class="t dim" x="${x}" y="38" font-size="10.5" font-weight="650" letter-spacing="1.1">${esc(d.wrapped)}</text>` +
    `<text class="t fg" x="${x}" y="66" font-size="24" font-weight="700">${esc(periodTitle(w.key))}</text>` +
    (w.top ? `<text class="t dim" x="${x}" y="88" font-size="12">${esc(clip(d.most(w.top), Math.floor(room / 6.4)))}</text>` : '') +
    stats.map(([v, label], i) => stat(v, label, x + col * (i % 3), 122 + Math.floor(i / 3) * 42, col - 8)).join('') +
    days.svg +
    `<text class="t dim" x="24" y="${y + 22}" font-size="11.5">${esc(clip(busiest, 76))}</text>` +
    `<text class="t dim" x="24" y="${H - 16}" font-size="10.5" font-weight="600">${esc(d.tagline)}</text>` +
    `<text class="t faint" x="${CARD_W - 24}" y="${H - 16}" font-size="10" text-anchor="end">${REPO}</text>` +
    '</svg>'
}

// ---------- the snapshot ----------

/** A drawing of the band or the pane given its own size and the cards' background, to be seen on its own page. */
export const framed = (svg: string, w: number, h: number) =>
  svg.replace('width="100%" height="100%"', `width="${w}" height="${n(h)}"`).replace('</style>', `</style>${BG}<rect class="bg" x="0.5" y="0.5" width="${w - 1}" height="${n(h - 1)}" rx="16"/>`)
