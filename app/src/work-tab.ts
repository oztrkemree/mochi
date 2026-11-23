import { lang } from '../../hooks/i18n'
import { type Effort, type Project, type Sum, peakOf, sumOf } from './effort'
import { words } from './words'

/**
 * The room's Work tab: where the agents' time went, by project. A river of the days (one stream a project), the
 * projects as a ledger, the busiest day as lanes of chats side by side, when the work happens, and what it came to.
 * Drawn afresh on each change; the hover over the river only moves its tip.
 */

export const PERIODS = [7, 30, 42] as const
const INKS = ['#E27A52', '#F2B84B', '#5FB3F0', '#B794F6', '#F07CB8', '#4CC3A0']
const OTHER_INK = '#8C7B70'
const UNMATCHED_INK = '#6E615A'

export type Band = { key: string; name: string; ink: string; daily: Sum[] }

const zero = (): Sum => ({ secs: 0, commits: 0, add: 0, del: 0, cost: 0, night: 0, turns: 0 })
const total = (p: Project) => p.daily.reduce((s, d) => s + d.secs, 0)

/**
 * The river's streams: the six projects with the most time over all the days shown, each in its own ink (kept as the
 * stretch changes), the rest and the chats with no project as one stream.
 */
export function bandsOf(e: Effort): Band[] {
  const ranked = e.projects.filter(p => total(p) > 0)
  const own = ranked.slice(0, INKS.length).map((p, i) => ({ key: p.name, name: p.name, ink: INKS[i]!, daily: p.daily }))
  const rest = [...ranked.slice(INKS.length), e.unmatched]
  const daily = e.days.map((_, i) => {
    const s = zero()
    for (const p of rest) for (const f of Object.keys(s) as (keyof Sum)[]) s[f] += p.daily[i]![f]
    return s
  })
  const hasRest = daily.some(d => d.secs > 0)
  const others = ranked.length - own.length
  const name = others > 0 ? words().work.others(others) : words().work.unmatched
  return hasRest ? [...own, { key: '', name, ink: others > 0 ? OTHER_INK : UNMATCHED_INK, daily }] : own
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const r1 = (n: number) => Math.round(n * 10) / 10

/** A Catmull-Rom run through the points as cubic curves, from the first point on (no move). */
function curve(p: [number, number][]): string {
  let d = ''
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[i + 2] ?? p2
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)},${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)},${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])},${r1(p2[1])}`
  }
  return d
}

/** How long, as the person's language says it: minutes under an hour, else hours with one decimal (whole past 100). */
export function spell(secs: number): string {
  const w = words().work
  const m = secs / 60
  if (m < 60) return w.mins(new Intl.NumberFormat(lang()).format(Math.round(m)))
  const h = m / 60
  return w.hours(new Intl.NumberFormat(lang(), { maximumFractionDigits: h < 100 ? 1 : 0, minimumFractionDigits: h < 100 ? 1 : 0 }).format(h))
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}
const svg = (className: string, markup: string, label: string) => {
  const node = el('div', className)
  node.setAttribute('role', 'img')
  node.setAttribute('aria-label', label)
  // Drawn here from the person's own numbers; names are escaped.
  node.innerHTML = markup
  return node
}
/** A sentence with one part made to stand out: `{x}` in `text` becomes `part`, in bold. */
const sentence = (tag: 'h2' | 'p', className: string, text: string, token: string, part: string, ink = '') => {
  const node = el(tag, className)
  const [before = '', after = ''] = text.split(token)
  const b = el('b', '', part)
  if (ink) b.style.color = ink
  node.append(before, b, after)
  return node
}

export type WorkState = { period: number; focus: string | null }
/** The stretch last drawn: the river flows in only for a new one, not each time the room is read again on focus. */
let drawnPeriod = -1

/** The Work tab, drawn into `into`. `set` changes the state and draws again. */
export function drawWork(into: HTMLElement, e: Effort, st: WorkState, set: (st: WorkState) => void) {
  const w = words().work
  const nf = new Intl.NumberFormat(lang())
  const day = (key: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang(), { ...opts, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`))
  const n = e.days.length
  const span = Math.min(PERIODS[st.period] ?? 42, n)
  const from = n - span
  const bands = bandsOf(e)
  const sums = new Map(bands.map(b => [b.key, sumOf(b.daily, from)]))
  const all = zero()
  for (const s of sums.values()) for (const f of Object.keys(all) as (keyof Sum)[]) all[f] += s[f]
  const focusOn = (key: string) => () => set({ ...st, focus: st.focus === key ? null : key })
  const dim = (key: string) => st.focus !== null && st.focus !== key

  // The head: what it adds up to, and the stretch.
  const head = el('div', 'w-head')
  const text = el('div')
  const seg = el('div', 'seg w-seg')
  seg.setAttribute('role', 'group')
  w.periods.forEach((label, i) => {
    const b = el('button', '', label)
    b.type = 'button'
    b.setAttribute('aria-pressed', String(st.period === i))
    b.addEventListener('click', () => set({ ...st, period: i }))
    seg.append(b)
  })
  head.append(text, seg)
  into.append(head)
  if (all.secs <= 0) {
    text.append(el('p', 'w-empty', w.empty))
    return
  }
  const own = e.projects.map(p => ({ p, s: sumOf(p.daily, from) })).filter(x => x.s.secs > 0).sort((a, b) => b.s.secs - a.s.secs)
  const top = own[0] ?? null
  text.append(sentence('h2', 'w-lead', w.worked[st.period] ?? w.worked[2], '{h}', spell(all.secs)))
  if (top) {
    const ink = bands.find(b => b.key === top.p.name)?.ink ?? ''
    text.append(sentence('p', 'w-most', w.most(Math.round((top.s.secs / all.secs) * 100)), '{p}', top.p.name, ink))
  }
  text.append(el('p', 'w-sub', w.sub(nf.format(own.length), nf.format(all.turns), nf.format(all.commits))))

  // The river.
  const W = 800, H = 300, X0 = 14, X1 = 786, TOP = 44, BOT = 30, cy = TOP + (H - TOP - BOT) / 2
  const step = (X1 - X0) / Math.max(1, span - 1)
  const dayTot = Array.from({ length: span }, (_, j) => bands.reduce((s, b) => s + b.daily[from + j]!.secs, 0))
  const k = ((H - TOP - BOT) * 0.96) / Math.max(...dayTot, 3600)
  const order = [...bands].reverse()
  const cum = dayTot.map(() => 0)
  let paths = ''
  let glow = ''
  for (const b of order) {
    const at = (j: number) => cy + (dayTot[j]! * k) / 2 - cum[j]! * k
    const lo = dayTot.map((_, j): [number, number] => [X0 + j * step, at(j)])
    dayTot.forEach((_, j) => (cum[j] = cum[j]! + b.daily[from + j]!.secs))
    const up = dayTot.map((_, j): [number, number] => [X0 + j * step, at(j)])
    const back = [...lo].reverse()
    const d = `M${r1(up[0]![0])},${r1(up[0]![1])}${curve(up)} L${r1(back[0]![0])},${r1(back[0]![1])}${curve(back)} Z`
    const op = dim(b.key) ? 0.13 : 0.94
    glow += `<path d="${d}" fill="${b.ink}" opacity="${op}"/>`
    paths += `<path class="w-band" data-key="${esc(b.key)}" d="${d}" fill="${b.ink}" opacity="${op}"><title>${esc(b.name)} · ${esc(spell(sums.get(b.key)!.secs))}</title></path>`
    // A name goes where the stream is wide for three days running, not on a one-day spike.
    const th = (j: number) => lo[j]![1] - up[j]![1]
    let best = 0
    let bj = -1
    for (let j = 1; j < span - 1; j++) {
      const wide = Math.min(th(j - 1), th(j), th(j + 1))
      if (wide > best) [best, bj] = [wide, j]
    }
    if (bj > 0 && best >= 16 && b.name.length * 7 < step * 3) paths += `<text class="w-bl" x="${r1(up[bj]![0])}" y="${r1((up[bj]![1] + lo[bj]![1]) / 2 + 4)}">${esc(b.name)}</text>`
  }
  let ticks = ''
  for (let j = 0; j < span; j++) {
    const key = e.days[from + j]!
    const isMonday = new Date(`${key}T12:00:00Z`).getUTCDay() === 1
    const x = X0 + j * step
    if ((span <= 10 || isMonday) && x > X0 + 20 && x < X1 - 50) ticks += `<line class="w-grid" x1="${r1(x)}" x2="${r1(x)}" y1="${TOP - 10}" y2="${H - BOT + 4}"/><text class="w-ax" x="${r1(x)}" y="${H - 8}">${esc(day(key, { day: 'numeric', month: 'short' }))}</text>`
  }
  let jMax = 0
  dayTot.forEach((v, j) => (v > dayTot[jMax]! ? (jMax = j) : 0))
  const px = X0 + jMax * step, py = cy - (dayTot[jMax]! * k) / 2
  const isLeft = px > W * 0.55
  const peakText = `<line class="w-hair" x1="${r1(px)}" x2="${r1(px)}" y1="${r1(Math.max(10, py - 30))}" y2="${r1(py - 3)}"/><text class="w-pk${isLeft ? ' end' : ''}" x="${r1(isLeft ? px - 8 : px + 8)}" y="${r1(Math.max(22, py - 16))}">${esc(day(e.days[from + jMax]!, { day: 'numeric', month: 'short' }))} · ${esc(spell(dayTot[jMax]!))}</text>`
  const cols = dayTot.map((_, j) => `<rect data-j="${j}" x="${r1(X0 + j * step - step / 2)}" y="${TOP - 10}" width="${r1(step)}" height="${H - TOP - BOT + 14}" fill="transparent"/>`).join('')
  const river = el('div', drawnPeriod === st.period ? 'w-river' : 'w-river reveal')
  drawnPeriod = st.period
  const pic = svg('w-pic', `<svg viewBox="0 0 ${W} ${H}"><defs><filter id="w-glow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="12"/></filter><linearGradient id="w-fade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".6" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="w-mask"><rect width="${W}" height="${H}" fill="url(#w-fade)"/></mask></defs>${ticks}<g mask="url(#w-mask)"><g filter="url(#w-glow)" opacity=".5">${glow}</g>${paths}</g>${peakText}<line class="w-hov" x1="0" x2="0" y1="${TOP - 10}" y2="${H - BOT + 4}" visibility="hidden"/><text class="w-ax w-now" x="${X1}" y="${H - 8}">${esc(w.today)}</text>${cols}</svg>`, `${w.cols.time} · ${w.projects}`)
  const tip = el('div', 'w-tip')
  tip.hidden = true
  river.append(pic, tip)
  const hov = pic.querySelector<SVGLineElement>('.w-hov')!
  pic.addEventListener('mouseover', ev => {
    const j = Number((ev.target as Element).getAttribute('data-j'))
    if (!Number.isInteger(j) || (ev.target as Element).tagName !== 'rect') return
    const x = X0 + j * step
    hov.setAttribute('x1', String(x))
    hov.setAttribute('x2', String(x))
    hov.setAttribute('visibility', 'visible')
    tip.replaceChildren()
    const top = el('div', 'w-tip-top')
    top.append(el('b', '', day(e.days[from + j]!, { weekday: 'long', day: 'numeric', month: 'long' })), el('span', '', spell(dayTot[j]!)))
    tip.append(top)
    const rows = bands.map(b => ({ b, secs: b.daily[from + j]!.secs })).filter(r => r.secs > 0).sort((a, b) => b.secs - a.secs)
    if (!rows.length) tip.append(el('div', 'w-tip-row', w.quiet))
    for (const r of rows) {
      const row = el('div', 'w-tip-row')
      const dot = el('i')
      dot.style.background = r.b.ink
      row.append(dot, el('span', '', r.b.name), el('b', '', spell(r.secs)))
      tip.append(row)
    }
    tip.style.left = `${(x / W) * 100}%`
    tip.classList.toggle('flip', x > W * 0.6)
    tip.hidden = false
  })
  pic.addEventListener('mouseleave', () => {
    tip.hidden = true
    hov.setAttribute('visibility', 'hidden')
  })
  // The day columns lie over the streams for the hover: a press finds the stream beneath them.
  pic.addEventListener('click', ev => {
    const key = document.elementsFromPoint(ev.clientX, ev.clientY).find(n => n.classList.contains('w-band'))?.getAttribute('data-key')
    if (key !== null && key !== undefined) focusOn(key)()
  })
  into.append(river)
  const chips = el('div', 'w-chips')
  for (const b of bands.filter(b => sums.get(b.key)!.secs > 0)) {
    const c = el('button', 'w-chip')
    c.type = 'button'
    c.setAttribute('aria-pressed', String(st.focus === b.key))
    const dot = el('i')
    dot.style.background = b.ink
    c.append(dot, b.name, el('small', '', spell(sums.get(b.key)!.secs)))
    c.addEventListener('click', focusOn(b.key))
    chips.append(c)
  }
  into.append(chips)

  // The ledger.
  const ledger = el('section', 'w-sec')
  ledger.append(el('h3', '', w.projects), el('p', 'w-hint', w.projectsHint))
  const hasCost = all.cost > 0
  const grid = el('div', `w-ledger${hasCost ? ' cost' : ''}`)
  const cols6 = [w.cols.project, w.cols.time, w.cols.weeks, w.cols.commits, w.cols.lines, ...(hasCost ? [w.cols.cost] : [])]
  const headRow = el('div', 'w-row w-row-head')
  cols6.forEach(c => headRow.append(el('span', '', c)))
  grid.append(headRow)
  const shown = own.slice(0, 8)
  const rest = own.slice(8)
  const inkOf = (name: string) => bands.find(b => b.key === name)?.ink ?? OTHER_INK
  const maxSecs = Math.max(1, ...own.map(x => x.s.secs), sumOf(e.unmatched.daily, from).secs)
  const weekMax = Math.max(1, ...e.projects.flatMap(p => [0, 1, 2, 3, 4, 5].map(i => sumOf(p.daily.slice(n - 42 + i * 7, n - 42 + i * 7 + 7), 0).secs)))
  const rowOf = (name: string, key: string | null, ink: string, s: Sum, daily: Sum[] | null, tag: string) => {
    const row = el(key === null ? 'div' : 'button', `w-row${key !== null && st.focus === key ? ' on' : ''}${key !== null && dim(key) ? ' dim' : ''}`)
    if (row instanceof HTMLButtonElement && key !== null) {
      row.type = 'button'
      row.setAttribute('aria-pressed', String(st.focus === key))
      row.addEventListener('click', focusOn(key))
    }
    const nameCell = el('span', 'w-name')
    const dot = el('i')
    dot.style.background = ink
    nameCell.append(dot, el('b', '', name))
    if (tag) nameCell.append(el('small', '', tag))
    const time = el('span', 'w-time')
    const track = el('span', 'w-track')
    const fill = el('span')
    fill.style.width = `${(s.secs / maxSecs) * 100}%`
    fill.style.background = ink
    track.append(fill)
    time.append(track, el('b', '', spell(s.secs)), el('small', '', `${Math.round((s.secs / all.secs) * 100)}%`))
    const weeks = el('span', 'w-weeks')
    if (daily) {
      for (let i = 0; i < 6; i++) {
        const secs = sumOf(daily.slice(n - 42 + i * 7, n - 42 + i * 7 + 7), 0).secs
        const bar = el('i')
        bar.style.height = `${secs > 0 ? Math.max(3, Math.round(Math.sqrt(secs / weekMax) * 26)) : 2}px`
        bar.style.background = ink
        bar.style.opacity = secs > 0 ? '0.9' : '0.18'
        bar.title = spell(secs)
        weeks.append(bar)
      }
    }
    const lines = el('span', 'w-lines')
    lines.append(el('em', 'add', `+${nf.format(s.add)}`), ' ', el('em', 'del', `−${nf.format(s.del)}`))
    row.append(nameCell, time, weeks, el('span', 'w-num', nf.format(s.commits)), lines)
    if (hasCost) row.append(el('span', 'w-num', `$${nf.format(Math.round(s.cost))}`))
    return row
  }
  for (const { p, s } of shown) grid.append(rowOf(p.name, inkOf(p.name) === OTHER_INK ? null : p.name, inkOf(p.name), s, p.daily, p.folders.length ? w.folders(p.folders.length) : ''))
  if (rest.length) {
    const s = zero()
    for (const x of rest) for (const f of Object.keys(s) as (keyof Sum)[]) s[f] += x.s[f]
    grid.append(rowOf(w.others(rest.length), null, OTHER_INK, s, null, ''))
  }
  const lost = sumOf(e.unmatched.daily, from)
  if (lost.secs > 0) grid.append(rowOf(w.unmatched, null, UNMATCHED_INK, lost, e.unmatched.daily, w.folders(e.unmatched.folders.length)))
  const scroll = el('div', 'w-scroll')
  scroll.append(grid)
  ledger.append(scroll)
  if (lost.secs > 0) ledger.append(el('p', 'w-note', w.unmatchedLine(e.unmatched.folders.length, spell(lost.secs))))
  into.append(ledger)

  // Two clocks: the busiest day's chats side by side.
  const peak = peakOf(e, from)
  if (peak) {
    const sec = el('section', 'w-sec')
    const dayLong = day(peak.day, { day: 'numeric', month: 'long' })
    sec.append(el('h3', '', w.peak), el('p', 'w-hint', w.peakLine(dayLong, spell(peak.longest), spell(peak.total))))
    const lanes = peak.lanes.slice(0, 8)
    const LX = 170, LW = 620, rowH = 30
    const most = Math.max(...lanes.map(l => l.chats.reduce((s, c) => s + c, 0)))
    let m = ''
    let isLongestDrawn = false
    lanes.forEach((l, r) => {
      const y = 8 + r * rowH
      m += `<text class="w-lane" x="0" y="${y + 13}">${esc(l.label.length > 18 ? `${l.label.slice(0, 17)}…` : l.label)}</text><text class="w-lanec" x="${LX - 10}" y="${y + 13}">${esc(w.chats(l.chats.length))}</text><rect x="${LX}" y="${y}" width="${LW}" height="17" rx="3" fill="rgba(255,236,222,.035)"/>`
      let x = LX
      for (const c of l.chats) {
        const wd = Math.max(1.3, (c / most) * LW - 1.5)
        // The longest chat in gold, as in the bars below.
        const isLongest = !isLongestDrawn && c === peak.longest
        if (isLongest) isLongestDrawn = true
        m += `<rect x="${r1(x)}" y="${y}" width="${r1(wd)}" height="17" rx="2" fill="${isLongest ? '#F2B84B' : '#E27A52'}" opacity="${c < 180 ? 0.45 : 0.95}"/>`
        x += wd + 1.5
      }
    })
    const hh = 8 + lanes.length * rowH
    sec.append(svg('w-pic', `<svg viewBox="0 0 800 ${hh}">${m}</svg>`, w.peak))
    if (peak.lanes.length > lanes.length) sec.append(el('p', 'w-note', w.moreLanes(peak.lanes.length - lanes.length)))
    const cmp = el('div', 'w-cmp')
    for (const [label, secs, ink] of [[w.longest, peak.longest, '#F2B84B'], [w.together, peak.total, '#E27A52']] as const) {
      const track = el('span', 'w-track big')
      const fill = el('span')
      fill.style.width = `${(secs / peak.total) * 100}%`
      fill.style.background = ink
      fill.style.boxShadow = `0 0 18px ${ink}88`
      track.append(fill)
      cmp.append(el('span', '', label), track, el('b', '', spell(secs)))
    }
    sec.append(cmp, el('p', 'w-note', w.lanesNote))
    into.append(sec)
  }

  // When, and what it came to.
  const pair = el('div', 'w-pair')
  const when = el('section', 'w-sec')
  when.append(el('h3', '', w.when), el('p', 'w-hint', w.whenHint))
  const cal = el('div', 'w-cal')
  const lead = (new Date(`${e.days[0]}T12:00:00Z`).getUTCDay() + 6) % 7
  const dayAll = e.days.map((_, i) => bands.reduce((s, b) => s + b.daily[i]!.secs, 0))
  const calMax = Math.max(1, ...dayAll)
  for (let i = 0; i < lead; i++) cal.append(el('i', 'blank'))
  e.days.forEach((key, i) => {
    const c = el('i')
    const v = dayAll[i]!
    c.style.background = v > 0 ? `rgba(226,122,82,${(0.16 + 0.84 * Math.sqrt(v / calMax)).toFixed(2)})` : 'rgba(255,236,222,.045)'
    if (i < from) c.style.opacity = '0.3'
    if (i === n - 1) c.className = 'today'
    c.title = `${day(key, { day: 'numeric', month: 'short' })} · ${spell(v)}`
    cal.append(c)
  })
  const wk = [0, 0, 0, 0, 0, 0, 0]
  for (let i = from; i < n; i++) wk[(new Date(`${e.days[i]}T12:00:00Z`).getUTCDay() + 6) % 7] += dayAll[i]!
  const wkMax = Math.max(1, ...wk)
  const week = el('div', 'w-week')
  wk.forEach((secs, i) => {
    const col = el('div')
    const bar = el('i')
    bar.style.height = `${Math.max(3, Math.round((secs / wkMax) * 56))}px`
    if (secs === wkMax) bar.className = 'top'
    // 2026-11-23 was a Monday: its weekday names the column.
    col.append(el('small', '', secs > 0 ? nf.format(Math.round(secs / 3600)) : '0'), bar, el('span', '', day(`2026-11-${23 + i}`, { weekday: 'short' })))
    week.append(col)
  })
  when.append(cal, week)
  if (all.turns > 0) when.append(el('p', 'w-night', w.night(Math.round((all.night / all.turns) * 100))))
  const result = el('section', 'w-sec')
  result.append(el('h3', '', w.result), el('p', 'w-hint', w.resultHint))
  const dots = bands.map(b => ({ b, s: sums.get(b.key)! })).filter(x => x.s.secs > 0)
  const nice = (v: number) => {
    const p = 10 ** Math.floor(Math.log10(Math.max(v, 1)))
    return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(s => v <= s * p) ?? 10) * p
  }
  const xMax = nice(Math.max(...dots.map(d => d.s.secs / 3600)))
  const yMax = nice(Math.max(1, ...dots.map(d => d.s.commits)))
  const cMax = Math.max(0, ...dots.map(d => d.s.cost))
  const SX0 = 44, SX1 = 370, SY0 = 220, SY1 = 22
  let sc = ''
  const placed: [number, number][] = []
  for (let i = 0; i <= 4; i++) {
    const y = SY0 - ((SY0 - SY1) * i) / 4
    sc += `<line class="w-grid" x1="${SX0}" x2="${SX1}" y1="${r1(y)}" y2="${r1(y)}"/><text class="w-ax end" x="${SX0 - 8}" y="${r1(y + 4)}">${esc(nf.format(Math.round((yMax * i) / 4)))}</text><text class="w-ax" x="${r1(SX0 + ((SX1 - SX0) * i) / 4)}" y="${SY0 + 18}">${esc(nf.format(r1((xMax * i) / 4)))}</text>`
  }
  sc += `<text class="w-ax end" x="${SX1}" y="${SY0 + 34}">${esc(w.axisTime)}</text><text class="w-ax start" x="${SX0}" y="10">${esc(w.axisCommits)}</text>`
  for (const { b, s } of [...dots].sort((a, b) => b.s.cost - a.s.cost || b.s.secs - a.s.secs)) {
    const x = SX0 + (s.secs / 3600 / xMax) * (SX1 - SX0), y = SY0 - (s.commits / yMax) * (SY0 - SY1)
    const r = cMax > 0 ? 5 + 22 * Math.sqrt(s.cost / cMax) : 7
    const isEnd = x + r + 8 + b.name.length * 6.5 > 380
    sc += `<circle class="w-band" data-key="${esc(b.key)}" cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${b.ink}" opacity="${dim(b.key) ? 0.15 : 0.82}"><title>${esc(`${b.name} · ${spell(s.secs)} · ${nf.format(s.commits)}`)}</title></circle>`
    const lx = isEnd ? x - r - 6 : x + r + 6
    // A name only where it reads: worth naming, and clear of the names already placed.
    const isClear = placed.every(([px, py]) => Math.abs(py - y) > 14 || Math.abs(px - lx) > 70)
    if ((s.secs / 3600 >= xMax * 0.08 || s.commits >= yMax * 0.12) && isClear) {
      placed.push([lx, y])
      sc += `<text class="w-dl${isEnd ? ' end' : ''}" x="${r1(lx)}" y="${r1(y + 4)}">${esc(b.name)}</text>`
    }
  }
  const scatter = svg('w-pic', `<svg viewBox="0 0 380 260">${sc}</svg>`, w.result)
  scatter.addEventListener('click', ev => {
    const key = (ev.target as Element).closest?.('.w-band')?.getAttribute('data-key')
    if (key !== null && key !== undefined) focusOn(key)()
  })
  result.append(scatter)
  pair.append(when, result)
  into.append(pair)
}
