import type { DayRec } from '../types'
import { shiftDay } from './facts'
import { lang, t } from './i18n'
import { clip, rtlStyle } from './text'

// The code city: the last four weeks as a small isometric city, a building
// a day. How tall it stands is how much was asked that day, its lit windows
// the commits, a moon over it work late at night; a day with nothing is a
// park, today a building site with its crane, the busiest day flies a flag.
// The sky is the hour's, and cars run along the road in front.

const n = (v: number) => String(Math.round(v * 100) / 100)
const esc = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const COLS = 7
const ROWS = 4
/** The road in front of the city, in tiles. */
const ROAD = 0.55

/** A colour between two, `k` of the way. */
function mix(a: string, b: string, k: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2].map(i => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, '0')).join('')}`
}
/** A colour darker (`f` under 1) or lighter (over 1). */
const shade = (hex: string, f: number) => (f < 1 ? mix(hex, '#000000', 1 - f) : mix(hex, '#ffffff', f - 1))

/** The same small numbers every time for the same seed. */
function dice(seed: number) {
  let r = Math.floor(Math.abs(seed)) % 2147483647 || 1
  return () => (r = (r * 48271) % 2147483647) / 2147483647
}

type Sky = { top: string; bottom: string; ink: string; dim: string; isNight: boolean; glow: string }
/** The sky at a local hour: night, dawn or dusk, or day; with the inks that read on it. */
function skyAt(hour: number): Sky {
  if (hour >= 21 || hour < 6) return { top: '#0E1428', bottom: '#28325A', ink: '#F2F1EE', dim: '#A9B0C8', isNight: true, glow: '#FFD36B' }
  if (hour >= 18 || hour < 8) return { top: '#2C2350', bottom: '#E3926E', ink: '#FFF6EE', dim: '#F1D3C4', isNight: false, glow: '#FFD9A0' }
  return { top: '#A9D4F2', bottom: '#EAF5FC', ink: '#1F2A3A', dim: '#4E5F75', isNight: false, glow: '#FFE7A3' }
}

/** A day's short weekday name in the language in use (Mon, Pzt…), from its key. */
function weekday(key: string): string {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(lang(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
  } catch {
    return ''
  }
}

/** Monday as 0, Sunday as 6, of a day's key. */
const dayOfWeek = (key: string) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7

/**
 * The city, `w` wide, for `today` (a local day's key) at a local `hour`.
 * Buildings rise one after another when it first shows (the caller moves the
 * drawing on by the time since, as each redraw rebuilds it); the rest loops.
 */
export function citySvg(days: Record<string, DayRec>, today: string, hour: number, w: number): { svg: string; height: number } {
  const full = drawCity(days, today, hour, w, true)
  // A drawing goes to the desktop at 131072 characters at most: a city of busy days drops its dark windows first.
  return full.svg.length <= SVG_MAX ? full : drawCity(days, today, hour, w, false)
}

/** What the desktop takes of one drawing, with room to spare. */
const SVG_MAX = 120_000

function drawCity(days: Record<string, DayRec>, today: string, hour: number, w: number, hasDark: boolean): { svg: string; height: number } {
  const c = t().city
  const W = Math.max(320, Math.round(w))
  const sky = skyAt(hour)
  const monday = shiftDay(today, -dayOfWeek(today))
  const keyAt = (col: number, row: number) => shiftDay(monday, (row - (ROWS - 1)) * 7 + col)
  const keys = Array.from({ length: ROWS * COLS }, (_, i) => keyAt(i % COLS, Math.floor(i / COLS)))
  const recs = keys.map(k => days[k])
  const maxTurns = Math.max(1, ...recs.map(r => r?.turns ?? 0))
  const busiest = keys.find(k => (days[k]?.turns ?? 0) === maxTurns && maxTurns > 1) ?? ''

  // ---- the grid, seen from above at an angle ----
  const tw = Math.min(104, ((W - 36) * 2) / (COLS + ROWS + ROAD))
  const th = tw / 2
  const maxH = Math.min(150, tw * 1.55)
  const head = 58
  const ox = W / 2 + ((ROWS + ROAD - COLS) * tw) / 4
  const heightOf = (key: string) => Math.max(10, 8 + (maxH - 8) * Math.sqrt((days[key]?.turns ?? 0) / maxTurns))
  // As high as the tallest roof (with its flag or crane) needs, and no higher.
  const reach = Math.max(0, ...keys.map((key, i) => {
    const rec = days[key]
    if (key > today || ((rec?.turns ?? 0) === 0 && key !== today)) return 0
    const above = key === busiest ? 34 : key === today ? 40 : 12
    return ((rec?.turns ?? 0) > 0 ? heightOf(key) : 0) + above - ((i % COLS) + Math.floor(i / COLS) + 1) * (th / 2)
  }))
  const oy = head + 8 + reach
  const iso = (gx: number, gy: number): [number, number] => [ox + ((gx - gy) * tw) / 2, oy + ((gx + gy) * th) / 2]
  const H = Math.round(iso(COLS, ROWS + ROAD)[1] + 48)
  const pts = (list: [number, number][]) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')

  // ---- the sky ----
  const roll = dice(Number(today.replaceAll('-', '')))
  const stars = sky.isNight
    ? Array.from({ length: 26 }, (_, i) => {
      const x = roll() * W, y = 8 + roll() * (oy - maxH * 0.4)
      return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(0.6 + roll() * 0.9)}" fill="#fff" opacity="${n(0.4 + roll() * 0.5)}">` +
        (i % 4 === 0 ? `<animate attributeName="opacity" values="0.9;0.2;0.9" dur="${n(2 + roll() * 3)}s" repeatCount="indefinite"/>` : '') + '</circle>'
    }).join('') + `<circle cx="${n(W - 46)}" cy="34" r="13" fill="#F4EBD0"/><circle cx="${n(W - 40)}" cy="30" r="11" fill="${sky.top}"/>`
    : [0, 1].map(i => {
      const y = 22 + i * 26, x = (i * 0.55 + 0.15) * W
      return `<g opacity="${sky.ink === '#1F2A3A' ? 0.9 : 0.45}"><animateTransform attributeName="transform" type="translate" values="-30 0;30 0;-30 0" dur="${40 + i * 14}s" repeatCount="indefinite"/>` +
        `<ellipse cx="${n(x)}" cy="${y}" rx="26" ry="8" fill="#fff"/><ellipse cx="${n(x + 14)}" cy="${y - 5}" rx="14" ry="8" fill="#fff"/><ellipse cx="${n(x - 12)}" cy="${y - 3}" rx="11" ry="6" fill="#fff"/></g>`
    }).join('')
  const backdrop = `<defs><linearGradient id="citysky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bottom}"/></linearGradient>` +
    '</defs>' +
    `<rect x="0" y="0" width="${W}" height="${H}" rx="16" fill="url(#citysky)"/>${stars}`

  // ---- the ground: a slab with the road along its front ----
  const plate = [iso(0, 0), iso(COLS, 0), iso(COLS, ROWS + ROAD), iso(0, ROWS + ROAD)] as [number, number][]
  const drop = (p: [number, number], d: number): [number, number] => [p[0], p[1] + d]
  const ground = sky.isNight ? '#2E3A3A' : '#8FB98A'
  const slab = `<polygon points="${pts([plate[3]!, plate[2]!, drop(plate[2]!, 12), drop(plate[3]!, 12)])}" fill="${shade(ground, 0.62)}"/>` +
    `<polygon points="${pts([plate[1]!, plate[2]!, drop(plate[2]!, 12), drop(plate[1]!, 12)])}" fill="${shade(ground, 0.48)}"/>` +
    `<polygon points="${pts(plate)}" fill="${ground}"/>` +
    `<polygon points="${pts([iso(0, ROWS), iso(COLS, ROWS), iso(COLS, ROWS + ROAD), iso(0, ROWS + ROAD)])}" fill="${sky.isNight ? '#2A2D36' : '#5E636E'}"/>` +
    `<line x1="${n(iso(0, ROWS + ROAD / 2)[0])}" y1="${n(iso(0, ROWS + ROAD / 2)[1])}" x2="${n(iso(COLS, ROWS + ROAD / 2)[0])}" y2="${n(iso(COLS, ROWS + ROAD / 2)[1])}" stroke="#F2E6B8" stroke-width="1.2" stroke-dasharray="6 6" opacity="0.7"/>` +
    // The streets between the weeks.
    Array.from({ length: ROWS - 1 }, (_, i) => {
      const [x1, y1] = iso(0, i + 1), [x2, y2] = iso(COLS, i + 1)
      return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${shade(ground, 0.8)}" stroke-width="2"/>`
    }).join('')

  // ---- a building a day, back to front ----
  const LOW = '#7C89AD', HIGH = '#E0805E'
  let rising = 0
  const tiles = keys.map((key, i) => ({ key, col: i % COLS, row: Math.floor(i / COLS) })).sort((a, b) => a.col + a.row - (b.col + b.row) || a.row - b.row)
  const blocks = tiles.map(({ key, col, row }) => {
    const rec = days[key]
    const [x, y] = iso(col + 0.5, row + 0.5)
    const a = (tw / 2) * 0.6, b = (th / 2) * 0.6
    const isFuture = key > today
    const isToday = key === today
    const turns = rec?.turns ?? 0
    const at = `translate(${n(x)} ${n(y)})`
    if (isFuture) {
      return `<polygon transform="${at}" points="${pts([[0, -b], [a, 0], [0, b], [-a, 0]])}" fill="none" stroke="${sky.dim}" stroke-opacity="0.45" stroke-dasharray="3 3"/>`
    }
    if (turns === 0 && !isToday) {
      // A park: grass and two trees.
      const r = dice(Number(key.replaceAll('-', '')))
      const tree = (dx: number, dy: number, s: number) => `<rect x="${n(dx - 1)}" y="${n(dy - 7 * s)}" width="2" height="${n(7 * s)}" fill="#6B4E36"/>` +
        `<circle cx="${n(dx)}" cy="${n(dy - 9 * s)}" r="${n(5.5 * s)}" fill="${sky.isNight ? '#2F5E45' : '#4E9A5E'}"/><circle cx="${n(dx - 1.5 * s)}" cy="${n(dy - 10.5 * s)}" r="${n(2.2 * s)}" fill="#fff" opacity="0.18"/>`
      return `<g transform="${at}"><polygon points="${pts([[0, -b], [a, 0], [0, b], [-a, 0]])}" fill="${sky.isNight ? '#355845' : '#7FC07A'}"/>` +
        tree(-a * 0.35, -b * 0.1, 0.9 + r() * 0.3) + tree(a * 0.3, b * 0.25, 1 + r() * 0.3) + '</g>'
    }
    const h = heightOf(key)
    const base = mix(LOW, HIGH, Math.sqrt(turns / maxTurns))
    const night = sky.isNight ? 0.72 : 1
    const left = shade(base, 0.86 * night), right = shade(base, 0.68 * night), top = shade(base, 1.12 * night)
    // Windows on both walls, in floors: lit as many as the day's commits ask, a few twinkling.
    const r = dice(Number(key.replaceAll('-', '')) * 7)
    const floors = Math.max(1, Math.min(16, Math.floor((h - 8) / 8)))
    const lit = (rec?.commits ?? 0) === 0 ? 0 : Math.min(0.92, 0.18 + Math.sqrt(rec?.commits ?? 0) / 11)
    // One window shape a wall, used again and again, so a city of tall days stays small; the lit ones glow together.
    const lit0: string[] = [], dark: string[] = [], twinkles: string[] = []
    for (const side of [-1, 1] as const) {
      for (let f = 0; f < floors; f++) {
        for (const u of [0.28, 0.62]) {
          const use = `<use href="#w${side < 0 ? 'l' : 'r'}" x="${n(side * a * (1 - u))}" y="${n(b * u - 6 - f * 8)}"`
          if (r() >= lit) { if (hasDark) dark.push(`${use} fill="${shade(side < 0 ? left : right, 0.7)}"/>`) }
          else if (r() < 0.12) twinkles.push(`${use}><animate attributeName="opacity" values="1;0.35;1" dur="${n(3 + r() * 4)}s" begin="${n(r() * 3)}s" repeatCount="indefinite"/></use>`)
          else lit0.push(`${use}/>`)
        }
      }
    }
    const windows = dark.join('') + `<g fill="${sky.glow}"${sky.isNight ? ' filter="url(#winglow)"' : ''}>${lit0.join('')}${twinkles.join('')}</g>`
    const walls = `<polygon points="${pts([[-a, 0], [0, b], [0, b - h], [-a, -h]])}" fill="${left}"/>` +
      `<polygon points="${pts([[0, b], [a, 0], [a, -h], [0, b - h]])}" fill="${right}"/>` +
      `<polygon points="${pts([[0, -b - h], [a, -h], [0, b - h], [-a, -h]])}" fill="${top}"/>` +
      `<polygon points="${pts([[0, -b - h + 2.5], [a - 4, -h], [0, b - h - 2.5], [-a + 4, -h]])}" fill="${shade(top, 0.92)}"/>`
    // A moon over a day worked late at night; a flag on the busiest; a crane over today.
    const moon = (rec?.night ?? 0) > 0 ? `<g transform="translate(${n(-a * 0.3)} ${n(-h - b - 9)})"><circle r="4.2" fill="#F4EBD0"/><circle cx="2" cy="-1.4" r="3.6" fill="${top}"/></g>` : ''
    const flag = key === busiest
      ? `<g transform="translate(0 ${n(-h - 2)})"><rect x="-0.8" y="-22" width="1.6" height="22" fill="#D9D6CF"/>` +
        `<path d="M0.8 -22L15 -18L0.8 -14Z" fill="#F0645A"><animateTransform attributeName="transform" type="skewY" values="0;-6;0;5;0" dur="2.4s" repeatCount="indefinite"/></path>` +
        `<text x="0" y="-27" font-size="10" font-weight="700" fill="${sky.ink}" text-anchor="middle" class="t">${esc(c.record(turns))}</text></g>`
      : ''
    const crane = isToday
      ? `<g transform="translate(${n(a * 0.55)} ${n(-h)})"><rect x="-1.2" y="-34" width="2.4" height="34" fill="#F2B84B"/>` +
        `<g><animateTransform attributeName="transform" type="rotate" values="-8 0 -34;10 0 -34;-8 0 -34" dur="7s" repeatCount="indefinite"/>` +
        `<rect x="-26" y="-36" width="38" height="2.4" fill="#F2B84B"/><rect x="-26" y="-34" width="6" height="5" fill="#8A8984"/>` +
        `<line x1="9" y1="-34" x2="9" y2="-20" stroke="#D9D6CF" stroke-width="0.8"><animate attributeName="y2" values="-20;-12;-20" dur="5s" repeatCount="indefinite"/></line></g></g>`
      : ''
    const body = turns === 0
      ? `<polygon points="${pts([[0, -b], [a, 0], [0, b], [-a, 0]])}" fill="#C9B58E" opacity="0.7"/><polygon points="${pts([[0, -b], [a, 0], [0, b], [-a, 0]])}" fill="none" stroke="#F2B84B" stroke-dasharray="3 2"/>`
      : walls + windows + moon + flag
    // Rising from the ground at its turn, from the start of the drawing.
    const wait = Math.min(1.6, rising++ * 0.05)
    const dur = wait + 0.6
    const k = n(wait / dur)
    return `<g transform="${at}"><g><animateTransform attributeName="transform" type="scale" values="1 0;1 0;1 1" keyTimes="0;${k};1" dur="${n(dur)}s" calcMode="spline" keySplines="0 0 1 1;0.2 0.9 0.3 1.15"/>${body}${crane}</g></g>`
  }).join('')

  // ---- cars on the road ----
  const lane = (gy: number, dir: 1 | -1, i: number) => {
    const [x1, y1] = iso(dir > 0 ? -0.3 : COLS + 0.3, gy), [x2, y2] = iso(dir > 0 ? COLS + 0.3 : -0.3, gy)
    const inks = ['#F0645A', '#7AA2F7', '#FFD36B', '#73DACA']
    const dur = 9 + i * 2.5
    return `<g clip-path="url(#roadclip)"><g><animateTransform attributeName="transform" type="translate" values="${n(x1)} ${n(y1)};${n(x2)} ${n(y2)}" dur="${n(dur)}s" begin="${n(-i * 3.1)}s" repeatCount="indefinite"/>` +
      `<g transform="rotate(${dir > 0 ? 26.57 : 26.57})"><rect x="-6" y="-2.6" width="12" height="5.2" rx="1.6" fill="${inks[i % inks.length]}"/><rect x="-2" y="-2" width="5" height="4" rx="1" fill="#fff" opacity="0.5"/>` +
      (sky.isNight ? `<circle cx="${dir > 0 ? 6.5 : -6.5}" cy="0" r="1.6" fill="#FFF3C4" filter="url(#winglow)"/>` : '') + '</g></g></g>'
  }
  const road = `<clipPath id="roadclip"><polygon points="${pts([iso(0, ROWS), iso(COLS, ROWS), iso(COLS, ROWS + ROAD), iso(0, ROWS + ROAD)])}"/></clipPath>` +
    lane(ROWS + ROAD * 0.3, 1, 0) + lane(ROWS + ROAD * 0.3, 1, 2) + lane(ROWS + ROAD * 0.7, -1, 1) + lane(ROWS + ROAD * 0.7, -1, 3)

  // ---- weekday names along the front, and the words ----
  const names = Array.from({ length: COLS }, (_, col) => {
    const [x, y] = iso(col + 0.5, ROWS + ROAD)
    return `<text class="t" x="${n(x - 6)}" y="${n(y + 22)}" font-size="10" fill="${sky.dim}" text-anchor="middle">${esc(clip(weekday(keyAt(col, ROWS - 1)), 4))}</text>`
  }).join('')
  const total = recs.reduce((s, r) => ({ turns: s.turns + (r?.turns ?? 0), commits: s.commits + (r?.commits ?? 0), add: s.add + (r?.add ?? 0) }), { turns: 0, commits: 0, add: 0 })
  const words = `<text class="t" x="18" y="30" font-size="17" font-weight="750" fill="${sky.ink}">${esc(c.title)}</text>` +
    `<text class="t" x="18" y="48" font-size="11.5" fill="${sky.dim}">${esc(clip(c.sub(total.turns.toLocaleString(lang()), total.commits.toLocaleString(lang()), total.add.toLocaleString(lang())), Math.floor((W - 36) / 6.2)))}</text>` +
    `<text class="t" x="18" y="${H - 12}" font-size="10" fill="${sky.dim}" opacity="0.85">${esc(clip(c.legend, Math.floor((W - 36) / 5.6)))}</text>`

  // The two window shapes, one a wall: a slanted pane four high, its foot at the origin.
  const [wa, wb] = [(tw / 2) * 0.6 * 0.2, (th / 2) * 0.6 * 0.2]
  const panes = `<polygon id="wl" points="${pts([[0, 0], [wa, wb], [wa, wb - 4], [0, -4]])}"/><polygon id="wr" points="${pts([[0, 0], [-wa, wb], [-wa, wb - 4], [0, -4]])}"/>`
  const filters = `<defs>${panes}<clipPath id="cityclip"><rect x="0" y="0" width="${W}" height="${H}" rx="16"/></clipPath>` + '<filter id="winglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
  const style = '<style>.t{font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif}</style>'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMin meet">${style}${rtlStyle()}${filters}` +
    `<g clip-path="url(#cityclip)">${backdrop}${slab}${blocks}${road}${names}${words}</g></svg>`
  return { svg, height: H }
}
